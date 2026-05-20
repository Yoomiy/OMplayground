import {
  REGISTERED_ITEM_IDS,
  CRAFTING_GRID_WIDTH_2,
  CRAFTING_GRID_WIDTH_3,
  findMatchingRecipe,
  itemPerkSpec,
  itemMaxStack
} from "@playground/voxel-content";
import {
  BLOCK_REGISTRY,
  CHEST_SLOT_COUNT,
  CRAFTING_CELL_MAX,
  EQUIPMENT_SLOT_COUNT,
  MAIN_ITEM_INVENTORY_SLOTS,
  PLACEABLE_BLOCK_IDS,
  CRAFTING_GRID_SLOTS,
  type CraftingGridSlot,
  type HotbarSlot,
  type InventoryMoveReq,
  type ItemSlot
} from "./protocol";

export const HOTBAR_SLOT_COUNT = 9;
export const MAX_STACK = 64;

export type HotbarState = HotbarSlot[];
export type ChestState = HotbarSlot[];
export type ItemInventoryState = ItemSlot[];
export type CraftingGridState = CraftingGridSlot[];
export type EquipmentSlotState = ItemSlot[];
export type CraftingGridWidth = typeof CRAFTING_GRID_WIDTH_2 | typeof CRAFTING_GRID_WIDTH_3;

export const PERSONAL_CRAFTING_SLOT_INDICES = [0, 1, 3, 4] as const;
export const EQUIPMENT_SLOT_KEYS = ["head", "chest", "legs", "feet"] as const;

