import {
  REGISTERED_ITEM_IDS,
  ITEM_REGISTRY,
  itemMaxStack
} from "@playground/voxel-content";
import {
  BLOCK_REGISTRY,
  CRAFTING_CELL_MAX,
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
export type ItemInventoryState = ItemSlot[];
export type CraftingGridState = CraftingGridSlot[];

export function createEmptyHotbar(): HotbarState {
  return Array.from({ length: HOTBAR_SLOT_COUNT }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    count: 0
  }));
}

export function cloneHotbar(slots: HotbarState): HotbarState {
  return slots.map((s) => ({ blockId: s.blockId, count: s.count }));
}

/** Blocks that never drop an item into the hotbar (fluid / air). */
export function blockDropsPickable(blockId: number): boolean {
  return blockDropId(blockId) !== null;
}

export function blockBreakable(blockId: number): boolean {
  if (blockId === BLOCK_REGISTRY.AIR) return false;
  if (blockId === BLOCK_REGISTRY.WATER) return false;
  if (blockId === BLOCK_REGISTRY.BEDROCK) return false;
  return true;
}

export function blockDropId(blockId: number): number | null {
  if (!blockBreakable(blockId)) return null;
  if (blockId === BLOCK_REGISTRY.STONE) return BLOCK_REGISTRY.COBBLESTONE;
  return blockId;
}

function findStackIndex(slots: HotbarState, blockId: number): number {
  return slots.findIndex(
    (s) => s.blockId === blockId && s.count > 0 && s.count < MAX_STACK
  );
}

function findEmptyIndex(slots: HotbarState): number {
  return slots.findIndex((s) => s.blockId === BLOCK_REGISTRY.AIR || s.count <= 0);
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
    slots[i].count = 0;
  } else {
    slots[i].count = next;
  }
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
    const cell = raw[i] as { blockId?: unknown; count?: unknown };
    const blockId = Number(cell?.blockId);
    const count = Number(cell?.count);
    if (!Number.isFinite(count)) continue;
    if (blockId === BLOCK_REGISTRY.AIR && count === 0) {
      out[i] = { blockId: BLOCK_REGISTRY.AIR, count: 0 };
      continue;
    }
    if (!PLACEABLE_BLOCK_IDS.includes(blockId)) continue;
    out[i] = {
      blockId,
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
  return slots.map((s) => ({ itemId: s.itemId, count: s.count }));
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
    const cell = raw[i] as { itemId?: unknown; count?: unknown };
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
    out[i] = {
      itemId,
      count: Math.max(0, Math.min(cap, Math.floor(count)))
    };
  }
  return out;
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
  return grid.map((c) => ({ blockId: c.blockId, itemId: c.itemId, count: c.count }));
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
  if (!Array.isArray(raw) || raw.length !== CRAFTING_GRID_SLOTS) {
    return cloneCraftingGrid(fallback);
  }
  const out = createEmptyCraftingGrid();
  for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
    const cell = raw[i] as {
      blockId?: unknown;
      itemId?: unknown;
      count?: unknown;
    };
    out[i] = {
      blockId: Number(cell?.blockId) || 0,
      itemId: Number(cell?.itemId) || 0,
      count: Number(cell?.count) || 0
    };
    normalizeCraftingSlot(out[i]);
  }
  return out;
}

type SlotAtom =
  | { kind: "empty" }
  | { kind: "block"; blockId: number; count: number }
  | { kind: "item"; itemId: number; count: number };

function readHotbarAtom(s: HotbarSlot): SlotAtom {
  if (s.blockId === BLOCK_REGISTRY.AIR || s.count <= 0) return { kind: "empty" };
  if (!PLACEABLE_BLOCK_IDS.includes(s.blockId)) return { kind: "empty" };
  return { kind: "block", blockId: s.blockId, count: s.count };
}

function readItemAtom(s: ItemSlot): SlotAtom {
  if (s.itemId === 0 || s.count <= 0) return { kind: "empty" };
  if (!REGISTERED_ITEM_IDS.has(s.itemId)) return { kind: "empty" };
  return { kind: "item", itemId: s.itemId, count: s.count };
}

function readCraftAtom(s: CraftingGridSlot): SlotAtom {
  normalizeCraftingSlot(s);
  if (s.count <= 0) return { kind: "empty" };
  if (s.itemId > 0) return { kind: "item", itemId: s.itemId, count: s.count };
  if (s.blockId !== BLOCK_REGISTRY.AIR)
    return { kind: "block", blockId: s.blockId, count: s.count };
  return { kind: "empty" };
}

function writeHotbarAtom(s: HotbarSlot, a: SlotAtom): void {
  if (a.kind === "empty") {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.count = 0;
    return;
  }
  if (a.kind === "block") {
    s.blockId = a.blockId;
    s.count = a.count;
  }
}

