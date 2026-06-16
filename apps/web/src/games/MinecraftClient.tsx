import { useEffect, useRef, useState } from "react";
import type { ChatLineRow } from "@/hooks/usePersistedSessionChat";
import type { DragEvent } from "react";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import {
  BLOCK_REGISTRY,
  ITEM_REGISTRY,
  ITEM_ICON,
  MAIN_ITEM_INVENTORY_SLOTS,
  MAX_REACH,
  PLACEABLE_BLOCK_IDS,
  CRAFTING_GRID_SLOTS,
  EQUIPMENT_SLOT_COUNT,
  type BlockDelta,
  type ChestSlot,
  type CraftingGridSlot,
  type GameMode,
  type HotbarSlot,
  type InputReq,
  type InventoryRegion,
  type InventoryMoveReq,
  type ItemSlot,
  type CraftingGridWidth,
  type EatStartAck,
  type PlayerVitals,
  type RoomEvent,
  type RoomPlayerInfo,
  type RoomSnapshot,
  type Vec3,
  type BreakStartAck,
  type OpenChestAck,
  type PlayerDamagePayload,
  type SimpleAck,
  type WorldDrop,
  type WorldDropWireDelta
} from "@/lib/voxelProtocol";
import {
  isInstantBreak,
  isEquipmentPerkActive,
  itemFoodSpec,
  itemMaxDurability,
  MC_MATERIAL_ENTRIES,
  NOA_BLOCK_ENTRIES,
  PLANT_SPRITE_BLOCK_IDS,
  RECIPES,
  blockSoundGroup,
  blockBreakable,
  blockReplaceable,
  noaCubeBlockOptions,
  precipitationKindForColumn,
  proceduralVoxelID,
  sampleBiomeColumn,
  sugarCaneMayPlaceOn,
  type PrecipitationKind,
  type Recipe,
  type RecipeIngredient
} from "@playground/voxel-content";
import { craftingGridPreview } from "@/lib/voxelCraftingPreview";
import { VOXEL_ENTITY_CATALOG } from "@/games/voxel/voxelEntityCatalog";
import {
  applyTextureToVoxelRoot,
  cloneVoxelTemplate,
  preloadVoxelTemplate
} from "@/games/voxel/voxelJsonModel";
import {
  attachVoxelVisualToEntity,
  attachVoxelVisualToPlayer,
  setVisualVisible
} from "@/games/voxel/noaVoxelVisual";
import {
  advanceAvatarSwing,
  createAvatarRig,
  setAvatarHeadPitch,
  setAvatarYaw,
  setAvatarYawSmoothed,
  triggerAvatarSwing,
  updateAvatarWalk,
  type AvatarRig
} from "@/games/voxel/voxelAvatarAnimation";
import { overrideObjectMesher } from "@/games/voxel/voxelObjectMesher";
import { WorldgenWorkerPool } from "@/games/voxel/worldgenPool";
import {
  createBreakCrackOverlay,
  destroyStageIndex,
  type BreakCrackOverlay
} from "@/games/voxel/breakCrackOverlay";
import {
  FirstPersonHeldItemView,
  resolveHeldItemSpec
} from "@/games/voxel/heldItemView";
import { AudioManager } from "@/games/voxel/audioManager";
import { useLiveKitProximity, countSolidBlocksBetween } from "@/hooks/useLiveKitProximity";
import {
  VOXEL_MOVEMENT,
  resolveVoxelMovement
} from "@/games/voxel/movementConfig";
import { SURVIVAL_HELP_TABS } from "./minecraftSurvivalHelpHe";
import type { SurvivalHelpTabId } from "./minecraftSurvivalHelpHe";
import { SurvivalVitalsHud } from "@/games/voxel/hud/SurvivalVitalsHud";
import { BlockHotbarHud } from "@/games/voxel/hud/BlockHotbarHud";
import { ChatOverlay } from "@/games/voxel/hud/ChatOverlay";
import { TeacherDashboard } from "@/games/voxel/hud/TeacherDashboard";
import { VoiceWidget } from "@/games/voxel/hud/VoiceWidget";

const INV_DRAG_MIME = "application/x-playground-voxel-inv";

/**
 * Dumb noa-engine wrapper — props only, no IO. The container connects to
 * the voxel server (`useVoxelSocket`) and pipes data in/out via:
 *   - props: seed, deltas, mySpawn, paused, onInput/onBlockPlace/onBlockBreak
 *   - registerSnapshotListener / registerBlockDeltaListener: imperative
 *     fan-in for high-frequency server updates without re-rendering React.
 *
 * This component mounts noa on a host `<div>` and draws a hotbar HUD
 * (block icons) in creative and survival so players see the active slot.
 *
 * `noa-engine` typings are intentionally loose; we annotate the engine as
 * `any` to keep the integration small instead of redeclaring its surface.
 */

const HOTBAR = PLACEABLE_BLOCK_IDS;

function visibleCreativeHotbarBlocks(selectedBlockId: number): number[] {
  const blocks = HOTBAR.slice(0, 9);
  if (!blocks.includes(selectedBlockId) && PLACEABLE_BLOCK_IDS.includes(selectedBlockId)) {
    blocks[8] = selectedBlockId;
  }
  return blocks;
}

const PERSONAL_CRAFTING_SLOT_INDICES = [0, 1, 3, 4] as const;
const EQUIPMENT_SLOT_LABELS = ["ראש", "חזה", "רגל", "נעל"] as const;
const EMPTY_CRAFTING_SLOT: CraftingGridSlot = {
  blockId: BLOCK_REGISTRY.AIR,
  itemId: 0,
  count: 0
};
/** Max third-person camera pull-back (voxels); noa defaults `initialZoom` 0. */
const CAMERA_ZOOM_DISTANCE_MAX = 16;
/** Wheel delta → `zoomDistance` scale (`game-inputs` uses scaled pixel deltas). */
const CAMERA_ZOOM_SCROLL_STEP = 0.012;

/** Short labels for tooltips / a11y (Hebrew). */
const BLOCK_HUD: Record<number, string> = {
  [BLOCK_REGISTRY.GRASS]: "דשא",
  [BLOCK_REGISTRY.DIRT]: "עפר",
  [BLOCK_REGISTRY.STONE]: "אבן",
  [BLOCK_REGISTRY.WOOD]: "עץ",
  [BLOCK_REGISTRY.LEAVES]: "עלים",
  [BLOCK_REGISTRY.SAND]: "חול",
  [BLOCK_REGISTRY.GLASS]: "זכוכית",
  [BLOCK_REGISTRY.COBBLESTONE]: "אבן מרוצפת",
  [BLOCK_REGISTRY.OAK_PLANKS]: "לוחות עץ",
  [BLOCK_REGISTRY.SAPLING]: "שתיל",
  [BLOCK_REGISTRY.GRAVEL]: "חצץ",
  [BLOCK_REGISTRY.GOLD_ORE]: "עפרת זהב",
  [BLOCK_REGISTRY.IRON_ORE]: "עפרת ברזל",
  [BLOCK_REGISTRY.COAL_ORE]: "עפרת פחם",
  [BLOCK_REGISTRY.SPONGE]: "ספוג",
  [BLOCK_REGISTRY.RED_WOOL]: "צמר אדום",
  [BLOCK_REGISTRY.ORANGE_WOOL]: "צמר כתום",
  [BLOCK_REGISTRY.YELLOW_WOOL]: "צמר צהוב",
  [BLOCK_REGISTRY.LIME_WOOL]: "צמר ליים",
  [BLOCK_REGISTRY.GREEN_WOOL]: "צמר ירוק",
  [BLOCK_REGISTRY.CYAN_WOOL]: "צמר טורקיז",
  [BLOCK_REGISTRY.BLUE_WOOL]: "צמר כחול",
  [BLOCK_REGISTRY.PURPLE_WOOL]: "צמר סגול",
  [BLOCK_REGISTRY.MAGENTA_WOOL]: "צמר מג'נטה",
  [BLOCK_REGISTRY.PINK_WOOL]: "צמר ורוד",
  [BLOCK_REGISTRY.BLACK_WOOL]: "צמר שחור",
  [BLOCK_REGISTRY.GRAY_WOOL]: "צמר אפור",
  [BLOCK_REGISTRY.WHITE_WOOL]: "צמר לבן",
  [BLOCK_REGISTRY.DANDELION]: "שן הארי",
  [BLOCK_REGISTRY.ROSE]: "ורד",
  [BLOCK_REGISTRY.BROWN_MUSHROOM]: "פטרייה חומה",
  [BLOCK_REGISTRY.RED_MUSHROOM]: "פטרייה אדומה",
  [BLOCK_REGISTRY.GOLD_BLOCK]: "בלוק זהב",
  [BLOCK_REGISTRY.IRON_BLOCK]: "בלוק ברזל",
  [BLOCK_REGISTRY.STONE_SLAB]: "לוח אבן",
  [BLOCK_REGISTRY.BRICKS]: "לבנים",
  [BLOCK_REGISTRY.TNT]: "TNT",
  [BLOCK_REGISTRY.BOOKSHELF]: "ספרייה",
  [BLOCK_REGISTRY.MOSSY_COBBLESTONE]: "אבן טחובה",
  [BLOCK_REGISTRY.OBSIDIAN]: "אובסידיאן",
  [BLOCK_REGISTRY.BEDROCK]: "סלע יסוד",
  [BLOCK_REGISTRY.BIRCH_LOG]: "עץ ליבנה",
  [BLOCK_REGISTRY.BIRCH_PLANKS]: "לוחות ליבנה",
  [BLOCK_REGISTRY.BIRCH_LEAVES]: "עלי ליבנה",
  [BLOCK_REGISTRY.SPRUCE_LOG]: "עץ אשוח",
  [BLOCK_REGISTRY.SPRUCE_PLANKS]: "לוחות אשוח",
  [BLOCK_REGISTRY.SPRUCE_LEAVES]: "עלי אשוח",
  [BLOCK_REGISTRY.GRASS_SNOW]: "דשא מושלג",
  [BLOCK_REGISTRY.BARRIER]: "מחסום",
  [BLOCK_REGISTRY.SNOW]: "שלג",
  [BLOCK_REGISTRY.CACTUS]: "קקטוס",
  [BLOCK_REGISTRY.DEADBUSH]: "שיח יבש",
  [BLOCK_REGISTRY.CRAFTING]: "שולחן יצירה",
  [BLOCK_REGISTRY.STONEBRICK]: "לבני אבן",
  [BLOCK_REGISTRY.BROWN_WOOL]: "צמר חום",
  [BLOCK_REGISTRY.LIGHT_BLUE_WOOL]: "צמר תכלת",
  [BLOCK_REGISTRY.WHITE_STAINED_GLASS]: "זכוכית לבנה",
  [BLOCK_REGISTRY.YELLOW_STAINED_GLASS]: "זכוכית צהובה",
  [BLOCK_REGISTRY.RED_STAINED_GLASS]: "זכוכית אדומה",
  [BLOCK_REGISTRY.PURPLE_STAINED_GLASS]: "זכוכית סגולה",
  [BLOCK_REGISTRY.PINK_STAINED_GLASS]: "זכוכית ורודה",
  [BLOCK_REGISTRY.ORANGE_STAINED_GLASS]: "זכוכית כתומה",
  [BLOCK_REGISTRY.MAGENTA_STAINED_GLASS]: "זכוכית מג'נטה",
  [BLOCK_REGISTRY.LIME_STAINED_GLASS]: "זכוכית ליים",
  [BLOCK_REGISTRY.LIGHT_BLUE_STAINED_GLASS]: "זכוכית תכלת",
  [BLOCK_REGISTRY.GREEN_STAINED_GLASS]: "זכוכית ירוקה",
  [BLOCK_REGISTRY.GRAY_STAINED_GLASS]: "זכוכית אפורה",
  [BLOCK_REGISTRY.CYAN_STAINED_GLASS]: "זכוכית טורקיז",
  [BLOCK_REGISTRY.BROWN_STAINED_GLASS]: "זכוכית חומה",
  [BLOCK_REGISTRY.BLUE_STAINED_GLASS]: "זכוכית כחולה",
  [BLOCK_REGISTRY.BLACK_STAINED_GLASS]: "זכוכית שחורה",
  [BLOCK_REGISTRY.SANDSTONE]: "אבן חול",
  [BLOCK_REGISTRY.DIAMOND_ORE]: "עפרת יהלום",
  [BLOCK_REGISTRY.DIAMOND_BLOCK]: "בלוק יהלום",
  [BLOCK_REGISTRY.LAPIS_ORE]: "עפרת לפיס",
  [BLOCK_REGISTRY.LAPIS_BLOCK]: "בלוק לפיס",
  [BLOCK_REGISTRY.MOSSY_STONEBRICKS]: "לבני אבן טחובות",
  [BLOCK_REGISTRY.WHITE_CONCRETE]: "בטון לבן",
  [BLOCK_REGISTRY.YELLOW_CONCRETE]: "בטון צהוב",
  [BLOCK_REGISTRY.RED_CONCRETE]: "בטון אדום",
  [BLOCK_REGISTRY.PURPLE_CONCRETE]: "בטון סגול",
  [BLOCK_REGISTRY.PINK_CONCRETE]: "בטון ורוד",
  [BLOCK_REGISTRY.ORANGE_CONCRETE]: "בטון כתום",
  [BLOCK_REGISTRY.MAGENTA_CONCRETE]: "בטון מג'נטה",
  [BLOCK_REGISTRY.LIME_CONCRETE]: "בטון ליים",
  [BLOCK_REGISTRY.LIGHT_BLUE_CONCRETE]: "בטון תכלת",
  [BLOCK_REGISTRY.GREEN_CONCRETE]: "בטון ירוק",
  [BLOCK_REGISTRY.GRAY_CONCRETE]: "בטון אפור",
  [BLOCK_REGISTRY.CYAN_CONCRETE]: "בטון טורקיז",
  [BLOCK_REGISTRY.BROWN_CONCRETE]: "בטון חום",
  [BLOCK_REGISTRY.BLUE_CONCRETE]: "בטון כחול",
  [BLOCK_REGISTRY.BLACK_CONCRETE]: "בטון שחור",
  [BLOCK_REGISTRY.PUMPKIN]: "דלעת",
  [BLOCK_REGISTRY.ICE]: "קרח",
  [BLOCK_REGISTRY.GRASS_YELLOW]: "דשא יבש",
  [BLOCK_REGISTRY.GRASS_PLANT_YELLOW]: "עשב יבש",
  [BLOCK_REGISTRY.LEAVES_YELLOW]: "עלים צהובים",
  [BLOCK_REGISTRY.GRASS_PLANT]: "עשב",
  [BLOCK_REGISTRY.LADDER]: "סולם",
  [BLOCK_REGISTRY.TORCH]: "לפיד",
  [BLOCK_REGISTRY.CHEST]: "תיבה",
  [BLOCK_REGISTRY.MELON]: "אבטיח",
  [BLOCK_REGISTRY.CAKE]: "עוגה",
  [BLOCK_REGISTRY.CAKE_5]: "עוגה (5 פרוסות)",
  [BLOCK_REGISTRY.CAKE_4]: "עוגה (4 פרוסות)",
  [BLOCK_REGISTRY.CAKE_3]: "עוגה (3 פרוסות)",
  [BLOCK_REGISTRY.CAKE_2]: "עוגה (2 פרוסות)",
  [BLOCK_REGISTRY.CAKE_1]: "עוגה (פרוסה אחת)",
  [BLOCK_REGISTRY.SUGAR_CANE]: "קני סוכר"
};

function isValidDragPayload(
  v: unknown
): v is { from: InventoryRegion; fromIndex: number } {
  if (
    v &&
    typeof v === "object" &&
    "from" in v &&
    typeof (v as { from: unknown }).from === "string" &&
    "fromIndex" in v &&
    typeof (v as { fromIndex: unknown }).fromIndex === "number"
  ) {
    return true;
  }
  return false;
}

const ITEM_HUD: Record<number, string> = {
  [ITEM_REGISTRY.STICK]: "מקל",
  [ITEM_REGISTRY.PLANKS]: "לוחות",
  [ITEM_REGISTRY.WOODEN_PICKAXE]: "מכוש עץ",
  [ITEM_REGISTRY.STONE_PICKAXE]: "מכוש אבן",
  [ITEM_REGISTRY.IRON_PICKAXE]: "מכוש ברזל",
  [ITEM_REGISTRY.DIAMOND_PICKAXE]: "מכוש יהלום",
  [ITEM_REGISTRY.WOODEN_AXE]: "גרזן עץ",
  [ITEM_REGISTRY.STONE_AXE]: "גרזן אבן",
  [ITEM_REGISTRY.IRON_AXE]: "גרזן ברזל",
  [ITEM_REGISTRY.WOODEN_SHOVEL]: "את עץ",
  [ITEM_REGISTRY.STONE_SHOVEL]: "את אבן",
  [ITEM_REGISTRY.DIAMOND_AXE]: "גרזן יהלום",
  [ITEM_REGISTRY.SWIFT_PICKAXE]: "מכוש מהיר",
  [ITEM_REGISTRY.BUCKET]: "דלי",
  [ITEM_REGISTRY.WATER_BUCKET]: "דלי מים",
  [ITEM_REGISTRY.IRON_INGOT]: "מטיל ברזל",
  [ITEM_REGISTRY.GOLD_INGOT]: "מטיל זהב",
  [ITEM_REGISTRY.DIAMOND]: "יהלום",
  [ITEM_REGISTRY.COAL]: "פחם",
  [ITEM_REGISTRY.FLINT]: "צור",
  [ITEM_REGISTRY.WHEAT]: "חיטה",
  [ITEM_REGISTRY.BREAD]: "לחם",
  [ITEM_REGISTRY.APPLE]: "תפוח",
  [ITEM_REGISTRY.FLINT_AND_STEEL]: "מצית צור וברזל",
  [ITEM_REGISTRY.HEAVY_SHIELD]: "מגן כבד",
  [ITEM_REGISTRY.FEATHER_FALLING_TALISMAN]: "קמע נפילת נוצה",
  [ITEM_REGISTRY.HELIOS_MEDALLION]: "מדליון הליוס",
  [ITEM_REGISTRY.HELIUM_BOOTS]: "מגפי הליום",
  [ITEM_REGISTRY.GLOW_TALISMAN]: "קמע זוהר",
  [ITEM_REGISTRY.SUGAR]: "סוכר",
  [ITEM_REGISTRY.COCOA_BEANS]: "פולי קקאו",
  [ITEM_REGISTRY.EGG]: "ביצה",
  [ITEM_REGISTRY.RAW_MEAT]: "בשר נא",
  [ITEM_REGISTRY.COOKED_MEAT]: "בשר מבושל",
  [ITEM_REGISTRY.RAW_BEEF]: "בשר בקר נא",
  [ITEM_REGISTRY.COOKED_BEEF]: "סטייק",
  [ITEM_REGISTRY.COOKIE]: "עוגייה",
  [ITEM_REGISTRY.MELON_SLICE]: "פלח אבטיח",
  [ITEM_REGISTRY.CARROT]: "גזר",
  [ITEM_REGISTRY.GOLDEN_CARROT]: "גזר זהב",
  [ITEM_REGISTRY.POTATO]: "תפוח אדמה",
  [ITEM_REGISTRY.BAKED_POTATO]: "תפוח אדמה אפוי",
  [ITEM_REGISTRY.POISONOUS_POTATO]: "תפוח אדמה רעיל",
  [ITEM_REGISTRY.GUNPOWDER]: "אבק שרפה"
};

