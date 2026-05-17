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
  type BlockDelta,
  type CraftingGridSlot,
  type GameMode,
  type HotbarSlot,
  type InputReq,
  type InventoryRegion,
  type InventoryMoveReq,
  type ItemSlot,
  type RoomPlayerInfo,
  type RoomSnapshot,
  type Vec3
} from "@/lib/voxelProtocol";
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
  [BLOCK_REGISTRY.BEDROCK]: "סלע יסוד"
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
  [ITEM_REGISTRY.STICK]: "מקל"
};

/** Minecraft-like slot: raised inner bevel, dark rim. */
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
  grassTop: "/minecraft-assets/grass_block_top.png",
  grassSide: "/minecraft-assets/grass_block_side.png",
  dirt: "/minecraft-assets/dirt.png",
  stone: "/minecraft-assets/stone.png",
  oakLog: "/minecraft-assets/oak_log.png",
  oakLogTop: "/minecraft-assets/oak_log_top.png",
  oakLeaves: "/minecraft-assets/oak_leaves.png",
  sand: "/minecraft-assets/sand.png",
  waterStill: "/minecraft-assets/water_still.png",
  glass: "/minecraft-assets/glass.png",
  cobblestone: "/minecraft-assets/cobblestone.png",
  oakPlanks: "/minecraft-assets/oak_planks.png",
  sapling: "/minecraft-assets/oak_sapling.png",
  gravel: "/minecraft-assets/gravel.png",
  goldOre: "/minecraft-assets/gold_ore.png",
  ironOre: "/minecraft-assets/iron_ore.png",
  coalOre: "/minecraft-assets/coal_ore.png",
  sponge: "/minecraft-assets/sponge.png",
  redWool: "/minecraft-assets/red_wool.png",
  orangeWool: "/minecraft-assets/orange_wool.png",
  yellowWool: "/minecraft-assets/yellow_wool.png",
  limeWool: "/minecraft-assets/lime_wool.png",
  greenWool: "/minecraft-assets/green_wool.png",
  cyanWool: "/minecraft-assets/cyan_wool.png",
  blueWool: "/minecraft-assets/blue_wool.png",
  purpleWool: "/minecraft-assets/purple_wool.png",
  magentaWool: "/minecraft-assets/magenta_wool.png",
  pinkWool: "/minecraft-assets/pink_wool.png",
  blackWool: "/minecraft-assets/black_wool.png",
  grayWool: "/minecraft-assets/gray_wool.png",
  whiteWool: "/minecraft-assets/white_wool.png",
  dandelion: "/minecraft-assets/dandelion.png",
  rose: "/minecraft-assets/red_flower.png",
  brownMushroom: "/minecraft-assets/brown_mushroom.png",
  redMushroom: "/minecraft-assets/red_mushroom.png",
  goldBlock: "/minecraft-assets/gold_block.png",
  ironBlock: "/minecraft-assets/iron_block.png",
  smoothStone: "/minecraft-assets/smooth_stone.png",
  smoothStoneSlabSide: "/minecraft-assets/smooth_stone_slab_side.png",
  bricks: "/minecraft-assets/bricks.png",
  tntTop: "/minecraft-assets/tnt_top.png",
  tntBottom: "/minecraft-assets/tnt_bottom.png",
  tntSide: "/minecraft-assets/tnt_side.png",
  bookshelf: "/minecraft-assets/bookshelf.png",
  mossyCobblestone: "/minecraft-assets/mossy_cobblestone.png",
  obsidian: "/minecraft-assets/obsidian.png",
  bedrock: "/minecraft-assets/bedrock.png"
} as const;

