import {
  createWorld,
  hydrateDeltas,
  seedFromSessionId,
  serializeDeltas,
  spawnPointFor,
  type DeltaTuple,
  type WorldState
} from "./world";
import {
  createEmptyHotbar,
  cloneHotbar,
  hotbarFromPersisted,
  type HotbarState
} from "./inventory";
import type { GameMode, HotbarSlot, Vec3 } from "./protocol";

/**
 * In-memory voxel-room registry. Mirrors the structure of
 * apps/game-server/src/room.ts but the state is voxel-shaped (sparse
 * block map + per-player position) instead of a turn-based snapshot.
 *
 * Per-session isolation is structural: `rooms` keys by sessionId and
 * every emit goes through `voxel:${sessionId}` (see index.ts).
 */

export interface RoomPlayer {
  userId: string;
  displayName: string;
}

export interface PlayerRuntime extends RoomPlayer {
  pos: Vec3;
  heading: number;
  jumping: boolean;
  /** Last client INPUT timestamp (ms). Forwarded in snapshots for client interp. */
  t: number;
  /** Server time of the last write — used by tick coalescing. */
  lastInputAt: number;
  /** Set only in survival mode — authoritative hotbar for pause/resume. */
  inventory?: HotbarState;
}

export interface VoxelRoom {
  sessionId: string;
  gameId: string;
  gender: "boy" | "girl";
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  world: WorldState;
  players: Map<string, PlayerRuntime>;
  /** Persisted participant roster for resumed/paused games. */
  roster: RoomPlayer[];
  spawnPoints: Map<string, Vec3>;
  paused: boolean;
  /** Defaults to creative when omitted (legacy in-memory rooms). */
  gameMode?: GameMode;
  /** Survival inventories for roster members not currently connected. */
  disconnectedInventories: Map<string, HotbarState>;
  /** Set true when state changed since last tick emit. */
  dirty: boolean;
  /** ms timestamp of last emitted snapshot — used by coalescing in tick.ts. */
  lastTickAt: number;
}

const rooms = new Map<string, VoxelRoom>();

export interface CreateRoomMeta {
  gameId: string;
  gender: "boy" | "girl";
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  roster: RoomPlayer[];
  paused: boolean;
  /** game_sessions.game_state for paused rows; replays seed + deltas. */
  resumedState?: PersistedRoomState | null;
}

export interface PersistedRoomState {
  voxel: true;
  seed: number;
  deltas: DeltaTuple[];
  spawnPoints: Record<string, Vec3>;
  gameMode?: GameMode;
  inventories?: Record<string, HotbarSlot[]>;
}

export function getRoom(sessionId: string): VoxelRoom | undefined {
  return rooms.get(sessionId);
}

export function listRooms(): VoxelRoom[] {
  return Array.from(rooms.values());
}

export function deleteRoom(sessionId: string): void {
  rooms.delete(sessionId);
}

export function getOrCreateRoom(
  sessionId: string,
  meta: CreateRoomMeta
): VoxelRoom {
  const existing = rooms.get(sessionId);
  if (existing) {
    if (meta.paused) existing.paused = true;
    if (meta.roster.length > 0) existing.roster = meta.roster;
    if (!existing.disconnectedInventories) {
      existing.disconnectedInventories = new Map();
    }
    return existing;
  }
  const seed = meta.resumedState?.seed ?? seedFromSessionId(sessionId);
  const world = createWorld(seed);
  if (meta.resumedState?.deltas?.length) {
    hydrateDeltas(world, meta.resumedState.deltas);
  }
  const spawnPoints = new Map<string, Vec3>();
  if (meta.resumedState?.spawnPoints) {
    for (const [uid, pt] of Object.entries(meta.resumedState.spawnPoints)) {
      spawnPoints.set(uid, pt);
    }
  }
  const disconnectedInventories = new Map<string, HotbarState>();
  const emptyTemplate = createEmptyHotbar();
  if (meta.resumedState?.inventories) {
    for (const [uid, raw] of Object.entries(meta.resumedState.inventories)) {
      disconnectedInventories.set(
        uid,
        hotbarFromPersisted(raw, emptyTemplate)
      );
    }
  }
  const created: VoxelRoom = {
    sessionId,
    gameId: meta.gameId,
    gender: meta.gender,
    hostId: meta.hostId,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
    world,
    players: new Map(),
    roster: meta.roster,
    spawnPoints,
    paused: meta.paused,
    gameMode: meta.resumedState?.gameMode ?? "creative",
    disconnectedInventories,
    dirty: false,
    lastTickAt: 0
  };
  rooms.set(sessionId, created);
  return created;
}