function vecDist(a: readonly number[], b: readonly number[]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Minecraft-like slot: raised inner bevel, dark rim. */
function toolDurabilityBar(itemId: number, durability?: number): JSX.Element | null {
  const max = itemMaxDurability(itemId);
  if (max <= 0) return null;
  const cur = Math.max(0, Math.min(max, durability ?? max));
  return (
    <span className="pointer-events-none absolute inset-x-0.5 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-black/55">
      <span
        className="block h-full bg-lime-400"
        style={{ width: `${(cur / max) * 100}%` }}
      />
    </span>
  );
}

function mcSlotClass(selected: boolean): string {
  return [
    "relative flex h-10 w-10 shrink-0 items-center justify-center",
    "border-2 border-[#2a2a2a]",
    "bg-[#8d8d8d]",
    "shadow-[inset_2px_2px_0_rgba(255,255,255,0.45),inset_-2px_-2px_0_rgba(0,0,0,0.35)]",
    selected ? "z-[1] ring-2 ring-[#f8e060] ring-offset-2 ring-offset-[#5e4f38]" : ""
  ].join(" ");
}

/** Served from apps/web/public/minecraft-assets (copied from source packs). */
const MC_TEX = {
  grassTop: "/minecraft-assets/block/grass_block_top.png",
  grassSide: "/minecraft-assets/block/grass_block_side.png",
  dirt: "/minecraft-assets/block/dirt.png",
  stone: "/minecraft-assets/block/stone.png",
  oakLog: "/minecraft-assets/block/oak_log.png",
  oakLogTop: "/minecraft-assets/block/oak_log_top.png",
  oakLeaves: "/minecraft-assets/block/oak_leaves.png",
  birchLog: "/minecraft-assets/block/birch_log.png",
  birchLogTop: "/minecraft-assets/block/birch_log_top.png",
  birchPlanks: "/minecraft-assets/block/birch_planks.png",
  birchLeaves: "/minecraft-assets/block/birch_leaves.png",
  spruceLog: "/minecraft-assets/block/spruce_log.png",
  spruceLogTop: "/minecraft-assets/block/spruce_log_top.png",
  sprucePlanks: "/minecraft-assets/block/spruce_planks.png",
  spruceLeaves: "/minecraft-assets/block/spruce_leaves.png",
  sand: "/minecraft-assets/block/sand.png",
  waterStill: "/minecraft-assets/block/water_still.png",
  glass: "/minecraft-assets/block/glass.png",
  cobblestone: "/minecraft-assets/block/cobblestone.png",
  oakPlanks: "/minecraft-assets/block/oak_planks.png",
  sapling: "/minecraft-assets/block/oak_sapling.png",
  gravel: "/minecraft-assets/block/gravel.png",
  goldOre: "/minecraft-assets/block/gold_ore.png",
  ironOre: "/minecraft-assets/block/iron_ore.png",
  coalOre: "/minecraft-assets/block/coal_ore.png",
  sponge: "/minecraft-assets/block/sponge.png",
  redWool: "/minecraft-assets/block/red_wool.png",
  orangeWool: "/minecraft-assets/block/orange_wool.png",
  yellowWool: "/minecraft-assets/block/yellow_wool.png",
  limeWool: "/minecraft-assets/block/lime_wool.png",
  greenWool: "/minecraft-assets/block/green_wool.png",
  cyanWool: "/minecraft-assets/block/cyan_wool.png",
  blueWool: "/minecraft-assets/block/blue_wool.png",
  purpleWool: "/minecraft-assets/block/purple_wool.png",
  magentaWool: "/minecraft-assets/block/magenta_wool.png",
  pinkWool: "/minecraft-assets/block/pink_wool.png",
  blackWool: "/minecraft-assets/block/black_wool.png",
  grayWool: "/minecraft-assets/block/gray_wool.png",
  whiteWool: "/minecraft-assets/block/white_wool.png",
  dandelion: "/minecraft-assets/block/dandelion.png",
  rose: "/minecraft-assets/block/red_flower.png",
  brownMushroom: "/minecraft-assets/block/brown_mushroom.png",
  redMushroom: "/minecraft-assets/block/red_mushroom.png",
  goldBlock: "/minecraft-assets/block/gold_block.png",
  ironBlock: "/minecraft-assets/block/iron_block.png",
  smoothStone: "/minecraft-assets/block/smooth_stone.png",
  smoothStoneSlabSide: "/minecraft-assets/block/smooth_stone_slab_side.png",
  bricks: "/minecraft-assets/block/bricks.png",
  tntTop: "/minecraft-assets/block/tnt_top.png",
  tntBottom: "/minecraft-assets/block/tnt_bottom.png",
  tntSide: "/minecraft-assets/block/tnt_side.png",
  bookshelf: "/minecraft-assets/block/bookshelf.png",
  mossyCobblestone: "/minecraft-assets/block/mossy_cobblestone.png",
  obsidian: "/minecraft-assets/block/obsidian.png",
  bedrock: "/minecraft-assets/block/bedrock.png",
  grassSnow: "/minecraft-assets/block/grass_snow.png",
  snow: "/minecraft-assets/block/snow.png",
  cactusTop: "/minecraft-assets/block/cactus_top.png",
  cactusBottom: "/minecraft-assets/block/cactus_bottom.png",
  cactusSide: "/minecraft-assets/block/cactus_side.png",
  deadBush: "/minecraft-assets/block/dead_bush.png",
  craftingTableTop: "/minecraft-assets/block/crafting_table_top.png",
  craftingTableSide: "/minecraft-assets/block/crafting_table_side.png",
  stoneBrick: "/minecraft-assets/block/stonebrick.png",
  brownWool: "/minecraft-assets/block/brown_wool.png",
  lightBlueWool: "/minecraft-assets/block/light_blue_wool.png",
  whiteStainedGlass: "/minecraft-assets/block/white_stained_glass.png",
  yellowStainedGlass: "/minecraft-assets/block/yellow_stained_glass.png",
  redStainedGlass: "/minecraft-assets/block/red_stained_glass.png",
  purpleStainedGlass: "/minecraft-assets/block/purple_stained_glass.png",
  pinkStainedGlass: "/minecraft-assets/block/pink_stained_glass.png",
  orangeStainedGlass: "/minecraft-assets/block/orange_stained_glass.png",
  magentaStainedGlass: "/minecraft-assets/block/magenta_stained_glass.png",
  limeStainedGlass: "/minecraft-assets/block/lime_stained_glass.png",
  lightBlueStainedGlass: "/minecraft-assets/block/light_blue_stained_glass.png",
  greenStainedGlass: "/minecraft-assets/block/green_stained_glass.png",
  grayStainedGlass: "/minecraft-assets/block/gray_stained_glass.png",
  cyanStainedGlass: "/minecraft-assets/block/cyan_stained_glass.png",
  brownStainedGlass: "/minecraft-assets/block/brown_stained_glass.png",
  blueStainedGlass: "/minecraft-assets/block/blue_stained_glass.png",
  blackStainedGlass: "/minecraft-assets/block/black_stained_glass.png",
  sandstone: "/minecraft-assets/block/sandstone.png",
  diamondOre: "/minecraft-assets/block/diamond_ore.png",
  diamondBlock: "/minecraft-assets/block/diamond_block.png",
  lapisOre: "/minecraft-assets/block/lapis_ore.png",
  lapisBlock: "/minecraft-assets/block/lapis_block.png",
  mossyStonebricks: "/minecraft-assets/block/mossy_stone_bricks.png",
  whiteConcrete: "/minecraft-assets/block/white_concrete.png",
  yellowConcrete: "/minecraft-assets/block/yellow_concrete.png",
  redConcrete: "/minecraft-assets/block/red_concrete.png",
  purpleConcrete: "/minecraft-assets/block/purple_concrete.png",
  pinkConcrete: "/minecraft-assets/block/pink_concrete.png",
  orangeConcrete: "/minecraft-assets/block/orange_concrete.png",
  magentaConcrete: "/minecraft-assets/block/magenta_concrete.png",
  limeConcrete: "/minecraft-assets/block/lime_concrete.png",
  lightBlueConcrete: "/minecraft-assets/block/light_blue_concrete.png",
  greenConcrete: "/minecraft-assets/block/green_concrete.png",
  grayConcrete: "/minecraft-assets/block/gray_concrete.png",
  cyanConcrete: "/minecraft-assets/block/cyan_concrete.png",
  brownConcrete: "/minecraft-assets/block/brown_concrete.png",
  blueConcrete: "/minecraft-assets/block/blue_concrete.png",
  blackConcrete: "/minecraft-assets/block/black_concrete.png",
  pumpkinTop: "/minecraft-assets/block/pumpkin_top.png",
  pumpkinSide: "/minecraft-assets/block/pumpkin_side.png",
  ice: "/minecraft-assets/block/ice.png",
  grassYellowTop: "/minecraft-assets/block/grass_yellow_top.png",
  grassYellowSide: "/minecraft-assets/block/grass_yellow_side.png",
  grassPlantYellow: "/minecraft-assets/block/grass_plant_yellow.png",
  leavesYellow: "/minecraft-assets/block/leaves_yellow.png",
  grassPlant: "/minecraft-assets/block/grass_plant.png",
  ladder: "/minecraft-assets/block/ladder.png",
  torch: "/minecraft-assets/block/torch.png",
  chest: "/minecraft-assets/block/chest.png",
  melonTop: "/minecraft-assets/block/melon_top.png",
  melonSide: "/minecraft-assets/block/melon_side.png",
  cakeTop: "/minecraft-assets/block/cake_top.png",
  cakeBottom: "/minecraft-assets/block/cake_bottom.png",
  cakeSide: "/minecraft-assets/block/cake_side.png",
  cakeInner: "/minecraft-assets/block/cake_inner.png",
  sugarCane: "/minecraft-assets/block/sugar_cane.png"
} as const;

/** Item-style icon per block for the hotbar (same assets as terrain). */
const BLOCK_HOTBAR_ICON: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const e of NOA_BLOCK_ENTRIES) {
    if (e.shape === "slabHalf") {
      m[e.id] = e.hotbarIconUrl;
    } else {
      m[e.id] = MC_TEX[e.hotbarTextureKey];
    }
  }
  return m;
})();

const FLAT_HELD_BLOCK_IDS = new Set<number>([
  ...PLANT_SPRITE_BLOCK_IDS,
  BLOCK_REGISTRY.CAKE,
  BLOCK_REGISTRY.CAKE_5,
  BLOCK_REGISTRY.CAKE_4,
  BLOCK_REGISTRY.CAKE_3,
  BLOCK_REGISTRY.CAKE_2,
  BLOCK_REGISTRY.CAKE_1
]);

function registerMcTerrainMaterials(
  noa: {
    registry: { registerMaterial: (name: string, opts: Record<string, unknown>) => void };
    rendering: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getScene: () => any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeStandardMaterial: (name: string) => any;
    };
  },
  Babylon: typeof import("@babylonjs/core")
): void {
  const reg = (name: string, textureURL: string, extra: Record<string, unknown> = {}) => {
    noa.registry.registerMaterial(name, { textureURL, ...extra });
  };
  for (const m of MC_MATERIAL_ENTRIES) {
    const url = MC_TEX[m.textureKey];
    if (m.name === "mc_water") {
      const scene = noa.rendering.getScene();
      const tex = new Babylon.Texture(
        url,
        scene,
        true,
        false,
        Babylon.Texture.NEAREST_SAMPLINGMODE
      );
      tex.hasAlpha = true;
      const mat = noa.rendering.makeStandardMaterial("mc_water_render");
      mat.diffuseTexture = tex;
      mat.diffuseColor?.set(0.58, 0.78, 1);
      mat.ambientColor?.set(0.58, 0.78, 1);
      mat.specularColor?.set(0, 0, 0);
      mat.alpha = 0.62;
      mat.backFaceCulling = false;
      mat.freeze?.();
      noa.registry.registerMaterial(m.name, {
        color: [0.35, 0.55, 0.9, 0.42],
        renderMaterial: mat,
        texHasAlpha: true
      });
      continue;
    }
    reg(m.name, url, "texHasAlpha" in m && m.texHasAlpha ? { texHasAlpha: true } : {});
  }
}

function recipeIngredientDisplay(
  ingredient: RecipeIngredient
): { readonly icon: string; readonly label: string } {
  if (ingredient.kind === "block") {
    return {
      icon: BLOCK_HOTBAR_ICON[ingredient.blockId],
      label: BLOCK_HUD[ingredient.blockId] ?? String(ingredient.blockId)
    };
  }
  if (ingredient.kind === "item") {
    return {
      icon: ITEM_ICON[ingredient.itemId],
      label: ITEM_HUD[ingredient.itemId] ?? String(ingredient.itemId)
    };
  }
  if (ingredient.tag === "wood_logs") {
    return { icon: MC_TEX.oakLog, label: "גזע עץ" };
  }
  if (ingredient.tag === "leaves") {
    return { icon: BLOCK_HOTBAR_ICON[BLOCK_REGISTRY.LEAVES], label: "עלים" };
  }
  return { icon: BLOCK_HOTBAR_ICON[BLOCK_REGISTRY.OAK_PLANKS], label: "לוחות עץ" };
}

function recipeOutputDisplay(recipe: Recipe): {
  readonly icon: string;
  readonly label: string;
} {
  const { output } = recipe;
  if (output.kind === "block") {
    return {
      icon: BLOCK_HOTBAR_ICON[output.id],
      label: BLOCK_HUD[output.id] ?? String(output.id)
    };
  }
  return {
    icon: ITEM_ICON[output.id],
    label: ITEM_HUD[output.id] ?? String(output.id)
  };
}

function getRecipeCategory(recipe: Recipe): "tools" | "building" | "food_misc" {
  const key = recipe.key;
  if (
    key.includes("pickaxe") ||
    key.includes("axe") ||
    key.includes("shovel") ||
    key.includes("boots") ||
    key.includes("bucket") ||
    key.includes("shield") ||
    key.includes("talisman") ||
    key.includes("medallion") ||
    key === "crafting_table" ||
    key === "chest" ||
    key === "torch" ||
    key === "flint_and_steel"
  ) {
    return "tools";
  }

  if (key === "cake") {
    return "food_misc";
  }

  if (recipe.output.kind === "block") {
    return "building";
  }

  return "food_misc";
}

