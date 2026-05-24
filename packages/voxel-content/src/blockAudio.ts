import { BLOCK_REGISTRY } from "./blocks";

export type BlockSoundGroup =
  | "silent"
  | "grass"
  | "stone"
  | "sand"
  | "wood"
  | "leaves"
  | "cloth"
  | "glass"
  | "gravel"
  | "snow"
  | "plant"
  | "metal"
  | "water";

export type BlockSoundAction = "step" | "dig" | "break" | "place";

const BLOCK_SOUND_GROUP_BY_ID = new Map<number, BlockSoundGroup>([
  [BLOCK_REGISTRY.AIR, "silent"],
  [BLOCK_REGISTRY.WATER, "water"],

  [BLOCK_REGISTRY.GRASS, "grass"],
  [BLOCK_REGISTRY.DIRT, "grass"],
  [BLOCK_REGISTRY.GRASS_SNOW, "grass"],
  [BLOCK_REGISTRY.GRASS_YELLOW, "grass"],

  [BLOCK_REGISTRY.SAND, "sand"],
  [BLOCK_REGISTRY.SANDSTONE, "sand"],
  [BLOCK_REGISTRY.CACTUS, "sand"],
  [BLOCK_REGISTRY.DEADBUSH, "sand"],

  [BLOCK_REGISTRY.WOOD, "wood"],
  [BLOCK_REGISTRY.OAK_PLANKS, "wood"],
  [BLOCK_REGISTRY.BIRCH_LOG, "wood"],
  [BLOCK_REGISTRY.BIRCH_PLANKS, "wood"],
  [BLOCK_REGISTRY.SPRUCE_LOG, "wood"],
  [BLOCK_REGISTRY.SPRUCE_PLANKS, "wood"],
  [BLOCK_REGISTRY.CRAFTING, "wood"],
  [BLOCK_REGISTRY.BOOKSHELF, "wood"],
  [BLOCK_REGISTRY.LADDER, "wood"],
  [BLOCK_REGISTRY.CHEST, "wood"],
  [BLOCK_REGISTRY.PUMPKIN, "wood"],

  [BLOCK_REGISTRY.LEAVES, "leaves"],
  [BLOCK_REGISTRY.BIRCH_LEAVES, "leaves"],
  [BLOCK_REGISTRY.SPRUCE_LEAVES, "leaves"],
  [BLOCK_REGISTRY.LEAVES_YELLOW, "leaves"],

  [BLOCK_REGISTRY.SAPLING, "plant"],
  [BLOCK_REGISTRY.DANDELION, "plant"],
  [BLOCK_REGISTRY.ROSE, "plant"],
  [BLOCK_REGISTRY.BROWN_MUSHROOM, "plant"],
  [BLOCK_REGISTRY.RED_MUSHROOM, "plant"],
  [BLOCK_REGISTRY.GRASS_PLANT_YELLOW, "plant"],
  [BLOCK_REGISTRY.GRASS_PLANT, "plant"],
  [BLOCK_REGISTRY.TORCH, "plant"],

  [BLOCK_REGISTRY.GRAVEL, "gravel"],
  [BLOCK_REGISTRY.SNOW, "snow"],
  [BLOCK_REGISTRY.ICE, "glass"],
  [BLOCK_REGISTRY.GLASS, "glass"],
  [BLOCK_REGISTRY.WHITE_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.YELLOW_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.RED_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.PURPLE_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.PINK_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.ORANGE_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.MAGENTA_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.LIME_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.LIGHT_BLUE_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.GREEN_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.GRAY_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.CYAN_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.BROWN_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.BLUE_STAINED_GLASS, "glass"],
  [BLOCK_REGISTRY.BLACK_STAINED_GLASS, "glass"],

  [BLOCK_REGISTRY.GOLD_BLOCK, "metal"],
  [BLOCK_REGISTRY.IRON_BLOCK, "metal"]
]);

const WOOL_BLOCKS = [
  BLOCK_REGISTRY.RED_WOOL,
  BLOCK_REGISTRY.ORANGE_WOOL,
  BLOCK_REGISTRY.YELLOW_WOOL,
  BLOCK_REGISTRY.LIME_WOOL,
  BLOCK_REGISTRY.GREEN_WOOL,
  BLOCK_REGISTRY.CYAN_WOOL,
  BLOCK_REGISTRY.BLUE_WOOL,
  BLOCK_REGISTRY.PURPLE_WOOL,
  BLOCK_REGISTRY.MAGENTA_WOOL,
  BLOCK_REGISTRY.PINK_WOOL,
  BLOCK_REGISTRY.BLACK_WOOL,
  BLOCK_REGISTRY.GRAY_WOOL,
  BLOCK_REGISTRY.WHITE_WOOL,
  BLOCK_REGISTRY.BROWN_WOOL,
  BLOCK_REGISTRY.LIGHT_BLUE_WOOL
] as const;

for (const blockId of WOOL_BLOCKS) {
  BLOCK_SOUND_GROUP_BY_ID.set(blockId, "cloth");
}

export function blockSoundGroup(blockId: number): BlockSoundGroup {
  return BLOCK_SOUND_GROUP_BY_ID.get(blockId) ?? "stone";
}

export function blockSoundUrl(
  action: BlockSoundAction,
  group: BlockSoundGroup
): string | null {
  if (group === "silent") return null;
  return `/sounds/${action}/${group}.mp3`;
}
