import type { ContentManifest, ItemDefinition, Stack } from '../shared/content.ts';
import type { Cell } from '../shared/protocol.ts';
import {
  BAG_SLOTS,
  CHEST_SLOTS,
  EQUIPMENT,
  INVENTORY_VERSION,
  copyStack,
  makeStack,
  matchRecipe,
  sameStack,
  validStack,
} from '../shared/inventory.ts';
import type { InventoryCommand, InventoryView, Slot, SlotRef } from '../shared/inventory.ts';
import type { ActorAppearance } from '../shared/appearance.ts';
import {
  checkpointObject,
  checkpointInteger,
  checkpointIdentity,
  checkpointCell,
  checkpointSlots,
  freezeSlots,
} from './checkpoint-values.ts';
type Station = 'workbench' | 'container';
type Own = { revision: number; bag: Slot[]; craft2: Slot[]; craft3: Slot[]; equipment: Slot[] };
type Player = Own & {
  selected: number;
  station: { kind: Station; cell: Cell; containerId?: string } | null;
};
type Chest = { id: string; cell: Cell; revision: number; slots: Slot[] };
export type InventoryCheckpoint = Readonly<{
  schema: 1;
  contentHash: string;
  nextChest: number;
  players: readonly Readonly<{
    id: string;
    revision: number;
    selected: number;
    bag: readonly Slot[];
    craft2: readonly Slot[];
    craft3: readonly Slot[];
    equipment: readonly Slot[];
  }>[];
  chests: readonly Readonly<{ id: string; cell: Cell; revision: number; slots: readonly Slot[] }>[];
}>;
export type InventoryOutcome = { ok: boolean; reason: string; containerChanged?: string };
type Access = {
  station(cell: Cell): Station | null;
  canUse(id: string, cell: Cell, opening: boolean): boolean;
};
const key = (cell: Cell) => cell.join(',');
const empty = (count: number): Slot[] => Array(count).fill(null);
const clone = (slots: readonly Slot[]) => slots.map(copyStack);
/** Serialized room transactions. Only intents enter; no client stack/state is installed. */
export class Inventories {
  private players = new Map<string, Player>();
  private chests = new Map<string, Chest>();
  private nextChest = 0;
  private items: Map<string, ItemDefinition>;
  private recipes: ContentManifest['recipes'];
  private access: Access;
  private contentHash: string;
  constructor(content: ContentManifest, access: Access) {
    this.items = new Map(content.items.map((item) => [item.itemType, item]));
    this.recipes = content.recipes;
    this.access = access;
    this.contentHash = content.hash;
  }
  /** Capture private ownership without retaining live arrays, instances or open viewers. */
  checkpoint(): InventoryCheckpoint {
    return Object.freeze({
      schema: 1,
      contentHash: this.contentHash,
      nextChest: this.nextChest,
      players: Object.freeze(
        [...this.players]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([id, p]) =>
            Object.freeze({
              id,
              revision: p.revision,
              selected: p.selected,
              bag: freezeSlots(p.bag),
              craft2: freezeSlots(p.craft2),
              craft3: freezeSlots(p.craft3),
              equipment: freezeSlots(p.equipment),
            }),
          ),
      ),
      chests: Object.freeze(
        [...this.chests.values()]
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((chest) =>
            Object.freeze({
              id: chest.id,
              cell: Object.freeze([...chest.cell]) as Cell,
              revision: chest.revision,
              slots: freezeSlots(chest.slots),
            }),
          ),
      ),
    });
  }
  static fromCheckpoint(content: ContentManifest, access: Access, value: unknown): Inventories {
    const invalid = (): never => {
      throw new Error('invalid inventory checkpoint');
    };
    if (
      !checkpointObject(value, ['schema', 'contentHash', 'nextChest', 'players', 'chests']) ||
      value.schema !== 1 ||
      value.contentHash !== content.hash ||
      !checkpointInteger(value.nextChest) ||
      !Array.isArray(value.players) ||
      !Array.isArray(value.chests)
    )
      return invalid();
    const restored = new Inventories(content, access),
      players = new Map<string, Player>(),
      chests = new Map<string, Chest>(),
      chestIds = new Set<string>();
    for (const p of value.players) {
      if (
        !checkpointObject(p, [
          'id',
          'revision',
          'selected',
          'bag',
          'craft2',
          'craft3',
          'equipment',
        ]) ||
        !checkpointIdentity(p.id) ||
        players.has(p.id) ||
        !checkpointInteger(p.revision) ||
        !checkpointInteger(p.selected, 0, 8) ||
        !checkpointSlots(p.bag, BAG_SLOTS, restored.items) ||
        !checkpointSlots(p.craft2, 4, restored.items) ||
        !checkpointSlots(p.craft3, 9, restored.items) ||
        !checkpointSlots(p.equipment, EQUIPMENT.length, restored.items) ||
        p.equipment.some(
          (stack, index) =>
            stack && restored.items.get(stack.itemType)?.equipment !== EQUIPMENT[index],
        )
      )
        return invalid();
      players.set(p.id, {
        revision: p.revision,
        selected: p.selected,
        bag: clone(p.bag),
        craft2: clone(p.craft2),
        craft3: clone(p.craft3),
        equipment: clone(p.equipment),
        station: null,
      });
    }
    for (const chest of value.chests) {
      if (
        !checkpointObject(chest, ['id', 'cell', 'revision', 'slots']) ||
        typeof chest.id !== 'string' ||
        !/^chest-[1-9][0-9]*$/.test(chest.id) ||
        !checkpointInteger(Number(chest.id.slice(6)), 1, value.nextChest) ||
        chestIds.has(chest.id) ||
        !checkpointCell(chest.cell) ||
        chests.has(key(chest.cell)) ||
        !checkpointInteger(chest.revision) ||
        !checkpointSlots(chest.slots, CHEST_SLOTS, restored.items)
      )
        return invalid();
      chestIds.add(chest.id);
      chests.set(key(chest.cell), {
        id: chest.id,
        cell: [...chest.cell],
        revision: chest.revision,
        slots: clone(chest.slots),
      });
    }
    restored.players = players;
    restored.chests = chests;
    restored.nextChest = value.nextChest;
    return restored;
  }
  join(id: string): void {
    if (!this.players.has(id))
      this.players.set(id, {
        revision: 0,
        selected: 0,
        bag: empty(BAG_SLOTS),
        craft2: empty(4),
        craft3: empty(9),
        equipment: empty(EQUIPMENT.length),
        station: null,
      });
    this.close(id);
  }
  close(id: string): void {
    const player = this.players.get(id);
    if (player) player.station = null;
  }
  view(id: string, catalog = false): InventoryView {
    const p = this.player(id),
      chest = this.chest(p);
    return {
      version: INVENTORY_VERSION,
      catalog,
      revision: p.revision,
      selected: p.selected,
      bag: clone(p.bag),
      craft2: clone(p.craft2),
      craft3: clone(p.craft3),
      equipment: clone(p.equipment),
      station: p.station?.kind ?? 'personal',
      container: chest
        ? {
            id: chest.id,
            cell: [...chest.cell],
            revision: chest.revision,
            slots: clone(chest.slots),
          }
        : null,
    };
  }
  viewers(containerId: string): string[] {
    return [...this.players]
      .filter(([, p]) => p.station?.containerId === containerId)
      .map(([id]) => id);
  }
  refresh(id: string): boolean {
    const p = this.player(id),
      station = p.station;
    if (
      station &&
      (this.access.station(station.cell) !== station.kind ||
        !this.access.canUse(id, station.cell, false) ||
        (station.kind === 'container' && !this.chest(p)))
    ) {
      p.station = null;
      return true;
    }
    return false;
  }
  canBreak(cell: Cell): boolean {
    return !this.chests.get(key(cell))?.slots.some(Boolean);
  }
  removed(cell: Cell): string[] {
    this.chests.delete(key(cell));
    const closed: string[] = [];
    for (const [id, p] of this.players)
      if (p.station && key(p.station.cell) === key(cell)) {
        p.station = null;
        closed.push(id);
      }
    return closed;
  }
  transact(id: string, command: InventoryCommand, allowGive: boolean): InventoryOutcome {
    const p = this.player(id);
    if (command.kind === 'close') {
      p.station = null;
      return { ok: true, reason: 'closed' };
    }
    if (command.kind === 'open') {
      if (!command.target) {
        p.station = null;
        return { ok: true, reason: 'opened' };
      }
      const kind = this.access.station(command.target);
      if (!kind || !this.access.canUse(id, command.target, true))
        return { ok: false, reason: 'out_of_reach' };
      let chest: Chest | undefined;
      if (kind === 'container') {
        chest = this.chests.get(key(command.target));
        if (!chest) {
          if (this.nextChest === Number.MAX_SAFE_INTEGER)
            return { ok: false, reason: 'identity_exhausted' };
          chest = {
            id: `chest-${++this.nextChest}`,
            cell: [...command.target],
            revision: 0,
            slots: empty(CHEST_SLOTS),
          };
          this.chests.set(key(command.target), chest);
        }
      }
      p.station = { kind, cell: [...command.target], ...(chest ? { containerId: chest.id } : {}) };
      return { ok: true, reason: 'opened' };
    }
    this.refresh(id);
    if (command.revision !== p.revision) return { ok: false, reason: 'conflict' };
    if (command.kind === 'select') {
      if (!Number.isInteger(command.slot) || command.slot < 0 || command.slot > 8)
        return { ok: false, reason: 'invalid_slot' };
      if (p.selected !== command.slot) {
        p.selected = command.slot;
        p.revision++;
      }
      return { ok: true, reason: 'selected' };
    }
    if (command.kind === 'drop' || command.kind === 'consume')
      return { ok: false, reason: 'world_action_required' };
    const draft: Own = {
      revision: p.revision,
      bag: clone(p.bag),
      craft2: clone(p.craft2),
      craft3: clone(p.craft3),
      equipment: clone(p.equipment),
    };
    let changedChest: Chest | undefined;
    if (command.kind === 'give') {
      if (!allowGive) return { ok: false, reason: 'forbidden' };
      const item = this.items.get(command.itemType);
      if (!item || !Number.isSafeInteger(command.count) || command.count < 1 || command.count > 999)
        return { ok: false, reason: 'invalid_item' };
      if (!this.insert(draft.bag, item, command.count)) return { ok: false, reason: 'full' };
    } else if (command.kind === 'craft') {
      if (command.grid === 3 && p.station?.kind !== 'workbench')
        return { ok: false, reason: 'station_required' };
      if (!Number.isSafeInteger(command.count) || command.count < 1 || command.count > 64)
        return { ok: false, reason: 'invalid_count' };
      const grid = command.grid === 2 ? draft.craft2 : draft.craft3;
      const recipe = matchRecipe(grid, command.grid, this.recipes, this.items);
      if (!recipe) return { ok: false, reason: 'no_recipe' };
      for (const stack of grid)
        if (stack && stack.count < command.count) return { ok: false, reason: 'insufficient' };
      for (let i = 0; i < grid.length; i++)
        if (grid[i])
          grid[i] =
            grid[i]!.count === command.count
              ? null
              : { ...grid[i]!, count: grid[i]!.count - command.count };
      const item = this.items.get(recipe.result.itemType)!;
      if (!this.insert(draft.bag, item, recipe.result.count * command.count, recipe.result))
        return { ok: false, reason: 'full' };
    } else {
      const usesChest = command.from.area === 'container' || command.to.area === 'container';
      const chest = this.chest(p);
      if (
        usesChest &&
        (!chest || command.containerId !== chest.id || command.containerRevision !== chest.revision)
      )
        return { ok: false, reason: 'conflict' };
      const chestSlots = chest ? clone(chest.slots) : null;
      const slots = (ref: SlotRef, writing = false): Slot[] | null => {
        if (ref.area === 'container') return chestSlots;
        if (writing && ref.area === 'craft3' && p.station?.kind !== 'workbench') return null;
        return draft[ref.area];
      };
      const from = slots(command.from),
        to = slots(command.to, true);
      if (
        !from ||
        !to ||
        !Number.isInteger(command.from.slot) ||
        !Number.isInteger(command.to.slot) ||
        command.from.slot < 0 ||
        command.to.slot < 0 ||
        command.from.slot >= from.length ||
        command.to.slot >= to.length ||
        (from === to && command.from.slot === command.to.slot)
      )
        return { ok: false, reason: 'invalid_slot' };
      const source = from[command.from.slot],
        target = to[command.to.slot];
      if (
        !source ||
        !Number.isSafeInteger(command.count) ||
        command.count < 1 ||
        command.count > source.count
      )
        return { ok: false, reason: 'insufficient' };
      const item = this.items.get(source.itemType)!;
      const fits = (ref: SlotRef, stack: Stack | null) =>
        !stack ||
        ((ref.area !== 'craft3' || p.station?.kind === 'workbench') &&
          (ref.area !== 'equipment' ||
            (stack.count === 1 &&
              this.items.get(stack.itemType)?.equipment === EQUIPMENT[ref.slot])));
      const moved = { ...source, count: command.count };
      if (!fits(command.to, moved)) return { ok: false, reason: 'wrong_equipment' };
      if (target && !sameStack(source, target)) {
        if (command.count !== source.count || !fits(command.from, target))
          return { ok: false, reason: 'occupied' };
        from[command.from.slot] = target;
        to[command.to.slot] = source;
      } else {
        if ((target?.count ?? 0) + command.count > item.maxStack)
          return { ok: false, reason: 'full' };
        from[command.from.slot] =
          source.count === command.count
            ? null
            : { ...source, count: source.count - command.count };
        to[command.to.slot] = { ...source, count: (target?.count ?? 0) + command.count };
      }
      if (usesChest && chest && chestSlots)
        changedChest = { ...chest, slots: chestSlots, revision: chest.revision + 1 };
    }
    p.bag = draft.bag;
    p.craft2 = draft.craft2;
    p.craft3 = draft.craft3;
    p.equipment = draft.equipment;
    p.revision++;
    if (changedChest) this.chests.set(key(changedChest.cell), changedChest);
    return {
      ok: true,
      reason: command.kind,
      ...(changedChest ? { containerChanged: changedChest.id } : {}),
    };
  }
  held(id: string): { slot: number; stack: Slot; revision: number } {
    const p = this.player(id);
    return { slot: p.selected, stack: copyStack(p.bag[p.selected]), revision: p.revision };
  }
  appearance(id: string): ActorAppearance {
    const p = this.player(id);
    return {
      held: p.bag[p.selected]?.itemType ?? null,
      equipment: {
        head: p.equipment[0]?.itemType ?? null,
        body: p.equipment[1]?.itemType ?? null,
        legs: p.equipment[2]?.itemType ?? null,
        feet: p.equipment[3]?.itemType ?? null,
        offhand: p.equipment[4]?.itemType ?? null,
      },
    };
  }
  equipped(id: string): ItemDefinition[] {
    return this.player(id).equipment.flatMap((stack) =>
      stack ? [this.items.get(stack.itemType)!] : [],
    );
  }
  active(id: string): ItemDefinition[] {
    const p = this.player(id),
      held = p.bag[p.selected],
      item = held && this.items.get(held.itemType);
    return [...this.equipped(id), ...(item?.activation === 'held' ? [item] : [])];
  }
  consume(
    id: string,
    slot: number,
    revision: number,
    apply: (nutrition: number) => string,
  ): InventoryOutcome {
    const p = this.player(id),
      stack = p.bag[slot];
    if (p.revision !== revision) return { ok: false, reason: 'conflict' };
    if (!Number.isInteger(slot) || slot < 0 || slot >= BAG_SLOTS || !stack)
      return { ok: false, reason: 'insufficient' };
    const nutrition = this.items.get(stack.itemType)?.food;
    if (!nutrition) return { ok: false, reason: 'not_food' };
    const reason = apply(nutrition);
    if (reason !== 'eaten') return { ok: false, reason };
    p.bag[slot] = stack.count === 1 ? null : { ...stack, count: stack.count - 1 };
    p.revision++;
    return { ok: true, reason };
  }
  wearEquipment(id: string, effect: 'fall' | 'armor' | 'jump' | 'sun' | 'vision'): boolean {
    const p = this.player(id);
    let changed = false;
    p.equipment = p.equipment.map((stack) => {
      if (!stack?.instance?.durability) return stack;
      const item = this.items.get(stack.itemType)!;
      const contributes =
        effect === 'vision'
          ? item.perks?.vision
          : effect === 'sun'
            ? item.perks?.sunRegen
            : effect === 'fall'
              ? item.modifiers?.fall || item.perks?.fallImmune
              : effect === 'jump'
                ? item.modifiers?.jump !== undefined && item.modifiers.jump !== 1
                : item.modifiers?.armor;
      if (!contributes) return stack;
      changed = true;
      return stack.instance.durability === 1
        ? null
        : { ...stack, instance: { durability: stack.instance.durability - 1 } };
    });
    if (changed) p.revision++;
    return changed;
  }
  drain(id: string, spawn: (stack: Stack) => void): void {
    const p = this.player(id);
    for (const stack of [...p.bag, ...p.craft2, ...p.craft3, ...p.equipment])
      if (stack) spawn(copyStack(stack)!);
    p.bag = empty(BAG_SLOTS);
    p.craft2 = empty(4);
    p.craft3 = empty(9);
    p.equipment = empty(EQUIPMENT.length);
    p.station = null;
    p.selected = 0;
    p.revision++;
  }
  place(id: string, revision: number, family: string, apply: () => boolean): InventoryOutcome {
    const p = this.player(id),
      stack = p.bag[p.selected];
    if (p.revision !== revision) return { ok: false, reason: 'conflict' };
    if (!stack || this.items.get(stack.itemType)?.places !== family)
      return { ok: false, reason: 'not_owned' };
    const remainder = this.items.get(stack.itemType)?.remainder;
    const next = remainder
      ? makeStack(this.items.get(remainder)!, 1)
      : stack.count === 1
        ? null
        : { ...stack, count: stack.count - 1 };
    if (!apply()) return { ok: false, reason: 'unchanged' };
    p.bag[p.selected] = next;
    p.revision++;
    return { ok: true, reason: 'placed' };
  }
  collect(id: string, revision: number, family: string, apply: () => boolean): InventoryOutcome {
    const p = this.player(id),
      stack = p.bag[p.selected];
    if (p.revision !== revision) return { ok: false, reason: 'conflict' };
    const rule = stack && this.items.get(stack.itemType)?.collects;
    if (!rule || rule.family !== family) return { ok: false, reason: 'container_required' };
    const filled = makeStack(this.items.get(rule.result)!, 1);
    if (!apply()) return { ok: false, reason: 'unchanged' };
    p.bag[p.selected] = filled;
    p.revision++;
    return { ok: true, reason: 'collected' };
  }
  ignite(id: string, revision: number, creative: boolean, apply: () => boolean): InventoryOutcome {
    const p = this.player(id),
      stack = p.bag[p.selected];
    if (p.revision !== revision) return { ok: false, reason: 'conflict' };
    if (!creative && (!stack?.instance?.durability || !this.items.get(stack.itemType)?.igniter))
      return { ok: false, reason: 'igniter_required' };
    if (!apply()) return { ok: false, reason: 'unchanged' };
    if (!creative && stack?.instance?.durability) {
      p.bag[p.selected] =
        stack.instance.durability === 1
          ? null
          : { ...stack, instance: { durability: stack.instance.durability - 1 } };
      p.revision++;
    }
    return { ok: true, reason: 'ignited' };
  }
  explode(cell: Cell, spawn: (stack: Stack) => void): string[] {
    const chest = this.chests.get(key(cell));
    if (chest) for (const stack of chest.slots) if (stack) spawn(copyStack(stack)!);
    return this.removed(cell);
  }
  strike(id: string, revision: number, apply: () => boolean): InventoryOutcome {
    const p = this.player(id),
      stack = p.bag[p.selected];
    if (revision !== p.revision) return { ok: false, reason: 'conflict' };
    if (!apply()) return { ok: false, reason: 'protected' };
    if (stack?.instance?.durability && this.items.get(stack.itemType)?.combat) {
      p.bag[p.selected] =
        stack.instance.durability === 1
          ? null
          : { ...stack, instance: { durability: stack.instance.durability - 1 } };
      p.revision++;
    }
    return { ok: true, reason: 'hit' };
  }
  mine(id: string, slot: number, expected: Slot, apply: () => boolean): InventoryOutcome {
    const p = this.player(id),
      stack = p.bag[p.selected];
    if (
      p.selected !== slot ||
      !!stack !== !!expected ||
      (stack && expected && !sameStack(stack, expected))
    )
      return { ok: false, reason: 'tool_changed' };
    if (!apply()) return { ok: false, reason: 'unchanged' };
    if (stack?.instance?.durability && this.items.get(stack.itemType)?.tool) {
      p.bag[p.selected] =
        stack.instance.durability === 1
          ? null
          : { ...stack, instance: { durability: stack.instance.durability - 1 } };
      p.revision++;
    }
    return { ok: true, reason: 'mined' };
  }
  drop(
    id: string,
    slot: number,
    count: number,
    revision: number,
    spawn: (stack: Stack) => void,
  ): InventoryOutcome {
    const p = this.player(id),
      stack = p.bag[slot];
    if (revision !== p.revision) return { ok: false, reason: 'conflict' };
    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= BAG_SLOTS ||
      !stack ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > stack.count
    )
      return { ok: false, reason: 'insufficient' };
    spawn({ ...copyStack(stack)!, count });
    p.bag[slot] = count === stack.count ? null : { ...stack, count: stack.count - count };
    p.revision++;
    return { ok: true, reason: 'dropped' };
  }
  receive(id: string, stack: Stack): number {
    if (!validStack(stack, this.items)) throw new Error('invalid pickup stack');
    const p = this.player(id),
      bag = clone(p.bag),
      remaining = this.fill(bag, this.items.get(stack.itemType)!, stack.count, stack);
    const accepted = stack.count - remaining;
    if (accepted) {
      p.bag = bag;
      p.revision++;
    }
    return accepted;
  }
  dispose(): void {
    this.players.clear();
    this.chests.clear();
  }
  private player(id: string): Player {
    const p = this.players.get(id);
    if (!p) throw new Error('unknown inventory owner');
    return p;
  }
  private chest(p: Player): Chest | undefined {
    if (p.station?.kind !== 'container') return undefined;
    const chest = this.chests.get(key(p.station.cell));
    return chest?.id === p.station.containerId ? chest : undefined;
  }
  private insert(slots: Slot[], item: ItemDefinition, count: number, template?: Stack): boolean {
    return this.fill(slots, item, count, template) === 0;
  }
  private fill(slots: Slot[], item: ItemDefinition, count: number, template?: Stack): number {
    const prototype = template ?? makeStack(item, Math.min(count, item.maxStack));
    for (let i = 0; i < slots.length && count > 0; i++) {
      const stack = slots[i];
      if (stack && sameStack(stack, prototype)) {
        const moved = Math.min(count, item.maxStack - stack.count);
        slots[i] = { ...stack, count: stack.count + moved };
        count -= moved;
      }
    }
    for (let i = 0; i < slots.length && count > 0; i++)
      if (!slots[i]) {
        const moved = Math.min(count, item.maxStack);
        slots[i] = { ...copyStack(prototype)!, count: moved };
        count -= moved;
      }
    return count;
  }
}
