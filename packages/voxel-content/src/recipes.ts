/**
 * Unified shaped + shapeless crafting recipes shared by server + client preview.
 */

import { BLOCK_REGISTRY } from "./blocks";
import { ITEM_REGISTRY } from "./items";

export const PERSONAL_CRAFTING_GRID_SIZE = 4 as const;
export const CRAFTING_TABLE_GRID_SIZE = 9 as const;
export const CRAFTING_GRID_SIZE = PERSONAL_CRAFTING_GRID_SIZE;
export const CRAFTING_GRID_WIDTH_2 = 2 as const;
export const CRAFTING_GRID_WIDTH_3 = 3 as const;
export const CRAFTING_CELL_MAX = 1 as const;

export type RecipeTag = "planks" | "wood_logs" | "leaves";

export type RecipeIngredient =
  | { kind: "block"; blockId: number }
  | { kind: "item"; itemId: number }
  | { kind: "tag"; tag: RecipeTag };

export interface RecipeOutput {
  readonly kind: "block" | "item";
  readonly id: number;
  readonly count: number;
}

export interface ShapelessRecipe {
  readonly key: string;
  readonly kind: "shapeless";
  readonly inputs: readonly RecipeIngredient[];
  readonly output: RecipeOutput;
}

export interface ShapedRecipe {
  readonly key: string;
  readonly kind: "shaped";
  readonly width: number;
  readonly height: number;
  readonly pattern: readonly (RecipeIngredient | null)[];
  readonly output: RecipeOutput;
}

export type Recipe = ShapelessRecipe | ShapedRecipe;

export interface GridCellSnapshot {
  readonly blockId: number;
  readonly itemId: number;
  readonly count: number;
}

export type GridSnapshot = readonly GridCellSnapshot[];

export interface Matrix2D<T> {
  readonly width: number;
  readonly height: number;
  readonly data: readonly T[];
}

export interface MatchedRecipe {
  readonly recipe: Recipe;
  readonly consumeAt: readonly number[];
}

const PLANK_BLOCK_IDS = [
  BLOCK_REGISTRY.OAK_PLANKS,
  BLOCK_REGISTRY.BIRCH_PLANKS,
  BLOCK_REGISTRY.SPRUCE_PLANKS
] as const;

const WOOD_LOG_BLOCK_IDS = [
  BLOCK_REGISTRY.WOOD,
  BLOCK_REGISTRY.BIRCH_LOG,
  BLOCK_REGISTRY.SPRUCE_LOG
] as const;

const LEAF_BLOCK_IDS = [
  BLOCK_REGISTRY.LEAVES,
  BLOCK_REGISTRY.BIRCH_LEAVES,
  BLOCK_REGISTRY.SPRUCE_LEAVES,
  BLOCK_REGISTRY.LEAVES_YELLOW
] as const;

const planks = { kind: "tag", tag: "planks" } as const;
const leaves = { kind: "tag", tag: "leaves" } as const;
const stick = { kind: "item", itemId: ITEM_REGISTRY.STICK } as const;
const cobble = { kind: "block", blockId: BLOCK_REGISTRY.COBBLESTONE } as const;
const ironIngot = { kind: "item", itemId: ITEM_REGISTRY.IRON_INGOT } as const;
const goldIngot = { kind: "item", itemId: ITEM_REGISTRY.GOLD_INGOT } as const;
const diamond = { kind: "item", itemId: ITEM_REGISTRY.DIAMOND } as const;
const coal = { kind: "item", itemId: ITEM_REGISTRY.COAL } as const;
const flint = { kind: "item", itemId: ITEM_REGISTRY.FLINT } as const;
const wheat = { kind: "item", itemId: ITEM_REGISTRY.WHEAT } as const;

function block(blockId: number): RecipeIngredient {
  return { kind: "block", blockId };
}

function isEmptyCell(cell: GridCellSnapshot): boolean {
  return cell.count <= 0 || (cell.itemId === 0 && cell.blockId === BLOCK_REGISTRY.AIR);
}