function writeItemAtom(s: ItemSlot, a: SlotAtom): void {
  if (a.kind === "empty") {
    s.itemId = 0;
    s.count = 0;
    return;
  }
  if (a.kind === "item") {
    s.itemId = a.itemId;
    s.count = a.count;
  }
}

function writeCraftAtom(s: CraftingGridSlot, a: SlotAtom): void {
  if (a.kind === "empty") {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.itemId = 0;
    s.count = 0;
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
}

function readAtom(
  hotbar: HotbarState,
  items: ItemSlot[],
  craft: CraftingGridState,
  region: InventoryMoveReq["from"],
  index: number
): SlotAtom {
  if (region === "hotbar") return readHotbarAtom(hotbar[index]!);
  if (region === "storage") return readItemAtom(items[index]!);
  return readCraftAtom(craft[index]!);
}

function writeAtom(
  hotbar: HotbarState,
  items: ItemSlot[],
  craft: CraftingGridState,
  region: InventoryMoveReq["from"],
  index: number,
  a: SlotAtom
): void {
  if (region === "hotbar") writeHotbarAtom(hotbar[index]!, a);
  else if (region === "storage") writeItemAtom(items[index]!, a);
  else writeCraftAtom(craft[index]!, a);
}

function regionAllowsAtom(
  region: InventoryMoveReq["from"],
  a: SlotAtom
): boolean {
  if (a.kind === "empty") return true;
  if (region === "hotbar") return a.kind === "block";
  if (region === "storage") return a.kind === "item";
  return a.kind === "block" || a.kind === "item";
}

function sameAtomStack(a: SlotAtom, b: SlotAtom): boolean {
  if (a.kind === "empty" || b.kind === "empty") return false;
  if (a.kind === "block" && b.kind === "block") return a.blockId === b.blockId;
  if (a.kind === "item" && b.kind === "item") return a.itemId === b.itemId;
  return false;
}

function validMoveIndex(
  region: InventoryMoveReq["from"],
  index: number
): boolean {
  if (!Number.isInteger(index) || index < 0) return false;
  if (region === "hotbar") return index < HOTBAR_SLOT_COUNT;
  if (region === "storage") return index < MAIN_ITEM_INVENTORY_SLOTS;
  return index < CRAFTING_GRID_SLOTS;
}

function mergeRoomForDestination(
  to: InventoryMoveReq["from"],
  b: SlotAtom
): number {
  if (b.kind === "empty") return 0;
  if (to === "craft") return Math.max(0, CRAFTING_CELL_MAX - b.count);
  if (b.kind === "block") return Math.max(0, MAX_STACK - b.count);
  if (b.kind === "item") return Math.max(0, itemMaxStack(b.itemId) - b.count);
  return 0;
}

function atomExceedsCraftMax(a: SlotAtom): boolean {
  if (a.kind === "empty") return false;
  return a.count > CRAFTING_CELL_MAX;
}

/**
 * Move / merge / swap one stack between hotbar, item storage, and 2×2 craft grid.
 * Hotbar holds blocks only; storage holds items only; craft holds either.
 * Crafting cells accept at most one unit (`CRAFTING_CELL_MAX`); dragging from
 * stacks places one unit unless the whole source is one unit.
 */
export function applyInventoryMove(
  hotbar: HotbarState,
  itemSlots: ItemSlot[],
  craft: CraftingGridState,
  req: InventoryMoveReq
): boolean {
  const { from, fromIndex: fi, to, toIndex: ti } = req;
  if (!validMoveIndex(from, fi) || !validMoveIndex(to, ti)) return false;
  if (from === to && fi === ti) return true;

  for (const c of craft) normalizeCraftingSlot(c);

  let a = readAtom(hotbar, itemSlots, craft, from, fi);
  let b = readAtom(hotbar, itemSlots, craft, to, ti);
  if (a.kind === "empty") return false;
  if (!regionAllowsAtom(to, a)) return false;
  if (!regionAllowsAtom(from, b)) return false;

  const toCraft = to === "craft";
  const fromCraft = from === "craft";

  if (b.kind === "empty") {
    if (!toCraft) {
      writeAtom(hotbar, itemSlots, craft, to, ti, a);
      writeAtom(hotbar, itemSlots, craft, from, fi, { kind: "empty" });
      return true;
    }
    const take = Math.min(a.count, CRAFTING_CELL_MAX);
    if (take <= 0) return false;
    if (a.kind === "block") {
      writeAtom(hotbar, itemSlots, craft, to, ti, {
        kind: "block",
        blockId: a.blockId,
        count: take
      });
    } else {
      writeAtom(hotbar, itemSlots, craft, to, ti, {
        kind: "item",
        itemId: a.itemId,
        count: take
      });
    }
    const left = a.count - take;
    if (left <= 0) {
      writeAtom(hotbar, itemSlots, craft, from, fi, { kind: "empty" });
    } else if (a.kind === "block") {
      writeAtom(hotbar, itemSlots, craft, from, fi, {
        kind: "block",
        blockId: a.blockId,
        count: left
      });
    } else {
      writeAtom(hotbar, itemSlots, craft, from, fi, {
        kind: "item",
        itemId: a.itemId,
        count: left
      });
    }
    return true;
  }

  if (sameAtomStack(a, b)) {
    const room = mergeRoomForDestination(to, b);
    const move =
      a.kind === "block" || a.kind === "item" ? Math.min(a.count, room) : 0;
    if (move <= 0) {
      if (toCraft && !fromCraft) return false;
      if (atomExceedsCraftMax(a) || atomExceedsCraftMax(b)) return false;
      writeAtom(hotbar, itemSlots, craft, from, fi, b);
      writeAtom(hotbar, itemSlots, craft, to, ti, a);
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
      b = { kind: "item", itemId: b.itemId, count: b.count + move };
      const newSrcCount = a.count - move;
      a =
        newSrcCount <= 0
          ? { kind: "empty" }
          : { kind: "item", itemId: a.itemId, count: newSrcCount };
    } else {
      a = { kind: "empty" };
    }
    writeAtom(hotbar, itemSlots, craft, to, ti, b);
    writeAtom(hotbar, itemSlots, craft, from, fi, a);
    return true;
  }

  if (atomExceedsCraftMax(a) || atomExceedsCraftMax(b)) return false;
  writeAtom(hotbar, itemSlots, craft, from, fi, b);
  writeAtom(hotbar, itemSlots, craft, to, ti, a);
  return true;
}


function isEmptyCraftAtom(a: SlotAtom): boolean {
  return a.kind === "empty";
}

function isPlankCell(a: SlotAtom): boolean {
  if (a.kind === "empty") return false;
  if (a.count < 1 || a.count > CRAFTING_CELL_MAX) return false;
  if (a.kind === "item") return a.itemId === ITEM_REGISTRY.PLANKS;
  if (a.kind === "block") return a.blockId === BLOCK_REGISTRY.OAK_PLANKS;
  return false;
}

function tryCraftSticksShapeless(
  itemSlots: ItemSlot[],
  grid: CraftingGridState
): boolean {
  const plankCellIndices: number[] = [];
  let otherNonEmpty = 0;
  for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
    const c = grid[i]!;
    const atom = readCraftAtom(c);
    if (atom.kind === "empty") continue;
    if (isPlankCell(atom)) {
      plankCellIndices.push(i);
    } else {
      otherNonEmpty++;
    }
  }

  if (plankCellIndices.length === 2 && otherNonEmpty === 0) {
    if (maxAddableItemCount(itemSlots, ITEM_REGISTRY.STICK) < 4) return false;
    for (const i of plankCellIndices) {
      grid[i]!.count -= 1;
      normalizeCraftingSlot(grid[i]!);
    }
    addItemCount(itemSlots, ITEM_REGISTRY.STICK, 4);
    return true;
  }

  return false;
}

