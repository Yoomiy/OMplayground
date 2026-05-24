/**
 * Read-only crafting preview — uses shared recipe matcher + output space checks.
 */
import {
  CRAFTING_GRID_WIDTH_2,
  REGISTERED_ITEM_IDS,
  findMatchingRecipe,
  itemMaxStack
} from "@playground/voxel-content";
import {
  BLOCK_REGISTRY,
  CRAFTING_CELL_MAX,
  CRAFTING_GRID_SLOTS,
  PLACEABLE_BLOCK_IDS,
  type CraftingGridWidth,
  type CraftingGridSlot,
  type ItemSlot
} from "@/lib/voxelProtocol";

const MAX_STACK = 64;
const PERSONAL_CRAFTING_SLOT_INDICES = [0, 1, 3, 4] as const;

export interface CraftingPreview {
  outputKind: "block" | "item";
  outputId: number;
  count: number;
}

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

/** What the result slot would craft (if the player clicks), or null. */
export function craftingGridPreview(
  grid: CraftingGridSlot[],
  hotbarSlots: { blockId: number; count: number }[],
  itemSlots: ItemSlot[],
  gridWidth: CraftingGridWidth = CRAFTING_GRID_WIDTH_2
): CraftingPreview | null {
  if (!Array.isArray(grid) || grid.length !== CRAFTING_GRID_SLOTS) return null;
  const g = grid.map((c) => ({ ...c }));
  for (const c of g) normalizeCraftRead(c);

  const activeGrid =
    gridWidth === CRAFTING_GRID_WIDTH_2
      ? PERSONAL_CRAFTING_SLOT_INDICES.map((idx) => g[idx]!)
      : g;
  const matched = findMatchingRecipe(activeGrid, gridWidth);
  if (!matched) return null;

  const { output } = matched.recipe;
  if (output.kind === "block") {
    if (maxAddableBlockCount(hotbarSlots, output.id) < output.count) return null;
  } else if (maxAddableItemCount(itemSlots, output.id) < output.count) {
    return null;
  }

  return {
    outputKind: output.kind,
    outputId: output.id,
    count: output.count
  };
}