/** Item-style icon per block for the hotbar (same assets as terrain). */
const BLOCK_HOTBAR_ICON: Record<number, string> = {
  [BLOCK_REGISTRY.GRASS]: MC_TEX.grassTop,
  [BLOCK_REGISTRY.DIRT]: MC_TEX.dirt,
  [BLOCK_REGISTRY.STONE]: MC_TEX.stone,
  [BLOCK_REGISTRY.WOOD]: MC_TEX.oakLog,
  [BLOCK_REGISTRY.LEAVES]: MC_TEX.oakLeaves,
  [BLOCK_REGISTRY.SAND]: MC_TEX.sand,
  [BLOCK_REGISTRY.GLASS]: MC_TEX.glass,
  [BLOCK_REGISTRY.COBBLESTONE]: MC_TEX.cobblestone,
  [BLOCK_REGISTRY.OAK_PLANKS]: MC_TEX.oakPlanks,
  [BLOCK_REGISTRY.SAPLING]: MC_TEX.sapling,
  [BLOCK_REGISTRY.GRAVEL]: MC_TEX.gravel,
  [BLOCK_REGISTRY.GOLD_ORE]: MC_TEX.goldOre,
  [BLOCK_REGISTRY.IRON_ORE]: MC_TEX.ironOre,
  [BLOCK_REGISTRY.COAL_ORE]: MC_TEX.coalOre,
  [BLOCK_REGISTRY.SPONGE]: MC_TEX.sponge,
  [BLOCK_REGISTRY.RED_WOOL]: MC_TEX.redWool,
  [BLOCK_REGISTRY.ORANGE_WOOL]: MC_TEX.orangeWool,
  [BLOCK_REGISTRY.YELLOW_WOOL]: MC_TEX.yellowWool,
  [BLOCK_REGISTRY.LIME_WOOL]: MC_TEX.limeWool,
  [BLOCK_REGISTRY.GREEN_WOOL]: MC_TEX.greenWool,
  [BLOCK_REGISTRY.CYAN_WOOL]: MC_TEX.cyanWool,
  [BLOCK_REGISTRY.BLUE_WOOL]: MC_TEX.blueWool,
  [BLOCK_REGISTRY.PURPLE_WOOL]: MC_TEX.purpleWool,
  [BLOCK_REGISTRY.MAGENTA_WOOL]: MC_TEX.magentaWool,
  [BLOCK_REGISTRY.PINK_WOOL]: MC_TEX.pinkWool,
  [BLOCK_REGISTRY.BLACK_WOOL]: MC_TEX.blackWool,
  [BLOCK_REGISTRY.GRAY_WOOL]: MC_TEX.grayWool,
  [BLOCK_REGISTRY.WHITE_WOOL]: MC_TEX.whiteWool,
  [BLOCK_REGISTRY.DANDELION]: MC_TEX.dandelion,
  [BLOCK_REGISTRY.ROSE]: MC_TEX.rose,
  [BLOCK_REGISTRY.BROWN_MUSHROOM]: MC_TEX.brownMushroom,
  [BLOCK_REGISTRY.RED_MUSHROOM]: MC_TEX.redMushroom,
  [BLOCK_REGISTRY.GOLD_BLOCK]: MC_TEX.goldBlock,
  [BLOCK_REGISTRY.IRON_BLOCK]: MC_TEX.ironBlock,
  [BLOCK_REGISTRY.STONE_SLAB]: MC_TEX.smoothStone,
  [BLOCK_REGISTRY.BRICKS]: MC_TEX.bricks,
  [BLOCK_REGISTRY.TNT]: MC_TEX.tntSide,
  [BLOCK_REGISTRY.BOOKSHELF]: MC_TEX.bookshelf,
  [BLOCK_REGISTRY.MOSSY_COBBLESTONE]: MC_TEX.mossyCobblestone,
  [BLOCK_REGISTRY.OBSIDIAN]: MC_TEX.obsidian,
  [BLOCK_REGISTRY.BEDROCK]: MC_TEX.bedrock
};

