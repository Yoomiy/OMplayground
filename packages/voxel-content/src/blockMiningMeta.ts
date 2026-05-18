import type { BlockDef } from "./blocks";

type BlockKey = BlockDef["key"];

type MiningFields = Pick<BlockDef, "hardness" | "requiredTool" | "speedTool" | "minTier">;

/** Per-block mining metadata keyed by registry key. */
export const BLOCK_MINING_META: Record<BlockKey, MiningFields> = {
  AIR: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  GRASS: { hardness: 0.5, requiredTool: null, speedTool: "shovel", minTier: 0 },
  DIRT: { hardness: 0.5, requiredTool: null, speedTool: "shovel", minTier: 0 },
  STONE: { hardness: 1.5, requiredTool: null, speedTool: "pickaxe", minTier: 0 },
  WOOD: { hardness: 2, requiredTool: null, speedTool: "axe", minTier: 0 },
  LEAVES: { hardness: 0.15, requiredTool: null, speedTool: null, minTier: 0 },
  SAND: { hardness: 0.5, requiredTool: null, speedTool: "shovel", minTier: 0 },
  WATER: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  GLASS: { hardness: 0.2, requiredTool: null, speedTool: null, minTier: 0 },
  COBBLESTONE: { hardness: 1.5, requiredTool: null, speedTool: "pickaxe", minTier: 0 },
  OAK_PLANKS: { hardness: 1.5, requiredTool: null, speedTool: "axe", minTier: 0 },
  SAPLING: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  GRAVEL: { hardness: 0.5, requiredTool: null, speedTool: "shovel", minTier: 0 },
  GOLD_ORE: { hardness: 3, requiredTool: "pickaxe", speedTool: "pickaxe", minTier: 2 },
  IRON_ORE: { hardness: 3, requiredTool: "pickaxe", speedTool: "pickaxe", minTier: 1 },
  COAL_ORE: { hardness: 3, requiredTool: "pickaxe", speedTool: "pickaxe", minTier: 0 },
  SPONGE: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  RED_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  ORANGE_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  YELLOW_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  LIME_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  GREEN_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  CYAN_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  BLUE_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  PURPLE_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  MAGENTA_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  PINK_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  BLACK_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  GRAY_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  WHITE_WOOL: { hardness: 0.5, requiredTool: null, speedTool: null, minTier: 0 },
  DANDELION: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  ROSE: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  BROWN_MUSHROOM: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  RED_MUSHROOM: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  GOLD_BLOCK: { hardness: 2, requiredTool: null, speedTool: "pickaxe", minTier: 0 },
  IRON_BLOCK: { hardness: 2, requiredTool: null, speedTool: "pickaxe", minTier: 0 },
  STONE_SLAB: { hardness: 1.5, requiredTool: null, speedTool: "pickaxe", minTier: 0 },
  BRICKS: { hardness: 1.5, requiredTool: null, speedTool: "pickaxe", minTier: 0 },
  TNT: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 },
  BOOKSHELF: { hardness: 1.5, requiredTool: null, speedTool: "axe", minTier: 0 },
  MOSSY_COBBLESTONE: { hardness: 1.5, requiredTool: null, speedTool: "pickaxe", minTier: 0 },
  OBSIDIAN: { hardness: 10, requiredTool: "pickaxe", speedTool: "pickaxe", minTier: 2 },
  BEDROCK: { hardness: 0, requiredTool: null, speedTool: null, minTier: 0 }
};

export function miningMetaForKey(key: BlockKey): MiningFields {
  return BLOCK_MINING_META[key];
}
