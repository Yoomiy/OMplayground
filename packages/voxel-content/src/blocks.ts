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
  }
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
