/**
 * Read-only crafting preview — must match apps/minecraft-server/src/inventory.ts
 * tryCraftFromGrid pattern checks + output space (no mutations).
 */
import {
  BLOCK_REGISTRY,
  ITEM_REGISTRY,
  CRAFTING_CELL_MAX,
  CRAFTING_GRID_SLOTS,
  PLACEABLE_BLOCK_IDS,
  type CraftingGridSlot,
  type ItemSlot
} from "@/lib/voxelProtocol";

const KNOWN_ITEMS = new Set<number>([ITEM_REGISTRY.STICK, ITEM_REGISTRY.PLANKS]);
const MAX_STACK = 64;

const STICK_PLANK_PAIRS: [number, number][] = [
  [0, 2],
  [1, 3],
  [0, 1],
  [2, 3]
];

function normalizeCraftRead(s: CraftingGridSlot): void {
  if (!Number.isFinite(s.count) || s.count <= 0) {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.itemId = 0;
    s.count = 0;
    return;
  }
  s.count = Math.max(0, Math.min(MAX_STACK, Math.floor(s.count)));
  if (s.itemId > 0) {
    if (!KNOWN_ITEMS.has(s.itemId)) {
      s.blockId = BLOCK_REGISTRY.AIR;
      s.itemId = 0;
      s.count = 0;
      return;
    }
    s.blockId = BLOCK_REGISTRY.AIR;
    return;
  }
  if (s.blockId !== BLOCK_REGISTRY.AIR && !PLACEABLE_BLOCK_IDS.includes(s.blockId)) {
    s.blockId = BLOCK_REGISTRY.AIR;
    s.itemId = 0;
    s.count = 0;
  }
}

function maxAddableItemCount(slots: ItemSlot[], itemId: number): number {
  if (itemId === 0) return 0;
  let space = 0;
  for (const s of slots) {
    if (s.itemId === itemId && s.count > 0 && s.count < MAX_STACK) {
      space += MAX_STACK - s.count;
    } else if (s.itemId === 0 || s.count <= 0) {
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
  return (
    a.kind === "item" &&
    a.itemId === ITEM_REGISTRY.PLANKS &&
    a.count >= 1 &&
    a.count <= CRAFTING_CELL_MAX
  );
}

function stickPreviewOk(grid: CraftingGridSlot[], itemSlots: ItemSlot[]): boolean {
  if (maxAddableItemCount(itemSlots, ITEM_REGISTRY.STICK) < 4) return false;
  const atoms = grid.map((c) => {
    const copy = { ...c };
    return readCraftAtom(copy);
  });
  for (const [i, j] of STICK_PLANK_PAIRS) {
    const ai = atoms[i]!;
    const aj = atoms[j]!;
    if (!isPlankCell(ai) || !isPlankCell(aj)) continue;
    const others = [0, 1, 2, 3].filter((k) => k !== i && k !== j);
    if (!others.every((k) => isEmptyCraftAtom(atoms[k]!))) continue;
    return true;
  }
  return false;
}

/** What the result slot would craft (if the player clicks), or null. */
export function craftingGridPreview(
  grid: CraftingGridSlot[],
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
    return maxAddableItemCount(itemSlots, ITEM_REGISTRY.PLANKS) >= 4 ? "planks" : null;
  }

  return stickPreviewOk(g, itemSlots) ? "stick" : null;
}
