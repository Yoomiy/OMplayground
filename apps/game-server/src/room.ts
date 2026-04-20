import type {
  AnyGameModule,
  GameModule,
  GameOutcome,
  GameSeat
} from "@playground/game-logic";

export interface RoomPlayer {
  userId: string;
  displayName: string;
}

export interface Room<State = unknown> {
  sessionId: string;
  gameId: string;
  gameKey: string;
  gender: "boy" | "girl";
  /** Authoritative host for disconnect transfer (from game_sessions.host_id). */
  hostId: string;
  /** Minimum players required before the session transitions out of "waiting". */
  minPlayers: number;
  module: GameModule<State, unknown>;
  state: State;
  players: Map<string, RoomPlayer>;
  /** Teachers observing the same-gender session (not in player_ids / DB join list). */
  spectators: Map<string, RoomPlayer>;
}

const rooms = new Map<string, Room<unknown>>();

export function getOrCreateRoom<State>(
  sessionId: string,
  meta: {
    gameId: string;
    gameKey: string;
    module: GameModule<State, unknown>;
    gender: "boy" | "girl";
    hostId: string;
    minPlayers?: number;
  }
): Room<State> {
  const existing = rooms.get(sessionId) as Room<State> | undefined;
  if (existing) return existing;
  const created: Room<State> = {
    sessionId,
    gameId: meta.gameId,
    gameKey: meta.gameKey,
    gender: meta.gender,
    hostId: meta.hostId,
    minPlayers: meta.minPlayers ?? meta.module.minPlayers,
    module: meta.module,
    state: meta.module.initialState([]),
    players: new Map(),
    spectators: new Map()
  };
  rooms.set(sessionId, created as Room<unknown>);
  return created;
}

/**
 * Room is "idle" (session not yet truly playing) while fewer than `minPlayers`
 * have joined. Generalizes over 2p, 4p, etc. games.
 */
export function isRoomIdle<S>(room: Room<S>): boolean {
  return room.players.size < room.minPlayers;
}

export function getRoom(sessionId: string): Room<unknown> | undefined {
  return rooms.get(sessionId);
}

/** Snapshot of live rooms for room-wide sweeps (recess end, cleanup). */
export function listRooms(): Room<unknown>[] {
  return Array.from(rooms.values());
}

export function deleteRoom(sessionId: string): void {
  rooms.delete(sessionId);
}

/**
 * Removes a socket/player. If the host disconnects, transfers host to
 * another remaining player.
 */
export function removePlayerFromRoom(
  sessionId: string,
  userId: string
): { newHostId?: string; roomEmpty: boolean } {
  const r = rooms.get(sessionId);
  if (!r) return { roomEmpty: true };
  const wasHost = r.hostId === userId;
  r.players.delete(userId);
  if (r.players.size === 0) {
    if (r.spectators.size === 0) {
      rooms.delete(sessionId);
    }
    return { roomEmpty: true };
  }
  if (wasHost) {
    const nextHost = r.players.keys().next().value as string;
    r.hostId = nextHost;
    return { newHostId: nextHost, roomEmpty: false };
  }
  return { roomEmpty: false };
}

/**
 * Teacher / observer: not counted as a player, does not touch DB player_ids.
 */
export function attachSpectator<S>(
  room: Room<S>,
  userId: string,
  displayName: string
): { spectator: RoomPlayer } {
  const existing = room.spectators.get(userId);
  if (existing) {
    return { spectator: existing };
  }
  const spectator: RoomPlayer = { userId, displayName };
  room.spectators.set(userId, spectator);
  return { spectator };
}

export function removeSpectatorFromRoom(sessionId: string, userId: string): void {
  const r = rooms.get(sessionId);
  if (!r) return;
  r.spectators.delete(userId);
  if (r.players.size === 0 && r.spectators.size === 0) {
    rooms.delete(sessionId);
  }
}

/**
 * Assigns a player to the room. While the room is still idle (below
 * `minPlayers`) we re-seed authoritative state via `module.initialState`
 * so per-seat data (e.g. TicTacToe X/O assignment) is populated for the
 * current player set. Once the room is active we never re-seed — moves
 * already applied would be lost.
 */
export function assignPlayer<S>(
  room: Room<S>,
  userId: string,
  displayName: string
): { player: RoomPlayer } | { error: { code: string; message: string } } {
  if (room.players.has(userId)) {
    return { player: room.players.get(userId)! };
  }
  if (room.players.size >= room.module.maxPlayers) {
    return {
      error: { code: "ROOM_FULL", message: "Session is full" }
    };
  }
  const wasIdle = isRoomIdle(room);
  const player: RoomPlayer = { userId, displayName };
  room.players.set(userId, player);
  if (wasIdle) {
    const seats: GameSeat[] = Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      displayName: p.displayName
    }));
    room.state = room.module.initialState(seats);
  }
  return { player };
}

/**
 * Host-only guard for the STOP_GAME intent. Returns ok when the caller is
 * the room's current host; otherwise a structured error.
 */
export function canStopGame<S>(
  room: Room<S>,
  userId: string
): { ok: true } | { ok: false; error: { code: string; message: string } } {
  if (!room.players.has(userId)) {
    return {
      ok: false,
      error: { code: "NOT_IN_ROOM", message: "Player not in session" }
    };
  }
  if (room.hostId !== userId) {
    return {
      ok: false,
      error: { code: "NOT_HOST", message: "Only the host can stop the game" }
    };
  }
  return { ok: true };
}

export interface ApplyIntentOk<State> {
  ok: true;
  state: State;
  outcome?: GameOutcome;
}

export interface ApplyIntentErr {
  ok: false;
  error: { code: string; message: string };
}

/**
 * Thin wrapper around `room.module.applyIntent` that also enforces
 * room-level invariants (caller must be seated) and commits the new
 * state on success. Kept here so `index.ts` stays a dumb socket layer.
 */
export function applyIntent<S>(
  room: Room<S>,
  userId: string,
  intent: unknown
): ApplyIntentOk<S> | ApplyIntentErr {
  if (!room.players.has(userId)) {
    return {
      ok: false,
      error: { code: "NOT_IN_ROOM", message: "Player not in session" }
    };
  }
  const res = room.module.applyIntent(room.state, userId, intent);
  if (!res.ok) return res;
  room.state = res.state;
  return { ok: true, state: res.state, outcome: res.outcome };
}

/** Re-export of the registry type so callers don't import two packages. */
export type { AnyGameModule };