export function roomRoster(room: VoxelRoom): RoomPlayer[] {
  const merged = new Map<string, RoomPlayer>();
  for (const p of room.roster) merged.set(p.userId, p);
  for (const p of room.players.values()) {
    merged.set(p.userId, { userId: p.userId, displayName: p.displayName });
  }
  return Array.from(merged.values());
}

export function connectedPlayers(room: VoxelRoom): RoomPlayer[] {
  return Array.from(room.players.values()).map((p) => ({
    userId: p.userId,
    displayName: p.displayName
  }));
}

export function spawnFor(room: VoxelRoom, userId: string): Vec3 {
  const cached = room.spawnPoints.get(userId);
  if (cached) return cached;
  const pt = spawnPointFor(room.world.seed, userId);
  room.spawnPoints.set(userId, pt);
  return pt;
}

export function assignPlayer(
  room: VoxelRoom,
  userId: string,
  displayName: string
): { player: PlayerRuntime } | { error: { code: string; message: string } } {
  const existing = room.players.get(userId);
  if (existing) return { player: existing };
  if (room.players.size >= room.maxPlayers) {
    return {
      error: { code: "ROOM_FULL", message: "Session is full" }
    };
  }
  const spawn = spawnFor(room, userId);
  const now = Date.now();
  const player: PlayerRuntime = {
    userId,
    displayName,
    pos: spawn,
    heading: 0,
    jumping: false,
    t: now,
    lastInputAt: now
  };
  if ((room.gameMode ?? "creative") === "survival") {
    const cached = room.disconnectedInventories.get(userId);
    player.inventory = cached
      ? cloneHotbar(cached)
      : createEmptyHotbar();
    room.disconnectedInventories.delete(userId);
  }
  room.players.set(userId, player);
  if (!room.roster.some((p) => p.userId === userId)) {
    room.roster.push({ userId, displayName });
  }
  room.dirty = true;
  return { player };
}

export function removePlayerFromRoom(
  sessionId: string,
  userId: string
): { newHostId?: string; roomEmpty: boolean } {
  const r = rooms.get(sessionId);
  if (!r) return { roomEmpty: true };
  const wasHost = r.hostId === userId;
  const leaving = r.players.get(userId);
  if (leaving?.inventory) {
    r.disconnectedInventories.set(userId, cloneHotbar(leaving.inventory));
  }
  r.players.delete(userId);
  r.dirty = true;
  if (r.players.size === 0) {
    rooms.delete(sessionId);
    return { roomEmpty: true };
  }
  if (wasHost) {
    const nextHost = r.players.keys().next().value as string;
    r.hostId = nextHost;
    return { newHostId: nextHost, roomEmpty: false };
  }
  return { roomEmpty: false };
}

export function canStopGame(
  room: VoxelRoom,
  userId: string
): { ok: true } | { ok: false; error: { code: string; message: string } } {
  if (!room.players.has(userId)) {
    return {
      ok: false,
      error: { code: "NOT_IN_ROOM", message: "השחקן לא נמצא בחדר" }
    };
  }
  if (room.hostId !== userId) {
    return {
      ok: false,
      error: { code: "NOT_HOST", message: "רק המארח יכול לבצע את הפעולה" }
    };
  }
  return { ok: true };
}

export function snapshotPersistedState(room: VoxelRoom): PersistedRoomState {
  const spawnPoints: Record<string, Vec3> = {};
  for (const [uid, pt] of room.spawnPoints) spawnPoints[uid] = pt;
  const inventories: Record<string, HotbarSlot[]> = {};
  if ((room.gameMode ?? "creative") === "survival") {
    for (const p of room.players.values()) {
      if (p.inventory) inventories[p.userId] = cloneHotbar(p.inventory);
    }
    for (const [uid, hotbar] of room.disconnectedInventories) {
      if (!(uid in inventories)) inventories[uid] = cloneHotbar(hotbar);
    }
  }
  return {
    voxel: true,
    seed: room.world.seed,
    deltas: serializeDeltas(room.world),
    spawnPoints,
    gameMode: room.gameMode ?? "creative",
    ...(Object.keys(inventories).length > 0 ? { inventories } : {})
  };
}

/** Test-only: drop every room from the in-memory map. */
export function __resetRoomsForTest(): void {
  rooms.clear();
}
