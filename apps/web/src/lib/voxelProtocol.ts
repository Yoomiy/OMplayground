/**
 * Wire-protocol types for the voxel server, mirrored on the client. Kept
 * in lock-step with apps/minecraft-server/src/protocol.ts. Per the plan,
 * we inline now and extract into `packages/voxel-protocol` once both
 * sides stabilize (avoids a cross-app TS path until needed).
 */

export type Vec3 = [number, number, number];

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
}

export interface JoinRoomAckErr {
  ok: false;
  error: { code: string; message: string };
}

export type JoinRoomAck = JoinRoomAckOk | JoinRoomAckErr;

export interface InputReq {
  pos: Vec3;
  heading: number;
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

export interface SimpleAck {
  ok: boolean;
  error?: { code: string; message: string };
}

export interface PlayerSnapshot {
  pos: Vec3;
  heading: number;
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
  | { kind: "RECESS_ENDED"; sessionId: string };

export const BLOCK_REGISTRY = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  GLASS: 8
} as const;

export const PLACEABLE_BLOCK_IDS: readonly number[] = [
  BLOCK_REGISTRY.GRASS,
  BLOCK_REGISTRY.DIRT,
  BLOCK_REGISTRY.STONE,
  BLOCK_REGISTRY.WOOD,
  BLOCK_REGISTRY.LEAVES,
  BLOCK_REGISTRY.SAND,
  BLOCK_REGISTRY.GLASS
];

export const MAX_REACH = 8;
