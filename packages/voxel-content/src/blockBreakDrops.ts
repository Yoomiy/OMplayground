/**
 * Custom survival break drops (foraging tables, melon slices).
 * Uses a single weighted roll per grass break so total chance stays ~10.5%.
 */

import { BLOCK_REGISTRY } from "./blocks";
import { ITEM_REGISTRY } from "./items";

export interface BreakBonusDrop {
  readonly kind: "item" | "block";
  readonly id: number;
  readonly count: number;
}

/** Cumulative weights for one grass-plant foraging roll (sum = 0.105). */
const GRASS_FORAGING_WEIGHTS: readonly {
  id: number;
  asBlock: boolean;
  cumulative: number;
}[] = [
  { id: ITEM_REGISTRY.WHEAT, asBlock: false, cumulative: 0.05 },
  { id: ITEM_REGISTRY.CARROT, asBlock: false, cumulative: 0.065 },
  { id: ITEM_REGISTRY.POTATO, asBlock: false, cumulative: 0.08 },
  { id: ITEM_REGISTRY.POISONOUS_POTATO, asBlock: false, cumulative: 0.085 },
  { id: ITEM_REGISTRY.COCOA_BEANS, asBlock: false, cumulative: 0.09 },
  { id: BLOCK_REGISTRY.SUGAR_CANE, asBlock: true, cumulative: 0.095 },
  { id: ITEM_REGISTRY.EGG, asBlock: false, cumulative: 0.1 },
  { id: ITEM_REGISTRY.RAW_MEAT, asBlock: false, cumulative: 0.103 },
  { id: ITEM_REGISTRY.RAW_BEEF, asBlock: false, cumulative: 0.105 }
];

export const GRASS_FORAGING_TOTAL_CHANCE = 0.105;

/** Block ids that skip default blockDropId in survival (custom drops only). */
export const CUSTOM_SURVIVAL_BREAK_BLOCKS = new Set<number>([
  BLOCK_REGISTRY.GRASS_PLANT,
  BLOCK_REGISTRY.GRASS_PLANT_YELLOW,
  BLOCK_REGISTRY.MELON,
  BLOCK_REGISTRY.GRAVEL
]);

export function usesCustomSurvivalBreakDrops(blockId: number): boolean {
  return CUSTOM_SURVIVAL_BREAK_BLOCKS.has(blockId);
}

export function isGrassPlantBlock(blockId: number): boolean {
  return (
    blockId === BLOCK_REGISTRY.GRASS_PLANT ||
    blockId === BLOCK_REGISTRY.GRASS_PLANT_YELLOW
  );
}

export function isLeavesBlock(blockId: number): boolean {
  return (
    blockId === BLOCK_REGISTRY.LEAVES ||
    blockId === BLOCK_REGISTRY.LEAVES_YELLOW ||
    blockId === BLOCK_REGISTRY.BIRCH_LEAVES ||
    blockId === BLOCK_REGISTRY.SPRUCE_LEAVES
  );
}

/** Single weighted foraging drop from grass (null = nothing). */
export function rollGrassForagingDrop(rand01: number): BreakBonusDrop | null {
  if (rand01 >= GRASS_FORAGING_TOTAL_CHANCE) return null;
  for (const row of GRASS_FORAGING_WEIGHTS) {
    if (rand01 < row.cumulative) {
      return {
        kind: row.asBlock ? "block" : "item",
        id: row.id,
        count: 1
      };
    }
  }
  return null;
}

/** Bonus drops from leaves (in addition to leaf block drop). */
export function rollLeavesBonusDrop(rand01: number): BreakBonusDrop | null {
  if (rand01 < 0.05) return { kind: "item", id: ITEM_REGISTRY.APPLE, count: 1 };
  if (rand01 < 0.07) return { kind: "item", id: ITEM_REGISTRY.EGG, count: 1 };
  return null;
}

/** Melon block → 3–7 slices in survival. */
export function melonSliceDropCount(rand01: number): number {
  return 3 + Math.floor(rand01 * 5);
}

/** Gravel break drop chance of flint. Put at 1.0 (100%) for testing. Change to 0.1 for 10% chance later. */
export const GRAVEL_FLINT_CHANCE = 1.0;

/** Gravel drop: 10% (by default, currently 100% for testing) chance of flint item, otherwise gravel block */
export function rollGravelDrop(rand01: number): BreakBonusDrop {
  if (rand01 < GRAVEL_FLINT_CHANCE) {
    return { kind: "item", id: ITEM_REGISTRY.FLINT, count: 1 };
  }
  return { kind: "block", id: BLOCK_REGISTRY.GRAVEL, count: 1 };
}

/** Sugar cane must sit on grass, dirt, or sand. */
const SUGAR_CANE_BASE_BLOCKS = new Set<number>([
  BLOCK_REGISTRY.GRASS,
  BLOCK_REGISTRY.DIRT,
  BLOCK_REGISTRY.SAND,
  BLOCK_REGISTRY.GRASS_SNOW,
  BLOCK_REGISTRY.GRASS_YELLOW
]);

export function sugarCaneMayPlaceOn(blockBelowId: number): boolean {
  return SUGAR_CANE_BASE_BLOCKS.has(blockBelowId);
}

/** Cake uses a half-height collision box on the server. */
export function blockPlacementHeight(blockId: number): number {
  const isCake =
    blockId === BLOCK_REGISTRY.CAKE ||
    blockId === BLOCK_REGISTRY.CAKE_5 ||
    blockId === BLOCK_REGISTRY.CAKE_4 ||
    blockId === BLOCK_REGISTRY.CAKE_3 ||
    blockId === BLOCK_REGISTRY.CAKE_2 ||
    blockId === BLOCK_REGISTRY.CAKE_1;
  return isCake ? 0.5 : 1;
}
