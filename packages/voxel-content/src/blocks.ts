/**
 * Canonical block registry — ids are stable wire values for voxel survival.
 * Gameplay fields are consumed by minecraft-server + client protocol.
 */

import { BLOCK_MINING_META } from "./blockMiningMeta";
import type { ToolKind, ToolTier } from "./mining";

export interface BlockDef {
  readonly id: number;
  readonly key: string;
  readonly placeable: boolean;
  readonly breakable: boolean;
  /**
   * Block id merged into survival hotbar when this block is broken.
   * `null` when the block does not yield a hotbar stack (unbreakable / air).
   */
  readonly dropHotbarBlockId: number | null;
  /** Seconds to break at tool speed 1 (hand). 0 = instant. */
  readonly hardness: number;
  /** When set, matching tool kind + tier is required to start mining. */
  readonly requiredTool: ToolKind | null;
  /** Tool kind used for speed bonus when `requiredTool` is null. */
  readonly speedTool: ToolKind | null;
  readonly minTier: ToolTier;
}

const BASE_BLOCK_DEFS = [
  { id: 0, key: "AIR", placeable: false, breakable: false, dropHotbarBlockId: null },
  { id: 1, key: "GRASS", placeable: true, breakable: true, dropHotbarBlockId: 1 },
  { id: 2, key: "DIRT", placeable: true, breakable: true, dropHotbarBlockId: 2 },
  {
    id: 3,
    key: "STONE",
    placeable: true,
    breakable: true,
    dropHotbarBlockId: 9
  },
  { id: 4, key: "WOOD", placeable: true, breakable: true, dropHotbarBlockId: 4 },
  { id: 5, key: "LEAVES", placeable: true, breakable: true, dropHotbarBlockId: 5 },
  { id: 6, key: "SAND", placeable: true, breakable: true, dropHotbarBlockId: 6 },
  {
    id: 7,
    key: "WATER",
    placeable: false,
    breakable: false,
    dropHotbarBlockId: null
  },
  { id: 8, key: "GLASS", placeable: true, breakable: true, dropHotbarBlockId: 8 },
  { id: 9, key: "COBBLESTONE", placeable: true, breakable: true, dropHotbarBlockId: 9 },
  { id: 10, key: "OAK_PLANKS", placeable: true, breakable: true, dropHotbarBlockId: 10 },
  { id: 11, key: "SAPLING", placeable: true, breakable: true, dropHotbarBlockId: 11 },
  { id: 12, key: "GRAVEL", placeable: true, breakable: true, dropHotbarBlockId: 12 },
  { id: 13, key: "GOLD_ORE", placeable: true, breakable: true, dropHotbarBlockId: 13 },
  { id: 14, key: "IRON_ORE", placeable: true, breakable: true, dropHotbarBlockId: 14 },
  { id: 15, key: "COAL_ORE", placeable: true, breakable: true, dropHotbarBlockId: 15 },
  { id: 16, key: "SPONGE", placeable: true, breakable: true, dropHotbarBlockId: 16 },
  { id: 17, key: "RED_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 17 },
  { id: 18, key: "ORANGE_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 18 },
  { id: 19, key: "YELLOW_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 19 },
  { id: 20, key: "LIME_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 20 },
  { id: 21, key: "GREEN_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 21 },
  { id: 22, key: "CYAN_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 22 },
  { id: 23, key: "BLUE_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 23 },
  { id: 24, key: "PURPLE_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 24 },
  { id: 25, key: "MAGENTA_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 25 },
  { id: 26, key: "PINK_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 26 },
  { id: 27, key: "BLACK_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 27 },
  { id: 28, key: "GRAY_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 28 },
  { id: 29, key: "WHITE_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 29 },
  { id: 30, key: "DANDELION", placeable: true, breakable: true, dropHotbarBlockId: 30 },
  { id: 31, key: "ROSE", placeable: true, breakable: true, dropHotbarBlockId: 31 },
  { id: 32, key: "BROWN_MUSHROOM", placeable: true, breakable: true, dropHotbarBlockId: 32 },
  { id: 33, key: "RED_MUSHROOM", placeable: true, breakable: true, dropHotbarBlockId: 33 },
  { id: 34, key: "GOLD_BLOCK", placeable: true, breakable: true, dropHotbarBlockId: 34 },
  { id: 35, key: "IRON_BLOCK", placeable: true, breakable: true, dropHotbarBlockId: 35 },
  { id: 36, key: "STONE_SLAB", placeable: true, breakable: true, dropHotbarBlockId: 36 },
  { id: 37, key: "BRICKS", placeable: true, breakable: true, dropHotbarBlockId: 37 },
  { id: 38, key: "TNT", placeable: true, breakable: true, dropHotbarBlockId: 38 },
  { id: 39, key: "BOOKSHELF", placeable: true, breakable: true, dropHotbarBlockId: 39 },
  { id: 40, key: "MOSSY_COBBLESTONE", placeable: true, breakable: true, dropHotbarBlockId: 40 },
  { id: 41, key: "OBSIDIAN", placeable: true, breakable: true, dropHotbarBlockId: 41 },
  {
    id: 42,
    key: "BEDROCK",
    placeable: false,
    breakable: false,
    dropHotbarBlockId: null
  },
  { id: 43, key: "BIRCH_LOG", placeable: true, breakable: true, dropHotbarBlockId: 43 },
  {
    id: 44,
    key: "BIRCH_PLANKS",
    placeable: true,
    breakable: true,
    dropHotbarBlockId: 44
  },
  {
    id: 45,
    key: "BIRCH_LEAVES",
    placeable: true,
    breakable: true,
    dropHotbarBlockId: 45
  },
  { id: 46, key: "SPRUCE_LOG", placeable: true, breakable: true, dropHotbarBlockId: 46 },
  {
    id: 47,
    key: "SPRUCE_PLANKS",
    placeable: true,
    breakable: true,
    dropHotbarBlockId: 47
  },
  {
    id: 48,
    key: "SPRUCE_LEAVES",
    placeable: true,
    breakable: true,
    dropHotbarBlockId: 48
  },
  { id: 49, key: "GRASS_SNOW", placeable: true, breakable: true, dropHotbarBlockId: 49 },
  { id: 50, key: "BARRIER", placeable: true, breakable: false, dropHotbarBlockId: null },
  { id: 51, key: "SNOW", placeable: true, breakable: true, dropHotbarBlockId: 51 },
  { id: 52, key: "CACTUS", placeable: true, breakable: true, dropHotbarBlockId: 52 },
  { id: 53, key: "DEADBUSH", placeable: true, breakable: true, dropHotbarBlockId: 53 },
  { id: 54, key: "CRAFTING", placeable: true, breakable: true, dropHotbarBlockId: 54 },
  { id: 55, key: "STONEBRICK", placeable: true, breakable: true, dropHotbarBlockId: 55 },
  { id: 56, key: "BROWN_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 56 },
  { id: 57, key: "LIGHT_BLUE_WOOL", placeable: true, breakable: true, dropHotbarBlockId: 57 },
  { id: 58, key: "WHITE_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 58 },
  { id: 59, key: "YELLOW_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 59 },
  { id: 60, key: "RED_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 60 },
  { id: 61, key: "PURPLE_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 61 },
  { id: 62, key: "PINK_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 62 },
  { id: 63, key: "ORANGE_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 63 },
  { id: 64, key: "MAGENTA_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 64 },
  { id: 65, key: "LIME_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 65 },
  { id: 66, key: "LIGHT_BLUE_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 66 },
  { id: 67, key: "GREEN_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 67 },
  { id: 68, key: "GRAY_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 68 },
  { id: 69, key: "CYAN_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 69 },
  { id: 70, key: "BROWN_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 70 },
  { id: 71, key: "BLUE_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 71 },
  { id: 72, key: "BLACK_STAINED_GLASS", placeable: true, breakable: true, dropHotbarBlockId: 72 },
  { id: 73, key: "SANDSTONE", placeable: true, breakable: true, dropHotbarBlockId: 73 },
  { id: 74, key: "DIAMOND_ORE", placeable: true, breakable: true, dropHotbarBlockId: 74 },
  { id: 75, key: "DIAMOND_BLOCK", placeable: true, breakable: true, dropHotbarBlockId: 75 },
  { id: 76, key: "LAPIS_ORE", placeable: true, breakable: true, dropHotbarBlockId: 76 },
  { id: 77, key: "LAPIS_BLOCK", placeable: true, breakable: true, dropHotbarBlockId: 77 },
  { id: 78, key: "MOSSY_STONEBRICKS", placeable: true, breakable: true, dropHotbarBlockId: 78 },
  { id: 79, key: "WHITE_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 79 },
  { id: 80, key: "YELLOW_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 80 },
  { id: 81, key: "RED_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 81 },
  { id: 82, key: "PURPLE_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 82 },
  { id: 83, key: "PINK_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 83 },
  { id: 84, key: "ORANGE_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 84 },
  { id: 85, key: "MAGENTA_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 85 },
  { id: 86, key: "LIME_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 86 },
  { id: 87, key: "LIGHT_BLUE_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 87 },
  { id: 88, key: "GREEN_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 88 },
  { id: 89, key: "GRAY_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 89 },
  { id: 90, key: "CYAN_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 90 },
  { id: 91, key: "BROWN_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 91 },
  { id: 92, key: "BLUE_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 92 },
  { id: 93, key: "BLACK_CONCRETE", placeable: true, breakable: true, dropHotbarBlockId: 93 },
  { id: 94, key: "PUMPKIN", placeable: true, breakable: true, dropHotbarBlockId: 94 },
  { id: 95, key: "ICE", placeable: true, breakable: true, dropHotbarBlockId: 95 },
  { id: 96, key: "GRASS_YELLOW", placeable: true, breakable: true, dropHotbarBlockId: 96 },
  { id: 97, key: "GRASS_PLANT_YELLOW", placeable: true, breakable: true, dropHotbarBlockId: 97 },
  { id: 98, key: "LEAVES_YELLOW", placeable: true, breakable: true, dropHotbarBlockId: 98 },
  { id: 99, key: "GRASS_PLANT", placeable: true, breakable: true, dropHotbarBlockId: 99 },
  { id: 100, key: "LADDER", placeable: true, breakable: true, dropHotbarBlockId: 100 },
  { id: 101, key: "TORCH", placeable: true, breakable: true, dropHotbarBlockId: 101 },
  { id: 102, key: "CHEST", placeable: true, breakable: true, dropHotbarBlockId: 102 }
] as const;

export const BLOCK_DEFS = BASE_BLOCK_DEFS.map((base) => {
  const key = base.key as keyof typeof BLOCK_MINING_META;
  const mining = BLOCK_MINING_META[key];
  return { ...base, ...mining };
}) as readonly BlockDef[];

type BlockRegistryKey = (typeof BLOCK_DEFS)[number]["key"];

/** Compile-time narrowed keys (`BLOCK_REGISTRY.GRASS`, …). */
export type BlockRegistry = { readonly [K in BlockRegistryKey]: number };

function buildBlockRegistry(): BlockRegistry {
  const out = {} as Record<string, number>;
  const seenIds = new Set<number>();
  let expectedId = 0;
  for (const def of BLOCK_DEFS) {
    if (def.id !== expectedId) {
      throw new Error(`BLOCK_DEFS out of order: expected id ${expectedId}, got ${def.id}`);
    }
    expectedId += 1;
    if (seenIds.has(def.id)) {
      throw new Error(`Duplicate block id: ${def.id}`);
    }
    seenIds.add(def.id);
    if (Object.prototype.hasOwnProperty.call(out, def.key)) {
      throw new Error(`Duplicate block key: ${def.key}`);
    }
    out[def.key] = def.id;
  }
  return out as BlockRegistry;
}

export const BLOCK_REGISTRY = buildBlockRegistry();

export const REGISTERED_BLOCK_IDS = new Set<number>(BLOCK_DEFS.map((d) => d.id));

/** Placeable block ids in ascending numeric order (survival hotbar / creative picker). */
export const PLACEABLE_BLOCK_IDS: readonly number[] = BLOCK_DEFS.filter(
  (d) => d.placeable
).map((d) => d.id);

export const REPLACEABLE_BLOCK_IDS = new Set<number>([
  BLOCK_REGISTRY.AIR,
  BLOCK_REGISTRY.WATER,
  BLOCK_REGISTRY.SAPLING,
  BLOCK_REGISTRY.DANDELION,
  BLOCK_REGISTRY.ROSE,
  BLOCK_REGISTRY.BROWN_MUSHROOM,
  BLOCK_REGISTRY.RED_MUSHROOM,
  BLOCK_REGISTRY.DEADBUSH,
  BLOCK_REGISTRY.GRASS_PLANT_YELLOW,
  BLOCK_REGISTRY.GRASS_PLANT
]);

export function blockReplaceable(blockId: number): boolean {
  return REPLACEABLE_BLOCK_IDS.has(blockId);
}

const BLOCK_BY_ID = new Map<number, BlockDef>(
  BLOCK_DEFS.map((d) => [d.id, d as BlockDef])
);

export function blockDef(blockId: number): BlockDef | undefined {
  return BLOCK_BY_ID.get(blockId);
}

export function blockBreakable(blockId: number): boolean {
  return BLOCK_BY_ID.get(blockId)?.breakable ?? false;
}

/** Block id merged into survival hotbar when broken; null if none. */
export function blockDropId(blockId: number): number | null {
  const d = BLOCK_BY_ID.get(blockId);
  if (!d?.breakable) return null;
  return d.dropHotbarBlockId;
}

/** True when breaking this block yields a stackable hotbar drop. */
export function blockDropsPickable(blockId: number): boolean {
  return blockDropId(blockId) !== null;
}

export function blockHardness(blockId: number): number {
  return BLOCK_BY_ID.get(blockId)?.hardness ?? 0;
}
