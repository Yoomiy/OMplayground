/**
 * Data-driven 2×2 crafting recipes shared by server + client preview.
 */

import { BLOCK_REGISTRY } from "./blocks";
import { ITEM_REGISTRY } from "./items";

export const CRAFTING_GRID_SIZE = 4 as const;
export const CRAFTING_CELL_MAX = 1 as const;

export type RecipeIngredient =
  | { kind: "block"; blockId: number }
  | { kind: "item"; itemId: number }
  /** Oak / birch / spruce plank blocks or legacy item planks. */
  | { kind: "tag"; tag: "planks" };

export interface RecipeOutput {
  readonly kind: "block" | "item";
  readonly id: number;
  readonly count: number;
}

export interface ShapelessRecipe {
  readonly key: string;
  readonly kind: "shapeless";
  /** One occupied grid cell per entry; order does not matter. */
  readonly inputs: readonly RecipeIngredient[];
  readonly output: RecipeOutput;
}

export interface ShapedRecipe {
  readonly key: string;
  readonly kind: "shaped";
  /** Row-major 2×2; `null` = must be empty. */
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

export interface MatchedRecipe {
  readonly recipe: Recipe;
  /** Grid indices decremented by one when the craft executes. */
  readonly consumeAt: readonly number[];
}

const PLANK_BLOCK_IDS = [
  BLOCK_REGISTRY.OAK_PLANKS,
  BLOCK_REGISTRY.BIRCH_PLANKS,
  BLOCK_REGISTRY.SPRUCE_PLANKS
] as const;

function isEmptyCell(cell: GridCellSnapshot): boolean {
  return cell.count <= 0 || (cell.itemId === 0 && cell.blockId === BLOCK_REGISTRY.AIR);
}

function isPlankCell(cell: GridCellSnapshot): boolean {
  if (isEmptyCell(cell)) return false;
  if (cell.count < 1 || cell.count > CRAFTING_CELL_MAX) return false;
  if (cell.itemId > 0) return cell.itemId === ITEM_REGISTRY.PLANKS;
  return (PLANK_BLOCK_IDS as readonly number[]).includes(cell.blockId);
}

function cellMatchesIngredient(cell: GridCellSnapshot, ing: RecipeIngredient): boolean {
  if (isEmptyCell(cell)) return false;
  if (cell.count < 1 || cell.count > CRAFTING_CELL_MAX) return false;
  switch (ing.kind) {
    case "block":
      return cell.itemId === 0 && cell.blockId === ing.blockId;
    case "item":
      return cell.itemId === ing.itemId;
    case "tag":
      return ing.tag === "planks" && isPlankCell(cell);
    default:
      return false;
  }
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

function matchShaped(grid: GridSnapshot, recipe: ShapedRecipe): number[] | null {
  if (grid.length !== recipe.pattern.length) return null;
  const consumeAt: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const pat = recipe.pattern[i];
    const cell = grid[i]!;
    if (pat === null) {
      if (!isEmptyCell(cell)) return null;
      continue;
    }
    if (!cellMatchesIngredient(cell, pat)) return null;
    consumeAt.push(i);
  }
  return consumeAt;
}

function matchRecipeOnGrid(grid: GridSnapshot, recipe: Recipe): number[] | null {
  if (recipe.kind === "shapeless") return matchShapeless(grid, recipe);
  return matchShaped(grid, recipe);
}

export const RECIPES: readonly Recipe[] = [
  {
    key: "oak_log_to_planks",
    kind: "shapeless",
    inputs: [{ kind: "block", blockId: BLOCK_REGISTRY.WOOD }],
    output: { kind: "block", id: BLOCK_REGISTRY.OAK_PLANKS, count: 4 }
  },
  {
    key: "birch_log_to_planks",
    kind: "shapeless",
    inputs: [{ kind: "block", blockId: BLOCK_REGISTRY.BIRCH_LOG }],
    output: { kind: "block", id: BLOCK_REGISTRY.BIRCH_PLANKS, count: 4 }
  },
  {
    key: "spruce_log_to_planks",
    kind: "shapeless",
    inputs: [{ kind: "block", blockId: BLOCK_REGISTRY.SPRUCE_LOG }],
    output: { kind: "block", id: BLOCK_REGISTRY.SPRUCE_PLANKS, count: 4 }
  },
  {
    key: "planks_to_sticks",
    kind: "shapeless",
    inputs: [{ kind: "tag", tag: "planks" }, { kind: "tag", tag: "planks" }],
    output: { kind: "item", id: ITEM_REGISTRY.STICK, count: 4 }
  }
] as const;

/** First matching recipe for the grid, or null when nothing matches. */
export function findMatchingRecipe(grid: GridSnapshot): MatchedRecipe | null {
  if (grid.length !== CRAFTING_GRID_SIZE) return null;
  for (const recipe of RECIPES) {
    const consumeAt = matchRecipeOnGrid(grid, recipe);
    if (consumeAt) return { recipe, consumeAt };
  }
  return null;
}
