/**
 * Wire-protocol types for the voxel server, mirrored on the client (`protocol.ts`).
 * Item ids/metadata are authored in `@playground/voxel-content`; wire types stay here.
 */

import {
  CRAFTING_TABLE_GRID_SIZE,
  PERSONAL_CRAFTING_GRID_SIZE,
  webItemIcons
} from "@playground/voxel-content";

export {
  BLOCK_REGISTRY,
  ITEM_REGISTRY,
  PLACEABLE_BLOCK_IDS
} from "@playground/voxel-content";

export const ITEM_ICON: Record<number, string> = webItemIcons();

export type Vec3 = [number, number, number];

export type GameMode = "creative" | "survival";

export interface HotbarSlot {
  blockId: number;
  itemId: number;
  count: number;
  durability?: number;
}

export interface ItemSlot {
  itemId: number;
  count: number;
  /** Remaining tool durability; omitted = full from item def. */
  durability?: number;
}

export interface PlayerVitals {
  health: number;
  hunger: number;
  saturation: number;
  exhaustion: number;
}

/** One cell in the survival 3x3 backing crafting grid (blocks or items, never both). */
export interface CraftingGridSlot {
  blockId: number;
  itemId: number;
  count: number;
  durability?: number;
}

export type InventoryRegion = "hotbar" | "storage" | "craft" | "equipment";
export type CraftingGridWidth = 2 | 3;

export interface InventoryMoveReq {
  from: InventoryRegion;
  fromIndex: number;
  to: InventoryRegion;
  toIndex: number;
}

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
      spawnedAt?: number;
      vx?: number;
      vy?: number;
      vz?: number;
    }
  | {
      id: string;
      kind: "item";
      pos: Vec3;
      itemId: number;
      count: number;
      spawnedAt?: number;
      vx?: number;
      vy?: number;
      vz?: number;
    };

export interface WorldDropWireDelta {
  id: string;
  pos: Vec3;
  count?: number;
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
  equipmentSlots: ItemSlot[];
  vitals: PlayerVitals;
  craftingGrid: CraftingGridSlot[];
  craftingGridWidth?: CraftingGridWidth;
  /** Survival world stacks; newer servers only. */
  drops?: WorldDrop[];
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
  /** Survival: selected hotbar index 0..8. */
  hotbarIndex?: number;
}

export interface BlockPlaceReq {
  pos: Vec3;
  blockId: number;
}

export interface BlockBreakReq {
  pos: Vec3;
}

export interface BreakStartReq {
  pos: Vec3;
}

export interface BreakStartAck {
  ok: boolean;
  durationMs?: number;
  error?: { code: string; message: string };
}

export interface BreakFinishReq {
  pos: Vec3;
}

export interface BreakCancelReq {
  pos: Vec3;
}

export interface DropItemReq {
  hotbarIndex: number;
}

export interface EatReq {
  hotbarIndex: number;
}

export interface EatStartAck extends SimpleAck {
  durationMs?: number;
}

export interface InventorySyncPayload {
  slots: HotbarSlot[];
  itemSlots?: ItemSlot[];
  equipmentSlots?: ItemSlot[];
  craftingSlots?: CraftingGridSlot[];
  craftingGridWidth?: CraftingGridWidth;
  vitals?: PlayerVitals;
}

export const MAIN_ITEM_INVENTORY_SLOTS = 27;
export const EQUIPMENT_SLOT_COUNT = 4;
export const PERSONAL_CRAFTING_GRID_SLOTS = PERSONAL_CRAFTING_GRID_SIZE;
export const CRAFTING_GRID_SLOTS = CRAFTING_TABLE_GRID_SIZE;
/** Max units per crafting grid cell (one ingredient per slot). */
export const CRAFTING_CELL_MAX = 1;

export interface ItemPickupPayload {
  itemId: number;
  count: number;
}

export interface CraftReq {
  recipeId: string;
}

export interface OpenCraftingTableReq {
  pos: Vec3;
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
  vitals?: PlayerVitals;
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
  | { kind: "WORLD_DROP_REMOVED"; sessionId: string; id: string }
  | {
      kind: "WORLD_DROP_UPDATE";
      sessionId: string;
      updates: WorldDropWireDelta[];
    };

export const MAX_REACH = 8;