function canCraftRecipe(
  recipe: Recipe,
  inventory: readonly { blockId: number; itemId: number; count: number }[]
): boolean {
  const ingredients: RecipeIngredient[] = [];
  if (recipe.kind === "shapeless") {
    ingredients.push(...recipe.inputs);
  } else {
    for (const ing of recipe.pattern) {
      if (ing !== null) {
        ingredients.push(ing);
      }
    }
  }

  const invCopy = inventory.map((item) => ({
    blockId: item.blockId,
    itemId: item.itemId,
    count: item.count
  }));

  const isPlankCellLocal = (cell: { blockId: number; itemId: number }) => {
    if (cell.itemId > 0) return cell.itemId === ITEM_REGISTRY.PLANKS;
    return (
      cell.blockId === BLOCK_REGISTRY.OAK_PLANKS ||
      cell.blockId === BLOCK_REGISTRY.BIRCH_PLANKS ||
      cell.blockId === BLOCK_REGISTRY.SPRUCE_PLANKS
    );
  };

  const isWoodLogCellLocal = (cell: { blockId: number; itemId: number }) => {
    return (
      cell.itemId === 0 &&
      (cell.blockId === BLOCK_REGISTRY.WOOD ||
        cell.blockId === BLOCK_REGISTRY.BIRCH_LOG ||
        cell.blockId === BLOCK_REGISTRY.SPRUCE_LOG)
    );
  };

  const isLeavesCellLocal = (cell: { blockId: number; itemId: number }) => {
    return (
      cell.itemId === 0 &&
      (cell.blockId === BLOCK_REGISTRY.LEAVES ||
        cell.blockId === BLOCK_REGISTRY.BIRCH_LEAVES ||
        cell.blockId === BLOCK_REGISTRY.SPRUCE_LEAVES ||
        cell.blockId === BLOCK_REGISTRY.LEAVES_YELLOW)
    );
  };

  const matchIngredient = (
    cell: { blockId: number; itemId: number; count: number },
    ing: RecipeIngredient
  ): boolean => {
    if (cell.count <= 0) return false;
    switch (ing.kind) {
      case "block":
        return cell.itemId === 0 && cell.blockId === ing.blockId;
      case "item":
        return cell.itemId === ing.itemId;
      case "tag":
        if (ing.tag === "planks") return isPlankCellLocal(cell);
        if (ing.tag === "wood_logs") return isWoodLogCellLocal(cell);
        if (ing.tag === "leaves") return isLeavesCellLocal(cell);
        return false;
      default:
        return false;
    }
  };

  for (const ing of ingredients) {
    let found = false;
    for (const slot of invCopy) {
      if (matchIngredient(slot, ing)) {
        slot.count--;
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }

  return true;
}

function recipeBookCell(
  key: string,
  ingredient: RecipeIngredient | null
): JSX.Element {
  const display = ingredient ? recipeIngredientDisplay(ingredient) : null;
  const inner = display ? (
    <img
      src={display.icon}
      alt=""
      title={display.label}
      className="h-6 w-6"
      style={{ imageRendering: "pixelated" }}
    />
  ) : (
    <div className="h-6 w-6 rounded-sm bg-black/20" aria-hidden />
  );
  return (
    <div
      key={key}
      className="flex h-8 w-8 items-center justify-center border-2 border-[#2a2a2a] bg-[#8d8d8d] shadow-[inset_1px_1px_0_rgba(255,255,255,0.4),inset_-1px_-1px_0_rgba(0,0,0,0.25)]"
    >
      {inner}
    </div>
  );
}

function recipeBookInputGrid(recipe: Recipe): JSX.Element {
  if (recipe.kind === "shaped") {
    return (
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${recipe.width}, 2rem)` }}
      >
        {recipe.pattern.map((ingredient, i) =>
          recipeBookCell(`${recipe.key}-${i}`, ingredient)
        )}
      </div>
    );
  }
  return (
    <div
      className="grid gap-0.5"
      style={{
        gridTemplateColumns: `repeat(${recipe.inputs.length > 4 ? 3 : 2}, 2rem)`
      }}
    >
      {recipe.inputs.map((ingredient, i) =>
        recipeBookCell(`${recipe.key}-${i}`, ingredient)
      )}
    </div>
  );
}

function makePlantSpriteMesh(noa: any, Babylon: any, url: string, name: string) {
  const scene = noa.rendering.getScene();
  const matname = name || "mat";
  const tex = new Babylon.Texture(url, scene, true, true, Babylon.Texture.NEAREST_SAMPLINGMODE);
  tex.hasAlpha = true;
  const mesh = Babylon.MeshBuilder.CreatePlane("sprite-" + matname, { size: 1 }, scene);
  const mat = noa.rendering.makeStandardMaterial(matname);
  mat.backFaceCulling = false;
  mat.diffuseTexture = tex;
  mat.diffuseTexture.vOffset = 0.99;
  mesh.material = mat;
  mesh.rotation.y += 0.81;

  const offset = Babylon.Matrix.Translation(0, 0.5, 0);
  mesh.bakeTransformIntoVertices(offset);
  const clone = mesh.clone();
  clone.rotation.y += 1.62;

  const result = Babylon.Mesh.MergeMeshes([mesh, clone], true);
  
  return result;
}

function makeFlatDropMesh(noa: any, Babylon: any, url: string, name: string) {
  const scene = noa.rendering.getScene();
  const matname = name || "mat";
  const tex = new Babylon.Texture(url, scene, true, true, Babylon.Texture.NEAREST_SAMPLINGMODE);
  tex.hasAlpha = true;
  const mesh = Babylon.MeshBuilder.CreatePlane("flat-drop-" + matname, { size: 0.55 }, scene);
  const mat = noa.rendering.makeStandardMaterial(matname);
  mat.backFaceCulling = false;
  mat.diffuseTexture = tex;
  mesh.material = mat;
  const offset = Babylon.Matrix.Translation(0, 0.275, 0);
  mesh.bakeTransformIntoVertices(offset);
  return mesh;
}

function getUrlForMaterialName(name: string): string | undefined {
  const entry = MC_MATERIAL_ENTRIES.find(m => m.name === name);
  if (!entry) return undefined;
  return MC_TEX[entry.textureKey as keyof typeof MC_TEX];
}

function makeCakeSlabMesh(
  noa: { rendering: { getScene: () => import("@babylonjs/core").Scene; makeStandardMaterial: (n: string) => import("@babylonjs/core").StandardMaterial } },
  Babylon: typeof import("@babylonjs/core"),
  material: { top: string; bottom: string; sides: string; inner?: string },
  name: string,
  widthRatio: number = 1.0
) {
  const scene = noa.rendering.getScene();

  const dynamicTexture = new Babylon.DynamicTexture(
    `${name}-atlas`,
    { width: 16, height: 64 },
    scene,
    false,
    Babylon.Texture.NEAREST_SAMPLINGMODE
  );
  dynamicTexture.hasAlpha = true;

  const ctx = dynamicTexture.getContext();
  ctx.clearRect(0, 0, 16, 64);
  dynamicTexture.update();

  const loadAndDraw = (url: string, yOffset: number) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, yOffset, 16, 16);
      dynamicTexture.update();
    };
    img.src = url;
  };

  const urlTop = getUrlForMaterialName(material.top);
  const urlBottom = getUrlForMaterialName(material.bottom);
  const urlSide = getUrlForMaterialName(material.sides);
  const urlInner = material.inner ? getUrlForMaterialName(material.inner) : "/minecraft-assets/block/cake_inner.png";

  if (urlTop) loadAndDraw(urlTop, 0);
  if (urlBottom) loadAndDraw(urlBottom, 16);
  if (urlSide) loadAndDraw(urlSide, 32);
  if (urlInner) loadAndDraw(urlInner, 48);

  const mat = noa.rendering.makeStandardMaterial(`${name}-mat`);
  mat.diffuseTexture = dynamicTexture;

  const uMin = 0.0625;
  const uMax = 0.9375;
  const uWidth = uMax - uMin;

  const uvInner = new Babylon.Vector4(
    uMin + 0.001,
    0.0 + 0.001,
    uMax - 0.001,
    0.125 - 0.001
  );

  const uvSideFull = new Babylon.Vector4(
    uMin + 0.001,
    0.25 + 0.001,
    uMax - 0.001,
    0.375 - 0.001
  );

  const uvSideCropped = new Babylon.Vector4(
    uMin + 0.001,
    0.25 + 0.001,
    uMin + uWidth * widthRatio - 0.001,
    0.375 - 0.001
  );

  const uvBottom = new Babylon.Vector4(
    uMin + 0.001,
    0.515625 + 0.001,
    uMin + uWidth * widthRatio - 0.001,
    0.734375 - 0.001
  );

  const uvTop = new Babylon.Vector4(
    uMin + 0.001,
    0.765625 + 0.001,
    uMin + uWidth * widthRatio - 0.001,
    0.984375 - 0.001
  );

  const faceUV = new Array(6);
  if (widthRatio < 1.0) {
    faceUV[0] = uvSideCropped; // Front (Z-)
    faceUV[1] = uvSideCropped; // Back (Z+)
    faceUV[2] = uvInner;       // Right (X+)
    faceUV[3] = uvSideFull;    // Left (X-)
  } else {
    faceUV[0] = uvSideFull;
    faceUV[1] = uvSideFull;
    faceUV[2] = uvSideFull;
    faceUV[3] = uvSideFull;
  }
  faceUV[4] = uvTop;      // Top (Y+)
  faceUV[5] = uvBottom;   // Bottom (Y-)

  const mesh = Babylon.MeshBuilder.CreateBox(
    name,
    { width: widthRatio, height: 0.5, depth: 1, faceUV, wrap: true },
    scene
  );

  mesh.material = mat;

  const xOffset = -0.5 + widthRatio / 2;
  const offset = Babylon.Matrix.Translation(xOffset, 0.25, 0);
  mesh.bakeTransformIntoVertices(offset);

  return mesh;
}

export interface MinecraftClientProps {
  seed: number;
  initialDeltas: [number, number, number, number][];
  mySpawn: Vec3;
  paused: boolean;
  roster: RoomPlayerInfo[];
  myUserId: string | null;
  gameMode: GameMode;
  /** Survival: server-confirmed stacks. Creative: ignored for placing (still passed for typing). */
  inventorySlots: HotbarSlot[];
  /** Survival: main item storage (27). Creative: may be empty. */
  itemInventorySlots: ItemSlot[];
  /** Survival: equipment slots [head, chest, legs, feet]. */
  equipmentSlots: ItemSlot[];
  /** Survival: 3x3 backing grid from server; normal inventory exposes top-left 2x2. */
  craftingGridSlots: CraftingGridSlot[];
  /** Survival: 2 personal grid, 3 crafting-table grid. */
  craftingGridWidth: CraftingGridWidth;
  /** Survival: authoritative health/hunger state. */
  vitals: PlayerVitals;
  onInventoryMove: (req: InventoryMoveReq) => void;
  onCraft: (recipeId: string) => void;
  onOpenCraftingTable: (pos: Vec3) => Promise<SimpleAck>;
  onCloseCraftingTable: () => Promise<SimpleAck>;
  activeChest: { pos: Vec3; slots: ChestSlot[] } | null;
  onOpenChest: (pos: Vec3) => Promise<OpenChestAck>;
  onCloseChest: () => Promise<SimpleAck>;
  onChestMove: (req: InventoryMoveReq) => void;
  onEatStart: (hotbarIndex: number) => Promise<EatStartAck>;
  onEatFinish: (hotbarIndex: number) => Promise<SimpleAck>;
  onEatCancel: () => Promise<SimpleAck>;
  onEatCakeSlice: (pos: Vec3) => Promise<SimpleAck>;
  onInput: (input: InputReq) => void;
  onBlockPlace: (pos: Vec3, blockId: number) => void;
  onBlockBreak: (pos: Vec3) => void;
  /** Survival timed mining (hold LMB). */
  onBreakStart: (pos: Vec3) => Promise<BreakStartAck>;
  onBreakFinish: (pos: Vec3) => Promise<SimpleAck>;
  onBreakCancel: (pos: Vec3) => void;
  onArmSwing: () => void;
  onFallImpact: (velocityY: number) => Promise<SimpleAck>;
  onPlayerAttack: (targetUserId: string) => Promise<SimpleAck>;
  onIgniteTnt: (pos: Vec3) => Promise<SimpleAck>;
  /** Survival: server validates and spawns a world drop. */
  onDropHotbarSlot?: (hotbarIndex: number) => void;
  registerSnapshotListener: (cb: (snap: RoomSnapshot) => void) => () => void;
  registerBlockDeltaListener: (cb: (delta: BlockDelta) => void) => () => void;
  registerRoomEventListener: (cb: (ev: RoomEvent) => void) => () => void;
  registerArmSwingListener: (cb: (payload: { userId: string }) => void) => () => void;
  registerPlayerDamageListener: (cb: (payload: PlayerDamagePayload) => void) => () => void;
  /** World stacks present on join (survival). */
  initialWorldDrops: WorldDrop[];
  registerWorldDropSpawned: (cb: (drop: WorldDrop) => void) => () => void;
  registerWorldDropRemoved: (cb: (id: string) => void) => () => void;
  /** ~5 Hz server WORLD_DROP_UPDATE for survival stack motion. */
  registerWorldDropUpdated: (
    cb: (updates: WorldDropWireDelta[]) => void
  ) => () => void;
  onSendChatMessage: (message: string) => Promise<SimpleAck>;
  onChatExpandedChange?: (expanded: boolean) => void;
  isTeacher?: boolean;
  onSwitchTeacherMode?: (observer: boolean) => Promise<SimpleAck>;
  onSoftDeleteChatMessage?: (messageId: string) => Promise<void>;
  onClearSessionChat?: () => Promise<void>;
  chatLines?: ChatLineRow[];
  canSendChat?: boolean;
  iAmHost: boolean;
  sessionId: string;
  onMuteAll: (cb: (payload: { mutedBy: string }) => void) => () => void;
  muteAll: () => void;
  onFPSReport?: (phase: "loading" | "runtime", avgFps: number, sampleCount: number) => void;
}

export function MinecraftClient(props: MinecraftClientProps): JSX.Element {
  const {
    seed,
    initialDeltas,
    mySpawn,
    paused,
    roster,
    myUserId,
    gameMode,
    inventorySlots,
    itemInventorySlots,
    equipmentSlots,
    craftingGridSlots,
    craftingGridWidth,
    vitals,
    onInventoryMove,
    onCraft,
    onOpenCraftingTable,
    onCloseCraftingTable,
    activeChest,
    onOpenChest,
    onCloseChest,
    onChestMove,
    onEatStart,
    onEatFinish,
    onEatCancel,
    onEatCakeSlice,
    onInput,
    onBlockPlace,
    onBlockBreak,
    onBreakStart,
    onBreakFinish,
    onBreakCancel,
    onArmSwing,
    onFallImpact,
    onPlayerAttack,
    onIgniteTnt,
    onDropHotbarSlot,
    registerSnapshotListener,
    registerBlockDeltaListener,
    registerRoomEventListener,
    registerArmSwingListener,
    registerPlayerDamageListener,
    initialWorldDrops,
    registerWorldDropSpawned,
    registerWorldDropRemoved,
    registerWorldDropUpdated,
    chatLines = [],
    canSendChat,
    onSendChatMessage,
    onChatExpandedChange,
    isTeacher = false,
    onSwitchTeacherMode,
    onSoftDeleteChatMessage,
    onClearSessionChat,
    sessionId,
    onMuteAll,
    muteAll,
    iAmHost,
    onFPSReport
  } = props;

  const [survivalSlot, setSurvivalSlot] = useState(0);
  const [isTeacherSpectator, setIsTeacherSpectator] = useState(isTeacher);
  const isTeacherSpectatorRef = useRef(isTeacher);
  useEffect(() => {
    setIsTeacherSpectator(isTeacher);
    isTeacherSpectatorRef.current = isTeacher;
  }, [isTeacher]);
  useEffect(() => {
    isTeacherSpectatorRef.current = isTeacherSpectator;
  }, [isTeacherSpectator]);
  const [playersList, setPlayersList] = useState<Array<{ userId: string; displayName: string; pos: [number, number, number] }>>([]);
  const [creativeSlotIdx, setCreativeSlotIdx] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<SurvivalHelpTabId>("controls");
  const [helpPulse, setHelpPulse] = useState(true);
  const helpOpenRef = useRef(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [recipeBookOpen, setRecipeBookOpen] = useState(false);
  const [recipeTab, setRecipeTab] = useState<"all" | "tools" | "building" | "food_misc">("all");
  const [localVitals, setLocalVitals] = useState<PlayerVitals>(vitals);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceWidgetExpanded, setVoiceWidgetExpanded] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [typedMessage, setTypedMessage] = useState("");
  const [chatPosition, setChatPosition] = useState<{ x: number; y: number }>(() => {
    return { x: 16, y: typeof window !== "undefined" ? window.innerHeight - 340 : 400 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; chatX: number; chatY: number }>({
    mouseX: 0,
    mouseY: 0,
    chatX: 0,
    chatY: 0,
  });
  const [damageFlash, setDamageFlash] = useState(0);
  const [blastFlash, setBlastFlash] = useState(0);
  const [weatherKind, setWeatherKind] = useState<PrecipitationKind>("clear");
  const [debugInfo, setDebugInfo] = useState<{ fps: number; pos: Vec3 } | null>(null);
  const [isDead, setIsDead] = useState(false);
  const showDebugRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // noa-engine has loose .d.ts typings; lock to any so we don't fight them.
  const noaRef = useRef<unknown>(null);
  const onInputRef = useRef(onInput);
  const onPlaceRef = useRef(onBlockPlace);
  const onBreakRef = useRef(onBlockBreak);
  const onBreakStartRef = useRef(onBreakStart);
  const onBreakFinishRef = useRef(onBreakFinish);
  const onBreakCancelRef = useRef(onBreakCancel);
  const onArmSwingRef = useRef(onArmSwing);
  const onFallImpactRef = useRef(onFallImpact);
  const onPlayerAttackRef = useRef(onPlayerAttack);
  const onIgniteTntRef = useRef(onIgniteTnt);
  const onEatStartRef = useRef(onEatStart);
  const onEatFinishRef = useRef(onEatFinish);
  const onEatCancelRef = useRef(onEatCancel);
  const onEatCakeSliceRef = useRef(onEatCakeSlice);
  const activeMiningRef = useRef<{
    pos: Vec3;
    durationMs: number | null;
    startedAt: number | null;
  } | null>(null);
  const activeEatingRef = useRef<{
    hotbarIndex: number;
    timer: number | null;
  } | null>(null);
  const miningAnimRef = useRef<number | null>(null);
  const breakCrackRef = useRef<BreakCrackOverlay | null>(null);
  const heldItemViewRef = useRef<FirstPersonHeldItemView | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const lastBreakStartAtRef = useRef(0);
  const lastBreakFinishAtRef = useRef(0);
  const breakFinishSentRef = useRef(false);
  const BREAK_START_MIN_MS = 100;
  const BREAK_FINISH_MIN_MS = 100;
  const onFPSReportRef = useRef(onFPSReport);
  useEffect(() => {
    onFPSReportRef.current = onFPSReport;
  }, [onFPSReport]);

  const loadedColumnsRef = useRef<Set<string>>(new Set());
  const loadingCompleteRef = useRef<boolean>(false);
  const loadingFpsBufRef = useRef<number[]>([]);
  const runtimeFpsBufRef = useRef<number[]>([]);
  const lastFpsSampleAtRef = useRef<number>(0);
  const lastFpsFlushAtRef = useRef<number>(0);

  const pausedRef = useRef(paused);
  const isDeadRef = useRef(isDead);
  const gameModeRef = useRef<GameMode>(gameMode);
  const inventoryOpenRef = useRef(inventoryOpen);
  const chatOpenRef = useRef(chatOpen);
  const craftingGridWidthRef = useRef<CraftingGridWidth>(craftingGridWidth);
  const activeChestRef = useRef(activeChest);
  const equipmentSlotsRef = useRef<ItemSlot[]>(equipmentSlots);
  const localVitalsRef = useRef<PlayerVitals>(localVitals);
  const inventoryRef = useRef<HotbarSlot[]>(inventorySlots);
  const remoteEntitiesRef = useRef(new Map<string, number>());
  const selectedBlockRef = useRef<number>(BLOCK_REGISTRY.GRASS);
  const survivalSlotRef = useRef(0);
  const myUserIdRef = useRef<string | null>(myUserId);
  const registerSnapshotListenerRef = useRef(registerSnapshotListener);
  const registerBlockDeltaListenerRef = useRef(registerBlockDeltaListener);
  const registerRoomEventListenerRef = useRef(registerRoomEventListener);
  const registerArmSwingListenerRef = useRef(registerArmSwingListener);
  const registerPlayerDamageListenerRef = useRef(registerPlayerDamageListener);
  const registerWorldDropSpawnedRef = useRef(registerWorldDropSpawned);
  const registerWorldDropRemovedRef = useRef(registerWorldDropRemoved);
  const registerWorldDropUpdatedRef = useRef(registerWorldDropUpdated);
  const onDropHotbarSlotRef = useRef(onDropHotbarSlot);
  const onOpenCraftingTableRef = useRef(onOpenCraftingTable);
  const onCloseCraftingTableRef = useRef(onCloseCraftingTable);
  const onOpenChestRef = useRef(onOpenChest);
  const onCloseChestRef = useRef(onCloseChest);

  const {
    activeRoom,
    micEnabled,
    toggleMute,
    audioRigsRef,
    getAudioContext,
    activeSpeakers,
    mutedByHostReason,
    audioDevices,
    selectedDevice,
    changeAudioOutput
  } = useLiveKitProximity({
    sessionId,
    noaRef: noaRef as any,
    remoteEntities: remoteEntitiesRef,
    onMuteAll
  });

  onInputRef.current = onInput;
  onPlaceRef.current = onBlockPlace;
  onBreakRef.current = onBlockBreak;
  onBreakStartRef.current = onBreakStart;
  onBreakFinishRef.current = onBreakFinish;
  onBreakCancelRef.current = onBreakCancel;
  onArmSwingRef.current = onArmSwing;
  onFallImpactRef.current = onFallImpact;
  onPlayerAttackRef.current = onPlayerAttack;
  onIgniteTntRef.current = onIgniteTnt;
  onEatStartRef.current = onEatStart;
  onEatFinishRef.current = onEatFinish;
  onEatCancelRef.current = onEatCancel;
  onEatCakeSliceRef.current = onEatCakeSlice;
  pausedRef.current = paused;
  isDeadRef.current = isDead;
  gameModeRef.current = gameMode;
  inventoryOpenRef.current = inventoryOpen;
  helpOpenRef.current = helpOpen;
  chatOpenRef.current = chatOpen;
  craftingGridWidthRef.current = craftingGridWidth;
  activeChestRef.current = activeChest;
  equipmentSlotsRef.current = equipmentSlots;
  localVitalsRef.current = localVitals;
  inventoryRef.current = inventorySlots;
  survivalSlotRef.current = survivalSlot;
  myUserIdRef.current = myUserId;
  registerSnapshotListenerRef.current = registerSnapshotListener;
  registerBlockDeltaListenerRef.current = registerBlockDeltaListener;
  registerRoomEventListenerRef.current = registerRoomEventListener;
  registerArmSwingListenerRef.current = registerArmSwingListener;
  registerPlayerDamageListenerRef.current = registerPlayerDamageListener;
  registerWorldDropSpawnedRef.current = registerWorldDropSpawned;
  registerWorldDropRemovedRef.current = registerWorldDropRemoved;
  registerWorldDropUpdatedRef.current = registerWorldDropUpdated;
  onDropHotbarSlotRef.current = onDropHotbarSlot;
  onOpenCraftingTableRef.current = onOpenCraftingTable;
  onCloseCraftingTableRef.current = onCloseCraftingTable;
  onOpenChestRef.current = onOpenChest;
  onCloseChestRef.current = onCloseChest;

  const selectCreativeBlock = (blockId: number): void => {
    if (!PLACEABLE_BLOCK_IDS.includes(blockId)) return;
    selectedBlockRef.current = blockId;
    const idx = visibleCreativeHotbarBlocks(blockId).indexOf(blockId);
    if (idx >= 0) setCreativeSlotIdx(idx);
  };

  useEffect(() => {
    if (!inventoryOpen) setRecipeBookOpen(false);
  }, [inventoryOpen]);

  useEffect(() => {
    setLocalVitals(vitals);
  }, [vitals]);

  function closeInventory(): void {
    if (craftingGridWidthRef.current === 3) {
      void onCloseCraftingTableRef.current();
    }
    if (activeChestRef.current) {
      void onCloseChestRef.current();
    }
    setInventoryOpen(false);
  }

  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleCloseChat = () => {
    setChatOpen(false);
    onChatExpandedChange?.(false);
    const noa: any = noaRef.current;
    if (noa) {
      noa.inputs.disabled = false;
      setTimeout(() => {
        noa.container.element?.requestPointerLock?.();
      }, 50);
    }
  };

  const handleSendMessage = async () => {
    const text = typedMessage.trim();
    if (!text) return;
    setTypedMessage("");
    if (onSendChatMessage) {
      const res = await onSendChatMessage(text);
      if (!res.ok) {
        console.warn("failed to send chat message:", res.error);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.code === "Escape") {
      e.preventDefault();
      handleCloseChat();
    } else if (e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 50);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatLines, chatOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (chatOpen && e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCloseChat();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [chatOpen]);

  useEffect(() => {
    if (helpPulse) {
      const timer = setTimeout(() => {
        setHelpPulse(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [helpPulse]);

  useEffect(() => {
    const handleHelpGlobalKeyDown = (e: KeyboardEvent) => {
      if (helpOpen && e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setHelpOpen(false);
        const noa: any = noaRef.current;
        if (noa) {
          noa.inputs.disabled = false;
          setTimeout(() => {
            noa.container.element?.requestPointerLock?.();
          }, 50);
        }
      }
    };
    window.addEventListener("keydown", handleHelpGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleHelpGlobalKeyDown, true);
  }, [helpOpen]);

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag with left click
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      chatX: chatPosition.x,
      chatY: chatPosition.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      let newX = dragStartRef.current.chatX + deltaX;
      let newY = dragStartRef.current.chatY + deltaY;

      // Keep it within viewport bounds
      newX = Math.max(0, Math.min(window.innerWidth - 320, newX));
      newY = Math.max(0, Math.min(window.innerHeight - 100, newY));

      setChatPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (chatOpen) {
      setChatPosition((prev) => {
        const defaultY = window.innerHeight - 340;
        const safeX = Math.max(16, Math.min(window.innerWidth - 384, prev.x));
        const safeY = Math.max(16, Math.min(window.innerHeight - 300, prev.y === 0 ? defaultY : prev.y));
        return { x: safeX, y: safeY };
      });
    }
  }, [chatOpen]);

  useEffect(() => {
    if (gameMode !== "creative") return;
    const idx = visibleCreativeHotbarBlocks(selectedBlockRef.current).indexOf(
      selectedBlockRef.current
    );
    if (idx >= 0) setCreativeSlotIdx(idx);
  }, [gameMode]);

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;
    const cleanupFns: Array<() => void> = [];

    void (async () => {
      const { Engine } = await import("noa-engine");
      const Babylon = await import("@babylonjs/core");
      if (cancelled || !hostRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noa: any = new Engine({
        debug: false,
        silent: true,
        /** Space is jump; without this, Space can "click" a focused HTML button (e.g. pause). */
        preventDefaults: true,
        playerStart: mySpawn,
        playerHeight: 1.8,
        playerWidth: 0.6,
        blockTestDistance: 8,
        domElement: hostRef.current,
        chunkSize: 16,
        chunkAddDistance: [10, 8],
        chunkRemoveDistance: [12, 10]
      } as Record<string, unknown>);
      
      // noa's built-in ObjectMesher uses global thin instances with manual rebase math;
      // plants jump on origin rebase. Per-chunk thin instances were tried (Phase 3) but
      // also jumped and were slower than SPS. Keep SPS until a rebase-safe path is proven.
      overrideObjectMesher(noa);

      const pool = new WorldgenWorkerPool();
      cleanupFns.push(() => pool.dispose());
      
      // Unbind default KeyE from alt-fire (right-click) so pressing E to open inventory doesn't place blocks
      noa.inputs.unbind("alt-fire");
      noa.inputs.bind("alt-fire", "Mouse3");
      
      // Bind sprint keys (Shift and Control)
      noa.inputs.bind("sprint", "ShiftLeft");
      noa.inputs.bind("sprint", "ShiftRight");
      noa.inputs.bind("sprint", "ControlLeft");
      noa.inputs.bind("sprint", "ControlRight");
      
      noaRef.current = noa;
      noa?.setPaused?.(pausedRef.current);

      // Override highlightBlockFace to handle half-height blocks like CAKE
      if (noa && noa.rendering && noa.rendering.highlightBlockFace) {
        const originalHighlight = noa.rendering.highlightBlockFace;
        noa.rendering.highlightBlockFace = function (show: boolean, posArr: number[], normArr: number[]) {
          if (show && posArr && normArr) {
            const [bx, by, bz] = posArr;
            const blockId = noa.getBlock(bx, by, bz);
            const isCake =
              blockId === BLOCK_REGISTRY.CAKE ||
              blockId === BLOCK_REGISTRY.CAKE_5 ||
              blockId === BLOCK_REGISTRY.CAKE_4 ||
              blockId === BLOCK_REGISTRY.CAKE_3 ||
              blockId === BLOCK_REGISTRY.CAKE_2 ||
              blockId === BLOCK_REGISTRY.CAKE_1;
            if (isCake) {
              let ratio = 1.0;
              if (blockId === BLOCK_REGISTRY.CAKE_5) ratio = 5 / 6;
              else if (blockId === BLOCK_REGISTRY.CAKE_4) ratio = 4 / 6;
              else if (blockId === BLOCK_REGISTRY.CAKE_3) ratio = 0.5;
              else if (blockId === BLOCK_REGISTRY.CAKE_2) ratio = 2 / 6;
              else if (blockId === BLOCK_REGISTRY.CAKE_1) ratio = 1 / 6;

              originalHighlight.call(noa.rendering, show, posArr, normArr);
              const m = noa.rendering._highlightMesh;
              if (m) {
                const isTop = normArr[1] === 1;
                const isSide = normArr[1] === 0;
                const isXFace = normArr[0] !== 0;

                m.position.x += (ratio - 1) / 2;

                if (isTop) {
                  m.position.y -= 0.5;
                  m.scaling.set(ratio, 1, 1);
                } else if (isSide) {
                  m.position.y -= 0.25;
                  if (isXFace) {
                    m.scaling.set(1, 0.5, 1);
                  } else {
                    m.scaling.set(ratio, 0.5, 1);
                  }
                } else {
                  m.scaling.set(ratio, 1, 1);
                }
              }
              return;
            }
          }
          originalHighlight.call(noa.rendering, show, posArr, normArr);
          const m = noa.rendering._highlightMesh;
          if (m) {
            m.scaling.set(1, 1, 1);
          }
        };
      }

      const gameEl = noa.container.element as HTMLElement;
      const focusGame = (): void => {
        hostRef.current?.focus({ preventScroll: true });
      };
      gameEl.addEventListener("pointerdown", focusGame);
      cleanupFns.push(() => gameEl.removeEventListener("pointerdown", focusGame));

      const audio = new AudioManager();
      audioManagerRef.current = audio;
      audio.setMuted(pausedRef.current);
      const primeAudio = (): void => {
        audio.prime();
        window.removeEventListener("pointerdown", primeAudio);
      };
      window.addEventListener("pointerdown", primeAudio);
      cleanupFns.push(() => window.removeEventListener("pointerdown", primeAudio));
      cleanupFns.push(() => {
        audio.dispose();
        audioManagerRef.current = null;
      });

      const deltas = new Map<string, number>();
      const chunkDeltas = new Map<string, Map<string, number>>();

      const setDelta = (x: number, y: number, z: number, id: number) => {
        const key = `${x},${y},${z}`;
        deltas.set(key, id);

        const cx = Math.floor(x / 16);
        const cy = Math.floor(y / 16);
        const cz = Math.floor(z / 16);
        const chunkKey = `${cx},${cy},${cz}`;
        let chunkMap = chunkDeltas.get(chunkKey);
        if (!chunkMap) {
          chunkMap = new Map<string, number>();
          chunkDeltas.set(chunkKey, chunkMap);
        }
        chunkMap.set(key, id);
      };

      for (const [x, y, z, id] of initialDeltas) {
        setDelta(x, y, z, id);
      }

      const scene = noa.rendering.getScene();

      // Configure linear distance fog to blend loading chunks into the sky/background
      scene.fogMode = Babylon.Scene.FOGMODE_LINEAR;
      scene.fogStart = 110;
      scene.fogEnd = 150;
      const skyBlue = new Babylon.Color3(0.6, 0.8, 1.0);
      scene.fogColor = skyBlue;
      scene.clearColor = new Babylon.Color4(0.6, 0.8, 1.0, 1.0);

      const defaultAmbient = scene.ambientColor?.clone?.() ?? new Babylon.Color3(0, 0, 0);
      const fullBrightAmbient = new Babylon.Color3(1, 1, 1);
      const torchLights = new Map<string, { dispose: () => void }>();
      const heldItemView = scene.activeCamera
        ? new FirstPersonHeldItemView({
            scene,
            camera: scene.activeCamera,
            addMeshToScene: (mesh) => noa.rendering.addMeshToScene(mesh, false)
          })
        : null;
      heldItemViewRef.current = heldItemView;
      cleanupFns.push(() => {
        heldItemView?.dispose();
        heldItemViewRef.current = null;
      });
      const breakCrack = createBreakCrackOverlay(Babylon, scene, noa);
      breakCrackRef.current = breakCrack;
      cleanupFns.push(() => {
        breakCrack.dispose();
        breakCrackRef.current = null;
      });
      cleanupFns.push(() => {
        for (const light of torchLights.values()) light.dispose();
        torchLights.clear();
      });
      registerMcTerrainMaterials(noa, Babylon);

      function blockCoordKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
      }

      function setTorchLightAt(x: number, y: number, z: number, blockId: number): void {
        const key = blockCoordKey(x, y, z);
        const existing = torchLights.get(key);
        if (existing) {
          existing.dispose();
          torchLights.delete(key);
        }
        if (blockId !== BLOCK_REGISTRY.TORCH) return;
        const light = new Babylon.PointLight(
          `torch-light-${key}`,
          new Babylon.Vector3(x + 0.5, y + 0.72, z + 0.5),
          scene
        );
        light.diffuse = new Babylon.Color3(1, 0.66, 0.3);
        light.range = 10;
        light.intensity = 1.15;
        torchLights.set(key, light);
      }

      for (const [x, y, z, id] of initialDeltas) {
        if (id === BLOCK_REGISTRY.TORCH) setTorchLightAt(x, y, z, id);
      }

      for (const e of NOA_BLOCK_ENTRIES) {
        if (e.shape === "cube") {
          noa.registry.registerBlock(e.id, noaCubeBlockOptions(e));
        } else if (e.shape === "plantSprite") {
          noa.registry.registerBlock(e.id, {
            blockMesh: makePlantSpriteMesh(
              noa,
              Babylon,
              MC_TEX[e.textureKey],
              e.materialName
            ),
            solid: false,
            opaque: false
          });
        } else {
          let ratio = 1.0;
          if (e.id === BLOCK_REGISTRY.CAKE_5) ratio = 5 / 6;
          else if (e.id === BLOCK_REGISTRY.CAKE_4) ratio = 4 / 6;
          else if (e.id === BLOCK_REGISTRY.CAKE_3) ratio = 0.5;
          else if (e.id === BLOCK_REGISTRY.CAKE_2) ratio = 2 / 6;
          else if (e.id === BLOCK_REGISTRY.CAKE_1) ratio = 1 / 6;

          noa.registry.registerBlock(e.id, {
            blockMesh: makeCakeSlabMesh(noa, Babylon, e.material, `cake-${e.id}`, ratio),
            solid: true,
            opaque: false
          });
        }
      }

      noa.blockTargetIdCheck = (id: number): boolean =>
        id !== BLOCK_REGISTRY.WATER && !blockReplaceable(id);

      noa.world.on(
        "worldDataNeeded",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chunkId: any, data: any, x0: number, y0: number, z0: number) => {
          const [sx, sy, sz] = data.shape;

          // Sync threshold: find player's current chunk columns to generate nearby chunks synchronously
          const pPos = noa.entities.getPosition(noa.playerEntity) as number[];
          const playerChunkX = Math.floor((pPos ? pPos[0] : 0) / 16);
          const playerChunkZ = Math.floor((pPos ? pPos[2] : 0) / 16);
          const chunkX = Math.floor(x0 / 16);
          const chunkZ = Math.floor(z0 / 16);

          // If the chunk is part of the 3x3 surrounding the player, generate synchronously to prevent gaps or falling through
          if (Math.abs(chunkX - playerChunkX) <= 1 && Math.abs(chunkZ - playerChunkZ) <= 1) {
            const cx = Math.floor(x0 / 16);
            const cy = Math.floor(y0 / 16);
            const cz = Math.floor(z0 / 16);
            const chunkKey = `${cx},${cy},${cz}`;
            const chunkMap = chunkDeltas.get(chunkKey);

            for (let i = 0; i < sx; i++) {
              for (let j = 0; j < sy; j++) {
                for (let k = 0; k < sz; k++) {
                  const x = x0 + i;
                  const y = y0 + j;
                  const z = z0 + k;
                  const override = chunkMap?.get(`${x},${y},${z}`);
                  const blockId = override !== undefined ? override : proceduralVoxelID(x, y, z, seed);
                  data.set(i, j, k, blockId);
                }
              }
            }
            noa.world.setChunkData(chunkId, data);
            if (!loadingCompleteRef.current) {
              loadedColumnsRef.current.add(`${chunkX},${chunkZ}`);
              if (loadedColumnsRef.current.size >= 9) {
                loadingCompleteRef.current = true;
              }
            }
            return;
          }

          // Otherwise, offload asynchronous chunk generation to background worker pool
          pool.requestChunk({
            chunkId,
            data,
            x0,
            y0,
            z0,
            seed,
            sx,
            sy,
            sz,
            onComplete: (voxels: Uint16Array) => {
              const cx = Math.floor(x0 / 16);
              const cy = Math.floor(y0 / 16);
              const cz = Math.floor(z0 / 16);
              const chunkKey = `${cx},${cy},${cz}`;
              const chunkMap = chunkDeltas.get(chunkKey);

              let idx = 0;
              if (chunkMap && chunkMap.size > 0) {
                for (let i = 0; i < sx; i++) {
                  for (let j = 0; j < sy; j++) {
                    for (let k = 0; k < sz; k++) {
                      const x = x0 + i;
                      const y = y0 + j;
                      const z = z0 + k;
                      const override = chunkMap.get(`${x},${y},${z}`);
                      const blockId = override !== undefined ? override : voxels[idx];
                      data.set(i, j, k, blockId);
                      idx++;
                    }
                  }
                }
              } else {
                for (let i = 0; i < sx; i++) {
                  for (let j = 0; j < sy; j++) {
                    for (let k = 0; k < sz; k++) {
                      data.set(i, j, k, voxels[idx++]);
                    }
                  }
                }
              }
              noa.world.setChunkData(chunkId, data);
            }
          });
        }
      );

      noa.world.on("chunkBeingRemoved", (chunkId: any) => {
        pool.cancelChunk(chunkId);
      });

      const remoteMaterial = new Babylon.StandardMaterial("mat_remote", scene);
      remoteMaterial.diffuseColor = new Babylon.Color3(1, 0.8, 0.2);
      const sourceMesh = Babylon.MeshBuilder.CreateBox(
        "remote-player",
        { height: 1.8, width: 0.6, depth: 0.6 },
        scene
      );
      sourceMesh.material = remoteMaterial;
      sourceMesh.setEnabled(false);
      noa.rendering.addMeshToScene(sourceMesh, true);

      const voxelCat = VOXEL_ENTITY_CATALOG.player;
      let voxelAvatarsEnabled = false;
      try {
        await preloadVoxelTemplate(scene, voxelCat.modelId, voxelCat.modelUrl);
        voxelAvatarsEnabled = true;
      } catch (err) {
        console.warn("voxel avatars: fallback to boxes", err);
      }

      /** Local third-person body mesh (noa `mesh` component); null if voxel load failed. */
      let localPlayerVoxelRoot: Mesh | null = null;
      let localRig: AvatarRig | null = null;
      if (!cancelled && voxelAvatarsEnabled) {
        try {
          const localRoot = cloneVoxelTemplate(voxelCat.modelId, "local-player-voxel");
          applyTextureToVoxelRoot(scene, localRoot, voxelCat.textureUrl);
          attachVoxelVisualToPlayer(noa, noa.playerEntity, localRoot, {
            meshOffset: voxelCat.meshOffset
          });
          const md = noa.entities.getMeshData(noa.playerEntity);
          localPlayerVoxelRoot = md?.mesh ?? null;
          if (localPlayerVoxelRoot) {
            setVisualVisible(localPlayerVoxelRoot, noa.camera.zoomDistance > 0 && !isTeacherSpectatorRef.current);
            localRig = createAvatarRig(localPlayerVoxelRoot);
            setAvatarYaw(localRig, noa.camera.heading);
          }
        } catch (err) {
          console.warn("voxel avatars: local body failed", err);
          localPlayerVoxelRoot = null;
          localRig = null;
        }
      }

      /** Per-remote-entity animation rigs, keyed by userId — parallel to remoteEntitiesRef. */
      const remoteRigs = new Map<string, AvatarRig>();

      const offArmSwing = registerArmSwingListenerRef.current(({ userId }) => {
        const rig = remoteRigs.get(userId);
        if (rig) triggerAvatarSwing(rig);
      });
      cleanupFns.push(offArmSwing);

      let damageFlashTimer: number | null = null;
      const offPlayerDamage = registerPlayerDamageListenerRef.current((payload) => {
        if (payload.userId !== myUserIdRef.current) return;
        setLocalVitals((prev) => ({ ...prev, health: payload.health }));
        if (payload.impulse) {
          const phys = noa.entities.getPhysics(noa.playerEntity);
          const velocity = phys?.body?.velocity;
          if (velocity) {
            velocity[0] = Number(velocity[0] ?? 0) + payload.impulse[0] * 0.08;
            velocity[1] = Math.max(
              Number(velocity[1] ?? 0),
              payload.impulse[1] * 0.08
            );
            velocity[2] = Number(velocity[2] ?? 0) + payload.impulse[2] * 0.08;
          }
        }
        audio.playHurt();
        setDamageFlash(1);
        if (damageFlashTimer !== null) window.clearTimeout(damageFlashTimer);
        damageFlashTimer = window.setTimeout(() => {
          setDamageFlash(0);
          damageFlashTimer = null;
        }, 180);
      });
      cleanupFns.push(offPlayerDamage);
      cleanupFns.push(() => {
        if (damageFlashTimer !== null) window.clearTimeout(damageFlashTimer);
      });

      function currentHeldItemSpec() {
        return resolveHeldItemSpec({
          gameMode: gameModeRef.current,
          selectedBlockId: selectedBlockRef.current,
          survivalSlotIndex: survivalSlotRef.current,
          survivalSlots: inventoryRef.current,
          blockIconById: BLOCK_HOTBAR_ICON,
          itemIconById: ITEM_ICON,
          flatBlockIds: FLAT_HELD_BLOCK_IDS,
          airBlockId: BLOCK_REGISTRY.AIR
        });
      }

      function triggerLocalArmSwing(): void {
        onArmSwingRef.current();
        audio.playSwing();
        if (localRig) triggerAvatarSwing(localRig);
        heldItemView?.triggerSwing();
      }

      function findAttackTarget(): { userId: string; distance: number } | null {
        const eye = noa.camera.getTargetPosition() as number[];
        const dir = noa.camera.getDirection() as number[];
        let best: { userId: string; distance: number } | null = null;
        for (const [userId, eid] of remoteEntitiesRef.current) {
          const p = noa.entities.getPosition(eid) as number[];
          const cx = p[0] - eye[0];
          const cy = p[1] + 0.9 - eye[1];
          const cz = p[2] - eye[2];
          const along = cx * dir[0] + cy * dir[1] + cz * dir[2];
          if (along < 0 || along > 3.5) continue;
          const px = eye[0] + dir[0] * along;
          const py = eye[1] + dir[1] * along;
          const pz = eye[2] + dir[2] * along;
          const sideDx = p[0] - px;
          const sideDy = p[1] + 0.9 - py;
          const sideDz = p[2] - pz;
          const sideDistSq = sideDx * sideDx + sideDy * sideDy + sideDz * sideDz;
          if (sideDistSq > 0.55 * 0.55) continue;
          if (!best || along < best.distance) best = { userId, distance: along };
        }
        return best;
      }

      function ensureRemoteEntity(userId: string): number {
        const existing = remoteEntitiesRef.current.get(userId);
        if (existing !== undefined) return existing;
        const mesh = sourceMesh.createInstance(`remote-${userId}`);
        const id: number = noa.entities.add(
          [mySpawn[0], mySpawn[1], mySpawn[2]],
          voxelCat.width,
          voxelCat.height,
          mesh,
          voxelCat.meshOffset,
          false,
          false
        );
        if (voxelAvatarsEnabled) {
          try {
            const visual = cloneVoxelTemplate(voxelCat.modelId, `remote-vox-${userId}`);
            applyTextureToVoxelRoot(scene, visual, voxelCat.textureUrl);
            attachVoxelVisualToEntity(noa, id, visual, { meshOffset: voxelCat.meshOffset });
            const md = noa.entities.getMeshData(id);
            if (md?.mesh) remoteRigs.set(userId, createAvatarRig(md.mesh as Mesh));
          } catch {
            // keep placeholder box mesh from add()
          }
        }
        remoteEntitiesRef.current.set(userId, id);
        return id;
      }

      const offSnapshot = registerSnapshotListenerRef.current((snap) => {
        const selfId = myUserIdRef.current;
        const currentPlayers: Array<{ userId: string; displayName: string; pos: [number, number, number] }> = [];
        
        for (const [userId, p] of Object.entries(snap.players)) {
          if (userId === selfId) {
            if (p.vitals) setLocalVitals(p.vitals);
            if (isTeacher && p.isTeacherObserver !== undefined && p.isTeacherObserver !== isTeacherSpectatorRef.current) {
              setIsTeacherSpectator(p.isTeacherObserver);
            }
            continue;
          }
          
          if (p.isTeacherObserver) {
            const existingEid = remoteEntitiesRef.current.get(userId);
            if (existingEid !== undefined) {
              noa.entities.deleteEntity(existingEid);
              remoteEntitiesRef.current.delete(userId);
              remoteRigs.delete(userId);
            }
            continue;
          }

          const rosterUser = roster.find((r) => r.userId === userId);
          const displayName = rosterUser?.displayName ?? "שחקן";
          currentPlayers.push({
            userId,
            displayName,
            pos: [
              Math.round(p.pos[0] * 10) / 10,
              Math.round(p.pos[1] * 10) / 10,
              Math.round(p.pos[2] * 10) / 10
            ]
          });

          const eid = ensureRemoteEntity(userId);
          noa.entities.setPosition(eid, p.pos);
          const rig = remoteRigs.get(userId);
          if (rig) {
            updateAvatarWalk(rig, p.pos[0], p.pos[2]);
            setAvatarHeadPitch(rig, p.pitch ?? 0);
            setAvatarYawSmoothed(rig, p.heading);
          }
        }
        setPlayersList(currentPlayers);

        for (const [userId, eid] of remoteEntitiesRef.current) {
          if (!(userId in snap.players)) {
            noa.entities.deleteEntity(eid);
            remoteEntitiesRef.current.delete(userId);
            remoteRigs.delete(userId);
          }
        }
      });
      cleanupFns.push(offSnapshot);

      const offBlockDelta = registerBlockDeltaListenerRef.current(({ pos, blockId }) => {
        const [x, y, z] = pos;
        const previousId = clientBlockAtInt(x, y, z);
        noa.setBlock(blockId, x, y, z);
        setDelta(x, y, z, blockId);
        setTorchLightAt(x, y, z, blockId);
        if (!pausedRef.current && previousId !== blockId) {
          if (previousId !== BLOCK_REGISTRY.AIR && blockId === BLOCK_REGISTRY.AIR) {
            const volume = blockEventVolume(x, y, z, 0.58);
            if (volume > 0) audio.playBreak(blockSoundGroup(previousId), volume);
          } else if (blockId !== BLOCK_REGISTRY.AIR) {
            const volume = blockEventVolume(x, y, z, 0.42);
            if (volume > 0) audio.playPlace(blockSoundGroup(blockId), volume);
          }
        }
      });
      cleanupFns.push(offBlockDelta);

      /** Keep in sync with `DROP_PHYS_HALF_XZ` / `DROP_PHYS_HALF_Y` (apps/minecraft-server/src/drops.ts). */
      const DROP_PHYS_HALF_XZ = 0.142;
      const DROP_PHYS_HALF_Y = 0.142;
      const DROP_MAX_VIS_STEP = 0.16;
      const DEPENET_VIS_EPS = 1.2e-3;

      function clientBlockAtInt(ix: number, iy: number, iz: number): number {
        const o = deltas.get(`${ix},${iy},${iz}`);
        return o ?? proceduralVoxelID(ix, iy, iz, seed);
      }

      function clientSolidAtInt(ix: number, iy: number, iz: number): boolean {
        return clientBlockAtInt(ix, iy, iz) !== BLOCK_REGISTRY.AIR;
      }

      function blockEventVolume(
        ix: number,
        iy: number,
        iz: number,
        baseVolume: number
      ): number {
        try {
          const pos = noa.entities.getPosition(noa.playerEntity) as number[];
          const dx = ix + 0.5 - pos[0];
          const dy = iy + 0.5 - pos[1];
          const dz = iz + 0.5 - pos[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > 18) return 0;
          return baseVolume * Math.max(0.18, 1 - dist / 18);
        } catch {
          return baseVolume;
        }
      }

      function playerIntersectsLadder(pos: Vec3): boolean {
        const xs = [Math.floor(pos[0] - 0.32), Math.floor(pos[0] + 0.32)];
        const ys = [Math.floor(pos[1] + 0.15), Math.floor(pos[1] + 1.15)];
        const zs = [Math.floor(pos[2] - 0.32), Math.floor(pos[2] + 0.32)];
        for (const x of xs) {
          for (const y of ys) {
            for (const z of zs) {
              if (clientBlockAtInt(x, y, z) === BLOCK_REGISTRY.LADDER) return true;
            }
          }
        }
        return false;
      }

      function blockIntersectsLocalPlayer(x: number, y: number, z: number): boolean {
        const pos = noa.entities.getPosition(noa.playerEntity) as number[];
        return (
          x < pos[0] + 0.35 &&
          x + 1 > pos[0] - 0.35 &&
          y < pos[1] + 1.8 &&
          y + 1 > pos[1] &&
          z < pos[2] + 0.35 &&
          z + 1 > pos[2] - 0.35
        );
      }

      function fallbackPlacementPos(): Vec3 | null {
        const eye = noa.camera.getTargetPosition() as number[];
        const dir = noa.camera.getDirection() as number[];
        const seen = new Set<string>();
        for (let dist = 1.6; dist <= MAX_REACH - 0.5; dist += 0.25) {
          const x = Math.floor(eye[0] + dir[0] * dist);
          const y = Math.floor(eye[1] + dir[1] * dist);
          const z = Math.floor(eye[2] + dir[2] * dist);
          const key = blockCoordKey(x, y, z);
          if (seen.has(key)) continue;
          seen.add(key);
          if (!blockReplaceable(clientBlockAtInt(x, y, z))) continue;
          if (blockIntersectsLocalPlayer(x, y, z)) continue;
          return [x, y, z];
        }
        return null;
      }

      /** First breakable voxel along view ray (includes replaceable plants noa skips for placement). */
      function findBreakTarget(): { pos: Vec3; blockId: number; distance: number } | null {
        const eye = noa.camera.getTargetPosition() as number[];
        const dir = noa.camera.getDirection() as number[];
        const seen = new Set<string>();
        for (let dist = 1.0; dist <= MAX_REACH - 0.5; dist += 0.15) {
          const x = Math.floor(eye[0] + dir[0] * dist);
          const y = Math.floor(eye[1] + dir[1] * dist);
          const z = Math.floor(eye[2] + dir[2] * dist);
          const key = blockCoordKey(x, y, z);
          if (seen.has(key)) continue;
          seen.add(key);
          const blockId = clientBlockAtInt(x, y, z);
          if (blockId === BLOCK_REGISTRY.AIR || blockId === BLOCK_REGISTRY.WATER) continue;
          if (!blockBreakable(blockId)) continue;
          const center: Vec3 = [x + 0.5, y + 0.5, z + 0.5];
          const distance = vecDist(eye, center);
          if (distance > MAX_REACH) continue;
          return { pos: [x, y, z], blockId, distance };
        }
        return null;
      }

      function clientDepenetrateDropVisual(px: number, py: number, pz: number): Vec3 {
        let x = px;
        let y = py;
        let z = pz;
        const hx = DROP_PHYS_HALF_XZ;
        const hy = DROP_PHYS_HALF_Y;
        const hz = DROP_PHYS_HALF_XZ;

        for (let pass = 0; pass < 10; pass++) {
          let moved = false;
          const gx0 = Math.floor(x - hx);
          const gx1 = Math.floor(x + hx);
          const gy0 = Math.floor(y - hy);
          const gy1 = Math.floor(y + hy);
          const gz0 = Math.floor(z - hz);
          const gz1 = Math.floor(z + hz);

          for (let bx = gx0; bx <= gx1; bx++) {
            for (let by = gy0; by <= gy1; by++) {
              for (let bz = gz0; bz <= gz1; bz++) {
                if (!clientSolidAtInt(bx, by, bz)) continue;

                const ox =
                  Math.min(x + hx, bx + 1 + 4e-7) -
                  Math.max(x - hx, bx - 4e-7);
                const oy =
                  Math.min(y + hy, by + 1 + 4e-7) -
                  Math.max(y - hy, by - 4e-7);
                const oz =
                  Math.min(z + hz, bz + 1 + 4e-7) -
                  Math.max(z - hz, bz - 4e-7);

                if (ox <= 0 || oy <= 0 || oz <= 0) continue;

                if (ox < oy && ox < oz) {
                  const sign = x < bx + 0.5 ? -1 : 1;
                  x += sign * (ox + DEPENET_VIS_EPS);
                } else if (oy < oz) {
                  const sign = y < by + 0.5 ? -1 : 1;
                  y += sign * (oy + DEPENET_VIS_EPS);
                } else {
                  const sign = z < bz + 0.5 ? -1 : 1;
                  z += sign * (oz + DEPENET_VIS_EPS);
                }

                moved = true;
                break;
              }
              if (moved) break;
            }
            if (moved) break;
          }

          if (!moved) break;
        }

        return [x, y, z];
      }

      function moveTowardCap(prev: Vec3, target: Vec3, maxLen: number): Vec3 {
        const dx = target[0] - prev[0];
        const dy = target[1] - prev[1];
        const dz = target[2] - prev[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= maxLen || d < 1e-8) {
          return [target[0], target[1], target[2]];
        }
        const s = maxLen / d;
        return [prev[0] + dx * s, prev[1] + dy * s, prev[2] + dz * s];
      }

      const worldDropEntities = new Map<string, number>();
      type DropInterpRecord = { p0: Vec3; p1: Vec3; t0: number };
      const DROP_INTERP_MS = 220;
      const worldDropInterpById = new Map<string, DropInterpRecord>();
      const worldDropMeshes = new Map<string, Mesh>();
      const worldDropSpinSign = new Map<string, number>();
      const worldDropVisualBase = new Map<string, Vec3>();
      const worldDropStackKey = new Map<string, string>();

      function clientSeparateDissimilarDropBases(): void {
        const wids = [...worldDropEntities.keys()];
        const hx = DROP_PHYS_HALF_XZ;
        const hy = DROP_PHYS_HALF_Y;
        const hz = DROP_PHYS_HALF_XZ;

        for (let i = 0; i < wids.length; i++) {
          const wa = wids[i]!;
          const ka = worldDropStackKey.get(wa);
          const ba = worldDropVisualBase.get(wa);
          if (ka === undefined || !ba) continue;

          for (let j = i + 1; j < wids.length; j++) {
            const wb = wids[j]!;
            if ((worldDropStackKey.get(wb) ?? "") === ka) continue;
            const bb = worldDropVisualBase.get(wb);
            if (!bb) continue;

            const dx = bb[0] - ba[0];
            const dy = bb[1] - ba[1];
            const dz = bb[2] - ba[2];

            const ox =
              Math.min(ba[0] + hx, bb[0] + hx) - Math.max(ba[0] - hx, bb[0] - hx);
            const oy =
              Math.min(ba[1] + hy, bb[1] + hy) - Math.max(ba[1] - hy, bb[1] - hy);
            const oz =
              Math.min(ba[2] + hz, bb[2] + hz) - Math.max(ba[2] - hz, bb[2] - hz);

            if (ox <= 0 || oy <= 0 || oz <= 0) continue;

            let mag: number;
            let sx = 0;
            let sy = 0;
            let sz = 0;
            if (ox < oy && ox < oz) {
              mag = (ox + DEPENET_VIS_EPS) * 0.5;
              if (Math.abs(dx) > 1e-5) sx = dx > 0 ? 1 : -1;
              else sx = wa.localeCompare(wb) <= 0 ? -1 : 1;
            } else if (oy < oz) {
              mag = (oy + DEPENET_VIS_EPS) * 0.5;
              if (Math.abs(dy) > 1e-5) sy = dy > 0 ? 1 : -1;
              else sy = wa.localeCompare(wb) <= 0 ? -1 : 1;
            } else {
              mag = (oz + DEPENET_VIS_EPS) * 0.5;
              if (Math.abs(dz) > 1e-5) sz = dz > 0 ? 1 : -1;
              else sz = wa.localeCompare(wb) <= 0 ? -1 : 1;
            }

            ba[0] -= sx * mag;
            ba[1] -= sy * mag;
            ba[2] -= sz * mag;
            bb[0] += sx * mag;
            bb[1] += sy * mag;
            bb[2] += sz * mag;
          }
        }
      }

      function smoothInterp01(u: number): number {
        const x = Math.min(Math.max(u, 0), 1);
        return x * x * (3 - 2 * x);
      }

      function sampleInterp(prev: DropInterpRecord): Vec3 {
        const elapsed = performance.now() - prev.t0;
        const u = smoothInterp01(Math.min(Math.max(elapsed / DROP_INTERP_MS, 0), 1));
        return [
          prev.p0[0] + (prev.p1[0] - prev.p0[0]) * u,
          prev.p0[1] + (prev.p1[1] - prev.p0[1]) * u,
          prev.p0[2] + (prev.p1[2] - prev.p0[2]) * u
        ];
      }

      function spinSignForDropId(id: string): number {
        return id.charCodeAt(0) % 2 === 0 ? 1 : -1;
      }

      function textureUrlForDrop(drop: WorldDrop): string | undefined {
        if (drop.kind === "block") {
          const isCake =
            drop.blockId === BLOCK_REGISTRY.CAKE ||
            drop.blockId === BLOCK_REGISTRY.CAKE_5 ||
            drop.blockId === BLOCK_REGISTRY.CAKE_4 ||
            drop.blockId === BLOCK_REGISTRY.CAKE_3 ||
            drop.blockId === BLOCK_REGISTRY.CAKE_2 ||
            drop.blockId === BLOCK_REGISTRY.CAKE_1;
          if (isCake) {
            return "/minecraft-assets/item/cake.png";
          }
          return BLOCK_HOTBAR_ICON[drop.blockId];
        }
        return ITEM_ICON[drop.itemId];
      }

      function dropUsesFlatSprite(drop: WorldDrop): boolean {
        if (drop.kind === "item") return true;
        const isCake =
          drop.blockId === BLOCK_REGISTRY.CAKE ||
          drop.blockId === BLOCK_REGISTRY.CAKE_5 ||
          drop.blockId === BLOCK_REGISTRY.CAKE_4 ||
          drop.blockId === BLOCK_REGISTRY.CAKE_3 ||
          drop.blockId === BLOCK_REGISTRY.CAKE_2 ||
          drop.blockId === BLOCK_REGISTRY.CAKE_1;
        return (
          PLANT_SPRITE_BLOCK_IDS.has(drop.blockId) ||
          isCake
        );
      }

      function worldDropMergeStackKey(drop: WorldDrop): string {
        return drop.kind === "block" ? `b:${drop.blockId}` : `i:${drop.itemId}`;
      }

      const DROP_CUBE_SIZE = 0.28;

      function createTexturedDropCube(textureUrl: string, uniqueId: string): Mesh {
        const scene = noa.rendering.getScene();
        const mesh = Babylon.MeshBuilder.CreateBox(
          `world-drop-${uniqueId}`,
          { size: DROP_CUBE_SIZE },
          scene
        );
        const tex = new Babylon.Texture(
          textureUrl,
          scene,
          true,
          false,
          Babylon.Texture.NEAREST_SAMPLINGMODE
        );
        tex.hasAlpha = true;
        const mat = noa.rendering.makeStandardMaterial(`world-drop-mat-${uniqueId}`);
        mat.diffuseTexture = tex;
        mat.specularColor = new Babylon.Color3(0.04, 0.04, 0.04);
        mat.emissiveColor = new Babylon.Color3(0.12, 0.12, 0.12);
        mesh.material = mat;
        return mesh;
      }

      function cacheDropMeshAndInterp(wid: string, eid: number, pos: Vec3): void {
        worldDropInterpById.set(wid, {
          p0: [pos[0], pos[1], pos[2]],
          p1: [pos[0], pos[1], pos[2]],
          t0: performance.now()
        });
        worldDropVisualBase.set(wid, [pos[0], pos[1], pos[2]]);
        worldDropSpinSign.set(wid, spinSignForDropId(wid));
        try {
          const md = noa.entities.getMeshData(eid);
          if (md?.mesh) worldDropMeshes.set(wid, md.mesh as Mesh);
        } catch {
          // ignore
        }
      }

      function spawnWorldDropEntity(drop: WorldDrop): void {
        const url = textureUrlForDrop(drop);
        if (!url) return;
        try {
          if (dropUsesFlatSprite(drop)) {
            const mesh = makeFlatDropMesh(
              noa,
              Babylon,
              url,
              `world-drop-${drop.id}`
            );
            mesh.scaling = new Babylon.Vector3(0.7, 0.7, 0.7);
            const eid: number = noa.entities.add(
              [drop.pos[0], drop.pos[1], drop.pos[2]],
              0.32,
              0.32,
              mesh,
              [0, 0.12, 0],
              false,
              false
            );
            worldDropStackKey.set(drop.id, worldDropMergeStackKey(drop));
            worldDropEntities.set(drop.id, eid);
            cacheDropMeshAndInterp(drop.id, eid, drop.pos);
            return;
          }
          const mesh = createTexturedDropCube(url, drop.id);
          const eid: number = noa.entities.add(
            [drop.pos[0], drop.pos[1], drop.pos[2]],
            DROP_CUBE_SIZE,
            DROP_CUBE_SIZE,
            mesh,
            [0, 0, 0],
            false,
            false
          );
          worldDropStackKey.set(drop.id, worldDropMergeStackKey(drop));
          worldDropEntities.set(drop.id, eid);
          cacheDropMeshAndInterp(drop.id, eid, drop.pos);
        } catch {
          // ignore malformed drop visuals
        }
      }

      function removeWorldDropEntity(wid: string): void {
        const eid = worldDropEntities.get(wid);
        if (eid === undefined) return;
        try {
          noa.entities.deleteEntity(eid);
        } catch {
          // engine may already be tearing down
        }
        worldDropEntities.delete(wid);
        worldDropInterpById.delete(wid);
        worldDropMeshes.delete(wid);
        worldDropSpinSign.delete(wid);
        worldDropVisualBase.delete(wid);
        worldDropStackKey.delete(wid);
      }

      type PrimedTntVisual = {
        eid: number;
        mesh: Mesh;
        primedAt: number;
        explodeAt: number;
      };
      const primedTnts = new Map<string, PrimedTntVisual>();

      function createPrimedTntMesh(id: string): Mesh | null {
        const url = BLOCK_HOTBAR_ICON[BLOCK_REGISTRY.TNT];
        if (!url) return null;
        const scene = noa.rendering.getScene();
        const mesh = Babylon.MeshBuilder.CreateBox(
          `primed-tnt-${id}`,
          { size: 0.84 },
          scene
        );
        const tex = new Babylon.Texture(
          url,
          scene,
          true,
          false,
          Babylon.Texture.NEAREST_SAMPLINGMODE
        );
        const mat = noa.rendering.makeStandardMaterial(`primed-tnt-mat-${id}`);
        mat.diffuseTexture = tex;
        mat.specularColor = new Babylon.Color3(0.02, 0.02, 0.02);
        mat.emissiveColor = new Babylon.Color3(0.18, 0.08, 0.08);
        mesh.material = mat;
        return mesh;
      }

      function spawnPrimedTntVisual(ev: Extract<RoomEvent, { kind: "TNT_PRIMED" }>): void {
        if (primedTnts.has(ev.id)) return;
        const mesh = createPrimedTntMesh(ev.id);
        if (!mesh) return;
        try {
          const eid: number = noa.entities.add(
            [ev.pos[0] + 0.5, ev.pos[1] + 0.5, ev.pos[2] + 0.5],
            0.84,
            0.84,
            mesh,
            [0, 0, 0],
            false,
            false
          );
          primedTnts.set(ev.id, {
            eid,
            mesh,
            primedAt: ev.primedAt,
            explodeAt: ev.explodeAt
          });
        } catch {
          mesh.dispose();
        }
      }

      function removePrimedTntVisual(id: string): void {
        const visual = primedTnts.get(id);
        if (!visual) return;
        try {
          noa.entities.deleteEntity(visual.eid);
        } catch {
          visual.mesh.dispose();
        }
        primedTnts.delete(id);
      }

      function animatePrimedTnts(nowMs: number): void {
        for (const [id, visual] of primedTnts) {
          const duration = Math.max(1, visual.explodeAt - visual.primedAt);
          const progress = Math.min(1, Math.max(0, (nowMs - visual.primedAt) / duration));
          const pulseRate = 7 + progress * 18;
          const pulse = Math.sin((nowMs / 1000) * pulseRate) * 0.5 + 0.5;
          const scale = 1 + pulse * (0.04 + progress * 0.12);
          visual.mesh.scaling.set(scale, scale, scale);
          const mat = visual.mesh.material as {
            emissiveColor?: { r: number; g: number; b: number };
          } | null;
          if (mat?.emissiveColor) {
            mat.emissiveColor.r = 0.12 + pulse * progress * 0.75;
            mat.emissiveColor.g = 0.05 + pulse * progress * 0.5;
            mat.emissiveColor.b = 0.05 + pulse * progress * 0.5;
          }
          if (nowMs > visual.explodeAt + 1500) removePrimedTntVisual(id);
        }
      }

      let blastFlashTimer: number | null = null;
      const offRoomEvents = registerRoomEventListenerRef.current((ev) => {
        if (ev.kind === "TNT_PRIMED") {
          spawnPrimedTntVisual(ev);
          const volume = blockEventVolume(ev.pos[0], ev.pos[1], ev.pos[2], 0.32);
          if (volume > 0) audio.playFuse(volume);
          return;
        }
        if (ev.kind === "EXPLOSION") {
          removePrimedTntVisual(ev.id);
          const volume = blockEventVolume(ev.pos[0], ev.pos[1], ev.pos[2], 0.95);
          if (volume > 0) audio.playExplosion(volume);
          if (volume > 0.12) {
            setBlastFlash(1);
            if (blastFlashTimer !== null) window.clearTimeout(blastFlashTimer);
            blastFlashTimer = window.setTimeout(() => {
              setBlastFlash(0);
              blastFlashTimer = null;
            }, 220);
          }
          return;
        }
        if (ev.kind === "PLAYER_DEATH") {
          if (ev.userId === myUserIdRef.current) {
            document.exitPointerLock?.();
            setIsDead(true);
          }
          return;
        }
        if (ev.kind === "PLAYER_RESPAWN") {
          if (ev.userId === myUserIdRef.current) {
            noa.entities.setPosition(noa.playerEntity, ev.respawnPos);
            const phys = noa.entities.getPhysics(noa.playerEntity);
            if (phys?.body) {
              phys.body.velocity[0] = 0;
              phys.body.velocity[1] = 0;
              phys.body.velocity[2] = 0;
            }
          }
          return;
        }
      });
      cleanupFns.push(offRoomEvents);
      cleanupFns.push(() => {
        if (blastFlashTimer !== null) window.clearTimeout(blastFlashTimer);
        for (const id of [...primedTnts.keys()]) removePrimedTntVisual(id);
      });

      for (const d of initialWorldDrops) {
        spawnWorldDropEntity(d);
      }

      const offWorldDropSpawned = registerWorldDropSpawnedRef.current((d) => {
        spawnWorldDropEntity(d);
      });
      cleanupFns.push(offWorldDropSpawned);

      const offWorldDropRemoved = registerWorldDropRemovedRef.current((wid) => {
        removeWorldDropEntity(wid);
      });
      cleanupFns.push(offWorldDropRemoved);

      const offWorldDropUpdated = registerWorldDropUpdatedRef.current(
        (updates: WorldDropWireDelta[]) => {
          for (const u of updates) {
            const prev = worldDropInterpById.get(u.id);
            let p0: Vec3;
            const eid = worldDropEntities.get(u.id);
            if (eid !== undefined) {
              try {
                const cur = noa.entities.getPosition(eid);
                p0 = [cur[0], cur[1], cur[2]];
              } catch {
                p0 = [u.pos[0], u.pos[1], u.pos[2]];
              }
            } else if (prev) {
              p0 = sampleInterp(prev);
            } else {
              p0 = [u.pos[0], u.pos[1], u.pos[2]];
            }
            worldDropInterpById.set(u.id, {
              p0,
              p1: [u.pos[0], u.pos[1], u.pos[2]],
              t0: performance.now()
            });
          }
        }
      );
      cleanupFns.push(offWorldDropUpdated);

      function stopMiningAnim(): void {
        if (miningAnimRef.current !== null) {
          cancelAnimationFrame(miningAnimRef.current);
          miningAnimRef.current = null;
        }
      }

      function clearMiningState(cancelServer: boolean): void {
        const m = activeMiningRef.current;
        stopMiningAnim();
        activeMiningRef.current = null;
        breakFinishSentRef.current = false;
        breakCrackRef.current?.clear();
        if (cancelServer && m) {
          onBreakCancelRef.current(m.pos);
        }
      }

      function emitBreakFinish(pos: Vec3): void {
        if (breakFinishSentRef.current) return;
        const now = performance.now();
        if (now - lastBreakFinishAtRef.current < BREAK_FINISH_MIN_MS) return;
        breakFinishSentRef.current = true;
        lastBreakFinishAtRef.current = now;
        breakCrackRef.current?.clear();
        void onBreakFinishRef.current(pos);
      }

      let lastDigSfxAt = 0;

      async function tryStartMining(): Promise<void> {
        if (pausedRef.current) return;
        const breakTgt = findBreakTarget();
        const attackTarget = findAttackTarget();
        if (attackTarget) {
          const blockDistance = breakTgt?.distance ?? Number.POSITIVE_INFINITY;
          if (attackTarget.distance <= blockDistance) {
            triggerLocalArmSwing();
            void onPlayerAttackRef.current(attackTarget.userId);
            return;
          }
        }
        if (!breakTgt) return;
        const pos = breakTgt.pos;
        triggerLocalArmSwing();
        const startSwingAt = performance.now();
        if (gameModeRef.current === "creative") {
          onBreakRef.current(pos);
          return;
        }
        const blockId = breakTgt.blockId;
        if (isInstantBreak(blockId)) {
          onBreakRef.current(pos);
          return;
        }
        if (activeMiningRef.current) {
          const cur = activeMiningRef.current.pos;
          if (cur[0] === pos[0] && cur[1] === pos[1] && cur[2] === pos[2]) {
            return;
          }
          clearMiningState(true);
        }
        const now = performance.now();
        if (now - lastBreakStartAtRef.current < BREAK_START_MIN_MS) return;
        breakFinishSentRef.current = false;
        const currentMining = {
          pos,
          durationMs: null as number | null,
          startedAt: null as number | null
        };
        activeMiningRef.current = currentMining;
        const ack = await onBreakStartRef.current(pos);
        if (activeMiningRef.current !== currentMining) return;
        if (!ack.ok || !ack.durationMs) {
          activeMiningRef.current = null;
          return;
        }
        lastBreakStartAtRef.current = now;
        currentMining.durationMs = ack.durationMs;
        currentMining.startedAt = performance.now();
        lastDigSfxAt = 0;
        breakCrackRef.current?.setStage(pos, 0);
        let lastSwingAt = startSwingAt;
        const tick = (): void => {
          const m = activeMiningRef.current;
          if (!m || m.durationMs === null || m.startedAt === null) return;
          const now = performance.now();
          if (now - lastDigSfxAt > 250) {
            const diggingId = clientBlockAtInt(m.pos[0], m.pos[1], m.pos[2]);
            audio.playDig(blockSoundGroup(diggingId));
            lastDigSfxAt = now;
          }
          if (now - lastSwingAt > 250) {
            triggerLocalArmSwing();
            lastSwingAt = now;
          }
          const t = (now - m.startedAt) / m.durationMs;
          breakCrackRef.current?.setStage(m.pos, destroyStageIndex(t));
          if (t >= 1) {
            activeMiningRef.current = null;
            stopMiningAnim();
            emitBreakFinish(m.pos);
            return;
          }
          miningAnimRef.current = requestAnimationFrame(tick);
        };
        miningAnimRef.current = requestAnimationFrame(tick);
      }

      function endMiningHold(): void {
        const m = activeMiningRef.current;
        if (!m) return;
        if (m.durationMs === null || m.startedAt === null) {
          stopMiningAnim();
          activeMiningRef.current = null;
          breakCrackRef.current?.clear();
          onBreakCancelRef.current(m.pos);
          return;
        }
        const elapsed = performance.now() - m.startedAt;
        stopMiningAnim();
        activeMiningRef.current = null;
        if (elapsed >= m.durationMs - 60) {
          emitBreakFinish(m.pos);
        } else {
          breakCrackRef.current?.clear();
          onBreakCancelRef.current(m.pos);
        }
      }

      function cancelEatingHold(): void {
        const eating = activeEatingRef.current;
        if (!eating) return;
        if (eating.timer !== null) {
          window.clearTimeout(eating.timer);
        }
        activeEatingRef.current = null;
        audio.stopEating(false);
        void onEatCancelRef.current();
      }

      async function startEatingHold(hotbarIndex: number): Promise<void> {
        if (activeEatingRef.current) return;
        const active: { hotbarIndex: number; timer: number | null } = {
          hotbarIndex,
          timer: null
        };
        activeEatingRef.current = active;
        const ack = await onEatStartRef.current(hotbarIndex);
        if (activeEatingRef.current !== active) return;
        if (!ack.ok) {
          activeEatingRef.current = null;
          return;
        }
        audio.startEating();
        const durationMs = ack.durationMs ?? 1600;
        active.timer = window.setTimeout(() => {
          if (activeEatingRef.current !== active) return;
          activeEatingRef.current = null;
          audio.stopEating(true);
          void onEatFinishRef.current(hotbarIndex);
        }, durationMs);
      }

      noa.inputs.down.on("fire", () => {
        if (isTeacherSpectatorRef.current) return;
        if (chatOpenRef.current || inventoryOpenRef.current) return;
        void tryStartMining();
      });
      noa.inputs.up.on("fire", endMiningHold);
      noa.inputs.up.on("alt-fire", cancelEatingHold);
      cleanupFns.push(() => clearMiningState(true));
      cleanupFns.push(cancelEatingHold);
      noa.inputs.down.on("alt-fire", () => {
        if (pausedRef.current) return;
        if (isTeacherSpectatorRef.current) return;
        if (chatOpenRef.current || inventoryOpenRef.current) return;
        if (gameModeRef.current === "survival") {
          const tgt = noa.targetedBlock;
          const inv = inventoryRef.current;
          const idx = survivalSlotRef.current;
          const cell = inv[idx];
          if (
            tgt &&
            Number(tgt.blockID) === BLOCK_REGISTRY.TNT &&
            cell &&
            cell.count > 0 &&
            cell.itemId === ITEM_REGISTRY.FLINT_AND_STEEL
          ) {
            const pos: Vec3 = [
              Math.floor(Number(tgt.position[0])),
              Math.floor(Number(tgt.position[1])),
              Math.floor(Number(tgt.position[2]))
            ];
            triggerLocalArmSwing();
            void onIgniteTntRef.current(pos);
            return;
          }
          if (tgt && Number(tgt.blockID) === BLOCK_REGISTRY.CRAFTING) {
            const pos: Vec3 = [
              Math.floor(Number(tgt.position[0])),
              Math.floor(Number(tgt.position[1])),
              Math.floor(Number(tgt.position[2]))
            ];
            void onOpenCraftingTableRef.current(pos).then((ack) => {
              if (!ack.ok) return;
              document.exitPointerLock?.();
              setInventoryOpen(true);
            });
            return;
          }
          if (tgt && Number(tgt.blockID) === BLOCK_REGISTRY.CHEST) {
            const pos: Vec3 = [
              Math.floor(Number(tgt.position[0])),
              Math.floor(Number(tgt.position[1])),
              Math.floor(Number(tgt.position[2]))
            ];
            void onOpenChestRef.current(pos).then((ack) => {
              if (!ack.ok) return;
              document.exitPointerLock?.();
              setInventoryOpen(true);
            });
            return;
          }
          const tgtBlockID = tgt ? Number(tgt.blockID) : 0;
          const isCakeBlock =
            tgtBlockID === BLOCK_REGISTRY.CAKE ||
            tgtBlockID === BLOCK_REGISTRY.CAKE_5 ||
            tgtBlockID === BLOCK_REGISTRY.CAKE_4 ||
            tgtBlockID === BLOCK_REGISTRY.CAKE_3 ||
            tgtBlockID === BLOCK_REGISTRY.CAKE_2 ||
            tgtBlockID === BLOCK_REGISTRY.CAKE_1;

          if (tgt && isCakeBlock) {
            const pos: Vec3 = [
              Math.floor(Number(tgt.position[0])),
              Math.floor(Number(tgt.position[1])),
              Math.floor(Number(tgt.position[2]))
            ];
            triggerLocalArmSwing();
            audio.startEating();
            setTimeout(() => {
              audio.stopEating(true);
            }, 180);
            void onEatCakeSliceRef.current(pos);
            return;
          }
          if (cell && cell.count > 0 && itemFoodSpec(cell.itemId ?? 0)) {
            void startEatingHold(idx);
            return;
          }
          if (
            !cell ||
            cell.count <= 0 ||
            (cell.itemId ?? 0) > 0 ||
            cell.blockId === BLOCK_REGISTRY.AIR
          ) {
            return;
          }
          const placePos = tgt
            ? ([tgt.adjacent[0], tgt.adjacent[1], tgt.adjacent[2]] as Vec3)
            : fallbackPlacementPos();
          if (!placePos) return;
          if (cell.blockId === BLOCK_REGISTRY.SUGAR_CANE) {
            const [px, py, pz] = placePos;
            const belowId = clientBlockAtInt(px, py - 1, pz);
            if (!sugarCaneMayPlaceOn(belowId)) {
              return;
            }
          }
          triggerLocalArmSwing();
          onPlaceRef.current(placePos, cell.blockId);
          return;
        }
        const tgt = noa.targetedBlock;
        const placePos = tgt
          ? ([tgt.adjacent[0], tgt.adjacent[1], tgt.adjacent[2]] as Vec3)
          : fallbackPlacementPos();
        if (!placePos) return;
        if (selectedBlockRef.current === BLOCK_REGISTRY.SUGAR_CANE) {
          const [px, py, pz] = placePos;
          const belowId = clientBlockAtInt(px, py - 1, pz);
          if (!sugarCaneMayPlaceOn(belowId)) {
            return;
          }
        }
        triggerLocalArmSwing();
        onPlaceRef.current(placePos, selectedBlockRef.current);
      });

      function pickTargetedBlock() {
        if (chatOpenRef.current || inventoryOpenRef.current) return;
        const breakTgt = findBreakTarget();
        if (!breakTgt) return;
        const blockId = breakTgt.blockId;
        if (!PLACEABLE_BLOCK_IDS.includes(blockId)) return;
        if (gameModeRef.current === "creative") {
          selectCreativeBlock(blockId);
          return;
        }
        const idx = inventoryRef.current.findIndex(
          (cell) => cell.blockId === blockId && cell.count > 0
        );
        if (idx >= 0) {
          if (survivalSlotRef.current !== idx) {
            cancelEatingHold();
            survivalSlotRef.current = idx;
            setSurvivalSlot(idx);
          }
        }
      }

      noa.inputs.down.on("mid-fire", pickTargetedBlock);

      function onHotbarKey(e: KeyboardEvent) {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        if (chatOpenRef.current) return;

        if (helpOpenRef.current) {
          if (e.code === "KeyH") {
            e.preventDefault();
            e.stopPropagation();
            setHelpOpen(false);
            const noa: any = noaRef.current;
            if (noa) {
              noa.inputs.disabled = false;
              setTimeout(() => {
                noa.container.element?.requestPointerLock?.();
              }, 50);
            }
          }
          return;
        }

        if (e.code === "KeyH") {
          e.preventDefault();
          e.stopPropagation();
          if (gameModeRef.current === "survival" && !isDeadRef.current) {
            setHelpOpen(true);
            setInventoryOpen(false);
            setChatOpen(false);
            onChatExpandedChange?.(false);
            
            document.exitPointerLock?.();
            const noa: any = noaRef.current;
            if (noa) {
              noa.inputs.disabled = true;
            }
            setHelpPulse(false);
          }
          return;
        }

        if (e.code === "KeyI") {
          showDebugRef.current = !showDebugRef.current;
          if (!showDebugRef.current) {
            setDebugInfo(null);
          }
          return;
        }
        if (e.code === "KeyM" && !chatOpenRef.current && !inventoryOpenRef.current) {
          e.preventDefault();
          e.stopPropagation();
          void toggleMute();
          return;
        }
        if (isDeadRef.current) return;

        if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyT") {
          e.preventDefault();
          e.stopPropagation();
          document.exitPointerLock?.();
          setChatOpen(true);
          onChatExpandedChange?.(true);
          const noa: any = noaRef.current;
          if (noa) {
            noa.inputs.disabled = true;
          }
          return;
        }
        if (e.code === "KeyE") {
          if (isTeacherSpectatorRef.current) return;
          if (inventoryOpenRef.current) {
            closeInventory();
          } else {
            document.exitPointerLock?.();
            setInventoryOpen(true);
          }
          return;
        }
        if (e.code === "KeyQ" && !inventoryOpenRef.current) {
          if (isTeacherSpectatorRef.current) return;
          if (gameModeRef.current === "survival") {
            onDropHotbarSlotRef.current?.(survivalSlotRef.current);
          }
          return;
        }
        
        let n: number | null = null;
        if (e.code.startsWith("Digit")) {
          const val = parseInt(e.code.substring(5), 10);
          if (!isNaN(val)) {
            n = val;
          }
        } else if (e.code.startsWith("Numpad")) {
          const val = parseInt(e.code.substring(6), 10);
          if (!isNaN(val)) {
            n = val;
          }
        }

        if (n !== null) {
          if (gameModeRef.current === "survival") {
            if (n >= 1 && n <= 9) {
              const i = n - 1;
              if (survivalSlotRef.current !== i) {
                cancelEatingHold();
                survivalSlotRef.current = i;
                setSurvivalSlot(i);
              }
            }
            return;
          }
          const visibleCreativeBlocks = visibleCreativeHotbarBlocks(selectedBlockRef.current);
          if (n >= 1 && n <= visibleCreativeBlocks.length) {
            const idx = n - 1;
            selectCreativeBlock(visibleCreativeBlocks[idx]!);
          }
        }
      }
      window.addEventListener("keydown", onHotbarKey);
      cleanupFns.push(() => window.removeEventListener("keydown", onHotbarKey));

      let lastEmit = 0;
      let lastGrounded = true;
      let minAirVelocityY = 0;
      let lastFallImpactAt = 0;
      let lastAmbientSampleAt = 0;
      let lastFootstepAt = 0;
      let lastDebugUpdate = 0;

      // Helpers that work on both the modern AudioParam API and the legacy
      // setPosition/setOrientation API (older Safari only exposes the latter).
      function setListenerPose(
        listener: AudioListener,
        pos: number[],
        dir: number[],
        t: number
      ): void {
        if ("positionX" in listener) {
          listener.positionX.setValueAtTime(pos[0], t);
          listener.positionY.setValueAtTime(pos[1], t);
          listener.positionZ.setValueAtTime(pos[2], t);
          listener.forwardX.setValueAtTime(dir[0], t);
          listener.forwardY.setValueAtTime(dir[1], t);
          listener.forwardZ.setValueAtTime(dir[2], t);
          listener.upX.setValueAtTime(0, t); // Voxel world is strictly Y-Up
          listener.upY.setValueAtTime(1, t);
          listener.upZ.setValueAtTime(0, t);
        } else {
          (listener as any).setPosition(pos[0], pos[1], pos[2]);
          (listener as any).setOrientation(dir[0], dir[1], dir[2], 0, 1, 0);
        }
      }

      function setPannerPosition(panner: PannerNode, x: number, y: number, z: number, t: number): void {
        if ("positionX" in panner) {
          panner.positionX.setValueAtTime(x, t);
          panner.positionY.setValueAtTime(y, t);
          panner.positionZ.setValueAtTime(z, t);
        } else {
          (panner as any).setPosition(x, y, z); // legacy Safari fallback
        }
      }

      const OCCLUSION_INTERVAL_MS = 100;
      let lastOcclusionAt = 0;

      noa.on("beforeRender", () => {
        const ctx = getAudioContext();
        if (!ctx || ctx.state === "suspended" || ctx.state === "closed") return;

        const timeNow = ctx.currentTime;
        const listener = ctx.listener;
        const nowMs = performance.now();
        const doOcclusion = nowMs - lastOcclusionAt >= OCCLUSION_INTERVAL_MS;
        if (doOcclusion) lastOcclusionAt = nowMs;

        // Local player's REAL world position (the head)
        const headPos = noa.camera.getTargetPosition() as number[];
        const camDir = noa.camera.getDirection() as number[];

        // Occlusion raycasts run from the player entity position to remote entities.
        const pPos = noa.entities.getPosition(noa.playerEntity) as number[];

        if (headPos && camDir) {
          setListenerPose(listener, headPos, camDir, timeNow);
        }

        // Update Panner and (throttled) Occlusion params for all active remote players
        audioRigsRef.current.forEach((rig, userId) => {
          const eid = remoteEntitiesRef.current.get(userId);
          if (eid === undefined) {
            setPannerPosition(rig.panner, 99999, 99999, 99999, timeNow);
            return;
          }

          const rPos = noa.entities.getPosition(eid) as number[];
          if (!rPos) return;

          setPannerPosition(rig.panner, rPos[0], rPos[1], rPos[2], timeNow);

          if (!doOcclusion || !pPos) return;

          const solidBlocks = countSolidBlocksBetween(noa, pPos as [number, number, number], rPos as [number, number, number]);
          let cutoffFreq = 20000;

          if (solidBlocks === 1) {
            cutoffFreq = 2500;
          } else if (solidBlocks === 2) {
            cutoffFreq = 1000;
          } else if (solidBlocks >= 3) {
            cutoffFreq = 400;
          }

          rig.filter.frequency.setTargetAtTime(cutoffFreq, timeNow, 0.08);
        });
      });

      const flushFpsReports = () => {
        if (onFPSReportRef.current) {
          if (loadingFpsBufRef.current.length > 0) {
            const sum = loadingFpsBufRef.current.reduce((a, b) => a + b, 0);
            const avg = sum / loadingFpsBufRef.current.length;
            onFPSReportRef.current("loading", avg, loadingFpsBufRef.current.length);
            loadingFpsBufRef.current = [];
          }
          if (runtimeFpsBufRef.current.length > 0) {
            const sum = runtimeFpsBufRef.current.reduce((a, b) => a + b, 0);
            const avg = sum / runtimeFpsBufRef.current.length;
            onFPSReportRef.current("runtime", avg, runtimeFpsBufRef.current.length);
            runtimeFpsBufRef.current = [];
          }
        }
      };

      noa.on("tick", () => {
        if (chatOpenRef.current || inventoryOpenRef.current) {
          if (noa.inputs.state) {
            for (const key in noa.inputs.state) {
              if (Object.prototype.hasOwnProperty.call(noa.inputs.state, key)) {
                noa.inputs.state[key] = false;
              }
            }
          }
          if (noa.inputs.pointerState) {
            noa.inputs.pointerState.scrolly = 0;
          }
        }

        const nowPerf = performance.now();

        if (nowPerf - lastFpsSampleAtRef.current >= 1000) {
          lastFpsSampleAtRef.current = nowPerf;
          const scene = noa.rendering.getScene();
          const engine = scene.getEngine();
          const fps = engine.getFps();
          if (typeof fps === "number" && !isNaN(fps) && fps > 0) {
            if (loadingCompleteRef.current) {
              runtimeFpsBufRef.current.push(fps);
            } else {
              loadingFpsBufRef.current.push(fps);
            }
          }
        }

        const timeNow = Date.now();
        if (lastFpsFlushAtRef.current === 0) {
          lastFpsFlushAtRef.current = timeNow;
        }
        if (timeNow - lastFpsFlushAtRef.current >= 30000) {
          lastFpsFlushAtRef.current = timeNow;
          flushFpsReports();
        }

        // Update background pool with player position and camera direction
        const pPos = noa.entities.getPosition(noa.playerEntity) as number[];
        const pDir = noa.camera.getDirection() as number[];
        if (pPos && pDir) {
          pool.updatePlayer(
            [pPos[0], pPos[1], pPos[2]],
            [pDir[0], pDir[1], pDir[2]]
          );
        }
        if (!pausedRef.current) animatePrimedTnts(Date.now());
        const equipped = equipmentSlotsRef.current;
        const flightPhysState = noa.entities.getPhysics(noa.playerEntity);
        const moveState = noa.entities.getMovement?.(noa.playerEntity);

        if (isTeacherSpectatorRef.current) {
          if (flightPhysState?.body) {
            flightPhysState.body.gravityMultiplier = 0;
            if (moveState) {
              moveState.maxSpeed = 0;
              moveState.jumpForce = 0;
              moveState.jumpImpulse = 0;
            }

            const inputState = noa.inputs.state;
            let vx = 0;
            let vy = 0;
            let vz = 0;
            const speed = 10; // noa agent default speed

            const dir = noa.camera.getDirection() as number[];
            const lenHorizontal = Math.hypot(dir[0], dir[2]);
            const right = lenHorizontal > 0.001 
              ? [dir[2] / lenHorizontal, 0, -dir[0] / lenHorizontal]
              : [1, 0, 0];

            if (inputState.forward) {
              vx += dir[0];
              vy += dir[1];
              vz += dir[2];
            }
            if (inputState.backward) {
              vx -= dir[0];
              vy -= dir[1];
              vz -= dir[2];
            }
            if (inputState.right) {
              vx += right[0];
              vz += right[2];
            }
            if (inputState.left) {
              vx -= right[0];
              vz -= right[2];
            }

            const moveLen = Math.hypot(vx, vy, vz);
            if (moveLen > 0.001) {
              vx = (vx / moveLen) * speed;
              vy = (vy / moveLen) * speed;
              vz = (vz / moveLen) * speed;
            }

            if (inputState.jump) {
              vy = speed;
            } else if (inputState.sprint) {
              vy = -speed;
            } else if (!inputState.forward && !inputState.backward) {
              vy = 0;
            }

            flightPhysState.body.velocity[0] = vx;
            flightPhysState.body.velocity[1] = vy;
            flightPhysState.body.velocity[2] = vz;
          }
        } else {
          if (flightPhysState?.body) {
            flightPhysState.body.gravityMultiplier = 2; // Standard gravity multiplier
          }
          if (moveState) {
            const inputState = noa.inputs.state;
            const playerMoving =
              !!inputState.forward ||
              !!inputState.backward ||
              !!inputState.left ||
              !!inputState.right;
            const sprintRequested = !!inputState.sprint && playerMoving;

            const movement = resolveVoxelMovement({
              equipmentSlots: equipped,
              eating: activeEatingRef.current !== null,
              sprintRequested,
              health: localVitalsRef.current.health,
              gameMode: gameModeRef.current
            });
            const isSprinting =
              movement.canSprint && !!inputState.sprint && playerMoving;
            moveState.running = playerMoving;
            moveState.maxSpeed =
              movement.maxSpeed *
              (isSprinting ? VOXEL_MOVEMENT.sprintSpeedMultiplier : 1);
            moveState.jumpForce = movement.jumpForce;
            moveState.jumpImpulse = movement.jumpImpulse;
            moveState.jumpTime = movement.jumpTimeMs;
          }
        }
        if (scene.ambientColor) {
          scene.ambientColor = isEquipmentPerkActive(
            equipped,
            ITEM_REGISTRY.GLOW_TALISMAN
          )
            ? fullBrightAmbient
            : defaultAmbient;
        }

        if (!pausedRef.current && gameModeRef.current === "survival" && worldDropEntities.size > 0) {
          const bobT = nowPerf / 1000;
          const bobUpMag = (Math.sin(bobT * 6.6) * 0.5 + 0.5) * 0.022;

          for (const [wid, eid] of worldDropEntities) {
            const ip = worldDropInterpById.get(wid);
            let tx: number;
            let ty: number;
            let tz: number;
            if (ip) {
              const elapsed = nowPerf - ip.t0;
              const u = smoothInterp01(Math.min(Math.max(elapsed / DROP_INTERP_MS, 0), 1));
              tx = ip.p0[0] + (ip.p1[0] - ip.p0[0]) * u;
              ty = ip.p0[1] + (ip.p1[1] - ip.p0[1]) * u;
              tz = ip.p0[2] + (ip.p1[2] - ip.p0[2]) * u;
            } else {
              const pCur = noa.entities.getPosition(eid);
              tx = pCur[0];
              ty = pCur[1];
              tz = pCur[2];
            }

            const prevBase =
              worldDropVisualBase.get(wid) ??
              ([tx, ty, tz] as Vec3);
            const base = moveTowardCap(prevBase, [tx, ty, tz], DROP_MAX_VIS_STEP);
            worldDropVisualBase.set(wid, base);
          }

          clientSeparateDissimilarDropBases();

          for (const [wid, eid] of worldDropEntities) {
            const base = worldDropVisualBase.get(wid);
            if (!base) continue;
            const yWithBob = base[1] + bobUpMag;
            const [rx, ry, rz] = clientDepenetrateDropVisual(base[0], yWithBob, base[2]);

            noa.entities.setPosition(eid, [rx, ry, rz]);
            const mesh = worldDropMeshes.get(wid);
            if (mesh) {
              mesh.rotation.y = bobT * 2.1 * (worldDropSpinSign.get(wid) ?? 1);
            }
          }
        }

        if (pausedRef.current) {
          heldItemView?.setVisible(false);
          return;
        }

        const scrolly: number = noa.inputs.pointerState.scrolly;
        if (scrolly !== 0) {
          const cam = noa.camera;
          cam.zoomDistance = Math.max(
            0,
            Math.min(
              CAMERA_ZOOM_DISTANCE_MAX,
              cam.zoomDistance + scrolly * CAMERA_ZOOM_SCROLL_STEP
            )
          );
        }

        const playerEnt = noa.playerEntity;
        const pos: number[] = noa.entities.getPosition(playerEnt);
        const heading: number = noa.camera.heading;
        const pitch: number = noa.camera.pitch;
        const physState = noa.entities.getPhysics(playerEnt);
        const onGround = physState?.body?.resting?.[1] === -1;
        const velocityY = Number(physState?.body?.velocity?.[1] ?? 0);
        const inputState = noa.inputs.state;
        const playerMoving =
          !!inputState.forward ||
          !!inputState.backward ||
          !!inputState.left ||
          !!inputState.right;

        if (nowPerf - lastAmbientSampleAt > 1200) {
          lastAmbientSampleAt = nowPerf;
          const column = sampleBiomeColumn(Math.floor(pos[0]), Math.floor(pos[2]), seed);
          audio.updateAmbient(column.biomeId);
          const nextWeather = precipitationKindForColumn(column);
          setWeatherKind((prev) => (prev === nextWeather ? prev : nextWeather));
        }

        if (onGround && playerMoving && !inventoryOpenRef.current) {
          const velocity = physState?.body?.velocity ?? [0, 0, 0];
          const horizontalSpeed = Math.hypot(
            Number(velocity[0] ?? 0),
            Number(velocity[2] ?? 0)
          );
          const strideMs =
            horizontalSpeed > VOXEL_MOVEMENT.fastStrideSpeed
              ? VOXEL_MOVEMENT.fastStrideMs
              : VOXEL_MOVEMENT.walkStrideMs;
          if (horizontalSpeed > 0.05 && nowPerf - lastFootstepAt >= strideMs) {
            const bx = Math.floor(pos[0]);
            const bz = Math.floor(pos[2]);
            let by = Math.floor(pos[1] - 0.35);
            let blockBelow = clientBlockAtInt(bx, by, bz);
            if (blockReplaceable(blockBelow) || blockBelow === BLOCK_REGISTRY.WATER) {
              by -= 1;
              blockBelow = clientBlockAtInt(bx, by, bz);
            }
            if (blockBelow !== BLOCK_REGISTRY.AIR && blockBelow !== BLOCK_REGISTRY.WATER) {
              audio.playStep(
                blockSoundGroup(blockBelow),
                horizontalSpeed > VOXEL_MOVEMENT.fastStrideSpeed ? 0.36 : 0.3
              );
              lastFootstepAt = nowPerf;
            }
          }
        }

        heldItemView?.setActiveVisual(currentHeldItemSpec());
        heldItemView?.update({
          now: nowPerf,
          moving: playerMoving,
          visible: noa.camera.zoomDistance <= 0 && !inventoryOpenRef.current && !isTeacherSpectatorRef.current
        });

        if (localPlayerVoxelRoot) {
          setVisualVisible(localPlayerVoxelRoot, noa.camera.zoomDistance > 0 && !isTeacherSpectatorRef.current);
        }
        if (localRig) {
          updateAvatarWalk(localRig, pos[0], pos[2]);
          setAvatarHeadPitch(localRig, pitch);
          setAvatarYaw(localRig, heading);
          advanceAvatarSwing(localRig);
        }
        for (const rig of remoteRigs.values()) {
          advanceAvatarSwing(rig);
        }

        if (
          gameModeRef.current === "survival" &&
          physState?.body &&
          playerIntersectsLadder([pos[0], pos[1], pos[2]])
        ) {
          if (inputState.jump || inputState.forward) {
            physState.body.velocity[1] = VOXEL_MOVEMENT.ladderClimbSpeed;
          } else if (inputState.backward) {
            physState.body.velocity[1] = -VOXEL_MOVEMENT.ladderClimbSpeed;
          } else {
            physState.body.velocity[1] = Math.max(
              physState.body.velocity[1],
              VOXEL_MOVEMENT.ladderSlideSpeed
            );
          }
          if (moveState) {
            moveState._isJumping = false;
            moveState._currjumptime = 0;
          }
        }

        if (gameModeRef.current === "survival") {
          if (!onGround) {
            minAirVelocityY = Math.min(minAirVelocityY, velocityY);
          } else {
            if (
              !lastGrounded &&
              minAirVelocityY < -12 &&
              nowPerf - lastFallImpactAt > 500
            ) {
              lastFallImpactAt = nowPerf;
              void onFallImpactRef.current(minAirVelocityY);
            }
            minAirVelocityY = 0;
          }
          lastGrounded = onGround;
        }

        if (showDebugRef.current) {
          if (nowPerf - lastDebugUpdate > 100) {
            lastDebugUpdate = nowPerf;
            const scene = noa.rendering.getScene();
            const engine = scene.getEngine();
            const fps = engine.getFps();
            setDebugInfo({
              fps,
              pos: [pos[0], pos[1], pos[2]]
            });
          }
        }

        if (isDeadRef.current) return;
        if (nowPerf - lastEmit < 60) return;
        lastEmit = nowPerf;
        onInputRef.current({
          pos: [pos[0], pos[1], pos[2]],
          heading,
          pitch,
          jumping: !onGround,
          t: Date.now(),
          hotbarIndex: survivalSlotRef.current
        });
      });

      cleanupFns.push(() => {
        flushFpsReports();
      });

      cleanupFns.push(() => {
        try {
          noa.dispose?.();
        } catch {
          // noa<0.34 didn't expose dispose; the engine GCs when host detaches.
        }
      });

      // Roster reserved for future name-label rendering — keep ref so unused-var lint is happy.
      void roster;
    })();

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
      noaRef.current = null;
      remoteEntitiesRef.current.clear();
    };
  }, [seed]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noa: any = noaRef.current;
    noa?.setPaused?.(paused || isDead);
    audioManagerRef.current?.setMuted(paused || isDead);
    if (paused || isDead) heldItemViewRef.current?.setVisible(false);
  }, [paused, isDead]);

  const survivalVitalsHud = (
    <SurvivalVitalsHud
      gameMode={gameMode}
      paused={paused}
      isTeacherSpectator={isTeacherSpectator}
      localVitals={localVitals}
    />
  );

  const blockHotbarHud = (
    <BlockHotbarHud
      gameMode={gameMode}
      paused={paused}
      isTeacherSpectator={isTeacherSpectator}
      selectedBlock={selectedBlockRef.current}
      creativeSlotIdx={creativeSlotIdx}
      survivalSlot={survivalSlot}
      inventorySlots={inventorySlots}
    />
  );

  const invDraggable = gameMode === "survival" && inventoryOpen;

  const slotDragHandlers = (region: InventoryRegion, index: number) => ({
    draggable: invDraggable,
    onDragStart: (e: DragEvent<HTMLDivElement>) => {
      if (!invDraggable) return;
      e.dataTransfer.setData(
        INV_DRAG_MIME,
        JSON.stringify({ from: region, fromIndex: index })
      );
      e.dataTransfer.effectAllowed = "move";
      const img = e.currentTarget.querySelector("img");
      if (img) {
        const canvas = document.createElement("canvas");
        const size = Math.max(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            img,
            (size - img.width) / 2,
            (size - img.height) / 2,
            img.width,
            img.height
          );
        }
        e.dataTransfer.setDragImage(canvas as unknown as Element, canvas.width / 2, canvas.height / 2);
      }
    },
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      if (!invDraggable) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      if (!invDraggable) return;
      e.preventDefault();
      const raw = e.dataTransfer.getData(INV_DRAG_MIME);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (isValidDragPayload(parsed)) {
          const move = {
            from: parsed.from,
            fromIndex: parsed.fromIndex,
            to: region,
            toIndex: index
          };
          if (move.from === "chest" || move.to === "chest") {
            onChestMove(move);
          } else {
            onInventoryMove(move);
          }
        } else {
          console.warn("Malformed drag-and-drop payload:", parsed);
        }
      } catch (err) {
        console.warn("Invalid drag-and-drop payload:", err);
      }
    }
  });

  const craftPreview =
    gameMode === "survival"
      ? craftingGridPreview(
          craftingGridSlots,
          inventorySlots,
          itemInventorySlots,
          craftingGridWidth
        )
      : null;
  const craftGridIndices =
    craftingGridWidth === 3
      ? Array.from({ length: CRAFTING_GRID_SLOTS }, (_, i) => i)
      : [...PERSONAL_CRAFTING_SLOT_INDICES];
  const craftGridClass = [
    "grid gap-1 rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.18)] p-1.5",
    craftingGridWidth === 3 ? "grid-cols-3" : "grid-cols-2"
  ].join(" ");
  const craftGridTitle = `רשת יצירה ${craftingGridWidth}×${craftingGridWidth}`;

  const inventoryPanel = inventoryOpen ? (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[2px]">
      <div
        className="max-h-[min(92vh,720px)] w-[min(96vw,640px)] overflow-y-auto rounded-sm border-[3px] border-[#1e1e1e] bg-gradient-to-b from-[#d4c5a8] via-[#bfb196] to-[#a89274] px-4 py-3 text-[#2f261c] shadow-[0_20px_50px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.35)] sm:px-6 sm:py-4"
        dir="rtl"
      >
        <div className="mb-3 flex items-start justify-between gap-3 border-b-2 border-[#8a7a62] pb-2.5">
          <div>
            <div className="text-base font-black tracking-tight text-[#1f1810] sm:text-lg">
              מלאי
            </div>
            <div className="mt-0.5 text-[10px] font-semibold text-[#4a3f30] sm:text-[11px]">
              לחץ E או כפתור סגירה כדי לחזור למשחק
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded border-2 border-[#3d3d3d] bg-gradient-to-b from-[#a89a86] to-[#8c7d68] px-3 py-1.5 text-xs font-bold text-[#1a1510] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_0_#2a2418] hover:brightness-105 active:translate-y-px active:shadow-none"
            onClick={closeInventory}
          >
            ✕ סגור
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {gameMode === "survival" ? (
            <section
              className="rounded-sm border-2 border-[#6b5e4b] bg-[rgba(0,0,0,0.12)] p-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]"
              aria-label="יצירה"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#2a2218]">
                  יצירה ({craftingGridWidth}×{craftingGridWidth})
                </div>
                <button
                  type="button"
                  className="rounded border-2 border-[#5c4f3e] bg-[#c9bda8] px-2 py-1 text-[10px] font-bold text-[#1a1510] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-[#ddd2be]"
                  onClick={() => setRecipeBookOpen(true)}
                >
                  ספר מתכונים
                </button>
              </div>
              <p className="mb-2 text-[10px] font-semibold leading-snug text-[#4a3f30]">
                גרור פריטים בשביל ליצור פריטים חדשים!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4" dir="ltr">
                <div className={craftGridClass} title={craftGridTitle}>
                  {craftGridIndices.map((i) => {
                    const cell = craftingGridSlots[i] ?? EMPTY_CRAFTING_SLOT;
                    const itemIcon =
                      cell.itemId > 0 && cell.count > 0 ? ITEM_ICON[cell.itemId] : undefined;
                    const blockIcon =
                      cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0
                        ? BLOCK_HOTBAR_ICON[cell.blockId]
                        : undefined;
                    return (
                      <div
                        key={`craft-${i}`}
                        className={mcSlotClass(false)}
                        {...slotDragHandlers("craft", i)}
                      >
                        {itemIcon ? (
                          <>
                            <img
                              src={itemIcon}
                              alt=""
                              title={`${ITEM_HUD[cell.itemId] ?? cell.itemId} ×${cell.count}`}
                              className="h-8 w-8"
                              style={{ imageRendering: "pixelated" }}
                            />
                            {toolDurabilityBar(cell.itemId, cell.durability)}
                            {cell.count > 1 ? (
                              <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                {cell.count}
                              </span>
                            ) : null}
                          </>
                        ) : blockIcon ? (
                          <>
                            <img
                              src={blockIcon}
                              alt=""
                              title={`${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`}
                              className="h-8 w-8"
                              style={{ imageRendering: "pixelated" }}
                            />
                            {cell.count > 1 ? (
                              <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                {cell.count}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="select-none text-2xl font-black text-[#3d3426]" aria-hidden>
                  →
                </div>
                <button
                  type="button"
                  disabled={!craftPreview}
                  title={
                    craftPreview
                      ? craftPreview.outputKind === "block"
                        ? `${BLOCK_HUD[craftPreview.outputId] ?? craftPreview.outputId} ×${craftPreview.count}`
                        : `${ITEM_HUD[craftPreview.outputId] ?? craftPreview.outputId} ×${craftPreview.count}`
                      : "אין מתכון תקף או אין מקום בפריטים"
                  }
                  className={[
                    mcSlotClass(false),
                    "h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14",
                    craftPreview
                      ? "cursor-pointer hover:brightness-110 active:brightness-95"
                      : "cursor-not-allowed opacity-45"
                  ].join(" ")}
                  onClick={() => {
                    audioManagerRef.current?.playCraft();
                    onCraft("grid");
                  }}
                >
                  {craftPreview ? (
                    <>
                      <img
                        src={
                          craftPreview.outputKind === "block"
                            ? BLOCK_HOTBAR_ICON[craftPreview.outputId]
                            : ITEM_ICON[craftPreview.outputId]
                        }
                        alt=""
                        className="h-9 w-9"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[11px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                        ×{craftPreview.count}
                      </span>
                    </>
                  ) : null}
                </button>
              </div>
            </section>
          ) : null}

          {gameMode === "survival" && activeChest ? (
            <section>
              <div className="mb-1.5 text-[11px] font-black text-[#2a2218]">
                תיבה
              </div>
              <div className="inline-block rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.15)] p-1.5">
                <div className="grid grid-cols-9 gap-1">
                  {activeChest.slots.slice(0, 27).map((cell, i) => {
                    const itemIcon =
                      (cell.itemId ?? 0) > 0 && cell.count > 0
                        ? ITEM_ICON[cell.itemId]
                        : undefined;
                    const blockIcon =
                      cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0
                        ? BLOCK_HOTBAR_ICON[cell.blockId]
                        : undefined;
                    const icon = itemIcon ?? blockIcon;
                    const has = cell.count > 0 && icon !== undefined;
                    return (
                      <div
                        key={`chest-${i}`}
                        className={mcSlotClass(false)}
                        {...slotDragHandlers("chest", i)}
                      >
                        {has ? (
                          <>
                            <img
                              src={icon}
                              alt=""
                              title={
                                itemIcon
                                  ? `${ITEM_HUD[cell.itemId] ?? cell.itemId} ×${cell.count}`
                                  : `${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`
                              }
                              className="h-8 w-8"
                              style={{ imageRendering: "pixelated" }}
                            />
                            {itemIcon
                              ? toolDurabilityBar(cell.itemId, cell.durability)
                              : null}
                            <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                              {cell.count}
                            </span>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {gameMode === "creative" ? (
            <section>
              <div className="mb-1.5 text-[11px] font-black text-[#2a2218]">
                לוח בלוקים יצירתי
              </div>
              <div className="rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.15)] p-2">
                <div className="grid grid-cols-6 gap-1 sm:grid-cols-9">
                  {HOTBAR.map((blockId) => {
                    const selected = blockId === selectedBlockRef.current;
                    return (
                      <button
                        key={blockId}
                        type="button"
                        className={[
                          mcSlotClass(selected),
                          "h-11 w-11 cursor-pointer hover:brightness-110"
                        ].join(" ")}
                        title={BLOCK_HUD[blockId] ?? String(blockId)}
                        onClick={() => selectCreativeBlock(blockId)}
                      >
                        <img
                          src={BLOCK_HOTBAR_ICON[blockId]}
                          alt=""
                          className="h-9 w-9"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <>
              <section>
                <div className="mb-1.5 text-[11px] font-black text-[#2a2218]">
                  ציוד
                </div>
                <div className="inline-block rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.15)] p-1.5">
                  <div className="grid grid-cols-4 gap-1 sm:grid-cols-1">
                    {equipmentSlots.slice(0, EQUIPMENT_SLOT_COUNT).map((cell, i) => {
                      const icon = ITEM_ICON[cell.itemId];
                      const has = cell.itemId !== 0 && cell.count > 0 && icon;
                      return (
                        <div
                          key={`equipment-${i}`}
                          className={mcSlotClass(false)}
                          title={EQUIPMENT_SLOT_LABELS[i] ?? ""}
                          {...slotDragHandlers("equipment", i)}
                        >
                          {has ? (
                            <>
                              <img
                                src={icon}
                                alt=""
                                title={`${EQUIPMENT_SLOT_LABELS[i] ?? ""}: ${
                                  ITEM_HUD[cell.itemId] ?? cell.itemId
                                }`}
                                className="h-8 w-8"
                                style={{ imageRendering: "pixelated" }}
                              />
                              {toolDurabilityBar(cell.itemId, cell.durability)}
                            </>
                          ) : (
                            <span className="pointer-events-none text-[9px] font-black text-[#33291d]/70">
                              {EQUIPMENT_SLOT_LABELS[i]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-1.5 text-[11px] font-black text-[#2a2218]">
                  אחסון פריטים
                </div>
                <div className="inline-block rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.15)] p-1.5">
                  <div className="grid grid-cols-9 gap-1">
                    {itemInventorySlots.slice(0, MAIN_ITEM_INVENTORY_SLOTS).map((cell, i) => {
                      const icon = ITEM_ICON[cell.itemId];
                      const has = cell.itemId !== 0 && cell.count > 0 && icon;
                      return (
                        <div
                          key={i}
                          className={mcSlotClass(false)}
                          {...slotDragHandlers("storage", i)}
                        >
                          {has ? (
                            <>
                              <img
                                src={icon}
                                alt=""
                                title={`${ITEM_HUD[cell.itemId] ?? cell.itemId} ×${cell.count}`}
                                className="h-8 w-8"
                                style={{ imageRendering: "pixelated" }}
                              />
                              {toolDurabilityBar(cell.itemId, cell.durability)}
                              <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                {cell.count}
                              </span>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-1.5 text-[11px] font-black text-[#2a2218]">
                  סרגל חם
                </div>
                <div className="inline-block rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.15)] p-1.5">
                  <div className="grid grid-cols-9 gap-1">
                    {inventorySlots.slice(0, 9).map((cell, i) => {
                      const itemIcon =
                        (cell.itemId ?? 0) > 0 && cell.count > 0
                          ? ITEM_ICON[cell.itemId]
                          : undefined;
                      const blockIcon =
                        cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0
                          ? BLOCK_HOTBAR_ICON[cell.blockId]
                          : undefined;
                      const icon = itemIcon ?? blockIcon;
                      const has = cell.count > 0 && icon !== undefined;
                      return (
                        <div
                          key={i}
                          className={mcSlotClass(i === survivalSlot)}
                          {...slotDragHandlers("hotbar", i)}
                        >
                          {has ? (
                            <>
                              <img
                                src={icon}
                                alt=""
                                title={
                                  itemIcon
                                    ? `${ITEM_HUD[cell.itemId] ?? cell.itemId} ×${cell.count}`
                                    : `${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`
                                }
                                className="h-8 w-8"
                                style={{ imageRendering: "pixelated" }}
                              />
                              {itemIcon
                                ? toolDurabilityBar(cell.itemId, cell.durability)
                                : null}
                              <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                {cell.count}
                              </span>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const recipeBookOverlay =
    inventoryOpen && gameMode === "survival" && recipeBookOpen ? (
      <div
        className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-black/55 p-3"
        onClick={() => setRecipeBookOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voxel-recipe-book-title"
      >
        <div
          className="h-[min(86vh,520px)] w-[min(94vw,440px)] flex flex-col rounded-sm border-[3px] border-[#1e1e1e] bg-gradient-to-b from-[#ebe1cf] via-[#d9ccb8] to-[#c0b09a] p-4 text-[#1f1810] shadow-[0_16px_40px_rgba(0,0,0,0.85)]"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 flex items-start justify-between gap-2 pb-1">
            <h2
              id="voxel-recipe-book-title"
              className="text-sm font-black leading-tight text-[#1a1510] sm:text-base"
            >
              ספר המתכונים
            </h2>
            <button
              type="button"
              className="shrink-0 rounded border-2 border-[#3d3d3d] bg-gradient-to-b from-[#c4b8a6] to-[#9e907e] px-2 py-1 text-xs font-bold text-[#1a1510] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-105"
              onClick={() => setRecipeBookOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="mb-4 flex items-end justify-between gap-1 border-b-[3px] border-[#3d3d3d] px-1" dir="rtl">
            <button
              type="button"
              className={`flex flex-col items-center justify-center rounded-t-md px-2 py-1.5 border-t-[3px] border-x-[3px] transition-all flex-1 ${
                recipeTab === "all"
                  ? "border-[#3d3d3d] bg-[#d9ccb8] -mb-[3px] z-10 pb-2.5 pt-2"
                  : "border-transparent bg-black/5 hover:bg-black/10 pb-1.5 opacity-70 hover:opacity-100"
              }`}
              onClick={() => setRecipeTab("all")}
              title="הכל"
            >
              <img
                src="/minecraft-assets/item/compass_00.png"
                alt="הכל"
                className="h-6 w-6"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-[9px] font-black mt-0.5 whitespace-nowrap">הכל</span>
            </button>
            <button
              type="button"
              className={`flex flex-col items-center justify-center rounded-t-md px-2 py-1.5 border-t-[3px] border-x-[3px] transition-all flex-1 ${
                recipeTab === "tools"
                  ? "border-[#3d3d3d] bg-[#d9ccb8] -mb-[3px] z-10 pb-2.5 pt-2"
                  : "border-transparent bg-black/5 hover:bg-black/10 pb-1.5 opacity-70 hover:opacity-100"
              }`}
              onClick={() => setRecipeTab("tools")}
              title="כלים ונשק"
            >
              <img
                src="/minecraft-assets/item/iron_axe.png"
                alt="כלים ונשק"
                className="h-6 w-6"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-[9px] font-black mt-0.5 whitespace-nowrap">כלים ונשק</span>
            </button>
            <button
              type="button"
              className={`flex flex-col items-center justify-center rounded-t-md px-2 py-1.5 border-t-[3px] border-x-[3px] transition-all flex-1 ${
                recipeTab === "building"
                  ? "border-[#3d3d3d] bg-[#d9ccb8] -mb-[3px] z-10 pb-2.5 pt-2"
                  : "border-transparent bg-black/5 hover:bg-black/10 pb-1.5 opacity-70 hover:opacity-100"
              }`}
              onClick={() => setRecipeTab("building")}
              title="חומרי בנייה"
            >
              <img
                src="/minecraft-assets/block/bricks.png"
                alt="חומרי בנייה"
                className="h-6 w-6"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-[9px] font-black mt-0.5 whitespace-nowrap">בנייה</span>
            </button>
            <button
              type="button"
              className={`flex flex-col items-center justify-center rounded-t-md px-2 py-1.5 border-t-[3px] border-x-[3px] transition-all flex-1 ${
                recipeTab === "food_misc"
                  ? "border-[#3d3d3d] bg-[#d9ccb8] -mb-[3px] z-10 pb-2.5 pt-2"
                  : "border-transparent bg-black/5 hover:bg-black/10 pb-1.5 opacity-70 hover:opacity-100"
              }`}
              onClick={() => setRecipeTab("food_misc")}
              title="אוכל ושונות"
            >
              <img
                src="/minecraft-assets/item/lava_bucket.png"
                alt="אוכל ושונות"
                className="h-6 w-6"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-[9px] font-black mt-0.5 whitespace-nowrap">אוכל ושונות</span>
            </button>
          </div>

          <ul className="space-y-3 text-[11px] font-semibold text-[#2a2218] flex-1 overflow-y-auto pl-1">
            {(() => {
              const filteredRecipes = RECIPES.filter((recipe) => {
                if (recipeTab === "all") {
                  const combinedInventory = [
                    ...inventorySlots.map((slot) => ({
                      blockId: slot.blockId,
                      itemId: slot.itemId,
                      count: slot.count
                    })),
                    ...itemInventorySlots.map((slot) => ({
                      blockId: 0,
                      itemId: slot.itemId,
                      count: slot.count
                    })),
                    ...craftingGridSlots.map((slot) => ({
                      blockId: slot.blockId,
                      itemId: slot.itemId,
                      count: slot.count
                    })),
                    ...equipmentSlots.map((slot) => ({
                      blockId: 0,
                      itemId: slot.itemId,
                      count: slot.count
                    }))
                  ];
                  return canCraftRecipe(recipe, combinedInventory);
                }
                return getRecipeCategory(recipe) === recipeTab;
              });

              if (filteredRecipes.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-xs font-bold text-[#4a3f30]">
                    <span className="mb-2 text-2xl">🔍</span>
                    <span>אין מתכונים זמינים לייצור כרגע</span>
                    <span className="text-[10px] font-medium opacity-75 mt-1">אסוף עוד חומרים כדי לפתוח מתכונים חדשים!</span>
                  </div>
                );
              }

              return filteredRecipes.map((recipe) => {
                const output = recipeOutputDisplay(recipe);
                return (
                  <li
                    key={recipe.key}
                    className="rounded border border-[#6b5e4b] bg-black/10 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-black">{output.label}</div>
                      <div className="text-[10px] font-black text-[#4a3f30]">
                        {recipe.kind === "shaped" ? "מסודר" : "חופשי"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3" dir="ltr">
                      {recipeBookInputGrid(recipe)}
                      <span className="text-lg font-black text-[#3d3426]">→</span>
                      <div className="flex items-center gap-1">
                        <div className="flex h-8 w-8 items-center justify-center border-2 border-[#2a2a2a] bg-[#8d8d8d] shadow-[inset_1px_1px_0_rgba(255,255,255,0.4),inset_-1px_-1px_0_rgba(0,0,0,0.25)]">
                          <img
                            src={output.icon}
                            alt=""
                            title={output.label}
                            className="h-6 w-6"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-[#1a1510]">
                          ×{recipe.output.count}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              });
            })()}
          </ul>
        </div>
      </div>
    ) : null;

  const helpButton =
    gameMode === "survival" && !paused && !isDead ? (
      <div className="absolute left-4 top-4 z-20">
        <style>{`
          @keyframes help-button-pulse-glow {
            0%, 100% {
              box-shadow: 0 0 0 0px rgba(255, 215, 0, 0.8);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(255, 215, 0, 0);
            }
          }
          .help-btn-pulse {
            animation: help-button-pulse-glow 1.2s infinite ease-in-out;
          }
        `}</style>
        <button
          type="button"
          onClick={() => {
            setHelpOpen((prev) => {
              const next = !prev;
              if (next) {
                setInventoryOpen(false);
                setChatOpen(false);
                onChatExpandedChange?.(false);
                
                document.exitPointerLock?.();
                const noa: any = noaRef.current;
                if (noa) {
                  noa.inputs.disabled = true;
                }
                setHelpPulse(false);
              } else {
                const noa: any = noaRef.current;
                if (noa) {
                  noa.inputs.disabled = false;
                  setTimeout(() => {
                    noa.container.element?.requestPointerLock?.();
                  }, 50);
                }
              }
              return next;
            });
          }}
          className={`rounded-sm border-2 border-[#5c4f3e] bg-gradient-to-b from-[#a89a86] to-[#8c7d68] px-3.5 py-1.5 text-xs font-black text-[#1a1510] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_0_#2a2418] hover:brightness-105 active:translate-y-px active:shadow-none transition-all ${
            helpPulse ? "help-btn-pulse !border-[#ffd700]" : ""
          }`}
        >
          עזרה (H)
        </button>
      </div>
    ) : null;

  const helpSidebar =
    helpOpen && gameMode === "survival" ? (
      <div className="pointer-events-auto absolute left-0 top-0 bottom-0 z-50 flex h-full w-[min(96vw,380px)] flex-col border-r-[3px] border-[#1e1e1e] bg-gradient-to-b from-[#d4c5a8] via-[#bfb196] to-[#a89274] px-4 py-3 text-[#2f261c] shadow-[10px_0_30px_rgba(0,0,0,0.7),inset_1px_0_0_rgba(255,255,255,0.35)] sm:px-5 sm:py-4 animate-in slide-in-from-left duration-200" dir="rtl">
        <div className="mb-2 flex items-start justify-between gap-3 border-b-2 border-[#8a7a62] pb-1.5">
          <div>
            <div className="text-base font-black tracking-tight text-[#1f1810]">
              מדריך הישרדות
            </div>
            <div className="text-[9px] font-semibold text-[#4a3f30]">
              לחצו H או כפתור סגירה כדי לחזור
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded border-2 border-[#3d3d3d] bg-gradient-to-b from-[#a89a86] to-[#8c7d68] px-2.5 py-1 text-[11px] font-bold text-[#1a1510] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_0_#2a2418] hover:brightness-105 active:translate-y-px active:shadow-none"
            onClick={() => {
              setHelpOpen(false);
              const noa: any = noaRef.current;
              if (noa) {
                noa.inputs.disabled = false;
                setTimeout(() => {
                  noa.container.element?.requestPointerLock?.();
                }, 50);
              }
            }}
          >
            ✕ סגור
          </button>
        </div>

        <div className="flex flex-wrap gap-1 mb-3 pb-2 border-b border-[#8a7a62]/40">
          {SURVIVAL_HELP_TABS.map((tab) => {
            const active = helpTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHelpTab(tab.id)}
                className={`px-2.5 py-1 text-[10px] font-black rounded border-2 transition-all ${
                  active
                    ? "border-[#1a1510] bg-[#1a1510] text-[#ffd700]"
                    : "border-[#5c4f3e] bg-[#c9bda8] text-[#2f261c] hover:bg-[#ddd2be]"
                }`}
              >
                {tab.title}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 text-right font-sans custom-scrollbar select-text space-y-3 pb-2">
          {(() => {
            const currentTabObj = SURVIVAL_HELP_TABS.find((t) => t.id === helpTab);
            return currentTabObj?.sections.map((section, idx) => (
              <div
                key={idx}
                className="rounded-sm border-2 border-[#6b5e4b] bg-[rgba(0,0,0,0.12)] p-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)]"
              >
                {section.heading && (
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#1a1510] mb-1.5 pb-0.5 border-b border-[#8a7a62]/30">
                    {section.heading}
                  </h3>
                )}
                <div className="space-y-1.5 text-[10.5px] font-semibold leading-relaxed text-[#3d3122]">
                  {section.paragraphs.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    ) : null;

  const damageOverlay =
    damageFlash > 0 ? (
      <div
        className="pointer-events-none absolute inset-0 bg-red-600/20"
        aria-hidden
      />
    ) : null;

  const weatherOverlay = (() => {
    if (paused || weatherKind === "clear") return null;
    const isRain = weatherKind === "rain";
    const count = isRain ? 72 : 48;
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <style>{`
          @keyframes voxel-rain-fall {
            0% { opacity: 0; transform: translate3d(0, -18vh, 0) rotate(12deg); }
            12% { opacity: 1; }
            100% { opacity: 0; transform: translate3d(-14vw, 118vh, 0) rotate(12deg); }
          }
          @keyframes voxel-snow-fall {
            0% { opacity: 0; transform: translate3d(0, -12vh, 0); }
            14% { opacity: 0.95; }
            100% { opacity: 0; transform: translate3d(8vw, 112vh, 0); }
          }
        `}</style>
        {Array.from({ length: count }, (_, i) => {
          const left = (i * 37) % 100;
          const delay = -(((i * 137) % 2400) / 1000);
          const duration = isRain ? 0.78 + (i % 5) * 0.05 : 3.8 + (i % 7) * 0.32;
          return (
            <span
              key={i}
              className={
                isRain
                  ? "absolute top-[-12%] h-14 w-px bg-sky-100/55 mix-blend-screen"
                  : "absolute top-[-8%] h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.7)]"
              }
              style={{
                left: `${left}%`,
                animationName: isRain ? "voxel-rain-fall" : "voxel-snow-fall",
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                animationIterationCount: "infinite",
                animationTimingFunction: "linear"
              }}
            />
          );
        })}
      </div>
    );
  })();

  const blastOverlay =
    blastFlash > 0 ? (
      <div
        className="pointer-events-none absolute inset-0 bg-orange-200/20"
        aria-hidden
      />
    ) : null;

  const debugOverlay = debugInfo ? (
    <div
      className="pointer-events-none absolute left-3 top-16 z-[100] flex flex-col gap-1 rounded-sm border-2 border-[#5c4f3e]/80 bg-neutral-950/75 p-2 px-3 font-mono text-[10px] text-neutral-100 shadow-[0_8px_16px_rgba(0,0,0,0.6)] sm:text-xs"
    >
      <div className="font-bold text-[#ffd700]">Monecraft Debug</div>
      <div>FPS: {Math.round(debugInfo.fps)}</div>
      <div>X: {debugInfo.pos[0].toFixed(2)}</div>
      <div>Y: {debugInfo.pos[1].toFixed(2)}</div>
      <div>Z: {debugInfo.pos[2].toFixed(2)}</div>
    </div>
  ) : null;

  const deathOverlay = isDead ? (
    <div className="pointer-events-auto absolute inset-0 z-[101] flex flex-col items-center justify-center bg-red-950/70 backdrop-blur-[2px] transition-all duration-300">
      <h1 className="mb-2 text-4xl font-black tracking-wider text-red-500 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] sm:text-6xl animate-pulse">
        מתת!
      </h1>
      <p className="mb-8 text-sm font-bold text-red-200/90 drop-shadow-md sm:text-base">
        You Died!
      </p>
      <button
        type="button"
        className="pointer-events-auto transform rounded-md border-2 border-red-500 bg-gradient-to-b from-red-600 to-red-800 px-6 py-2.5 text-sm font-black text-white shadow-[0_4px_0_#4c0505,0_8px_16px_rgba(0,0,0,0.4)] transition-all hover:scale-105 hover:brightness-110 active:translate-y-px active:shadow-[0_2px_0_#4c0505]"
        onClick={() => {
          setIsDead(false);
          setLocalVitals((prev) => ({ ...prev, health: 20 }));
          if (hostRef.current) {
            hostRef.current.focus();
            const noa: any = noaRef.current;
            noa?.container?.element?.requestPointerLock?.();
          }
        }}
      >
        היוולד מחדש / Respawn
      </button>
    </div>
  ) : null;

  const onTeleport = (pos: [number, number, number]) => {
    const noa: any = noaRef.current;
    if (noa) {
      noa.entities.setPosition(noa.playerEntity, [
        pos[0] + 0.5,
        pos[1] + 1.2,
        pos[2] + 0.5
      ]);
      audioManagerRef.current?.playSwing();
    }
  };

  const chatOverlay = (
    <ChatOverlay
      chatOpen={chatOpen}
      chatPosition={chatPosition}
      chatLines={chatLines}
      canSendChat={!!canSendChat}
      typedMessage={typedMessage}
      setTypedMessage={setTypedMessage}
      onClearSessionChat={onClearSessionChat}
      onSoftDeleteChatMessage={onSoftDeleteChatMessage}
      handleDragStart={handleDragStart}
      handleCloseChat={handleCloseChat}
      chatScrollRef={chatScrollRef}
      chatInputRef={chatInputRef}
      handleInputKeyDown={handleInputKeyDown}
      handleInputKeyUp={handleInputKeyUp}
      handleSendMessage={handleSendMessage}
    />
  );

  const teacherDashboard = (
    <TeacherDashboard
      isTeacher={isTeacher}
      isTeacherSpectator={isTeacherSpectator}
      setIsTeacherSpectator={setIsTeacherSpectator}
      playersList={playersList}
      onTeleport={onTeleport}
      onSwitchTeacherMode={onSwitchTeacherMode}
    />
  );

  const getPlayerDistanceAndOcclusion = (playerPos: [number, number, number]) => {
    const noa: any = noaRef.current;
    if (!noa) return { distance: 0, solidBlocks: 0 };
    const myPos = noa.entities.getPosition(noa.playerEntity) as number[];
    if (!myPos) return { distance: 0, solidBlocks: 0 };
    
    const dx = playerPos[0] - myPos[0];
    const dy = playerPos[1] - myPos[1];
    const dz = playerPos[2] - myPos[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Check occlusion
    const solidBlocks = countSolidBlocksBetween(noa, myPos as [number, number, number], playerPos);
    return { distance, solidBlocks };
  };

  const voiceWidget = (
    <VoiceWidget
      mutedByHostReason={mutedByHostReason}
      voiceWidgetExpanded={voiceWidgetExpanded}
      setVoiceWidgetExpanded={setVoiceWidgetExpanded}
      activeRoom={activeRoom as any}
      showVoiceSettings={showVoiceSettings}
      setShowVoiceSettings={setShowVoiceSettings}
      selectedDevice={selectedDevice}
      changeAudioOutput={changeAudioOutput}
      audioDevices={audioDevices}
      micEnabled={micEnabled}
      activeSpeakers={activeSpeakers}
      myUserId={myUserId}
      toggleMute={toggleMute}
      iAmHost={iAmHost}
      muteAll={muteAll}
      playersList={playersList}
      getPlayerDistanceAndOcclusion={getPlayerDistanceAndOcclusion}
    />
  );

  return (
    <div className="absolute inset-0">
      <div
        ref={hostRef}
        className="absolute inset-0 outline-none"
        tabIndex={0}
        aria-label="minecraft viewport"
      />
      {weatherOverlay}
      {helpButton}
      {helpSidebar}
      {debugOverlay}
      {deathOverlay}
      {blastOverlay}
      {damageOverlay}
      {survivalVitalsHud}
      {blockHotbarHud}
      {inventoryPanel}
      {recipeBookOverlay}
      {chatOverlay}
      {teacherDashboard}
      {voiceWidget}
    </div>
  );
}