function registerMcTerrainMaterials(noa: {
  registry: { registerMaterial: (name: string, opts: Record<string, unknown>) => void };
}): void {
  const reg = (name: string, textureURL: string, extra: Record<string, unknown> = {}) => {
    noa.registry.registerMaterial(name, { textureURL, ...extra });
  };
  reg("mc_grass_top", MC_TEX.grassTop);
  reg("mc_grass_side", MC_TEX.grassSide);
  reg("mc_dirt", MC_TEX.dirt);
  reg("mc_stone", MC_TEX.stone);
  reg("mc_oak_log", MC_TEX.oakLog);
  reg("mc_oak_log_top", MC_TEX.oakLogTop);
  reg("mc_oak_leaves", MC_TEX.oakLeaves, { texHasAlpha: true });
  reg("mc_sand", MC_TEX.sand);
  reg("mc_water", MC_TEX.waterStill, { texHasAlpha: true });
  reg("mc_glass", MC_TEX.glass, { texHasAlpha: true });
  reg("mc_cobblestone", MC_TEX.cobblestone);
  reg("mc_oak_planks", MC_TEX.oakPlanks);
  reg("mc_sapling", MC_TEX.sapling, { texHasAlpha: true });
  reg("mc_gravel", MC_TEX.gravel);
  reg("mc_gold_ore", MC_TEX.goldOre);
  reg("mc_iron_ore", MC_TEX.ironOre);
  reg("mc_coal_ore", MC_TEX.coalOre);
  reg("mc_sponge", MC_TEX.sponge);
  reg("mc_red_wool", MC_TEX.redWool);
  reg("mc_orange_wool", MC_TEX.orangeWool);
  reg("mc_yellow_wool", MC_TEX.yellowWool);
  reg("mc_lime_wool", MC_TEX.limeWool);
  reg("mc_green_wool", MC_TEX.greenWool);
  reg("mc_cyan_wool", MC_TEX.cyanWool);
  reg("mc_blue_wool", MC_TEX.blueWool);
  reg("mc_purple_wool", MC_TEX.purpleWool);
  reg("mc_magenta_wool", MC_TEX.magentaWool);
  reg("mc_pink_wool", MC_TEX.pinkWool);
  reg("mc_black_wool", MC_TEX.blackWool);
  reg("mc_gray_wool", MC_TEX.grayWool);
  reg("mc_white_wool", MC_TEX.whiteWool);
  reg("mc_dandelion", MC_TEX.dandelion, { texHasAlpha: true });
  reg("mc_rose", MC_TEX.rose, { texHasAlpha: true });
  reg("mc_brown_mushroom", MC_TEX.brownMushroom, { texHasAlpha: true });
  reg("mc_red_mushroom", MC_TEX.redMushroom, { texHasAlpha: true });
  reg("mc_gold_block", MC_TEX.goldBlock);
  reg("mc_iron_block", MC_TEX.ironBlock);
  reg("mc_smooth_stone", MC_TEX.smoothStone);
  reg("mc_smooth_stone_slab_side", MC_TEX.smoothStoneSlabSide);
  reg("mc_bricks", MC_TEX.bricks);
  reg("mc_tnt_top", MC_TEX.tntTop);
  reg("mc_tnt_bottom", MC_TEX.tntBottom);
  reg("mc_tnt_side", MC_TEX.tntSide);
  reg("mc_bookshelf", MC_TEX.bookshelf);
  reg("mc_mossy_cobblestone", MC_TEX.mossyCobblestone);
  reg("mc_obsidian", MC_TEX.obsidian);
  reg("mc_bedrock", MC_TEX.bedrock);
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x9e3779b1);
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function smoothNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const h00 = hash3(xi, 0, zi, seed);
  const h10 = hash3(xi + 1, 0, zi, seed);
  const h01 = hash3(xi, 0, zi + 1, seed);
  const h11 = hash3(xi + 1, 0, zi + 1, seed);
  const fx = xf * xf * (3 - 2 * xf);
  const fz = zf * zf * (3 - 2 * zf);
  const a = h00 * (1 - fx) + h10 * fx;
  const b = h01 * (1 - fx) + h11 * fx;
  return a * (1 - fz) + b * fz;
}

function columnHeight(x: number, z: number, seed: number): number {
  const base = 8;
  const amp = 4;
  const heightF =
    smoothNoise(x / 16, z / 16, seed) * amp +
    smoothNoise(x / 4, z / 4, seed ^ 0x1234) * 1.2;
  return Math.floor(base + heightF);
}

function surfaceVoxelID(x: number, z: number, seed: number): number {
  const patch = smoothNoise(x / 10, z / 10, seed ^ 0x53465246);
  if (patch < 0.07) return BLOCK_REGISTRY.GRAVEL;
  if (patch < 0.16) return BLOCK_REGISTRY.SAND;
  return BLOCK_REGISTRY.GRASS;
}