export function createEmptyHotbar(): HotbarState {
  return Array.from({ length: HOTBAR_SLOT_COUNT }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

export function cloneHotbar(slots: HotbarState): HotbarState {
  return slots.map((s) => ({
    blockId: s.blockId,
    itemId: s.itemId ?? 0,
    count: s.count,
    ...(s.durability !== undefined ? { durability: s.durability } : {})
  }));
}

export function createEmptyChest(): ChestState {
  return Array.from({ length: CHEST_SLOT_COUNT }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

export function cloneChest(slots: ChestState): ChestState {
  return slots.map((s) => ({
    blockId: s.blockId,
    itemId: s.itemId ?? 0,
    count: s.count,
    ...(s.durability !== undefined ? { durability: s.durability } : {})
  }));
}

export { blockBreakable, blockDropId, blockDropsPickable } from "@playground/voxel-content";

function findStackIndex(slots: HotbarState, blockId: number): number {
  return slots.findIndex(
    (s) => s.blockId === blockId && s.count > 0 && s.count < MAX_STACK
  );
}

function findEmptyIndex(slots: HotbarState): number {
  return slots.findIndex(
    (s) =>
      (s.blockId === BLOCK_REGISTRY.AIR && (s.itemId ?? 0) === 0) || s.count <= 0
  );
}

/** Add one block worth of drops; merges stacks, then first empty slot. */
export function addPickUp(slots: HotbarState, blockId: number): void {
  addBlockCount(slots, blockId, 1);
}

/** How many units of `blockId` can still fit in the hotbar. */
export function maxAddableBlockCount(slots: HotbarState, blockId: number): number {
  if (!PLACEABLE_BLOCK_IDS.includes(blockId)) return 0;
  let space = 0;
  for (const s of slots) {
    if (s.blockId === blockId && s.count > 0 && s.count < MAX_STACK) {
      space += MAX_STACK - s.count;
    } else if (s.blockId === BLOCK_REGISTRY.AIR || s.count <= 0) {
      space += MAX_STACK;
    }
  }
  return space;
}

/** Add `count` blocks across hotbar stacks; leaves overflow unsourced if full. */
export function addBlockCount(slots: HotbarState, blockId: number, count: number): void {
  if (!PLACEABLE_BLOCK_IDS.includes(blockId) || count <= 0) return;
  let left = count;
  while (left > 0) {
    const stack = findStackIndex(slots, blockId);
    if (stack >= 0) {
      const room = MAX_STACK - slots[stack].count;
      const add = Math.min(room, left);
      slots[stack].count += add;
      left -= add;
      continue;
    }
    const empty = findEmptyIndex(slots);
    if (empty < 0) return;
    slots[empty].blockId = blockId;
    const add = Math.min(MAX_STACK, left);
    slots[empty].count = add;
    left -= add;
  }
}

/**
 * Best-effort consume for server sync: decrement if we have any; otherwise
 * no-op (client UX is trusted for this school deployment).
 */
export function consumeOneIfPresent(slots: HotbarState, blockId: number): void {
  const i = slots.findIndex((s) => s.blockId === blockId && s.count > 0);
  if (i < 0) return;
  const next = slots[i].count - 1;
  if (next <= 0) {
    slots[i].blockId = BLOCK_REGISTRY.AIR;
    slots[i].itemId = 0;
    slots[i].count = 0;
  } else {
    slots[i].count = next;
  }
}

/** Decrement one stack unit from an exact hotbar cell (player drop intent). */
export function consumeOneFromHotbarIndex(slots: HotbarState, index: number): boolean {
  if (index < 0 || index >= HOTBAR_SLOT_COUNT) return false;
  const s = slots[index];
  if (!s || s.count <= 0) return false;
  if ((s.itemId ?? 0) > 0) {
    const next = s.count - 1;
    if (next <= 0) {
      slots[index] = { blockId: BLOCK_REGISTRY.AIR, itemId: 0, count: 0 };
    } else {
      slots[index] = {
        blockId: BLOCK_REGISTRY.AIR,
        itemId: s.itemId,
        count: next,
        ...(s.durability !== undefined ? { durability: s.durability } : {})
      };
    }
    return true;
  }
  if (s.blockId === BLOCK_REGISTRY.AIR) return false;
  const next = s.count - 1;
  if (next <= 0) {
    slots[index] = { blockId: BLOCK_REGISTRY.AIR, itemId: 0, count: 0 };
  } else {
    slots[index] = { blockId: s.blockId, itemId: 0, count: next };
  }
  return true;
}

export function hotbarFromPersisted(
  raw: unknown,
  fallback: HotbarState
): HotbarState {
  if (!Array.isArray(raw) || raw.length !== HOTBAR_SLOT_COUNT) {
    return cloneHotbar(fallback);
  }
  const out = createEmptyHotbar();
  for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
    const cell = raw[i] as {
      blockId?: unknown;
      itemId?: unknown;
      count?: unknown;
      durability?: unknown;
    };
    const blockId = Number(cell?.blockId);
    const count = Number(cell?.count);
    if (!Number.isFinite(count)) continue;
    const itemId = Number(cell?.itemId) || 0;
    const cellDur = Number(cell?.durability);
    if (blockId === BLOCK_REGISTRY.AIR && itemId === 0 && count === 0) {
      out[i] = { blockId: BLOCK_REGISTRY.AIR, itemId: 0, count: 0 };
      continue;
    }
    if (itemId > 0 && REGISTERED_ITEM_IDS.has(itemId) && count > 0) {
      const cap = itemMaxStack(itemId);
      out[i] = {
        blockId: BLOCK_REGISTRY.AIR,
        itemId,
        count: Math.max(0, Math.min(cap, Math.floor(count))),
        ...(Number.isFinite(cellDur) ? { durability: Math.floor(cellDur) } : {})
      };
      continue;
    }
    if (!PLACEABLE_BLOCK_IDS.includes(blockId)) continue;
    out[i] = {
      blockId,
      itemId: 0,
      count: Math.max(0, Math.min(MAX_STACK, Math.floor(count)))
    };
  }
  return out;
}

export function chestFromPersisted(
  raw: unknown,
  fallback: ChestState
): ChestState {
  if (!Array.isArray(raw) || raw.length !== CHEST_SLOT_COUNT) {
    return cloneChest(fallback);
  }
  const out = createEmptyChest();
  for (let i = 0; i < CHEST_SLOT_COUNT; i++) {
    const cell = raw[i] as {
      blockId?: unknown;
      itemId?: unknown;
      count?: unknown;
      durability?: unknown;
    };
    const count = Number(cell?.count);
    if (!Number.isFinite(count)) continue;
    const itemId = Number(cell?.itemId) || 0;
    const blockId = Number(cell?.blockId);
    const cellDur = Number(cell?.durability);
    if (blockId === BLOCK_REGISTRY.AIR && itemId === 0 && count === 0) {
      out[i] = { blockId: BLOCK_REGISTRY.AIR, itemId: 0, count: 0 };
      continue;
    }
    if (itemId > 0 && REGISTERED_ITEM_IDS.has(itemId) && count > 0) {
      const cap = itemMaxStack(itemId);
      out[i] = {
        blockId: BLOCK_REGISTRY.AIR,
        itemId,
        count: Math.max(0, Math.min(cap, Math.floor(count))),
        ...(Number.isFinite(cellDur) ? { durability: Math.floor(cellDur) } : {})
      };
      continue;
    }
    if (!PLACEABLE_BLOCK_IDS.includes(blockId) || count <= 0) continue;
    out[i] = {
      blockId,
      itemId: 0,
      count: Math.max(0, Math.min(MAX_STACK, Math.floor(count)))
    };
  }
  return out;
}

export function createEmptyItemInventory(
  size = MAIN_ITEM_INVENTORY_SLOTS
): ItemSlot[] {
  return Array.from({ length: size }, () => ({ itemId: 0, count: 0 }));
}

export function cloneItemInventory(slots: ItemSlot[]): ItemSlot[] {
  return slots.map((s) => ({
    itemId: s.itemId,
    count: s.count,
    ...(s.durability !== undefined ? { durability: s.durability } : {})
  }));
}

export function itemInventoryFromPersisted(
  raw: unknown,
  fallback: ItemSlot[],
  size = MAIN_ITEM_INVENTORY_SLOTS
): ItemSlot[] {
  if (!Array.isArray(raw) || raw.length !== size) {
    return cloneItemInventory(fallback);
  }
  const out = createEmptyItemInventory(size);
  for (let i = 0; i < size; i++) {
    const cell = raw[i] as { itemId?: unknown; count?: unknown; durability?: unknown };
    const itemId = Number(cell?.itemId);
    const count = Number(cell?.count);
    if (!Number.isFinite(count) || itemId === 0 || count <= 0) {
      out[i] = { itemId: 0, count: 0 };
      continue;
    }
    if (!REGISTERED_ITEM_IDS.has(itemId)) {
      out[i] = { itemId: 0, count: 0 };
      continue;
    }
    const cap = itemMaxStack(itemId);
    const cellDur = Number(cell?.durability);
    out[i] = {
      itemId,
      count: Math.max(0, Math.min(cap, Math.floor(count))),
      ...(Number.isFinite(cellDur) ? { durability: Math.floor(cellDur) } : {})
    };
  }
  return out;
}

export function createEmptyEquipmentSlots(): EquipmentSlotState {
  return Array.from({ length: EQUIPMENT_SLOT_COUNT }, () => ({ itemId: 0, count: 0 }));
}

export function cloneEquipmentSlots(slots: EquipmentSlotState): EquipmentSlotState {
  return slots.map((s) => ({
    itemId: s.itemId,
    count: s.count,
    ...(s.durability !== undefined ? { durability: s.durability } : {})
  }));
}

export function equipmentItemFitsSlot(itemId: number, slotIndex: number): boolean {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= EQUIPMENT_SLOT_COUNT) {
    return false;
  }
  const slotKey = EQUIPMENT_SLOT_KEYS[slotIndex];
  if (!slotKey) return false;
  return itemPerkSpec(itemId)?.equipSlot === slotKey;
}

export function equipmentSlotsFromPersisted(
  raw: unknown,
  fallback: EquipmentSlotState
): EquipmentSlotState {
  if (!Array.isArray(raw) || raw.length !== EQUIPMENT_SLOT_COUNT) {
    return cloneEquipmentSlots(fallback);
  }
  const out = createEmptyEquipmentSlots();
  for (let i = 0; i < EQUIPMENT_SLOT_COUNT; i++) {
    const cell = raw[i] as { itemId?: unknown; count?: unknown; durability?: unknown };
    const itemId = Number(cell?.itemId);
    const count = Number(cell?.count);
    if (!Number.isFinite(count) || itemId === 0 || count <= 0) continue;
    if (!REGISTERED_ITEM_IDS.has(itemId) || !equipmentItemFitsSlot(itemId, i)) continue;
    const cellDur = Number(cell?.durability);
    out[i] = {
      itemId,
      count: 1,
      ...(Number.isFinite(cellDur) ? { durability: Math.floor(cellDur) } : {})
    };
  }
  return out;
}

export function hasEquipped(slots: EquipmentSlotState | undefined, itemId: number): boolean {
  return slots?.some((s) => s.itemId === itemId && s.count > 0) ?? false;
}

/** How many units of `itemId` can still fit (new stacks + partial stacks). */
export function maxAddableItemCount(slots: ItemSlot[], itemId: number): number {
  const cap = itemMaxStack(itemId);
  if (cap <= 0) return 0;
  let space = 0;
  for (const s of slots) {
    if (s.itemId === itemId && s.count > 0 && s.count < cap) {
      space += cap - s.count;
    } else if (s.itemId === 0 || s.count <= 0) {
      space += cap;
    }
  }
  return space;
}

/** Add `count` items across stacks; leaves overflow unsourced if inv is full. */
export function addItemCount(slots: ItemSlot[], itemId: number, count: number): void {
  if (itemId === 0 || count <= 0) return;
  const stackCap = itemMaxStack(itemId);
  if (stackCap <= 0) return;
  let left = count;
  while (left > 0) {
    const stack = slots.findIndex(
      (s) => s.itemId === itemId && s.count > 0 && s.count < stackCap
    );
    if (stack >= 0) {
      const room = stackCap - slots[stack].count;
      const add = Math.min(room, left);
      slots[stack].count += add;
      left -= add;
      continue;
    }
    const empty = slots.findIndex((s) => s.itemId === 0 || s.count <= 0);
    if (empty < 0) return;
    slots[empty].itemId = itemId;
    const add = Math.min(stackCap, left);
    slots[empty].count = add;
    left -= add;
  }
}

export function addItemPickup(slots: ItemSlot[], itemId: number): void {
  addItemCount(slots, itemId, 1);
}

function normalizeCraftingSlot(s: CraftingGridSlot): void {
  if (!Number.isFinite(s.count) || s.count <= 0) {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.itemId = 0;
    s.count = 0;
    return;
  }
  if (s.itemId > 0) {
    if (!REGISTERED_ITEM_IDS.has(s.itemId)) {
      s.blockId = BLOCK_REGISTRY.AIR;
      s.itemId = 0;
      s.count = 0;
      return;
    }
    const cap = Math.max(itemMaxStack(s.itemId), CRAFTING_CELL_MAX);
    s.count = Math.max(0, Math.min(cap, Math.floor(s.count)));
    s.blockId = BLOCK_REGISTRY.AIR;
    return;
  }
  s.count = Math.max(0, Math.min(MAX_STACK, Math.floor(s.count)));
  if (s.blockId !== BLOCK_REGISTRY.AIR && !PLACEABLE_BLOCK_IDS.includes(s.blockId)) {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.itemId = 0;
    s.count = 0;
  }
}

export function createEmptyCraftingGrid(): CraftingGridState {
  return Array.from({ length: CRAFTING_GRID_SLOTS }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

export function cloneCraftingGrid(grid: CraftingGridState): CraftingGridState {
  return grid.map((c) => ({
    blockId: c.blockId,
    itemId: c.itemId,
    count: c.count,
    ...(c.durability !== undefined ? { durability: c.durability } : {})
  }));
}

/**
 * If persisted crafting cells have stacked ingredients, spill extras into
 * hotbar / item storage and leave at most `CRAFTING_CELL_MAX` per cell.
 */
export function spillExcessFromCraftingGrid(
  grid: CraftingGridState,
  hotbar: HotbarState,
  itemSlots: ItemSlot[]
): void {
  for (const c of grid) {
    normalizeCraftingSlot(c);
    if (c.count <= CRAFTING_CELL_MAX) continue;
    const excess = c.count - CRAFTING_CELL_MAX;
    if (c.itemId > 0) {
      addItemCount(itemSlots, c.itemId, excess);
    } else if (c.blockId !== BLOCK_REGISTRY.AIR) {
      addBlockCount(hotbar, c.blockId, excess);
    }
    c.count = CRAFTING_CELL_MAX;
    normalizeCraftingSlot(c);
  }
}

export function craftingGridFromPersisted(
  raw: unknown,
  fallback: CraftingGridState
): CraftingGridState {
  if (!Array.isArray(raw)) {
    return cloneCraftingGrid(fallback);
  }
  if (raw.length === CRAFTING_GRID_WIDTH_2 * CRAFTING_GRID_WIDTH_2) {
    const out = createEmptyCraftingGrid();
    for (let i = 0; i < PERSONAL_CRAFTING_SLOT_INDICES.length; i++) {
      const cell = raw[i] as {
        blockId?: unknown;
        itemId?: unknown;
        count?: unknown;
        durability?: unknown;
      };
      const cellDur = Number(cell?.durability);
      out[PERSONAL_CRAFTING_SLOT_INDICES[i]!] = {
        blockId: Number(cell?.blockId) || 0,
        itemId: Number(cell?.itemId) || 0,
        count: Number(cell?.count) || 0,
        ...(Number.isFinite(cellDur) ? { durability: Math.floor(cellDur) } : {})
      };
      normalizeCraftingSlot(out[PERSONAL_CRAFTING_SLOT_INDICES[i]!]!);
    }
    return out;
  }
  if (raw.length !== CRAFTING_GRID_SLOTS) {
    return cloneCraftingGrid(fallback);
  }
  const out = createEmptyCraftingGrid();
  for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
    const cell = raw[i] as {
      blockId?: unknown;
      itemId?: unknown;
      count?: unknown;
      durability?: unknown;
    };
    const cellDur = Number(cell?.durability);
    out[i] = {
      blockId: Number(cell?.blockId) || 0,
      itemId: Number(cell?.itemId) || 0,
      count: Number(cell?.count) || 0,
      ...(Number.isFinite(cellDur) ? { durability: Math.floor(cellDur) } : {})
    };
    normalizeCraftingSlot(out[i]);
  }
  return out;
}

type SlotAtom =
  | { kind: "empty" }
  | { kind: "block"; blockId: number; count: number }
  | { kind: "item"; itemId: number; count: number; durability?: number };

function readHotbarAtom(s: HotbarSlot): SlotAtom {
  if (s.count <= 0) return { kind: "empty" };
  if ((s.itemId ?? 0) > 0) {
    if (!REGISTERED_ITEM_IDS.has(s.itemId)) return { kind: "empty" };
    return {
      kind: "item",
      itemId: s.itemId,
      count: s.count,
      ...(s.durability !== undefined ? { durability: s.durability } : {})
    };
  }
  if (s.blockId === BLOCK_REGISTRY.AIR) return { kind: "empty" };
  if (!PLACEABLE_BLOCK_IDS.includes(s.blockId)) return { kind: "empty" };
  return { kind: "block", blockId: s.blockId, count: s.count };
}

function readItemAtom(s: ItemSlot): SlotAtom {
  if (s.itemId === 0 || s.count <= 0) return { kind: "empty" };
  if (!REGISTERED_ITEM_IDS.has(s.itemId)) return { kind: "empty" };
  return {
    kind: "item",
    itemId: s.itemId,
    count: s.count,
    ...(s.durability !== undefined ? { durability: s.durability } : {})
  };
}

function readCraftAtom(s: CraftingGridSlot): SlotAtom {
  normalizeCraftingSlot(s);
  if (s.count <= 0) return { kind: "empty" };
  if (s.itemId > 0) {
    return {
      kind: "item",
      itemId: s.itemId,
      count: s.count,
      ...(s.durability !== undefined ? { durability: s.durability } : {})
    };
  }
  if (s.blockId !== BLOCK_REGISTRY.AIR)
    return { kind: "block", blockId: s.blockId, count: s.count };
  return { kind: "empty" };
}

function writeHotbarAtom(s: HotbarSlot, a: SlotAtom): void {
  if (a.kind === "empty") {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.itemId = 0;
    s.count = 0;
    delete s.durability;
    return;
  }
  if (a.kind === "block") {
    s.blockId = a.blockId;
    s.itemId = 0;
    s.count = a.count;
    delete s.durability;
    return;
  }
  s.blockId = BLOCK_REGISTRY.AIR;
  s.itemId = a.itemId;
  s.count = a.count;
  if (a.durability !== undefined) s.durability = a.durability;
  else delete s.durability;
}

function writeItemAtom(s: ItemSlot, a: SlotAtom): void {
  if (a.kind === "empty") {
    s.itemId = 0;
    s.count = 0;
    delete s.durability;
    return;
  }
  if (a.kind === "item") {
    s.itemId = a.itemId;
    s.count = a.count;
    if (a.durability !== undefined) s.durability = a.durability;
    else delete s.durability;
  }
}

function readEquipmentAtom(s: ItemSlot): SlotAtom {
  return readItemAtom(s);
}

function writeEquipmentAtom(s: ItemSlot, a: SlotAtom): void {
  writeItemAtom(s, a);
}

function writeCraftAtom(s: CraftingGridSlot, a: SlotAtom): void {
  if (a.kind === "empty") {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.itemId = 0;
    s.count = 0;
    delete s.durability;
    return;
  }
  if (a.kind === "block") {
    s.blockId = a.blockId;
    s.itemId = 0;
    s.count = a.count;
    return;
  }
  s.blockId = BLOCK_REGISTRY.AIR;
  s.itemId = a.itemId;
  s.count = a.count;
  if (a.durability !== undefined) s.durability = a.durability;
  else delete s.durability;
}

function readAtom(
  hotbar: HotbarState,
  items: ItemSlot[],
  craft: CraftingGridState,
  equipment: EquipmentSlotState | undefined,
  chest: ChestState | undefined,
  region: InventoryMoveReq["from"],
  index: number
): SlotAtom {
  if (region === "hotbar") return readHotbarAtom(hotbar[index]!);
  if (region === "storage") return readItemAtom(items[index]!);
  if (region === "equipment") return readEquipmentAtom(equipment![index]!);
  if (region === "chest") return readHotbarAtom(chest![index]!);
  return readCraftAtom(craft[index]!);
}

function writeAtom(
  hotbar: HotbarState,
  items: ItemSlot[],
  craft: CraftingGridState,
  equipment: EquipmentSlotState | undefined,
  chest: ChestState | undefined,
  region: InventoryMoveReq["from"],
  index: number,
  a: SlotAtom
): void {
  if (region === "hotbar") writeHotbarAtom(hotbar[index]!, a);
  else if (region === "storage") writeItemAtom(items[index]!, a);
  else if (region === "equipment") writeEquipmentAtom(equipment![index]!, a);
  else if (region === "chest") writeHotbarAtom(chest![index]!, a);
  else writeCraftAtom(craft[index]!, a);
}

function regionAllowsAtom(
  region: InventoryMoveReq["from"],
  index: number,
  a: SlotAtom
): boolean {
  if (a.kind === "empty") return true;
  if (region === "hotbar") return a.kind === "block" || a.kind === "item";
  if (region === "storage") return a.kind === "item";
  if (region === "chest") return a.kind === "block" || a.kind === "item";
  if (region === "equipment") {
    return a.kind === "item" && equipmentItemFitsSlot(a.itemId, index);
  }
  return a.kind === "block" || a.kind === "item";
}

function itemDurabilityKey(d?: number): number | undefined {
  return d;
}

function sameAtomStack(a: SlotAtom, b: SlotAtom): boolean {
  if (a.kind === "empty" || b.kind === "empty") return false;
  if (a.kind === "block" && b.kind === "block") return a.blockId === b.blockId;
  if (a.kind === "item" && b.kind === "item") {
    return (
      a.itemId === b.itemId &&
      itemDurabilityKey(a.durability) === itemDurabilityKey(b.durability)
    );
  }
  return false;
}

function validMoveIndex(
  region: InventoryMoveReq["from"],
  index: number,
  equipment: EquipmentSlotState | undefined,
  chest: ChestState | undefined
): boolean {
  if (!Number.isInteger(index) || index < 0) return false;
  if (region === "hotbar") return index < HOTBAR_SLOT_COUNT;
  if (region === "storage") return index < MAIN_ITEM_INVENTORY_SLOTS;
  if (region === "equipment") return !!equipment && index < EQUIPMENT_SLOT_COUNT;
  if (region === "chest") return !!chest && index < CHEST_SLOT_COUNT;
  return index < CRAFTING_GRID_SLOTS;
}

export function isPersonalCraftingIndex(index: number): boolean {
  return (PERSONAL_CRAFTING_SLOT_INDICES as readonly number[]).includes(index);
}

function mergeRoomForDestination(
  to: InventoryMoveReq["from"],
  b: SlotAtom
): number {
  if (b.kind === "empty") return 0;
  if (to === "craft" || to === "equipment") return Math.max(0, CRAFTING_CELL_MAX - b.count);
  if (b.kind === "block") return Math.max(0, MAX_STACK - b.count);
  if (b.kind === "item") return Math.max(0, itemMaxStack(b.itemId) - b.count);
  return 0;
}

function atomExceedsSingleCellMax(a: SlotAtom): boolean {
  if (a.kind === "empty") return false;
  return a.count > CRAFTING_CELL_MAX;
}

/**
 * Move / merge / swap one stack between hotbar, item storage, and crafting grid.
 * Hotbar holds blocks or tools, storage holds items, craft holds either.
 * Crafting cells accept at most one unit (`CRAFTING_CELL_MAX`); dragging from
 * stacks places one unit unless the whole source is one unit.
 */
export function applyInventoryMove(
  hotbar: HotbarState,
  itemSlots: ItemSlot[],
  craft: CraftingGridState,
  req: InventoryMoveReq,
  equipmentSlots?: EquipmentSlotState,
  chestSlots?: ChestState
): boolean {
  const { from, fromIndex: fi, to, toIndex: ti } = req;
  if (
    !validMoveIndex(from, fi, equipmentSlots, chestSlots) ||
    !validMoveIndex(to, ti, equipmentSlots, chestSlots)
  ) {
    return false;
  }
  if (from === to && fi === ti) return true;

  for (const c of craft) normalizeCraftingSlot(c);

  let a = readAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi);
  let b = readAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, to, ti);
  if (a.kind === "empty") return false;
  if (!regionAllowsAtom(to, ti, a)) return false;
  if (!regionAllowsAtom(from, fi, b)) return false;

  const toSingleCell = to === "craft" || to === "equipment";
  const fromSingleCell = from === "craft" || from === "equipment";

  if (b.kind === "empty") {
    if (!toSingleCell) {
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, to, ti, a);
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi, { kind: "empty" });
      return true;
    }
    const take = Math.min(a.count, CRAFTING_CELL_MAX);
    if (take <= 0) return false;
    if (a.kind === "block") {
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, to, ti, {
        kind: "block",
        blockId: a.blockId,
        count: take
      });
    } else {
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, to, ti, {
        kind: "item",
        itemId: a.itemId,
        count: take,
        durability: a.durability
      });
    }
    const left = a.count - take;
    if (left <= 0) {
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi, { kind: "empty" });
    } else if (a.kind === "block") {
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi, {
        kind: "block",
        blockId: a.blockId,
        count: left
      });
    } else {
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi, {
        kind: "item",
        itemId: a.itemId,
        count: left,
        durability: a.durability
      });
    }
    return true;
  }

  if (sameAtomStack(a, b)) {
    const room = mergeRoomForDestination(to, b);
    const move =
      a.kind === "block" || a.kind === "item" ? Math.min(a.count, room) : 0;
    if (move <= 0) {
      if (toSingleCell && !fromSingleCell) return false;
      if (fromSingleCell && atomExceedsSingleCellMax(b)) return false;
      if (toSingleCell && atomExceedsSingleCellMax(a)) return false;
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi, b);
      writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, to, ti, a);
      return true;
    }
    if (b.kind === "block" && a.kind === "block") {
      b = { kind: "block", blockId: b.blockId, count: b.count + move };
      const newSrcCount = a.count - move;
      a =
        newSrcCount <= 0
          ? { kind: "empty" }
          : { kind: "block", blockId: a.blockId, count: newSrcCount };
    } else if (b.kind === "item" && a.kind === "item") {
      b = {
        kind: "item",
        itemId: b.itemId,
        count: b.count + move,
        durability: b.durability
      };
      const newSrcCount = a.count - move;
      a =
        newSrcCount <= 0
          ? { kind: "empty" }
          : {
              kind: "item",
              itemId: a.itemId,
              count: newSrcCount,
              durability: a.durability
            };
    } else {
      a = { kind: "empty" };
    }
    writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, to, ti, b);
    writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi, a);
    return true;
  }

  if (fromSingleCell && atomExceedsSingleCellMax(b)) return false;
  if (toSingleCell && atomExceedsSingleCellMax(a)) return false;
  writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, from, fi, b);
  writeAtom(hotbar, itemSlots, craft, equipmentSlots, chestSlots, to, ti, a);
  return true;
}


