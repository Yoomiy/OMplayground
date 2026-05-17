/**
 * Read-only crafting preview — must match apps/minecraft-server/src/inventory.ts
 * tryCraftFromGrid pattern checks + output space (no mutations).
 */
import {
  REGISTERED_ITEM_IDS,
  ITEM_REGISTRY,
  itemMaxStack
} from "@playground/voxel-content";
import {
  BLOCK_REGISTRY,
  CRAFTING_CELL_MAX,
  CRAFTING_GRID_SLOTS,
  PLACEABLE_BLOCK_IDS,
  type CraftingGridSlot,
  type ItemSlot
} from "@/lib/voxelProtocol";

const MAX_STACK = 64;

function normalizeCraftRead(s: CraftingGridSlot): void {
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

function maxAddableItemCount(slots: ItemSlot[], itemId: number): number {
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

function maxAddableBlockCount(slots: { blockId: number; count: number }[], blockId: number): number {
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

type CraftAtom =
  | { kind: "empty" }
  | { kind: "block"; blockId: number; count: number }
  | { kind: "item"; itemId: number; count: number };

function readCraftAtom(s: CraftingGridSlot): CraftAtom {
  normalizeCraftRead(s);
  if (s.count <= 0) return { kind: "empty" };
  if (s.itemId > 0) return { kind: "item", itemId: s.itemId, count: s.count };
  if (s.blockId !== BLOCK_REGISTRY.AIR)
    return { kind: "block", blockId: s.blockId, count: s.count };
  return { kind: "empty" };
}

function isEmptyCraftAtom(a: CraftAtom): boolean {
  return a.kind === "empty";
}

function isPlankCell(a: CraftAtom): boolean {
  if (a.kind === "empty") return false;
  if (a.count < 1 || a.count > CRAFTING_CELL_MAX) return false;
  if (a.kind === "item") return a.itemId === ITEM_REGISTRY.PLANKS;
  if (a.kind === "block") return a.blockId === BLOCK_REGISTRY.OAK_PLANKS;
  return false;
}

function stickPreviewOk(grid: CraftingGridSlot[], itemSlots: ItemSlot[]): boolean {
  if (maxAddableItemCount(itemSlots, ITEM_REGISTRY.STICK) < 4) return false;
  
  let plankCells = 0;
  let otherNonEmpty = 0;

  for (const c of grid) {
    const copy = { ...c };
    const atom = readCraftAtom(copy);
    if (isEmptyCraftAtom(atom)) continue;
    if (isPlankCell(atom)) {
      plankCells++;
    } else {
      otherNonEmpty++;
    }
  }

  return plankCells === 2 && otherNonEmpty === 0;
}

/** What the result slot would craft (if the player clicks), or null. */
export function craftingGridPreview(
  grid: CraftingGridSlot[],
  hotbarSlots: { blockId: number; count: number }[],
  itemSlots: ItemSlot[]
): "planks" | "stick" | null {
  if (!Array.isArray(grid) || grid.length !== CRAFTING_GRID_SLOTS) return null;
  const g = grid.map((c) => ({ ...c }));

  let woodCells = 0;
  let woodIdx = -1;
  let otherNonEmpty = 0;
  for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
    const c = g[i]!;
    const atom = readCraftAtom(c);
    if (atom.kind === "empty") continue;
    if (atom.kind === "block" && atom.blockId === BLOCK_REGISTRY.WOOD) {
      woodCells += 1;
      woodIdx = i;
    } else {
      otherNonEmpty += 1;
    }
  }
  if (woodCells === 1 && otherNonEmpty === 0 && woodIdx >= 0 && g[woodIdx]!.count >= 1) {
    return maxAddableBlockCount(hotbarSlots, BLOCK_REGISTRY.OAK_PLANKS) >= 4
      ? "planks"
      : null;
  }

  return stickPreviewOk(g, itemSlots) ? "stick" : null;
}