function undergroundVoxelID(x: number, y: number, z: number, seed: number): number {
  if (hash3(x, y, z, seed ^ 0x434f414c) < 0.013) {
    return BLOCK_REGISTRY.COAL_ORE;
  }
  if (y < 10 && hash3(x, y, z, seed ^ 0x49524f4e) < 0.008) {
    return BLOCK_REGISTRY.IRON_ORE;
  }
  if (y < 2 && hash3(x, y, z, seed ^ 0x474f4c44) < 0.004) {
    return BLOCK_REGISTRY.GOLD_ORE;
  }
  return BLOCK_REGISTRY.STONE;
}

function surfaceDecorationVoxelID(x: number, z: number, seed: number): number {
  const n = hash3(x, 2, z, seed ^ 0x464c5752);
  if (n < 0.006) return BLOCK_REGISTRY.SAPLING;
  if (n < 0.020) return BLOCK_REGISTRY.DANDELION;
  if (n < 0.032) return BLOCK_REGISTRY.ROSE;
  if (n < 0.040) return BLOCK_REGISTRY.BROWN_MUSHROOM;
  if (n < 0.047) return BLOCK_REGISTRY.RED_MUSHROOM;
  return BLOCK_REGISTRY.AIR;
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

/**
 * Mirror of apps/minecraft-server/src/world.ts proceduralVoxelID. Kept
 * client-side so noa can request blocks synchronously without a
 * round-trip per chunk.
 */
function proceduralVoxelID(x: number, y: number, z: number, seed: number): number {
  if (y <= -28) return BLOCK_REGISTRY.BEDROCK;

  const height = columnHeight(x, z, seed);
  if (y <= height) {
    const surface = surfaceVoxelID(x, z, seed);
    if (y === height) return surface;
    if (y > height - 3) {
      return surface === BLOCK_REGISTRY.GRASS ? BLOCK_REGISTRY.DIRT : surface;
    }
    return undergroundVoxelID(x, y, z, seed);
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const cx = x + dx;
      const cz = z + dz;
      const ch = columnHeight(cx, cz, seed);
      if (hash3(cx, 0, cz, seed ^ 0xBEEF) < 0.0005) {
        const h = hash3(cx, 1, cz, seed ^ 0xCAFE);
        const heightVar = Math.floor(h * 5) - 2;
        const trunkHeight = 7 + heightVar;
        const trunkTop = ch + trunkHeight;
        if (y <= trunkTop && dx === 0 && dz === 0) return BLOCK_REGISTRY.WOOD;
        const dy = y - trunkTop;
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 <= 9 && y > ch) return BLOCK_REGISTRY.LEAVES;
      }
    }
  }
  if (
    y === height + 1 &&
    surfaceVoxelID(x, z, seed) === BLOCK_REGISTRY.GRASS
  ) {
    return surfaceDecorationVoxelID(x, z, seed);
  }
  return BLOCK_REGISTRY.AIR;
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
  /** Survival: 2×2 crafting grid from server. */
  craftingGridSlots: CraftingGridSlot[];
  onInventoryMove: (req: InventoryMoveReq) => void;
  onCraft: (recipeId: string) => void;
  onInput: (input: InputReq) => void;
  onBlockPlace: (pos: Vec3, blockId: number) => void;
  onBlockBreak: (pos: Vec3) => void;
  registerSnapshotListener: (cb: (snap: RoomSnapshot) => void) => () => void;
  registerBlockDeltaListener: (cb: (delta: BlockDelta) => void) => () => void;
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
    craftingGridSlots,
    onInventoryMove,
    onCraft,
    onInput,
    onBlockPlace,
    onBlockBreak,
    registerSnapshotListener,
    registerBlockDeltaListener
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
  const pausedRef = useRef(paused);
  const gameModeRef = useRef<GameMode>(gameMode);
  const inventoryRef = useRef<HotbarSlot[]>(inventorySlots);
  const remoteEntitiesRef = useRef(new Map<string, number>());
  const selectedBlockRef = useRef<number>(BLOCK_REGISTRY.GRASS);
  const survivalSlotRef = useRef(0);
  const myUserIdRef = useRef<string | null>(myUserId);
  const registerSnapshotListenerRef = useRef(registerSnapshotListener);
  const registerBlockDeltaListenerRef = useRef(registerBlockDeltaListener);

  onInputRef.current = onInput;
  onPlaceRef.current = onBlockPlace;
  onBreakRef.current = onBlockBreak;
  pausedRef.current = paused;
  gameModeRef.current = gameMode;
  inventoryRef.current = inventorySlots;
  survivalSlotRef.current = survivalSlot;
  myUserIdRef.current = myUserId;
  registerSnapshotListenerRef.current = registerSnapshotListener;
  registerBlockDeltaListenerRef.current = registerBlockDeltaListener;

  const selectCreativeBlock = (blockId: number): void => {
    if (!PLACEABLE_BLOCK_IDS.includes(blockId)) return;
    selectedBlockRef.current = blockId;
    const idx = HOTBAR.indexOf(blockId);
    if (idx >= 0) setCreativeSlotIdx(idx);
  };

  useEffect(() => {
    if (!inventoryOpen) setRecipeBookOpen(false);
  }, [inventoryOpen]);

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
      registerMcTerrainMaterials(noa);

      noa.registry.registerBlock(BLOCK_REGISTRY.GRASS, {
        material: ["mc_grass_top", "mc_dirt", "mc_grass_side"],
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.DIRT, {
        material: "mc_dirt",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.STONE, {
        material: "mc_stone",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.WOOD, {
        material: ["mc_oak_log_top", "mc_oak_log_top", "mc_oak_log"],
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.LEAVES, {
        material: "mc_oak_leaves",
        solid: true,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.SAND, {
        material: "mc_sand",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.WATER, {
        material: "mc_water",
        solid: false,
        opaque: false,
        fluid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.GLASS, {
        material: "mc_glass",
        solid: true,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.COBBLESTONE, {
        material: "mc_cobblestone",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.OAK_PLANKS, {
        material: "mc_oak_planks",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.SAPLING, {
        blockMesh: makePlantSpriteMesh(noa, Babylon, MC_TEX.sapling, "mc_sapling"),
        solid: false,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.GRAVEL, {
        material: "mc_gravel",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.GOLD_ORE, {
        material: "mc_gold_ore",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.IRON_ORE, {
        material: "mc_iron_ore",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.COAL_ORE, {
        material: "mc_coal_ore",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.SPONGE, {
        material: "mc_sponge",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.RED_WOOL, {
        material: "mc_red_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.ORANGE_WOOL, {
        material: "mc_orange_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.YELLOW_WOOL, {
        material: "mc_yellow_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.LIME_WOOL, {
        material: "mc_lime_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.GREEN_WOOL, {
        material: "mc_green_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.CYAN_WOOL, {
        material: "mc_cyan_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.BLUE_WOOL, {
        material: "mc_blue_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.PURPLE_WOOL, {
        material: "mc_purple_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.MAGENTA_WOOL, {
        material: "mc_magenta_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.PINK_WOOL, {
        material: "mc_pink_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.BLACK_WOOL, {
        material: "mc_black_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.GRAY_WOOL, {
        material: "mc_gray_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.WHITE_WOOL, {
        material: "mc_white_wool",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.DANDELION, {
        blockMesh: makePlantSpriteMesh(noa, Babylon, MC_TEX.dandelion, "mc_dandelion"),
        solid: false,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.ROSE, {
        blockMesh: makePlantSpriteMesh(noa, Babylon, MC_TEX.rose, "mc_rose"),
        solid: false,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.BROWN_MUSHROOM, {
        blockMesh: makePlantSpriteMesh(noa, Babylon, MC_TEX.brownMushroom, "mc_brown_mushroom"),
        solid: false,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.RED_MUSHROOM, {
        blockMesh: makePlantSpriteMesh(noa, Babylon, MC_TEX.redMushroom, "mc_red_mushroom"),
        solid: false,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.GOLD_BLOCK, {
        material: "mc_gold_block",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.IRON_BLOCK, {
        material: "mc_iron_block",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.STONE_SLAB, {
        material: ["mc_smooth_stone", "mc_smooth_stone", "mc_smooth_stone_slab_side"],
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.BRICKS, {
        material: "mc_bricks",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.TNT, {
        material: ["mc_tnt_top", "mc_tnt_bottom", "mc_tnt_side"],
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.BOOKSHELF, {
        material: ["mc_oak_planks", "mc_oak_planks", "mc_bookshelf"],
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.MOSSY_COBBLESTONE, {
        material: "mc_mossy_cobblestone",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.OBSIDIAN, {
        material: "mc_obsidian",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.BEDROCK, {
        material: "mc_bedrock",
        solid: true
      });

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

      noa.inputs.down.on("fire", () => {
        if (pausedRef.current) return;
        const tgt = noa.targetedBlock;
        if (!tgt) return;
        onBreakRef.current([tgt.position[0], tgt.position[1], tgt.position[2]]);
      });
      noa.inputs.down.on("alt-fire", () => {
        if (pausedRef.current) return;
        const tgt = noa.targetedBlock;
        if (!tgt) return;
        if (gameModeRef.current === "survival") {
          const inv = inventoryRef.current;
          const idx = survivalSlotRef.current;
          const cell = inv[idx];
          if (!cell || cell.count <= 0 || cell.blockId === BLOCK_REGISTRY.AIR) {
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
          setInventoryOpen((v) => !v);
          return;
        }
        if (e.key.toLowerCase() === "p" && !inventoryOpen) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (onInputRef.current as any)({ action: "drop" });
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

        const now = performance.now();
        if (now - lastEmit < 60) return;
        lastEmit = now;
        const physState = noa.entities.getPhysics(playerEnt);
        const onGround = physState?.body?.resting?.[1] === -1;
        onInputRef.current({
          pos: [pos[0], pos[1], pos[2]],
          heading,
          pitch,
          jumping: !onGround,
          t: Date.now()
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
            const icon = BLOCK_HOTBAR_ICON[cell.blockId];
            const hasItem =
              cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0 && icon !== undefined;
            return slotBox(
              i === survivalSlot,
              i + 1,
              <>
                {hasItem ? (
                  <img
                    src={icon}
                    alt=""
                    title={`${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`}
                    className="h-9 w-9"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="h-9 w-9 rounded bg-black/40" aria-hidden />
                )}
                {hasItem ? (
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
      ? craftingGridPreview(craftingGridSlots, inventorySlots, itemInventorySlots)
      : null;

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
            onClick={() => setInventoryOpen(false)}
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
                  יצירה (2×2)
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
                <div
                  className="grid grid-cols-2 gap-1 rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.18)] p-1.5"
                  title="רשת יצירה 2×2"
                >
                  {craftingGridSlots.slice(0, CRAFTING_GRID_SLOTS).map((cell, i) => {
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
                    craftPreview === "planks"
                      ? "לוחות עץ ×4"
                      : craftPreview === "stick"
                        ? "מקלות ×4"
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
                  {craftPreview === "planks" ? (
                    <>
                      <img
                        src={BLOCK_HOTBAR_ICON[BLOCK_REGISTRY.OAK_PLANKS]}
                        alt=""
                        className="h-9 w-9"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[11px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                        ×4
                      </span>
                    </>
                  ) : craftPreview === "stick" ? (
                    <>
                      <img
                        src={ITEM_ICON[ITEM_REGISTRY.STICK]}
                        alt=""
                        className="h-9 w-9"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="pointer-events-none absolute bottom-0.5 end-0.5 text-[11px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                        ×4
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
                  סרגל חם — בלוקים
                </div>
                <div className="inline-block rounded border-2 border-[#5c4f3e] bg-[rgba(0,0,0,0.15)] p-1.5">
                  <div className="grid grid-cols-9 gap-1">
                    {inventorySlots.slice(0, 9).map((cell, i) => {
                      const icon = BLOCK_HOTBAR_ICON[cell.blockId];
                      const has =
                        cell.blockId !== BLOCK_REGISTRY.AIR &&
                        cell.count > 0 &&
                        icon !== undefined;
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
                                title={`${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`}
                                className="h-8 w-8"
                                style={{ imageRendering: "pixelated" }}
                              />
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
            WASD תנועה · רווח קפיצה · לחצן עכבר שמאלי שובר · ימני מניח · מקשי 1–9 לסרגל · E
            מלאי (גרירה בין משבצות / לוח בלוקים ביצירתי) · Q או לחצן אמצעי בוחר בלוק · גלגלת לזום
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