function isPlankCell(cell: GridCellSnapshot): boolean {
  if (isEmptyCell(cell) || cell.count < 1 || cell.count > CRAFTING_CELL_MAX) return false;
  if (cell.itemId > 0) return cell.itemId === ITEM_REGISTRY.PLANKS;
  return (PLANK_BLOCK_IDS as readonly number[]).includes(cell.blockId);
}

function isWoodLogCell(cell: GridCellSnapshot): boolean {
  if (isEmptyCell(cell) || cell.count < 1 || cell.count > CRAFTING_CELL_MAX) return false;
  return cell.itemId === 0 && (WOOD_LOG_BLOCK_IDS as readonly number[]).includes(cell.blockId);
}

function isLeavesCell(cell: GridCellSnapshot): boolean {
  if (isEmptyCell(cell) || cell.count < 1 || cell.count > CRAFTING_CELL_MAX) return false;
  return cell.itemId === 0 && (LEAF_BLOCK_IDS as readonly number[]).includes(cell.blockId);
}

function cellMatchesIngredient(cell: GridCellSnapshot, ing: RecipeIngredient): boolean {
  if (isEmptyCell(cell) || cell.count < 1 || cell.count > CRAFTING_CELL_MAX) {
    return false;
  }
  switch (ing.kind) {
    case "block":
      return cell.itemId === 0 && cell.blockId === ing.blockId;
    case "item":
      return cell.itemId === ing.itemId;
    case "tag":
      if (ing.tag === "planks") return isPlankCell(cell);
      if (ing.tag === "wood_logs") return isWoodLogCell(cell);
      if (ing.tag === "leaves") return isLeavesCell(cell);
      return false;
    default:
      return false;
  }
}

export function getBoundingBox<T extends GridCellSnapshot | RecipeIngredient | null>(
  grid: readonly T[],
  width: number,
  isEmpty: (cell: T) => boolean
): Matrix2D<T> {
  if (!Number.isInteger(width) || width <= 0 || grid.length % width !== 0) {
    return { width: 0, height: 0, data: [] };
  }
  const height = grid.length / width;
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = -1;
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = -1;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r * width + c]!;
      if (isEmpty(cell)) continue;
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    }
  }

  if (maxRow < 0) return { width: 0, height: 0, data: [] };

  const data: T[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      data.push(grid[r * width + c]!);
    }
  }
  return {
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
    data
  };
}

function validGridWidth(grid: GridSnapshot, width: number): boolean {
  return (
    (width === CRAFTING_GRID_WIDTH_2 || width === CRAFTING_GRID_WIDTH_3) &&
    grid.length === width * width
  );
}

function matchShapeless(grid: GridSnapshot, recipe: ShapelessRecipe): number[] | null {
  const occupied: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (!isEmptyCell(grid[i]!)) occupied.push(i);
  }
  if (occupied.length !== recipe.inputs.length) return null;

  const used = new Set<number>();
  const consumeAt: number[] = [];
  for (const ing of recipe.inputs) {
    let found = -1;
    for (const idx of occupied) {
      if (used.has(idx)) continue;
      if (cellMatchesIngredient(grid[idx]!, ing)) {
        found = idx;
        break;
      }
    }
    if (found < 0) return null;
    used.add(found);
    consumeAt.push(found);
  }
  return consumeAt;
}

function matchShaped(
  grid: GridSnapshot,
  gridWidth: number,
  recipe: ShapedRecipe
): number[] | null {
  if (!validGridWidth(grid, gridWidth)) return null;
  if (recipe.pattern.length !== recipe.width * recipe.height) return null;

  const input = getBoundingBox(grid, gridWidth, isEmptyCell);
  const pattern = getBoundingBox(recipe.pattern, recipe.width, (cell) => cell === null);
  if (input.width === 0 || pattern.width === 0) return null;
  if (input.width !== pattern.width || input.height !== pattern.height) return null;

  const consumeAt: number[] = [];
  const inputIndices = activeInputIndices(grid, gridWidth);
  for (let i = 0; i < pattern.data.length; i++) {
    const ing = pattern.data[i];
    const cell = input.data[i]!;
    if (ing === null) {
      if (!isEmptyCell(cell)) return null;
      continue;
    }
    if (!cellMatchesIngredient(cell, ing)) return null;
    consumeAt.push(inputIndices[i]!);
  }
  return consumeAt;
}

