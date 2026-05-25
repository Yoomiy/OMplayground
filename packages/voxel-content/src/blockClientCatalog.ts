/**
 * Client-side noa / texture catalog for voxel blocks — texture keys map to URLs
 * in `MinecraftClient` (`MC_TEX`). Server never imports this file.
 */

import { BLOCK_REGISTRY } from "./blocks";

/** Keys into `apps/web/src/games/MinecraftClient.tsx` `MC_TEX` map (filename bundle). */
export type McTerrainTextureKey =
  | "grassTop"
  | "grassSide"
  | "dirt"
  | "stone"
  | "oakLog"
  | "oakLogTop"
  | "oakLeaves"
  | "birchLog"
  | "birchLogTop"
  | "birchLeaves"
  | "birchPlanks"
  | "spruceLog"
  | "spruceLogTop"
  | "spruceLeaves"
  | "sprucePlanks"
  | "sand"
  | "waterStill"
  | "glass"
  | "cobblestone"
  | "oakPlanks"
  | "sapling"
  | "gravel"
  | "goldOre"
  | "ironOre"
  | "coalOre"
  | "sponge"
  | "redWool"
  | "orangeWool"
  | "yellowWool"
  | "limeWool"
  | "greenWool"
  | "cyanWool"
  | "blueWool"
  | "purpleWool"
  | "magentaWool"
  | "pinkWool"
  | "blackWool"
  | "grayWool"
  | "whiteWool"
  | "dandelion"
  | "rose"
  | "brownMushroom"
  | "redMushroom"
  | "goldBlock"
  | "ironBlock"
  | "smoothStone"
  | "smoothStoneSlabSide"
  | "bricks"
  | "tntTop"
  | "tntBottom"
  | "tntSide"
  | "bookshelf"
  | "mossyCobblestone"
  | "obsidian"
  | "bedrock"
  | "grassSnow"
  | "snow"
  | "cactusTop"
  | "cactusBottom"
  | "cactusSide"
  | "deadBush"
  | "craftingTableTop"
  | "craftingTableSide"
  | "stoneBrick"
  | "brownWool"
  | "lightBlueWool"
  | "whiteStainedGlass"
  | "yellowStainedGlass"
  | "redStainedGlass"
  | "purpleStainedGlass"
  | "pinkStainedGlass"
  | "orangeStainedGlass"
  | "magentaStainedGlass"
  | "limeStainedGlass"
  | "lightBlueStainedGlass"
  | "greenStainedGlass"
  | "grayStainedGlass"
  | "cyanStainedGlass"
  | "brownStainedGlass"
  | "blueStainedGlass"
  | "blackStainedGlass"
  | "sandstone"
  | "diamondOre"
  | "diamondBlock"
  | "lapisOre"
  | "lapisBlock"
  | "mossyStonebricks"
  | "whiteConcrete"
  | "yellowConcrete"
  | "redConcrete"
  | "purpleConcrete"
  | "pinkConcrete"
  | "orangeConcrete"
  | "magentaConcrete"
  | "limeConcrete"
  | "lightBlueConcrete"
  | "greenConcrete"
  | "grayConcrete"
  | "cyanConcrete"
  | "brownConcrete"
  | "blueConcrete"
  | "blackConcrete"
  | "pumpkinTop"
  | "pumpkinSide"
  | "ice"
  | "grassYellowTop"
  | "grassYellowSide"
  | "grassPlantYellow"
  | "leavesYellow"
  | "grassPlant"
  | "ladder"
  | "torch"
  | "chest"
  | "melonTop"
  | "melonSide"
  | "cakeTop"
  | "cakeBottom"
  | "cakeSide"
  | "cakeInner"
  | "sugarCane";