/** Craft from the active 2x2 or 3x3 grid into hotbar / item storage (survival). */
export function tryCraftFromGrid(
  hotbar: HotbarState,
  itemSlots: ItemSlot[],
  grid: CraftingGridState,
  gridWidth: CraftingGridWidth = CRAFTING_GRID_WIDTH_2
): boolean {
  for (const c of grid) normalizeCraftingSlot(c);

  const activeGrid =
    gridWidth === CRAFTING_GRID_WIDTH_2
      ? PERSONAL_CRAFTING_SLOT_INDICES.map((idx) => grid[idx]!)
      : grid;
  const matched = findMatchingRecipe(activeGrid, gridWidth);
  if (!matched) return false;

  const { recipe, consumeAt } = matched;
  const output = recipe.output;

  if (output.kind === "block") {
    if (maxAddableBlockCount(hotbar, output.id) < output.count) return false;
  } else if (maxAddableItemCount(itemSlots, output.id) < output.count) {
    return false;
  }

  for (const idx of consumeAt) {
    const gridIndex =
      gridWidth === CRAFTING_GRID_WIDTH_2
        ? PERSONAL_CRAFTING_SLOT_INDICES[idx]!
        : idx;
    grid[gridIndex]!.count -= 1;
    normalizeCraftingSlot(grid[gridIndex]!);
  }

  if (output.kind === "block") {
    addBlockCount(hotbar, output.id, output.count);
  } else {
    addItemCount(itemSlots, output.id, output.count);
  }
  return true;
}

