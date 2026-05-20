export {
  BLOCK_DEFS,
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  REPLACEABLE_BLOCK_IDS,
  REGISTERED_BLOCK_IDS,
  blockBreakable,
  blockDef,
  blockDropId,
  blockDropsPickable,
  blockReplaceable,
  type BlockDef,
  type BlockRegistry
} from "./blocks";

export {
  blockSoundGroup,
  blockSoundUrl,
  type BlockSoundAction,
  type BlockSoundGroup
} from "./blockAudio";

export {
  MC_MATERIAL_ENTRIES,
  NOA_BLOCK_ENTRIES,
  PLANT_SPRITE_BLOCK_IDS,
  noaCubeBlockOptions,
  type McTerrainTextureKey,
  type NoaBlockEntry,
  type NoaCubeBlockOptions
} from "./blockClientCatalog";

export {
  ITEM_DEFS,
  ITEM_REGISTRY,
  REGISTERED_ITEM_IDS,
  itemDef,
  itemFoodSpec,
  itemMaxDurability,
  itemMaxStack,
  itemPerkSpec,
  itemToolSpec,
  webItemIcons,
  type EquipmentSlotKey,
  type ItemCategory,
  type ItemDef,
  type ItemFoodSpec,
  type ItemPerkSpec,
  type ItemRegistry,
  type ItemToolSpec
} from "./items";

export {
  applyToolWear,
  breakDurationForBlock,
  breakDurationMs,
  HAND_TOOL_SPEED,
  isInstantBreak,
  resolveBreakTool,
  type ResolvedTool,
  type ToolKind,
  type ToolSlotRef,
  type ToolTier
} from "./mining";

export {
  CRAFTING_CELL_MAX,
  CRAFTING_GRID_SIZE,
  CRAFTING_GRID_WIDTH_2,
  CRAFTING_GRID_WIDTH_3,
  CRAFTING_TABLE_GRID_SIZE,
  PERSONAL_CRAFTING_GRID_SIZE,
  RECIPES,
  findMatchingRecipe,
  getBoundingBox,
  type GridCellSnapshot,
  type GridSnapshot,
  type Matrix2D,
  type MatchedRecipe,
  type Recipe,
  type RecipeIngredient,
  type RecipeOutput,
  type RecipeTag,
  type ShapedRecipe,
  type ShapelessRecipe
} from "./recipes";

export {
  BIOME_DEFS,
  biomeDef,
  type BiomeDef,
  type BiomeId
} from "./biomes";

export {
  precipitationKindForBiome,
  precipitationKindForColumn,
  type PrecipitationKind
} from "./weather";

export {
  MultiBiomeGenerator,
  SEA_LEVEL,
  SPAWN_SCAN_MAX_Y,
  WORLD_MIN_Y,
  findSurfaceY,
  isSpawnLocationSafe,
  multiBiomeGenerator,
  proceduralVoxelID,
  sampleBiomeColumn,
  type BiomeColumn,
  type BiomeFactors
} from "./worldgen";

export {
  clamp,
  hash3,
  noise2D,
  smoothNoise01,
  smoothstep
} from "./worldgenNoise";