/** One Babylon material per mc_* texture file; order matches legacy registration. */
export const MC_MATERIAL_ENTRIES = [
  { name: "mc_grass_top", textureKey: "grassTop" as const },
  { name: "mc_grass_side", textureKey: "grassSide" as const },
  { name: "mc_dirt", textureKey: "dirt" as const },
  { name: "mc_stone", textureKey: "stone" as const },
  { name: "mc_oak_log", textureKey: "oakLog" as const },
  { name: "mc_oak_log_top", textureKey: "oakLogTop" as const },
  { name: "mc_oak_leaves", textureKey: "oakLeaves" as const, texHasAlpha: true },
  { name: "mc_birch_log", textureKey: "birchLog" as const },
  { name: "mc_birch_log_top", textureKey: "birchLogTop" as const },
  { name: "mc_birch_planks", textureKey: "birchPlanks" as const },
  { name: "mc_birch_leaves", textureKey: "birchLeaves" as const, texHasAlpha: true },
  { name: "mc_spruce_log", textureKey: "spruceLog" as const },
  { name: "mc_spruce_log_top", textureKey: "spruceLogTop" as const },
  { name: "mc_spruce_planks", textureKey: "sprucePlanks" as const },
  { name: "mc_spruce_leaves", textureKey: "spruceLeaves" as const, texHasAlpha: true },
  { name: "mc_sand", textureKey: "sand" as const },
  { name: "mc_water", textureKey: "waterStill" as const, texHasAlpha: true },
  { name: "mc_glass", textureKey: "glass" as const, texHasAlpha: true },
  { name: "mc_cobblestone", textureKey: "cobblestone" as const },
  { name: "mc_oak_planks", textureKey: "oakPlanks" as const },
  { name: "mc_sapling", textureKey: "sapling" as const, texHasAlpha: true },
  { name: "mc_gravel", textureKey: "gravel" as const },
  { name: "mc_gold_ore", textureKey: "goldOre" as const },
  { name: "mc_iron_ore", textureKey: "ironOre" as const },
  { name: "mc_coal_ore", textureKey: "coalOre" as const },
  { name: "mc_sponge", textureKey: "sponge" as const },
  { name: "mc_red_wool", textureKey: "redWool" as const },
  { name: "mc_orange_wool", textureKey: "orangeWool" as const },
  { name: "mc_yellow_wool", textureKey: "yellowWool" as const },
  { name: "mc_lime_wool", textureKey: "limeWool" as const },
  { name: "mc_green_wool", textureKey: "greenWool" as const },
  { name: "mc_cyan_wool", textureKey: "cyanWool" as const },
  { name: "mc_blue_wool", textureKey: "blueWool" as const },
  { name: "mc_purple_wool", textureKey: "purpleWool" as const },
  { name: "mc_magenta_wool", textureKey: "magentaWool" as const },
  { name: "mc_pink_wool", textureKey: "pinkWool" as const },
  { name: "mc_black_wool", textureKey: "blackWool" as const },
  { name: "mc_gray_wool", textureKey: "grayWool" as const },
  { name: "mc_white_wool", textureKey: "whiteWool" as const },
  { name: "mc_dandelion", textureKey: "dandelion" as const, texHasAlpha: true },
  { name: "mc_rose", textureKey: "rose" as const, texHasAlpha: true },
  { name: "mc_brown_mushroom", textureKey: "brownMushroom" as const, texHasAlpha: true },
  { name: "mc_red_mushroom", textureKey: "redMushroom" as const, texHasAlpha: true },
  { name: "mc_gold_block", textureKey: "goldBlock" as const },
  { name: "mc_iron_block", textureKey: "ironBlock" as const },
  { name: "mc_smooth_stone", textureKey: "smoothStone" as const },
  { name: "mc_smooth_stone_slab_side", textureKey: "smoothStoneSlabSide" as const },
  { name: "mc_bricks", textureKey: "bricks" as const },
  { name: "mc_tnt_top", textureKey: "tntTop" as const },
  { name: "mc_tnt_bottom", textureKey: "tntBottom" as const },
  { name: "mc_tnt_side", textureKey: "tntSide" as const },
  { name: "mc_bookshelf", textureKey: "bookshelf" as const },
  { name: "mc_mossy_cobblestone", textureKey: "mossyCobblestone" as const },
  { name: "mc_obsidian", textureKey: "obsidian" as const },
  { name: "mc_bedrock", textureKey: "bedrock" as const },
  { name: "mc_grass_snow", textureKey: "grassSnow" as const },
  { name: "mc_snow", textureKey: "snow" as const },
  { name: "mc_cactus_top", textureKey: "cactusTop" as const },
  { name: "mc_cactus_bottom", textureKey: "cactusBottom" as const },
  { name: "mc_cactus_side", textureKey: "cactusSide" as const },
  { name: "mc_dead_bush", textureKey: "deadBush" as const, texHasAlpha: true },
  { name: "mc_crafting_table_top", textureKey: "craftingTableTop" as const },
  { name: "mc_crafting_table_side", textureKey: "craftingTableSide" as const },
  { name: "mc_stonebrick", textureKey: "stoneBrick" as const },
  { name: "mc_brown_wool", textureKey: "brownWool" as const },
  { name: "mc_light_blue_wool", textureKey: "lightBlueWool" as const },
  { name: "mc_white_stained_glass", textureKey: "whiteStainedGlass" as const, texHasAlpha: true },
  { name: "mc_yellow_stained_glass", textureKey: "yellowStainedGlass" as const, texHasAlpha: true },
  { name: "mc_red_stained_glass", textureKey: "redStainedGlass" as const, texHasAlpha: true },
  { name: "mc_purple_stained_glass", textureKey: "purpleStainedGlass" as const, texHasAlpha: true },
  { name: "mc_pink_stained_glass", textureKey: "pinkStainedGlass" as const, texHasAlpha: true },
  { name: "mc_orange_stained_glass", textureKey: "orangeStainedGlass" as const, texHasAlpha: true },
  { name: "mc_magenta_stained_glass", textureKey: "magentaStainedGlass" as const, texHasAlpha: true },
  { name: "mc_lime_stained_glass", textureKey: "limeStainedGlass" as const, texHasAlpha: true },
  { name: "mc_light_blue_stained_glass", textureKey: "lightBlueStainedGlass" as const, texHasAlpha: true },
  { name: "mc_green_stained_glass", textureKey: "greenStainedGlass" as const, texHasAlpha: true },
  { name: "mc_gray_stained_glass", textureKey: "grayStainedGlass" as const, texHasAlpha: true },
  { name: "mc_cyan_stained_glass", textureKey: "cyanStainedGlass" as const, texHasAlpha: true },
  { name: "mc_brown_stained_glass", textureKey: "brownStainedGlass" as const, texHasAlpha: true },
  { name: "mc_blue_stained_glass", textureKey: "blueStainedGlass" as const, texHasAlpha: true },
  { name: "mc_black_stained_glass", textureKey: "blackStainedGlass" as const, texHasAlpha: true },
  { name: "mc_sandstone", textureKey: "sandstone" as const },
  { name: "mc_diamond_ore", textureKey: "diamondOre" as const },
  { name: "mc_diamond_block", textureKey: "diamondBlock" as const },
  { name: "mc_lapis_ore", textureKey: "lapisOre" as const },
  { name: "mc_lapis_block", textureKey: "lapisBlock" as const },
  { name: "mc_mossy_stone_bricks", textureKey: "mossyStonebricks" as const },
  { name: "mc_white_concrete", textureKey: "whiteConcrete" as const },
  { name: "mc_yellow_concrete", textureKey: "yellowConcrete" as const },
  { name: "mc_red_concrete", textureKey: "redConcrete" as const },
  { name: "mc_purple_concrete", textureKey: "purpleConcrete" as const },
  { name: "mc_pink_concrete", textureKey: "pinkConcrete" as const },
  { name: "mc_orange_concrete", textureKey: "orangeConcrete" as const },
  { name: "mc_magenta_concrete", textureKey: "magentaConcrete" as const },
  { name: "mc_lime_concrete", textureKey: "limeConcrete" as const },
  { name: "mc_light_blue_concrete", textureKey: "lightBlueConcrete" as const },
  { name: "mc_green_concrete", textureKey: "greenConcrete" as const },
  { name: "mc_gray_concrete", textureKey: "grayConcrete" as const },
  { name: "mc_cyan_concrete", textureKey: "cyanConcrete" as const },
  { name: "mc_brown_concrete", textureKey: "brownConcrete" as const },
  { name: "mc_blue_concrete", textureKey: "blueConcrete" as const },
  { name: "mc_black_concrete", textureKey: "blackConcrete" as const },
  { name: "mc_pumpkin_top", textureKey: "pumpkinTop" as const },
  { name: "mc_pumpkin_side", textureKey: "pumpkinSide" as const },
  { name: "mc_ice", textureKey: "ice" as const },
  { name: "mc_grass_yellow_top", textureKey: "grassYellowTop" as const },
  { name: "mc_grass_yellow_side", textureKey: "grassYellowSide" as const },
  { name: "mc_grass_plant_yellow", textureKey: "grassPlantYellow" as const, texHasAlpha: true },
  { name: "mc_leaves_yellow", textureKey: "leavesYellow" as const, texHasAlpha: true },
  { name: "mc_grass_plant", textureKey: "grassPlant" as const, texHasAlpha: true },
  { name: "mc_ladder", textureKey: "ladder" as const, texHasAlpha: true },
  { name: "mc_torch", textureKey: "torch" as const, texHasAlpha: true },
  { name: "mc_chest", textureKey: "chest" as const },
  { name: "mc_melon_top", textureKey: "melonTop" as const },
  { name: "mc_melon_side", textureKey: "melonSide" as const },
  { name: "mc_cake_top", textureKey: "cakeTop" as const },
  { name: "mc_cake_bottom", textureKey: "cakeBottom" as const },
  { name: "mc_cake_side", textureKey: "cakeSide" as const },
  { name: "mc_cake_inner", textureKey: "cakeInner" as const },
  { name: "mc_sugar_cane", textureKey: "sugarCane" as const, texHasAlpha: true }
] as const;

