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
  | "bedrock";

/** One Babylon material per mc_* texture file; order matches legacy registration. */
export const MC_MATERIAL_ENTRIES = [
  { name: "mc_grass_top", textureKey: "grassTop" as const },
  { name: "mc_grass_side", textureKey: "grassSide" as const },
  { name: "mc_dirt", textureKey: "dirt" as const },
  { name: "mc_stone", textureKey: "stone" as const },
  { name: "mc_oak_log", textureKey: "oakLog" as const },
  { name: "mc_oak_log_top", textureKey: "oakLogTop" as const },
  { name: "mc_oak_leaves", textureKey: "oakLeaves" as const, texHasAlpha: true },
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
  { name: "mc_bedrock", textureKey: "bedrock" as const }
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
    };

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
  }
];

/** Block ids rendered as crossed billboards in noa (sapling, flowers, mushrooms). */
export const PLANT_SPRITE_BLOCK_IDS = new Set<number>(
  NOA_BLOCK_ENTRIES.filter((e) => e.shape === "plantSprite").map((e) => e.id)
);
