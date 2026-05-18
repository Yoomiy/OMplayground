/**
 * Wire-protocol types for the voxel server. These are the exact shapes
 * exchanged over Socket.IO; the client mirrors these via a relative type
 * import. Keep this file framework-free (no socket / babylon imports).
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

export {
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  ITEM_REGISTRY,
  REGISTERED_ITEM_IDS
} from "@playground/voxel-content";

export interface RoomPlayerInfo {
  userId: string;
  displayName: string;
}

export interface JoinRoomReq {
  sessionId: string;
}

/** Authoritative item stack lying in the world (survival). */
export type WorldDrop =
  | {
      id: string;
      kind: "block";
      pos: Vec3;
      blockId: number;
      count: number;
    }
  | {
      id: string;
      kind: "item";
      pos: Vec3;
      itemId: number;
      count: number;
    };

export interface JoinRoomAckOk {
  ok: true;
  seed: number;
  /** Sparse delta list: every block placed/broken from procedural baseline. */
  deltas: [number, number, number, number][];
  roster: RoomPlayerInfo[];
  hostId: string;
  spawn: Vec3;
  paused: boolean;
  gameMode: GameMode;
  /** Survival: authoritative hotbar. Creative: empty slots (UI ignores). */
  inventory: HotbarSlot[];
  /** Survival: non-placeable items (27 storage). Creative: empty. */
  itemInventory: ItemSlot[];
  /** Survival: 2×2 crafting grid. Creative: empty. */
  craftingGrid: CraftingGridSlot[];
  /** Item entities in the world (survival); creative sessions send `[]`. */
  drops: WorldDrop[];
}

export interface JoinRoomAckErr {
  ok: false;
  error: { code: string; message: string };
}

export type JoinRoomAck = JoinRoomAckOk | JoinRoomAckErr;

export interface InputReq {
  pos: Vec3;
  heading: number;
  /** Camera pitch in radians; optional for forward compat with older clients. */
  pitch?: number;
  jumping: boolean;
  /** Client time in ms; only used for rendering interpolation. */
  t: number;
}

export interface BlockPlaceReq {
  pos: Vec3;
  blockId: number;
}

export interface BlockBreakReq {
  pos: Vec3;
}

/** Survival: drop one stack unit from a hotbar slot near the player. */
export interface DropItemReq {
  hotbarIndex: number;
}

/** Survival: hotbar blocks + main item storage (27). Creative clients ignore itemSlots. */
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
  /** Radians; omitted for older clients (treat as 0 on render). */
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
  | { kind: "GAME_MODE_CHANGED"; sessionId: string; gameMode: GameMode }
  | { kind: "WORLD_DROP_SPAWNED"; sessionId: string; drop: WorldDrop }
  | { kind: "WORLD_DROP_REMOVED"; sessionId: string; id: string };

export const MAX_REACH = 8;
