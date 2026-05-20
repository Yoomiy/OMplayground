import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import {
  BLOCK_REGISTRY,
  ITEM_REGISTRY,
  ITEM_ICON,
  MAIN_ITEM_INVENTORY_SLOTS,
  PLACEABLE_BLOCK_IDS,
  CRAFTING_GRID_SLOTS,
  EQUIPMENT_SLOT_COUNT,
  type BlockDelta,
  type CraftingGridSlot,
  type GameMode,
  type HotbarSlot,
  type InputReq,
  type InventoryRegion,
  type InventoryMoveReq,
  type ItemSlot,
  type CraftingGridWidth,
  type RoomPlayerInfo,
  type RoomSnapshot,
  type Vec3,
  type BreakStartAck,
  type SimpleAck,
  type WorldDrop,
  type WorldDropWireDelta
} from "@/lib/voxelProtocol";
import {
  isInstantBreak,
  itemMaxDurability,
  MC_MATERIAL_ENTRIES,
  NOA_BLOCK_ENTRIES,
  PLANT_SPRITE_BLOCK_IDS,
  proceduralVoxelID
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
  createAvatarRig,
  setAvatarHeadPitch,
  setAvatarYaw,
  setAvatarYawSmoothed,
  updateAvatarWalk,
  type AvatarRig
} from "@/games/voxel/voxelAvatarAnimation";
import { overrideObjectMesher } from "@/games/voxel/voxelObjectMesher";
import {
  createBreakCrackOverlay,
  destroyStageIndex,
  type BreakCrackOverlay
} from "@/games/voxel/breakCrackOverlay";

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
const PERSONAL_CRAFTING_SLOT_INDICES = [0, 1, 3, 4] as const;
const EQUIPMENT_SLOT_LABELS = ["ראש", "חזה", "רגל", "נעל"] as const;
const EMPTY_CRAFTING_SLOT: CraftingGridSlot = {
  blockId: BLOCK_REGISTRY.AIR,
  itemId: 0,
  count: 0
};
const DEFAULT_JUMP_FORCE = 12;
const HELIUM_JUMP_FORCE = DEFAULT_JUMP_FORCE * 1.6;
const DEFAULT_MAX_SPEED = 10;
const HEAVY_SHIELD_SPEED_MULT = 0.8;

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
  [BLOCK_REGISTRY.SPRUCE_LEAVES]: "עלי אשוח"
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
  [ITEM_REGISTRY.DIAMOND_AXE]: "גרזן יהלום",
  [ITEM_REGISTRY.SWIFT_PICKAXE]: "מכוש מהיר",
  [ITEM_REGISTRY.IRON_INGOT]: "מטיל ברזל",
  [ITEM_REGISTRY.GOLD_INGOT]: "מטיל זהב",
  [ITEM_REGISTRY.DIAMOND]: "יהלום",
  [ITEM_REGISTRY.COAL]: "פחם",
  [ITEM_REGISTRY.WHEAT]: "חיטה",
  [ITEM_REGISTRY.BREAD]: "לחם",
  [ITEM_REGISTRY.APPLE]: "תפוח",
  [ITEM_REGISTRY.HEAVY_SHIELD]: "מגן כבד",
  [ITEM_REGISTRY.FEATHER_FALLING_TALISMAN]: "קמע נפילת נוצה",
  [ITEM_REGISTRY.HELIOS_MEDALLION]: "מדליון הליוס",
  [ITEM_REGISTRY.HELIUM_BOOTS]: "מגפי הליום",
  [ITEM_REGISTRY.GLOW_TALISMAN]: "קמע זוהר"
};

function equipmentHas(slots: ItemSlot[], itemId: number): boolean {
  return slots.some((s) => s.itemId === itemId && s.count > 0);
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
  chest: "/minecraft-assets/block/chest.png"
} as const;

/** Item-style icon per block for the hotbar (same assets as terrain). */
const BLOCK_HOTBAR_ICON: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const e of NOA_BLOCK_ENTRIES) {
    m[e.id] = MC_TEX[e.hotbarTextureKey];
  }
  return m;
})();