export type CraftOverflow =
  | { kind: "block"; blockId: number; count: number }
  | { kind: "item"; itemId: number; count: number; durability?: number };

export function returnInactiveCraftingSlotsToInventory(
  grid: CraftingGridState,
  hotbar: HotbarState,
  itemSlots: ItemSlot[]
): CraftOverflow[] {
  const overflow: CraftOverflow[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (isPersonalCraftingIndex(i)) continue;
    const cell = grid[i]!;
    normalizeCraftingSlot(cell);
    if (cell.count <= 0) continue;
    if (cell.itemId > 0) {
      const room = maxAddableItemCount(itemSlots, cell.itemId);
      const toAdd = Math.min(room, cell.count);
      if (toAdd > 0) addItemCount(itemSlots, cell.itemId, toAdd);
      if (toAdd < cell.count) {
        overflow.push({
          kind: "item",
          itemId: cell.itemId,
          count: cell.count - toAdd,
          ...(cell.durability !== undefined ? { durability: cell.durability } : {})
        });
      }
    } else if (cell.blockId !== BLOCK_REGISTRY.AIR) {
      const room = maxAddableBlockCount(hotbar, cell.blockId);
      const toAdd = Math.min(room, cell.count);
      if (toAdd > 0) addBlockCount(hotbar, cell.blockId, toAdd);
      if (toAdd < cell.count) {
        overflow.push({
          kind: "block",
          blockId: cell.blockId,
          count: cell.count - toAdd
        });
      }
    }
    grid[i] = { blockId: BLOCK_REGISTRY.AIR, itemId: 0, count: 0 };
  }
  return overflow;
}