export type NoaBlockEntry =
  | {
      id: number;
      shape: "cube";
      material: string | readonly [string, string, string];
      solid: boolean;
      opaque?: boolean;
      fluid?: boolean;
      hotbarTextureKey: McTerrainTextureKey;
    }
  | {
      id: number;
      shape: "plantSprite";
      materialName: string;
      textureKey: McTerrainTextureKey;
      hotbarTextureKey: McTerrainTextureKey;
    }
  | {
      id: number;
      shape: "slabHalf";
      material: {
        top: string;
        bottom: string;
        sides: string;
        inner?: string;
      };
      hotbarIconUrl: string;
    };

export interface NoaCubeBlockOptions {
  readonly material: string | readonly [string, string, string];
  readonly solid: boolean;
  readonly opaque?: boolean;
  readonly fluid?: boolean;
}

export function noaCubeBlockOptions(
  entry: Extract<NoaBlockEntry, { shape: "cube" }>
): NoaCubeBlockOptions {
  const options: NoaCubeBlockOptions = {
    material: entry.material,
    solid: entry.solid
  };
  if (entry.opaque !== undefined) {
    return entry.fluid !== undefined
      ? { ...options, opaque: entry.opaque, fluid: entry.fluid }
      : { ...options, opaque: entry.opaque };
  }
  return entry.fluid !== undefined ? { ...options, fluid: entry.fluid } : options;
}