function registerMcTerrainMaterials(noa: {
  registry: { registerMaterial: (name: string, opts: Record<string, unknown>) => void };
}): void {
  const reg = (name: string, textureURL: string, extra: Record<string, unknown> = {}) => {
    noa.registry.registerMaterial(name, { textureURL, ...extra });
  };
  for (const m of MC_MATERIAL_ENTRIES) {
    const url = MC_TEX[m.textureKey];
    reg(m.name, url, "texHasAlpha" in m && m.texHasAlpha ? { texHasAlpha: true } : {});
  }
}

/** Tiny 2×2 diagram cell for the in-game recipe book (not interactive). */
function recipeDiagramCell(
  key: string,
  kind: "empty" | "log" | "planks"
): JSX.Element {
  const inner =
    kind === "log" ? (
      <img
        src={MC_TEX.oakLog}
        alt=""
        className="h-6 w-6"
        style={{ imageRendering: "pixelated" }}
      />
    ) : kind === "planks" ? (
      <img
        src={BLOCK_HOTBAR_ICON[BLOCK_REGISTRY.OAK_PLANKS]}
        alt=""
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
  onInventoryMove: (req: InventoryMoveReq) => void;
  onCraft: (recipeId: string) => void;
  onOpenCraftingTable: (pos: Vec3) => Promise<SimpleAck>;
  onCloseCraftingTable: () => Promise<SimpleAck>;
  onInput: (input: InputReq) => void;
  onBlockPlace: (pos: Vec3, blockId: number) => void;
  onBlockBreak: (pos: Vec3) => void;
  /** Survival timed mining (hold LMB). */
  onBreakStart: (pos: Vec3) => Promise<BreakStartAck>;
  onBreakFinish: (pos: Vec3) => Promise<SimpleAck>;
  onBreakCancel: (pos: Vec3) => void;
  /** Survival: server validates and spawns a world drop. */
  onDropHotbarSlot?: (hotbarIndex: number) => void;
  registerSnapshotListener: (cb: (snap: RoomSnapshot) => void) => () => void;
  registerBlockDeltaListener: (cb: (delta: BlockDelta) => void) => () => void;
  /** World stacks present on join (survival). */
  initialWorldDrops: WorldDrop[];
  registerWorldDropSpawned: (cb: (drop: WorldDrop) => void) => () => void;
  registerWorldDropRemoved: (cb: (id: string) => void) => () => void;
  /** ~5 Hz server WORLD_DROP_UPDATE for survival stack motion. */
  registerWorldDropUpdated: (
    cb: (updates: WorldDropWireDelta[]) => void
  ) => () => void;
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
    onInventoryMove,
    onCraft,
    onOpenCraftingTable,
    onCloseCraftingTable,
    onInput,
    onBlockPlace,
    onBlockBreak,
    onBreakStart,
    onBreakFinish,
    onBreakCancel,
    onDropHotbarSlot,
    registerSnapshotListener,
    registerBlockDeltaListener,
    initialWorldDrops,
    registerWorldDropSpawned,
    registerWorldDropRemoved,
    registerWorldDropUpdated
  } = props;

  const [survivalSlot, setSurvivalSlot] = useState(0);
  const [creativeSlotIdx, setCreativeSlotIdx] = useState(0);
  const [controlsHintDismissed, setControlsHintDismissed] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [recipeBookOpen, setRecipeBookOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // noa-engine has loose .d.ts typings; lock to any so we don't fight them.
  const noaRef = useRef<unknown>(null);
  const onInputRef = useRef(onInput);
  const onPlaceRef = useRef(onBlockPlace);
  const onBreakRef = useRef(onBlockBreak);
  const onBreakStartRef = useRef(onBreakStart);
  const onBreakFinishRef = useRef(onBreakFinish);
  const onBreakCancelRef = useRef(onBreakCancel);
  const activeMiningRef = useRef<{
    pos: Vec3;
    durationMs: number;
    startedAt: number;
  } | null>(null);
  const miningAnimRef = useRef<number | null>(null);
  const breakCrackRef = useRef<BreakCrackOverlay | null>(null);
  const lastBreakStartAtRef = useRef(0);
  const lastBreakFinishAtRef = useRef(0);
  const breakFinishSentRef = useRef(false);
  const BREAK_START_MIN_MS = 100;
  const BREAK_FINISH_MIN_MS = 100;
  const pausedRef = useRef(paused);
  const gameModeRef = useRef<GameMode>(gameMode);
  const inventoryOpenRef = useRef(inventoryOpen);
  const craftingGridWidthRef = useRef<CraftingGridWidth>(craftingGridWidth);
  const equipmentSlotsRef = useRef<ItemSlot[]>(equipmentSlots);
  const inventoryRef = useRef<HotbarSlot[]>(inventorySlots);
  const remoteEntitiesRef = useRef(new Map<string, number>());
  const selectedBlockRef = useRef<number>(BLOCK_REGISTRY.GRASS);
  const survivalSlotRef = useRef(0);
  const myUserIdRef = useRef<string | null>(myUserId);
  const registerSnapshotListenerRef = useRef(registerSnapshotListener);
  const registerBlockDeltaListenerRef = useRef(registerBlockDeltaListener);
  const registerWorldDropSpawnedRef = useRef(registerWorldDropSpawned);
  const registerWorldDropRemovedRef = useRef(registerWorldDropRemoved);
  const registerWorldDropUpdatedRef = useRef(registerWorldDropUpdated);
  const onDropHotbarSlotRef = useRef(onDropHotbarSlot);
  const onOpenCraftingTableRef = useRef(onOpenCraftingTable);
  const onCloseCraftingTableRef = useRef(onCloseCraftingTable);

  onInputRef.current = onInput;
  onPlaceRef.current = onBlockPlace;
  onBreakRef.current = onBlockBreak;
  onBreakStartRef.current = onBreakStart;
  onBreakFinishRef.current = onBreakFinish;
  onBreakCancelRef.current = onBreakCancel;
  pausedRef.current = paused;
  gameModeRef.current = gameMode;
  inventoryOpenRef.current = inventoryOpen;
  craftingGridWidthRef.current = craftingGridWidth;
  equipmentSlotsRef.current = equipmentSlots;
  inventoryRef.current = inventorySlots;
  survivalSlotRef.current = survivalSlot;
  myUserIdRef.current = myUserId;
  registerSnapshotListenerRef.current = registerSnapshotListener;
  registerBlockDeltaListenerRef.current = registerBlockDeltaListener;
  registerWorldDropSpawnedRef.current = registerWorldDropSpawned;
  registerWorldDropRemovedRef.current = registerWorldDropRemoved;
  registerWorldDropUpdatedRef.current = registerWorldDropUpdated;
  onDropHotbarSlotRef.current = onDropHotbarSlot;
  onOpenCraftingTableRef.current = onOpenCraftingTable;
  onCloseCraftingTableRef.current = onCloseCraftingTable;

  const selectCreativeBlock = (blockId: number): void => {
    if (!PLACEABLE_BLOCK_IDS.includes(blockId)) return;
    selectedBlockRef.current = blockId;
    const idx = HOTBAR.indexOf(blockId);
    if (idx >= 0) setCreativeSlotIdx(idx);
  };

  useEffect(() => {
    if (!inventoryOpen) setRecipeBookOpen(false);
  }, [inventoryOpen]);

  function closeInventory(): void {
    if (craftingGridWidthRef.current === 3) {
      void onCloseCraftingTableRef.current();
    }
    setInventoryOpen(false);
  }

  useEffect(() => {
    if (gameMode !== "creative") return;
    const idx = HOTBAR.indexOf(selectedBlockRef.current as (typeof HOTBAR)[number]);
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
        chunkAddDistance: [3, 3],
        chunkRemoveDistance: [4, 4]
      } as Record<string, unknown>);
      
      // Override default ThinInstance ObjectMesher with SolidParticleSystem version 
      // (solves the ThinInstance origin shift bug where objects jump to sky)
      overrideObjectMesher(noa);
      
      // Unbind default KeyE from alt-fire (right-click) so pressing E to open inventory doesn't place blocks
      noa.inputs.unbind("alt-fire");
      noa.inputs.bind("alt-fire", "Mouse3");
      
      noaRef.current = noa;
      noa?.setPaused?.(pausedRef.current);

      const gameEl = noa.container.element as HTMLElement;
      const focusGame = (): void => {
        hostRef.current?.focus({ preventScroll: true });
      };
      gameEl.addEventListener("pointerdown", focusGame);
      cleanupFns.push(() => gameEl.removeEventListener("pointerdown", focusGame));

      const deltas = new Map<string, number>();
      for (const [x, y, z, id] of initialDeltas) {
        deltas.set(`${x},${y},${z}`, id);
      }

      const scene = noa.rendering.getScene();
      const defaultAmbient = scene.ambientColor?.clone?.() ?? new Babylon.Color3(0, 0, 0);
      const fullBrightAmbient = new Babylon.Color3(1, 1, 1);
      const breakCrack = createBreakCrackOverlay(Babylon, scene, noa);
      breakCrackRef.current = breakCrack;
      cleanupFns.push(() => {
        breakCrack.dispose();
        breakCrackRef.current = null;
      });
      registerMcTerrainMaterials(noa);

      for (const e of NOA_BLOCK_ENTRIES) {
        if (e.shape === "cube") {
          noa.registry.registerBlock(e.id, {
            material: e.material,
            solid: e.solid,
            opaque: e.opaque,
            fluid: e.fluid
          });
        } else {
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
        }
      }

      noa.blockTargetIdCheck = (id: number): boolean =>
        id !== BLOCK_REGISTRY.AIR && id !== BLOCK_REGISTRY.WATER;

      noa.world.on(
        "worldDataNeeded",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chunkId: unknown, data: any, x0: number, y0: number, z0: number) => {
          const [sx, sy, sz] = data.shape;
          for (let i = 0; i < sx; i++) {
            for (let j = 0; j < sy; j++) {
              for (let k = 0; k < sz; k++) {
                const x = x0 + i;
                const y = y0 + j;
                const z = z0 + k;
                const override = deltas.get(`${x},${y},${z}`);
                const blockId =
                  override !== undefined
                    ? override
                    : proceduralVoxelID(x, y, z, seed);
                data.set(i, j, k, blockId);
              }
            }
          }
          noa.world.setChunkData(chunkId, data);
        }
      );

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
            setVisualVisible(localPlayerVoxelRoot, noa.camera.zoomDistance > 0);
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
        for (const [userId, p] of Object.entries(snap.players)) {
          if (userId === selfId) continue;
          const eid = ensureRemoteEntity(userId);
          noa.entities.setPosition(eid, p.pos);
          const rig = remoteRigs.get(userId);
          if (rig) {
            updateAvatarWalk(rig, p.pos[0], p.pos[2]);
            setAvatarHeadPitch(rig, p.pitch ?? 0);
            setAvatarYawSmoothed(rig, p.heading);
          }
        }
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
        noa.setBlock(blockId, pos[0], pos[1], pos[2]);
        deltas.set(`${pos[0]},${pos[1]},${pos[2]}`, blockId);
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
          return BLOCK_HOTBAR_ICON[drop.blockId];
        }
        return ITEM_ICON[drop.itemId];
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
          const usePlantSprite =
            drop.kind === "block" && PLANT_SPRITE_BLOCK_IDS.has(drop.blockId);
          if (usePlantSprite) {
            const mesh = makePlantSpriteMesh(
              noa,
              Babylon,
              url,
              `world-drop-${drop.id}`
            );
            mesh.scaling = new Babylon.Vector3(0.36, 0.36, 0.36);
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

      async function tryStartMining(): Promise<void> {
        if (pausedRef.current) return;
        const tgt = noa.targetedBlock;
        if (!tgt) return;
        const pos: Vec3 = [tgt.position[0], tgt.position[1], tgt.position[2]];
        if (gameModeRef.current === "creative") {
          onBreakRef.current(pos);
          return;
        }
        const blockId = Number(tgt.blockID);
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
        const ack = await onBreakStartRef.current(pos);
        if (!ack.ok || !ack.durationMs) return;
        lastBreakStartAtRef.current = now;
        activeMiningRef.current = {
          pos,
          durationMs: ack.durationMs,
          startedAt: performance.now()
        };
        breakCrackRef.current?.setStage(pos, 0);
        const tick = (): void => {
          const m = activeMiningRef.current;
          if (!m) return;
          const t = (performance.now() - m.startedAt) / m.durationMs;
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

      noa.inputs.down.on("fire", () => {
        void tryStartMining();
      });
      noa.inputs.up.on("fire", endMiningHold);
      cleanupFns.push(() => clearMiningState(true));
      noa.inputs.down.on("alt-fire", () => {
        if (pausedRef.current) return;
        const tgt = noa.targetedBlock;
        if (!tgt) return;
        if (gameModeRef.current === "survival") {
          const blockId = Number(tgt.blockID);
          if (blockId === BLOCK_REGISTRY.CRAFTING) {
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
          const inv = inventoryRef.current;
          const idx = survivalSlotRef.current;
          const cell = inv[idx];
          if (
            !cell ||
            cell.count <= 0 ||
            (cell.itemId ?? 0) > 0 ||
            cell.blockId === BLOCK_REGISTRY.AIR
          ) {
            return;
          }
          onPlaceRef.current(
            [tgt.adjacent[0], tgt.adjacent[1], tgt.adjacent[2]],
            cell.blockId
          );
          return;
        }
        onPlaceRef.current(
          [tgt.adjacent[0], tgt.adjacent[1], tgt.adjacent[2]],
          selectedBlockRef.current
        );
      });

      function pickTargetedBlock() {
        const tgt = noa.targetedBlock;
        if (!tgt) return;
        const blockId = Number(tgt.blockID);
        if (!PLACEABLE_BLOCK_IDS.includes(blockId)) return;
        if (gameModeRef.current === "creative") {
          selectCreativeBlock(blockId);
          return;
        }
        const idx = inventoryRef.current.findIndex(
          (cell) => cell.blockId === blockId && cell.count > 0
        );
        if (idx >= 0) {
          survivalSlotRef.current = idx;
          setSurvivalSlot(idx);
        }
      }

      noa.inputs.down.on("mid-fire", pickTargetedBlock);

      function onHotbarKey(e: KeyboardEvent) {
        if (e.key.toLowerCase() === "e") {
          if (inventoryOpenRef.current) {
            closeInventory();
          } else {
            document.exitPointerLock?.();
            setInventoryOpen(true);
          }
          return;
        }
        if (e.key.toLowerCase() === "p" && !inventoryOpenRef.current) {
          if (gameModeRef.current === "survival") {
            onDropHotbarSlotRef.current?.(survivalSlotRef.current);
          }
          return;
        }
        if (e.key.toLowerCase() === "q" && !inventoryOpenRef.current) {
          if (gameModeRef.current === "survival") {
            onDropHotbarSlotRef.current?.(survivalSlotRef.current);
          }
          return;
        }
        const n = Number(e.key);
        if (gameModeRef.current === "survival") {
          if (Number.isFinite(n) && n >= 1 && n <= 9) {
            const i = n - 1;
            survivalSlotRef.current = i;
            setSurvivalSlot(i);
          }
          return;
        }
        if (Number.isFinite(n) && n >= 1 && n <= Math.min(9, HOTBAR.length)) {
          const idx = n - 1;
          selectCreativeBlock(HOTBAR[idx]);
        }
      }
      window.addEventListener("keydown", onHotbarKey);
      cleanupFns.push(() => window.removeEventListener("keydown", onHotbarKey));

      let lastEmit = 0;
      noa.on("tick", () => {
        const nowPerf = performance.now();
        const equipped = equipmentSlotsRef.current;
        const moveState = noa.entities.getMovement?.(noa.playerEntity);
        if (moveState) {
          moveState.jumpForce = equipmentHas(equipped, ITEM_REGISTRY.HELIUM_BOOTS)
            ? HELIUM_JUMP_FORCE
            : DEFAULT_JUMP_FORCE;
          moveState.maxSpeed = equipmentHas(equipped, ITEM_REGISTRY.HEAVY_SHIELD)
            ? DEFAULT_MAX_SPEED * HEAVY_SHIELD_SPEED_MULT
            : DEFAULT_MAX_SPEED;
        }
        if (scene.ambientColor) {
          scene.ambientColor = equipmentHas(equipped, ITEM_REGISTRY.GLOW_TALISMAN)
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

        if (pausedRef.current) return;

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

        if (localPlayerVoxelRoot) {
          setVisualVisible(localPlayerVoxelRoot, noa.camera.zoomDistance > 0);
        }
        if (localRig) {
          updateAvatarWalk(localRig, pos[0], pos[2]);
          setAvatarHeadPitch(localRig, pitch);
          setAvatarYaw(localRig, heading);
        }

        if (nowPerf - lastEmit < 60) return;
        lastEmit = nowPerf;
        const physState = noa.entities.getPhysics(playerEnt);
        const onGround = physState?.body?.resting?.[1] === -1;
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
    noa?.setPaused?.(paused);
  }, [paused]);

  const slotBox = (active: boolean, keyNum: number, inner: JSX.Element): JSX.Element => (
    <div key={keyNum} className={mcSlotClass(active)}>
      <span className="pointer-events-none absolute left-0.5 top-0.5 z-[2] text-[9px] font-black text-[#1a1510] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]">
        {keyNum}
      </span>
      {inner}
    </div>
  );

  const blockHotbarHud = !paused ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5 px-2">
      {gameMode === "creative"
        ? HOTBAR.slice(0, 9).map((blockId, i) =>
            slotBox(
              i === creativeSlotIdx,
              i + 1,
              <img
                src={BLOCK_HOTBAR_ICON[blockId]}
                alt=""
                title={BLOCK_HUD[blockId] ?? ""}
                className="h-9 w-9"
                style={{ imageRendering: "pixelated" }}
              />
            )
          )
        : inventorySlots.slice(0, 9).map((cell, i) => {
            const itemIcon =
              (cell.itemId ?? 0) > 0 && cell.count > 0
                ? ITEM_ICON[cell.itemId]
                : undefined;
            const blockIcon =
              cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0
                ? BLOCK_HOTBAR_ICON[cell.blockId]
                : undefined;
            const icon = itemIcon ?? blockIcon;
            const hasStack = cell.count > 0 && icon !== undefined;
            return slotBox(
              i === survivalSlot,
              i + 1,
              <>
                {hasStack ? (
                  <img
                    src={icon}
                    alt=""
                    title={
                      itemIcon
                        ? `${ITEM_HUD[cell.itemId] ?? cell.itemId} ×${cell.count}`
                        : `${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`
                    }
                    className="h-9 w-9"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="h-9 w-9 rounded bg-black/40" aria-hidden />
                )}
                {itemIcon ? toolDurabilityBar(cell.itemId, cell.durability) : null}
                {hasStack && (cell.count > 1 || itemIcon) ? (
                  <span className="pointer-events-none absolute bottom-0.5 right-0.5 text-[10px] font-black leading-none text-white drop-shadow-md">
                    {cell.count}
                  </span>
                ) : null}
              </>
            );
          })}
    </div>
  ) : null;

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
          onInventoryMove({
            from: parsed.from,
            fromIndex: parsed.fromIndex,
            to: region,
            toIndex: index
          });
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
                  onClick={() => onCraft("grid")}
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
          className="max-h-[min(86vh,520px)] w-[min(94vw,440px)] overflow-y-auto rounded-sm border-[3px] border-[#1e1e1e] bg-gradient-to-b from-[#ebe1cf] via-[#d9ccb8] to-[#c0b09a] p-4 text-[#1f1810] shadow-[0_16px_40px_rgba(0,0,0,0.85)]"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-2 border-b-2 border-[#8a7a62] pb-2">
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
          <ul className="space-y-5 text-[11px] font-semibold text-[#2a2218]">
            <li className="rounded border border-[#6b5e4b] bg-black/10 p-3">
              <div className="mb-1 font-black">לוחות עץ</div>
              <p className="mb-2 text-[10px] font-normal text-[#4a3f30]">
                עץ אחד = 4 לוחות עץ
              </p>
              <div className="flex flex-wrap items-center gap-3" dir="ltr">
                <div className="grid grid-cols-2 gap-0.5">
                  {recipeDiagramCell("p-l0", "log")}
                  {recipeDiagramCell("p-l1", "empty")}
                  {recipeDiagramCell("p-l2", "empty")}
                  {recipeDiagramCell("p-l3", "empty")}
                </div>
                <span className="text-lg font-black text-[#3d3426]">→</span>
                <div className="flex items-center gap-1">
                  {recipeDiagramCell("p-out", "planks")}
                  <span className="text-[10px] font-black text-[#1a1510]">×4</span>
                </div>
              </div>
            </li>
            <li className="rounded border border-[#6b5e4b] bg-black/10 p-3">
              <div className="mb-1 font-black">מקלות</div>
              <p className="mb-2 text-[10px] font-normal text-[#4a3f30]">
                2 לוחות עץ = 4 מקלות
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-3" dir="ltr">
                <div className="grid grid-cols-2 gap-0.5">
                  {recipeDiagramCell("s-a0", "planks")}
                  {recipeDiagramCell("s-a1", "planks")}
                  {recipeDiagramCell("s-a2", "empty")}
                  {recipeDiagramCell("s-a3", "empty")}
                </div>
                <span className="text-lg font-black text-[#3d3426]">→</span>
                <div className="flex items-center gap-1">
                  <img
                    src={ITEM_ICON[ITEM_REGISTRY.STICK]}
                    alt=""
                    className="h-8 w-8 border-2 border-[#2a2a2a] bg-[#8d8d8d] p-0.5"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <span className="text-[10px] font-black text-[#1a1510]">×4</span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    ) : null;

  const controlsHint =
    !paused && !controlsHintDismissed ? (
      <div className="pointer-events-none absolute left-3 top-3 max-w-[min(22rem,calc(100%-1.5rem)))]">
        <div
          className="relative space-y-1 rounded-lg border border-black/40 bg-neutral-950/75 py-2 ps-2.5 pe-8 pt-7 text-[10px] leading-snug text-neutral-100 shadow-md sm:text-[11px] sm:pe-9 sm:pt-8"
          dir="rtl"
        >
          <button
            type="button"
            className="pointer-events-auto absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-md text-base font-bold leading-none text-neutral-300 hover:bg-white/10 hover:text-white"
            aria-label="סגור"
            onClick={() => setControlsHintDismissed(true)}
          >
            ×
          </button>
          <p className="font-semibold text-neutral-300">בקרות</p>
          <p className="text-neutral-200">
            WASD תנועה · רווח קפיצה · לחצן שמאלי מחזיק לשבירה · ימני מניח · מקשי 1–9 לסרגל · E
            מלאי (גרירה בין משבצות / לוח בלוקים ביצירתי) · Q או לחצן אמצעי בוחר בלוק · P/Q זורקים פריט מההוטבר בשרדות · גלגלת לזום
            המצלמה
          </p>
        </div>
      </div>
    ) : null;

  return (
    <div className="absolute inset-0">
      <div
        ref={hostRef}
        className="absolute inset-0 outline-none"
        tabIndex={0}
        aria-label="minecraft viewport"
      />
      {controlsHint}
      {blockHotbarHud}
      {inventoryPanel}
      {recipeBookOverlay}
    </div>
  );
}