function activeInputIndices(grid: GridSnapshot, width: number): number[] {
  const indices = grid.map((_, i) => i);
  const boxes = getBoundingBox(
    indices.map((idx) => grid[idx]!),
    width,
    isEmptyCell
  );
  if (boxes.width === 0) return [];

  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = -1;
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = -1;
  const height = grid.length / width;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (isEmptyCell(grid[r * width + c]!)) continue;
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    }
  }

  const out: number[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      out.push(r * width + c);
    }
  }
  return out;
}

function matchRecipeOnGrid(
  grid: GridSnapshot,
  gridWidth: number,
  recipe: Recipe
): number[] | null {
  if (recipe.kind === "shapeless") return matchShapeless(grid, recipe);
  return matchShaped(grid, gridWidth, recipe);
}

function shaped(
  key: string,
  width: number,
  height: number,
  pattern: readonly (RecipeIngredient | null)[],
  output: RecipeOutput
): ShapedRecipe {
  return { key, kind: "shaped", width, height, pattern, output };
}

function shapeless(
  key: string,
  inputs: readonly RecipeIngredient[],
  output: RecipeOutput
): ShapelessRecipe {
  return { key, kind: "shapeless", inputs, output };
}

function pickaxeRecipe(key: string, head: RecipeIngredient, outputId: number): ShapedRecipe {
  return shaped(key, 3, 3, [head, head, head, null, stick, null, null, stick, null], {
    kind: "item",
    id: outputId,
    count: 1
  });
}

function axeRecipe(key: string, head: RecipeIngredient, outputId: number): ShapedRecipe {
  return shaped(key, 3, 3, [head, head, null, head, stick, null, null, stick, null], {
    kind: "item",
    id: outputId,
    count: 1
  });
}

function shovelRecipe(key: string, head: RecipeIngredient, outputId: number): ShapedRecipe {
  return shaped(key, 1, 3, [head, stick, stick], {
    kind: "item",
    id: outputId,
    count: 1
  });
}

