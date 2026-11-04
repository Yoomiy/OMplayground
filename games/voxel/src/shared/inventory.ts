import type { ItemDefinition, Recipe, Stack } from './content.ts';
import { ingredientMatches } from './recipes.ts';

export const INVENTORY_VERSION = 2;
export const BAG_SLOTS = 36;
export const CHEST_SLOTS = 27;
export const EQUIPMENT = ['head', 'body', 'legs', 'feet', 'offhand'] as const;
export type EquipmentSlot = (typeof EQUIPMENT)[number];
export type Slot = Stack | null;
export type InventoryArea = 'bag' | 'craft2' | 'craft3' | 'equipment' | 'container';
export type SlotRef = Readonly<{ area: InventoryArea; slot: number }>;
export type InventoryCommand =
  | { kind: 'open'; target: readonly [number, number, number] | null }
  | { kind: 'close' }
  | {
      kind: 'move';
      from: SlotRef;
      to: SlotRef;
      count: number;
      revision: number;
      containerId: string | null;
      containerRevision: number | null;
    }
  | { kind: 'craft'; grid: 2 | 3; count: number; revision: number }
  | { kind: 'give'; itemType: string; count: number; revision: number }
  | InventoryDropCommand
  | { kind: 'consume'; slot: number; revision: number }
  | InventorySelectCommand;