/**
 * Craft from the 2×2 grid into hotbar / item storage (survival). Patterns:
 * - One oak log alone in the grid → 4 placeable oak planks
 * - Two planks (legacy item planks or placeable plank blocks), rest empty → 4 sticks
 */
export function tryCraftFromGrid(
  hotbar: HotbarState,
  itemSlots: ItemSlot[],
  grid: CraftingGridState
): boolean {
  for (const c of grid) normalizeCraftingSlot(c);

  let woodCells = 0;
  let woodIdx = -1;
  let otherNonEmpty = 0;
  for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
    const c = grid[i]!;
    const atom = readCraftAtom(c);
    if (atom.kind === "empty") continue;
    if (atom.kind === "block" && atom.blockId === BLOCK_REGISTRY.WOOD) {
      woodCells += 1;
      woodIdx = i;
    } else {
      otherNonEmpty += 1;
    }
  }

  if (woodCells === 1 && otherNonEmpty === 0 && woodIdx >= 0) {
    const cell = grid[woodIdx]!;
    if (cell.count < 1) return false;
    if (maxAddableBlockCount(hotbar, BLOCK_REGISTRY.OAK_PLANKS) < 4) return false;
    cell.count -= 1;
    normalizeCraftingSlot(cell);
    addBlockCount(hotbar, BLOCK_REGISTRY.OAK_PLANKS, 4);
    return true;
  }

  return tryCraftSticksShapeless(itemSlots, grid);
}