export const RECIPES: readonly Recipe[] = [
  shapeless("oak_log_to_planks", [block(BLOCK_REGISTRY.WOOD)], {
    kind: "block",
    id: BLOCK_REGISTRY.OAK_PLANKS,
    count: 4
  }),
  shapeless("birch_log_to_planks", [block(BLOCK_REGISTRY.BIRCH_LOG)], {
    kind: "block",
    id: BLOCK_REGISTRY.BIRCH_PLANKS,
    count: 4
  }),
  shapeless("spruce_log_to_planks", [block(BLOCK_REGISTRY.SPRUCE_LOG)], {
    kind: "block",
    id: BLOCK_REGISTRY.SPRUCE_PLANKS,
    count: 4
  }),
  shaped("crafting_table", 2, 2, [planks, planks, planks, planks], {
    kind: "block",
    id: BLOCK_REGISTRY.CRAFTING,
    count: 1
  }),
  shaped("planks_to_sticks", 1, 2, [planks, planks], {
    kind: "item",
    id: ITEM_REGISTRY.STICK,
    count: 4
  }),
  pickaxeRecipe("wooden_pickaxe", planks, ITEM_REGISTRY.WOODEN_PICKAXE),
  pickaxeRecipe("stone_pickaxe", cobble, ITEM_REGISTRY.STONE_PICKAXE),
  pickaxeRecipe("iron_pickaxe", ironIngot, ITEM_REGISTRY.IRON_PICKAXE),
  pickaxeRecipe("diamond_pickaxe", diamond, ITEM_REGISTRY.DIAMOND_PICKAXE),
  axeRecipe("wooden_axe", planks, ITEM_REGISTRY.WOODEN_AXE),
  axeRecipe("stone_axe", cobble, ITEM_REGISTRY.STONE_AXE),
  axeRecipe("iron_axe", ironIngot, ITEM_REGISTRY.IRON_AXE),
  axeRecipe("diamond_axe", diamond, ITEM_REGISTRY.DIAMOND_AXE),
  shovelRecipe("wooden_shovel", planks, ITEM_REGISTRY.WOODEN_SHOVEL),
  shovelRecipe("stone_shovel", cobble, ITEM_REGISTRY.STONE_SHOVEL),
  shaped("bread", 3, 1, [wheat, wheat, wheat], {
    kind: "item",
    id: ITEM_REGISTRY.BREAD,
    count: 1
  }),
  shaped("helium_boots", 3, 3, [diamond, null, diamond, diamond, block(BLOCK_REGISTRY.SAPLING), diamond, null, block(BLOCK_REGISTRY.SAPLING), null], {
    kind: "item",
    id: ITEM_REGISTRY.HELIUM_BOOTS,
    count: 1
  }),
  pickaxeRecipe("swift_pickaxe", block(BLOCK_REGISTRY.GOLD_BLOCK), ITEM_REGISTRY.SWIFT_PICKAXE),
  shapeless("coal_ore_to_coal", [block(BLOCK_REGISTRY.COAL_ORE)], {
    kind: "item",
    id: ITEM_REGISTRY.COAL,
    count: 1
  }),
  shapeless("iron_ore_to_ingot", [block(BLOCK_REGISTRY.IRON_ORE)], {
    kind: "item",
    id: ITEM_REGISTRY.IRON_INGOT,
    count: 1
  }),
  shapeless("gold_ore_to_ingot", [block(BLOCK_REGISTRY.GOLD_ORE)], {
    kind: "item",
    id: ITEM_REGISTRY.GOLD_INGOT,
    count: 1
  }),
  shapeless("diamond_ore_to_diamond", [block(BLOCK_REGISTRY.DIAMOND_ORE)], {
    kind: "item",
    id: ITEM_REGISTRY.DIAMOND,
    count: 1
  }),
  shaped("bucket", 3, 2, [ironIngot, null, ironIngot, null, ironIngot, null], {
    kind: "item",
    id: ITEM_REGISTRY.BUCKET,
    count: 1
  }),
  shapeless("flint_and_steel", [flint, ironIngot], {
    kind: "item",
    id: ITEM_REGISTRY.FLINT_AND_STEEL,
    count: 1
  }),
  shaped("ladder", 3, 3, [stick, null, stick, stick, stick, stick, stick, null, stick], {
    kind: "block",
    id: BLOCK_REGISTRY.LADDER,
    count: 3
  }),
  shaped("torch", 1, 2, [coal, stick], {
    kind: "block",
    id: BLOCK_REGISTRY.TORCH,
    count: 4
  }),
  shaped("chest", 3, 3, [planks, planks, planks, planks, null, planks, planks, planks, planks], {
    kind: "block",
    id: BLOCK_REGISTRY.CHEST,
    count: 1
  }),
  shaped("heavy_shield", 3, 3, [ironIngot, ironIngot, ironIngot, ironIngot, planks, ironIngot, null, ironIngot, null], {
    kind: "item",
    id: ITEM_REGISTRY.HEAVY_SHIELD,
    count: 1
  }),
  shaped("feather_falling_talisman", 3, 3, [null, leaves, null, leaves, diamond, leaves, null, leaves, null], {
    kind: "item",
    id: ITEM_REGISTRY.FEATHER_FALLING_TALISMAN,
    count: 1
  }),
  shaped("helios_medallion", 3, 3, [null, goldIngot, null, goldIngot, block(BLOCK_REGISTRY.GOLD_BLOCK), goldIngot, null, goldIngot, null], {
    kind: "item",
    id: ITEM_REGISTRY.HELIOS_MEDALLION,
    count: 1
  }),
  shaped("glow_talisman", 3, 3, [null, coal, null, coal, block(BLOCK_REGISTRY.TORCH), coal, null, coal, null], {
    kind: "item",
    id: ITEM_REGISTRY.GLOW_TALISMAN,
    count: 1
  })
] as const;

export function findMatchingRecipe(
  grid: GridSnapshot,
  gridWidth: number = CRAFTING_GRID_WIDTH_2
): MatchedRecipe | null {
  if (!validGridWidth(grid, gridWidth)) return null;
  for (const recipe of RECIPES) {
    const consumeAt = matchRecipeOnGrid(grid, gridWidth, recipe);
    if (consumeAt) return { recipe, consumeAt };
  }
  return null;
}
