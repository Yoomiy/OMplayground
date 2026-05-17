/**
 * Wire-protocol types for the voxel server, mirrored on the client. Kept
 * in lock-step with apps/minecraft-server/src/protocol.ts. Per the plan,
 * we inline now and extract into `packages/voxel-protocol` once both
 * sides stabilize (avoids a cross-app TS path until needed).
 */

export type Vec3 = [number, number, number];

export type GameMode = "creative" | "survival";

export interface HotbarSlot {
  blockId: number;
  count: number;
}

export interface ItemSlot {
  itemId: number;
  count: number;
}

/** One cell in the survival 2×2 crafting grid (blocks or items, never both). */
export interface CraftingGridSlot {
  blockId: number;
  itemId: number;
  count: number;
}

export type InventoryRegion = "hotbar" | "storage" | "craft";

export interface InventoryMoveReq {
  from: InventoryRegion;
  fromIndex: number;
  to: InventoryRegion;
  toIndex: number;
}

export const ITEM_REGISTRY = {
  STICK: 100,
  /** Non-placeable planks (crafting ingredient); placeable planks use `OAK_PLANKS`. */
  PLANKS: 101
} as const;

export const ITEM_ICON: Record<number, string> = {
  [ITEM_REGISTRY.STICK]: "/minecraft-assets/stick.png",
  [ITEM_REGISTRY.PLANKS]: "/minecraft-assets/oak_planks.png"
};


export interface RoomPlayerInfo {
  userId: string;
  displayName: string;
}

export interface JoinRoomReq {
  sessionId: string;
}

export interface JoinRoomAckOk {
  ok: true;
  seed: number;
  deltas: [number, number, number, number][];
  roster: RoomPlayerInfo[];
  hostId: string;
  spawn: Vec3;
  paused: boolean;
  gameMode: GameMode;
  inventory: HotbarSlot[];
  itemInventory: ItemSlot[];
  craftingGrid: CraftingGridSlot[];
}

export interface JoinRoomAckErr {
  ok: false;
  error: { code: string; message: string };
}

export type JoinRoomAck = JoinRoomAckOk | JoinRoomAckErr;

export interface InputReq {
  pos: Vec3;
  heading: number;
  /** Camera pitch in radians; optional for forward compat with older servers. */
  pitch?: number;
  jumping: boolean;
  t: number;
}

export interface BlockPlaceReq {
  pos: Vec3;
  blockId: number;
}

export interface BlockBreakReq {
  pos: Vec3;
}

export interface InventorySyncPayload {
  slots: HotbarSlot[];
  itemSlots?: ItemSlot[];
  craftingSlots?: CraftingGridSlot[];
}

export const MAIN_ITEM_INVENTORY_SLOTS = 27;
export const CRAFTING_GRID_SLOTS = 4;
/** Max units per 2×2 crafting grid cell (one ingredient per slot). */
export const CRAFTING_CELL_MAX = 1;

export interface ItemPickupPayload {
  itemId: number;
  count: number;
}

export interface CraftReq {
  recipeId: string;
}

export interface CraftAck extends SimpleAck {
  output?: ItemSlot;
}

export interface SetGameModeReq {
  sessionId?: string;
  gameMode: GameMode;
}

export interface SimpleAck {
  ok: boolean;
  error?: { code: string; message: string };
}

export interface PlayerSnapshot {
  pos: Vec3;
  heading: number;
  /** Radians. Missing from older servers — treat as 0. */
  pitch?: number;
  jumping: boolean;
  t: number;
}

export interface RoomSnapshot {
  players: Record<string, PlayerSnapshot>;
}

export interface BlockDelta {
  pos: Vec3;
  blockId: number;
  by: string;
}

export type RoomEvent =
  | { kind: "PLAYER_JOINED"; sessionId: string; player: RoomPlayerInfo }
  | { kind: "PLAYER_LEFT"; sessionId: string; player: RoomPlayerInfo }
  | { kind: "HOST_LEFT"; sessionId: string; newHostId: string }
  | { kind: "GAME_PAUSED"; sessionId: string }
  | { kind: "GAME_RESUMED"; sessionId: string }
  | { kind: "GAME_STOPPED"; sessionId: string; stoppedBy: string }
  | { kind: "RECESS_ENDED"; sessionId: string }
  | { kind: "GAME_MODE_CHANGED"; sessionId: string; gameMode: GameMode };

export const BLOCK_REGISTRY = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  GLASS: 8,
  COBBLESTONE: 9,
  OAK_PLANKS: 10,
  SAPLING: 11,
  GRAVEL: 12,
  GOLD_ORE: 13,
  IRON_ORE: 14,
  COAL_ORE: 15,
  SPONGE: 16,
  RED_WOOL: 17,
  ORANGE_WOOL: 18,
  YELLOW_WOOL: 19,
  LIME_WOOL: 20,
  GREEN_WOOL: 21,
  CYAN_WOOL: 22,
  BLUE_WOOL: 23,
  PURPLE_WOOL: 24,
  MAGENTA_WOOL: 25,
  PINK_WOOL: 26,
  BLACK_WOOL: 27,
  GRAY_WOOL: 28,
  WHITE_WOOL: 29,
  DANDELION: 30,
  ROSE: 31,
  BROWN_MUSHROOM: 32,
  RED_MUSHROOM: 33,
  GOLD_BLOCK: 34,
  IRON_BLOCK: 35,
  STONE_SLAB: 36,
  BRICKS: 37,
  TNT: 38,
  BOOKSHELF: 39,
  MOSSY_COBBLESTONE: 40,
  OBSIDIAN: 41,
  BEDROCK: 42
} as const;

export const PLACEABLE_BLOCK_IDS: readonly number[] = [
  BLOCK_REGISTRY.GRASS,
  BLOCK_REGISTRY.DIRT,
  BLOCK_REGISTRY.STONE,
  BLOCK_REGISTRY.WOOD,
  BLOCK_REGISTRY.LEAVES,
  BLOCK_REGISTRY.SAND,
  BLOCK_REGISTRY.GLASS,
  BLOCK_REGISTRY.COBBLESTONE,
  BLOCK_REGISTRY.OAK_PLANKS,
  BLOCK_REGISTRY.SAPLING,
  BLOCK_REGISTRY.GRAVEL,
  BLOCK_REGISTRY.GOLD_ORE,
  BLOCK_REGISTRY.IRON_ORE,
  BLOCK_REGISTRY.COAL_ORE,
  BLOCK_REGISTRY.SPONGE,
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
  BLOCK_REGISTRY.DANDELION,
  BLOCK_REGISTRY.ROSE,
  BLOCK_REGISTRY.BROWN_MUSHROOM,
  BLOCK_REGISTRY.RED_MUSHROOM,
  BLOCK_REGISTRY.GOLD_BLOCK,
  BLOCK_REGISTRY.IRON_BLOCK,
  BLOCK_REGISTRY.STONE_SLAB,
  BLOCK_REGISTRY.BRICKS,
  BLOCK_REGISTRY.TNT,
  BLOCK_REGISTRY.BOOKSHELF,
  BLOCK_REGISTRY.MOSSY_COBBLESTONE,
  BLOCK_REGISTRY.OBSIDIAN
];

export const MAX_REACH = 8;