/** Every non-air block that noa registers (mirrors legacy `registerBlock` list). */
export const NOA_BLOCK_ENTRIES: readonly NoaBlockEntry[] = [
  {
    id: BLOCK_REGISTRY.GRASS,
    shape: "cube",
    material: ["mc_grass_top", "mc_dirt", "mc_grass_side"],
    solid: true,
    hotbarTextureKey: "grassTop"
  },
  {
    id: BLOCK_REGISTRY.DIRT,
    shape: "cube",
    material: "mc_dirt",
    solid: true,
    hotbarTextureKey: "dirt"
  },
  {
    id: BLOCK_REGISTRY.STONE,
    shape: "cube",
    material: "mc_stone",
    solid: true,
    hotbarTextureKey: "stone"
  },
  {
    id: BLOCK_REGISTRY.WOOD,
    shape: "cube",
    material: ["mc_oak_log_top", "mc_oak_log_top", "mc_oak_log"],
    solid: true,
    hotbarTextureKey: "oakLog"
  },
  {
    id: BLOCK_REGISTRY.LEAVES,
    shape: "cube",
    material: "mc_oak_leaves",
    solid: true,
    opaque: false,
    hotbarTextureKey: "oakLeaves"
  },
  {
    id: BLOCK_REGISTRY.SAND,
    shape: "cube",
    material: "mc_sand",
    solid: true,
    hotbarTextureKey: "sand"
  },
  {
    id: BLOCK_REGISTRY.WATER,
    shape: "cube",
    material: "mc_water",
    solid: false,
    opaque: false,
    fluid: true,
    hotbarTextureKey: "waterStill"
  },
  {
    id: BLOCK_REGISTRY.GLASS,
    shape: "cube",
    material: "mc_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "glass"
  },
  {
    id: BLOCK_REGISTRY.COBBLESTONE,
    shape: "cube",
    material: "mc_cobblestone",
    solid: true,
    hotbarTextureKey: "cobblestone"
  },
  {
    id: BLOCK_REGISTRY.OAK_PLANKS,
    shape: "cube",
    material: "mc_oak_planks",
    solid: true,
    hotbarTextureKey: "oakPlanks"
  },
  {
    id: BLOCK_REGISTRY.SAPLING,
    shape: "plantSprite",
    materialName: "mc_sapling",
    textureKey: "sapling",
    hotbarTextureKey: "sapling"
  },
  {
    id: BLOCK_REGISTRY.GRAVEL,
    shape: "cube",
    material: "mc_gravel",
    solid: true,
    hotbarTextureKey: "gravel"
  },
  {
    id: BLOCK_REGISTRY.GOLD_ORE,
    shape: "cube",
    material: "mc_gold_ore",
    solid: true,
    hotbarTextureKey: "goldOre"
  },
  {
    id: BLOCK_REGISTRY.IRON_ORE,
    shape: "cube",
    material: "mc_iron_ore",
    solid: true,
    hotbarTextureKey: "ironOre"
  },
  {
    id: BLOCK_REGISTRY.COAL_ORE,
    shape: "cube",
    material: "mc_coal_ore",
    solid: true,
    hotbarTextureKey: "coalOre"
  },
  {
    id: BLOCK_REGISTRY.SPONGE,
    shape: "cube",
    material: "mc_sponge",
    solid: true,
    hotbarTextureKey: "sponge"
  },
  {
    id: BLOCK_REGISTRY.RED_WOOL,
    shape: "cube",
    material: "mc_red_wool",
    solid: true,
    hotbarTextureKey: "redWool"
  },
  {
    id: BLOCK_REGISTRY.ORANGE_WOOL,
    shape: "cube",
    material: "mc_orange_wool",
    solid: true,
    hotbarTextureKey: "orangeWool"
  },
  {
    id: BLOCK_REGISTRY.YELLOW_WOOL,
    shape: "cube",
    material: "mc_yellow_wool",
    solid: true,
    hotbarTextureKey: "yellowWool"
  },
  {
    id: BLOCK_REGISTRY.LIME_WOOL,
    shape: "cube",
    material: "mc_lime_wool",
    solid: true,
    hotbarTextureKey: "limeWool"
  },
  {
    id: BLOCK_REGISTRY.GREEN_WOOL,
    shape: "cube",
    material: "mc_green_wool",
    solid: true,
    hotbarTextureKey: "greenWool"
  },
  {
    id: BLOCK_REGISTRY.CYAN_WOOL,
    shape: "cube",
    material: "mc_cyan_wool",
    solid: true,
    hotbarTextureKey: "cyanWool"
  },
  {
    id: BLOCK_REGISTRY.BLUE_WOOL,
    shape: "cube",
    material: "mc_blue_wool",
    solid: true,
    hotbarTextureKey: "blueWool"
  },
  {
    id: BLOCK_REGISTRY.PURPLE_WOOL,
    shape: "cube",
    material: "mc_purple_wool",
    solid: true,
    hotbarTextureKey: "purpleWool"
  },
  {
    id: BLOCK_REGISTRY.MAGENTA_WOOL,
    shape: "cube",
    material: "mc_magenta_wool",
    solid: true,
    hotbarTextureKey: "magentaWool"
  },
  {
    id: BLOCK_REGISTRY.PINK_WOOL,
    shape: "cube",
    material: "mc_pink_wool",
    solid: true,
    hotbarTextureKey: "pinkWool"
  },
  {
    id: BLOCK_REGISTRY.BLACK_WOOL,
    shape: "cube",
    material: "mc_black_wool",
    solid: true,
    hotbarTextureKey: "blackWool"
  },
  {
    id: BLOCK_REGISTRY.GRAY_WOOL,
    shape: "cube",
    material: "mc_gray_wool",
    solid: true,
    hotbarTextureKey: "grayWool"
  },
  {
    id: BLOCK_REGISTRY.WHITE_WOOL,
    shape: "cube",
    material: "mc_white_wool",
    solid: true,
    hotbarTextureKey: "whiteWool"
  },
  {
    id: BLOCK_REGISTRY.DANDELION,
    shape: "plantSprite",
    materialName: "mc_dandelion",
    textureKey: "dandelion",
    hotbarTextureKey: "dandelion"
  },
  {
    id: BLOCK_REGISTRY.ROSE,
    shape: "plantSprite",
    materialName: "mc_rose",
    textureKey: "rose",
    hotbarTextureKey: "rose"
  },
  {
    id: BLOCK_REGISTRY.BROWN_MUSHROOM,
    shape: "plantSprite",
    materialName: "mc_brown_mushroom",
    textureKey: "brownMushroom",
    hotbarTextureKey: "brownMushroom"
  },
  {
    id: BLOCK_REGISTRY.RED_MUSHROOM,
    shape: "plantSprite",
    materialName: "mc_red_mushroom",
    textureKey: "redMushroom",
    hotbarTextureKey: "redMushroom"
  },
  {
    id: BLOCK_REGISTRY.GOLD_BLOCK,
    shape: "cube",
    material: "mc_gold_block",
    solid: true,
    hotbarTextureKey: "goldBlock"
  },
  {
    id: BLOCK_REGISTRY.IRON_BLOCK,
    shape: "cube",
    material: "mc_iron_block",
    solid: true,
    hotbarTextureKey: "ironBlock"
  },
  {
    id: BLOCK_REGISTRY.STONE_SLAB,
    shape: "cube",
    material: ["mc_smooth_stone", "mc_smooth_stone", "mc_smooth_stone_slab_side"],
    solid: true,
    hotbarTextureKey: "smoothStone"
  },
  {
    id: BLOCK_REGISTRY.BRICKS,
    shape: "cube",
    material: "mc_bricks",
    solid: true,
    hotbarTextureKey: "bricks"
  },
  {
    id: BLOCK_REGISTRY.TNT,
    shape: "cube",
    material: ["mc_tnt_top", "mc_tnt_bottom", "mc_tnt_side"],
    solid: true,
    hotbarTextureKey: "tntSide"
  },
  {
    id: BLOCK_REGISTRY.BOOKSHELF,
    shape: "cube",
    material: ["mc_oak_planks", "mc_oak_planks", "mc_bookshelf"],
    solid: true,
    hotbarTextureKey: "bookshelf"
  },
  {
    id: BLOCK_REGISTRY.MOSSY_COBBLESTONE,
    shape: "cube",
    material: "mc_mossy_cobblestone",
    solid: true,
    hotbarTextureKey: "mossyCobblestone"
  },
  {
    id: BLOCK_REGISTRY.OBSIDIAN,
    shape: "cube",
    material: "mc_obsidian",
    solid: true,
    hotbarTextureKey: "obsidian"
  },
  {
    id: BLOCK_REGISTRY.BEDROCK,
    shape: "cube",
    material: "mc_bedrock",
    solid: true,
    hotbarTextureKey: "bedrock"
  },
  {
    id: BLOCK_REGISTRY.BIRCH_LOG,
    shape: "cube",
    material: ["mc_birch_log_top", "mc_birch_log_top", "mc_birch_log"],
    solid: true,
    hotbarTextureKey: "birchLog"
  },
  {
    id: BLOCK_REGISTRY.BIRCH_PLANKS,
    shape: "cube",
    material: "mc_birch_planks",
    solid: true,
    hotbarTextureKey: "birchPlanks"
  },
  {
    id: BLOCK_REGISTRY.BIRCH_LEAVES,
    shape: "cube",
    material: "mc_birch_leaves",
    solid: true,
    opaque: false,
    hotbarTextureKey: "birchLeaves"
  },
  {
    id: BLOCK_REGISTRY.SPRUCE_LOG,
    shape: "cube",
    material: ["mc_spruce_log_top", "mc_spruce_log_top", "mc_spruce_log"],
    solid: true,
    hotbarTextureKey: "spruceLog"
  },
  {
    id: BLOCK_REGISTRY.SPRUCE_PLANKS,
    shape: "cube",
    material: "mc_spruce_planks",
    solid: true,
    hotbarTextureKey: "sprucePlanks"
  },
  {
    id: BLOCK_REGISTRY.SPRUCE_LEAVES,
    shape: "cube",
    material: "mc_spruce_leaves",
    solid: true,
    opaque: false,
    hotbarTextureKey: "spruceLeaves"
  },
  {
    id: BLOCK_REGISTRY.GRASS_SNOW,
    shape: "cube",
    material: ["mc_snow", "mc_dirt", "mc_grass_snow"],
    solid: true,
    hotbarTextureKey: "grassSnow"
  },
  {
    id: BLOCK_REGISTRY.BARRIER,
    shape: "cube",
    material: "mc_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "glass"
  },
  {
    id: BLOCK_REGISTRY.SNOW,
    shape: "cube",
    material: "mc_snow",
    solid: true,
    hotbarTextureKey: "snow"
  },
  {
    id: BLOCK_REGISTRY.CACTUS,
    shape: "cube",
    material: ["mc_cactus_top", "mc_cactus_bottom", "mc_cactus_side"],
    solid: true,
    opaque: false,
    hotbarTextureKey: "cactusSide"
  },
  {
    id: BLOCK_REGISTRY.DEADBUSH,
    shape: "plantSprite",
    materialName: "mc_dead_bush",
    textureKey: "deadBush",
    hotbarTextureKey: "deadBush"
  },
  {
    id: BLOCK_REGISTRY.CRAFTING,
    shape: "cube",
    material: ["mc_crafting_table_top", "mc_oak_planks", "mc_crafting_table_side"],
    solid: true,
    hotbarTextureKey: "craftingTableSide"
  },
  {
    id: BLOCK_REGISTRY.STONEBRICK,
    shape: "cube",
    material: "mc_stonebrick",
    solid: true,
    hotbarTextureKey: "stoneBrick"
  },
  {
    id: BLOCK_REGISTRY.BROWN_WOOL,
    shape: "cube",
    material: "mc_brown_wool",
    solid: true,
    hotbarTextureKey: "brownWool"
  },
  {
    id: BLOCK_REGISTRY.LIGHT_BLUE_WOOL,
    shape: "cube",
    material: "mc_light_blue_wool",
    solid: true,
    hotbarTextureKey: "lightBlueWool"
  },
  {
    id: BLOCK_REGISTRY.WHITE_STAINED_GLASS,
    shape: "cube",
    material: "mc_white_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "whiteStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.YELLOW_STAINED_GLASS,
    shape: "cube",
    material: "mc_yellow_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "yellowStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.RED_STAINED_GLASS,
    shape: "cube",
    material: "mc_red_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "redStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.PURPLE_STAINED_GLASS,
    shape: "cube",
    material: "mc_purple_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "purpleStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.PINK_STAINED_GLASS,
    shape: "cube",
    material: "mc_pink_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "pinkStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.ORANGE_STAINED_GLASS,
    shape: "cube",
    material: "mc_orange_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "orangeStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.MAGENTA_STAINED_GLASS,
    shape: "cube",
    material: "mc_magenta_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "magentaStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.LIME_STAINED_GLASS,
    shape: "cube",
    material: "mc_lime_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "limeStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.LIGHT_BLUE_STAINED_GLASS,
    shape: "cube",
    material: "mc_light_blue_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "lightBlueStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.GREEN_STAINED_GLASS,
    shape: "cube",
    material: "mc_green_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "greenStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.GRAY_STAINED_GLASS,
    shape: "cube",
    material: "mc_gray_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "grayStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.CYAN_STAINED_GLASS,
    shape: "cube",
    material: "mc_cyan_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "cyanStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.BROWN_STAINED_GLASS,
    shape: "cube",
    material: "mc_brown_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "brownStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.BLUE_STAINED_GLASS,
    shape: "cube",
    material: "mc_blue_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "blueStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.BLACK_STAINED_GLASS,
    shape: "cube",
    material: "mc_black_stained_glass",
    solid: true,
    opaque: false,
    hotbarTextureKey: "blackStainedGlass"
  },
  {
    id: BLOCK_REGISTRY.SANDSTONE,
    shape: "cube",
    material: "mc_sandstone",
    solid: true,
    hotbarTextureKey: "sandstone"
  },
  {
    id: BLOCK_REGISTRY.DIAMOND_ORE,
    shape: "cube",
    material: "mc_diamond_ore",
    solid: true,
    hotbarTextureKey: "diamondOre"
  },
  {
    id: BLOCK_REGISTRY.DIAMOND_BLOCK,
    shape: "cube",
    material: "mc_diamond_block",
    solid: true,
    hotbarTextureKey: "diamondBlock"
  },
  {
    id: BLOCK_REGISTRY.LAPIS_ORE,
    shape: "cube",
    material: "mc_lapis_ore",
    solid: true,
    hotbarTextureKey: "lapisOre"
  },
  {
    id: BLOCK_REGISTRY.LAPIS_BLOCK,
    shape: "cube",
    material: "mc_lapis_block",
    solid: true,
    hotbarTextureKey: "lapisBlock"
  },
  {
    id: BLOCK_REGISTRY.MOSSY_STONEBRICKS,
    shape: "cube",
    material: "mc_mossy_stone_bricks",
    solid: true,
    hotbarTextureKey: "mossyStonebricks"
  },
  {
    id: BLOCK_REGISTRY.WHITE_CONCRETE,
    shape: "cube",
    material: "mc_white_concrete",
    solid: true,
    hotbarTextureKey: "whiteConcrete"
  },
  {
    id: BLOCK_REGISTRY.YELLOW_CONCRETE,
    shape: "cube",
    material: "mc_yellow_concrete",
    solid: true,
    hotbarTextureKey: "yellowConcrete"
  },
  {
    id: BLOCK_REGISTRY.RED_CONCRETE,
    shape: "cube",
    material: "mc_red_concrete",
    solid: true,
    hotbarTextureKey: "redConcrete"
  },
  {
    id: BLOCK_REGISTRY.PURPLE_CONCRETE,
    shape: "cube",
    material: "mc_purple_concrete",
    solid: true,
    hotbarTextureKey: "purpleConcrete"
  },
  {
    id: BLOCK_REGISTRY.PINK_CONCRETE,
    shape: "cube",
    material: "mc_pink_concrete",
    solid: true,
    hotbarTextureKey: "pinkConcrete"
  },
  {
    id: BLOCK_REGISTRY.ORANGE_CONCRETE,
    shape: "cube",
    material: "mc_orange_concrete",
    solid: true,
    hotbarTextureKey: "orangeConcrete"
  },
  {
    id: BLOCK_REGISTRY.MAGENTA_CONCRETE,
    shape: "cube",
    material: "mc_magenta_concrete",
    solid: true,
    hotbarTextureKey: "magentaConcrete"
  },
  {
    id: BLOCK_REGISTRY.LIME_CONCRETE,
    shape: "cube",
    material: "mc_lime_concrete",
    solid: true,
    hotbarTextureKey: "limeConcrete"
  },
  {
    id: BLOCK_REGISTRY.LIGHT_BLUE_CONCRETE,
    shape: "cube",
    material: "mc_light_blue_concrete",
    solid: true,
    hotbarTextureKey: "lightBlueConcrete"
  },
  {
    id: BLOCK_REGISTRY.GREEN_CONCRETE,
    shape: "cube",
    material: "mc_green_concrete",
    solid: true,
    hotbarTextureKey: "greenConcrete"
  },
  {
    id: BLOCK_REGISTRY.GRAY_CONCRETE,
    shape: "cube",
    material: "mc_gray_concrete",
    solid: true,
    hotbarTextureKey: "grayConcrete"
  },
  {
    id: BLOCK_REGISTRY.CYAN_CONCRETE,
    shape: "cube",
    material: "mc_cyan_concrete",
    solid: true,
    hotbarTextureKey: "cyanConcrete"
  },
  {
    id: BLOCK_REGISTRY.BROWN_CONCRETE,
    shape: "cube",
    material: "mc_brown_concrete",
    solid: true,
    hotbarTextureKey: "brownConcrete"
  },
  {
    id: BLOCK_REGISTRY.BLUE_CONCRETE,
    shape: "cube",
    material: "mc_blue_concrete",
    solid: true,
    hotbarTextureKey: "blueConcrete"
  },
  {
    id: BLOCK_REGISTRY.BLACK_CONCRETE,
    shape: "cube",
    material: "mc_black_concrete",
    solid: true,
    hotbarTextureKey: "blackConcrete"
  },
  {
    id: BLOCK_REGISTRY.PUMPKIN,
    shape: "cube",
    material: ["mc_pumpkin_top", "mc_pumpkin_side", "mc_pumpkin_side"],
    solid: true,
    hotbarTextureKey: "pumpkinSide"
  },
  {
    id: BLOCK_REGISTRY.ICE,
    shape: "cube",
    material: "mc_ice",
    solid: true,
    opaque: false,
    hotbarTextureKey: "ice"
  },
  {
    id: BLOCK_REGISTRY.GRASS_YELLOW,
    shape: "cube",
    material: ["mc_grass_yellow_top", "mc_dirt", "mc_grass_yellow_side"],
    solid: true,
    hotbarTextureKey: "grassYellowTop"
  },
  {
    id: BLOCK_REGISTRY.GRASS_PLANT_YELLOW,
    shape: "plantSprite",
    materialName: "mc_grass_plant_yellow",
    textureKey: "grassPlantYellow",
    hotbarTextureKey: "grassPlantYellow"
  },
  {
    id: BLOCK_REGISTRY.LEAVES_YELLOW,
    shape: "cube",
    material: "mc_leaves_yellow",
    solid: true,
    opaque: false,
    hotbarTextureKey: "leavesYellow"
  },
  {
    id: BLOCK_REGISTRY.GRASS_PLANT,
    shape: "plantSprite",
    materialName: "mc_grass_plant",
    textureKey: "grassPlant",
    hotbarTextureKey: "grassPlant"
  },
  {
    id: BLOCK_REGISTRY.LADDER,
    shape: "plantSprite",
    materialName: "mc_ladder",
    textureKey: "ladder",
    hotbarTextureKey: "ladder"
  },
  {
    id: BLOCK_REGISTRY.TORCH,
    shape: "plantSprite",
    materialName: "mc_torch",
    textureKey: "torch",
    hotbarTextureKey: "torch"
  },
  {
    id: BLOCK_REGISTRY.CHEST,
    shape: "cube",
    material: "mc_chest",
    solid: true,
    hotbarTextureKey: "chest"
  },
  {
    id: BLOCK_REGISTRY.MELON,
    shape: "cube",
    material: ["mc_melon_top", "mc_melon_side", "mc_melon_side"],
    solid: true,
    hotbarTextureKey: "melonSide"
  },
  {
    id: BLOCK_REGISTRY.SUGAR_CANE,
    shape: "plantSprite",
    materialName: "mc_sugar_cane",
    textureKey: "sugarCane",
    hotbarTextureKey: "sugarCane"
  },
  {
    id: BLOCK_REGISTRY.CAKE,
    shape: "slabHalf",
    material: {
      top: "mc_cake_top",
      bottom: "mc_cake_bottom",
      sides: "mc_cake_side"
    },
    hotbarIconUrl: "/minecraft-assets/item/cake.png"
  },
  {
    id: BLOCK_REGISTRY.CAKE_5,
    shape: "slabHalf",
    material: {
      top: "mc_cake_top",
      bottom: "mc_cake_bottom",
      sides: "mc_cake_side",
      inner: "mc_cake_inner"
    },
    hotbarIconUrl: "/minecraft-assets/item/cake.png"
  },
  {
    id: BLOCK_REGISTRY.CAKE_4,
    shape: "slabHalf",
    material: {
      top: "mc_cake_top",
      bottom: "mc_cake_bottom",
      sides: "mc_cake_side",
      inner: "mc_cake_inner"
    },
    hotbarIconUrl: "/minecraft-assets/item/cake.png"
  },
  {
    id: BLOCK_REGISTRY.CAKE_3,
    shape: "slabHalf",
    material: {
      top: "mc_cake_top",
      bottom: "mc_cake_bottom",
      sides: "mc_cake_side",
      inner: "mc_cake_inner"
    },
    hotbarIconUrl: "/minecraft-assets/item/cake.png"
  },
  {
    id: BLOCK_REGISTRY.CAKE_2,
    shape: "slabHalf",
    material: {
      top: "mc_cake_top",
      bottom: "mc_cake_bottom",
      sides: "mc_cake_side",
      inner: "mc_cake_inner"
    },
    hotbarIconUrl: "/minecraft-assets/item/cake.png"
  },
  {
    id: BLOCK_REGISTRY.CAKE_1,
    shape: "slabHalf",
    material: {
      top: "mc_cake_top",
      bottom: "mc_cake_bottom",
      sides: "mc_cake_side",
      inner: "mc_cake_inner"
    },
    hotbarIconUrl: "/minecraft-assets/item/cake.png"
  }
];

/** Block ids rendered as crossed billboards in noa (sapling, flowers, mushrooms). */
export const PLANT_SPRITE_BLOCK_IDS = new Set<number>(
  NOA_BLOCK_ENTRIES.filter((e) => e.shape === "plantSprite").map((e) => e.id)
);
