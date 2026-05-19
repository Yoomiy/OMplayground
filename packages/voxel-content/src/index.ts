export {
  BLOCK_DEFS,
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  REGISTERED_BLOCK_IDS,
  blockBreakable,
  blockDef,
  blockDropId,
  blockDropsPickable,
  type BlockDef,
  type BlockRegistry
} from "./blocks";

export {
  MC_MATERIAL_ENTRIES,
  NOA_BLOCK_ENTRIES,
  PLANT_SPRITE_BLOCK_IDS,
  type McTerrainTextureKey,
  type NoaBlockEntry
} from "./blockClientCatalog";

export {
  ITEM_DEFS,
  ITEM_REGISTRY,
  REGISTERED_ITEM_IDS,
  itemDef,
  itemMaxDurability,
  itemMaxStack,
  itemToolSpec,
  webItemIcons,
  type ItemCategory,
  type ItemDef,
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
  RECIPES,
  findMatchingRecipe,
  type GridCellSnapshot,
  type GridSnapshot,
  type MatchedRecipe,
  type Recipe,
  type RecipeIngredient,
  type RecipeOutput,
  type ShapedRecipe,
  type ShapelessRecipe
} from "./recipes";