export type InventoryDropCommand = { kind: 'drop'; slot: number; count: number; revision: number };
export type InventorySelectCommand = { kind: 'select'; slot: number; revision: number };
export type InventoryView = Readonly<{
  version: typeof INVENTORY_VERSION;
  catalog: boolean;
  revision: number;
  selected: number;
  bag: readonly Slot[];
  craft2: readonly Slot[];
  craft3: readonly Slot[];
  equipment: readonly Slot[];
  station: 'personal' | 'workbench' | 'container';
  container: Readonly<{
    id: string;
    cell: readonly [number, number, number];
    revision: number;
    slots: readonly Slot[];
  }> | null;
}>;
export function copyStack(stack: Slot): Slot {
  return stack
    ? { ...stack, ...(stack.instance ? { instance: { ...stack.instance } } : {}) }
    : null;
}
export function sameStack(a: Stack, b: Stack): boolean {
  return a.itemType === b.itemType && a.instance?.durability === b.instance?.durability;
}
/** Owned stacks are canonical: durable items have one bounded durability instance. */
export function validStack(
  value: unknown,
  items?: ReadonlyMap<string, ItemDefinition>,
): value is Stack {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (
    !Object.hasOwn(v, 'itemType') ||
    !Object.hasOwn(v, 'count') ||
    (v.instance !== undefined && !Object.hasOwn(v, 'instance')) ||
    !Object.keys(v).every((key) => ['itemType', 'count', 'instance'].includes(key)) ||
    typeof v.itemType !== 'string' ||
    !/^[a-z][a-z0-9_]{0,63}$/.test(v.itemType) ||
    !Number.isSafeInteger(v.count) ||
    (v.count as number) < 1 ||
    (v.count as number) > 999
  )
    return false;
  const item = items?.get(v.itemType);
  if (items && (!item || (v.count as number) > item.maxStack)) return false;
  if (v.instance !== undefined) {
    const instance = v.instance as Record<string, unknown>;
    if (
      !instance ||
      typeof instance !== 'object' ||
      Array.isArray(instance) ||
      Object.keys(instance).length !== 1 ||
      !Object.hasOwn(instance, 'durability') ||
      !Number.isSafeInteger(instance.durability) ||
      (instance.durability as number) < 1 ||
      (v.count as number) !== 1 ||
      (item && (!item.durability || (instance.durability as number) > item.durability))
    )
      return false;
  } else if (item?.durability !== undefined) return false;
  return true;
}
export function makeStack(item: ItemDefinition, count: number): Stack {
  const stack: Stack = {
    itemType: item.itemType,
    count,
    ...(item.durability ? { instance: { durability: item.durability } } : {}),
  };
  if (!validStack(stack, new Map([[item.itemType, item]]))) throw new Error('invalid new stack');
  return stack;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every((key) => Object.hasOwn(v, key));
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const areaSizes = {
  bag: BAG_SLOTS,
  craft2: 4,
  craft3: 9,
  equipment: EQUIPMENT.length,
  container: CHEST_SLOTS,
};
const slotRef = (v: unknown): v is SlotRef =>
  object(v) &&
  exact(v, ['area', 'slot']) &&
  typeof v.area === 'string' &&
  Object.hasOwn(areaSizes, v.area) &&
  integer(v.slot, 0, areaSizes[v.area as InventoryArea] - 1);
export function isInventoryCommand(
  v: unknown,
  cell: (value: unknown) => boolean,
): v is InventoryCommand {
  if (!object(v)) return false;
  switch (v.kind) {
    case 'consume':
      return (
        exact(v, ['kind', 'slot', 'revision']) &&
        integer(v.slot, 0, BAG_SLOTS - 1) &&
        integer(v.revision, 0)
      );
    case 'select':
      return (
        exact(v, ['kind', 'slot', 'revision']) && integer(v.slot, 0, 8) && integer(v.revision, 0)
      );
    case 'drop':
      return (
        exact(v, ['kind', 'slot', 'count', 'revision']) &&
        integer(v.slot, 0, BAG_SLOTS - 1) &&
        integer(v.count, 1, 999) &&
        integer(v.revision, 0)
      );
    case 'open':
      return exact(v, ['kind', 'target']) && (v.target === null || cell(v.target));
    case 'close':
      return exact(v, ['kind']);
    case 'move':
      return (
        exact(v, ['kind', 'from', 'to', 'count', 'revision', 'containerId', 'containerRevision']) &&
        slotRef(v.from) &&
        slotRef(v.to) &&
        integer(v.count, 1, 999) &&
        integer(v.revision, 0) &&
        (v.containerId === null ||
          (typeof v.containerId === 'string' && /^chest-[1-9][0-9]{0,15}$/.test(v.containerId))) &&
        (v.containerRevision === null || integer(v.containerRevision, 0))
      );
    case 'craft':
      return (
        exact(v, ['kind', 'grid', 'count', 'revision']) &&
        [2, 3].includes(v.grid as number) &&
        integer(v.count, 1, 64) &&
        integer(v.revision, 0)
      );
    case 'give':
      return (
        exact(v, ['kind', 'itemType', 'count', 'revision']) &&
        typeof v.itemType === 'string' &&
        /^[a-z][a-z0-9_]{0,63}$/.test(v.itemType) &&
        integer(v.count, 1, 999) &&
        integer(v.revision, 0)
      );
    default:
      return false;
  }
}
export function isInventoryView(v: unknown, cell: (value: unknown) => boolean): v is InventoryView {
  if (
    !object(v) ||
    !exact(v, [
      'version',
      'catalog',
      'revision',
      'selected',
      'bag',
      'craft2',
      'craft3',
      'equipment',
      'station',
      'container',
    ]) ||
    v.version !== INVENTORY_VERSION ||
    typeof v.catalog !== 'boolean' ||
    !integer(v.revision, 0) ||
    !integer(v.selected, 0, 8) ||
    !['personal', 'workbench', 'container'].includes(v.station as string)
  )
    return false;
  const slots = (s: unknown, count: number) =>
    Array.isArray(s) &&
    s.length === count &&
    s.every((stack) => stack === null || validStack(stack));
  if (
    !slots(v.bag, BAG_SLOTS) ||
    !slots(v.craft2, 4) ||
    !slots(v.craft3, 9) ||
    !slots(v.equipment, EQUIPMENT.length)
  )
    return false;
  if (v.station !== 'container') return v.container === null;
  const c = v.container;
  return (
    object(c) &&
    exact(c, ['id', 'cell', 'revision', 'slots']) &&
    typeof c.id === 'string' &&
    /^chest-[1-9][0-9]{0,15}$/.test(c.id) &&
    cell(c.cell) &&
    integer(c.revision, 0) &&
    slots(c.slots, CHEST_SLOTS)
  );
}
/** Shaped recipes translate within a grid and mirror horizontally; empty cells must match. */
export function matchRecipe(
  grid: readonly Slot[],
  size: 2 | 3,
  recipes: readonly Recipe[],
  items?: ReadonlyMap<string, ItemDefinition>,
): Recipe | null {
  if (grid.length !== size * size || !grid.some(Boolean)) return null;
  function bounds(cells: readonly (string | null)[], width: number) {
    let minX = width,
      minY = width,
      maxX = -1,
      maxY = -1;
    cells.forEach((cell, i) => {
      if (cell) {
        minX = Math.min(minX, i % width);
        maxX = Math.max(maxX, i % width);
        minY = Math.min(minY, Math.floor(i / width));
        maxY = Math.max(maxY, Math.floor(i / width));
      }
    });
    return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }
  const actual = grid.map((stack) => stack?.itemType ?? null),
    a = bounds(actual, size);
  for (const recipe of recipes) {
    if (recipe.size > size) continue;
    const b = bounds(recipe.ingredients, recipe.size);
    if (a.width !== b.width || a.height !== b.height) continue;
    for (const mirror of [false, true]) {
      let matches = true;
      for (let y = 0; y < a.height; y++)
        for (let x = 0; x < a.width; x++) {
          const ingredient =
            recipe.ingredients[
              (b.minY + y) * recipe.size + b.minX + (mirror ? b.width - 1 - x : x)
            ];
          const stack = grid[(a.minY + y) * size + a.minX + x];
          if (!ingredientMatches(ingredient, stack?.itemType ?? null, items) || stack?.instance)
            matches = false;
        }
      if (matches) return recipe;
    }
  }
  return null;
}
