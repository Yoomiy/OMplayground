import type {
  AnyGameModule,
  GameModule,
  GameOutcome,
  GameSeat
} from "@playground/game-logic";
import {
  applyChessIntent,
  isChessSetTimeControlIntent,
  type ChessState
} from "@playground/game-logic";

export interface RoomPlayer {
  userId: string;
  displayName: string;
}

export interface RemovePlayerResult {
  newHostId?: string;
  /** No active players remain; persistence may pause the game session. */
  roomEmpty: boolean;
  /** The in-memory room no longer exists; room-scoped live state may be released. */
  roomDeleted: boolean;
}

export type DrawingRoomContext =
  | { boardMode: "game" }
  | { boardMode: "classroom"; classroomId: string; roomCode: string };

export interface Room<State = unknown> {
  sessionId: string;
  gameId: string;
  gameKey: string;
  drawingContext?: DrawingRoomContext;
  gender: "boy" | "girl" | "all";
  /** Authoritative host for disconnect transfer (from game_sessions.host_id). */
  hostId: string | null;
  /** Minimum players required before the session transitions out of "waiting". */
  minPlayers: number;
  module: GameModule<State, unknown>;
  state: State;
  /** Persisted participant roster for resumed/paused games. */
  roster: RoomPlayer[];
  players: Map<string, RoomPlayer>;
  /** Teachers observing the same-gender session (not in player_ids / DB join list). */
  spectators: Map<string, RoomPlayer>;
  /** Child overflow viewers, kept separate from teacher observers and player seats. */
  childSpectatorIds: Set<string>;
  /**
   * After the room has ever had `minPlayers` seated, do not re-run `initialState`
   * when `players` dips below `minPlayers` (e.g. one kid refreshes).
   */
  hasBeenActive: boolean;
  paused: boolean;
  peakPlayerCount: number;
  rematch?: {
    requestedBy: string;
    accepted: Set<string>;
    refused: Set<string>;
  };
}

const rooms = new Map<string, Room<unknown>>();

function assignLateJoinSeatIfSequential<S>(room: Room<S>, userId: string): void {
  const state = room.state as { seats?: Record<string, unknown> } | null;
  const seats = state?.seats;
  if (!seats || seats[userId]) return;
  const values = Object.values(seats);
  if (
    values.every((v) => typeof v === "string" && /^p\d+$/.test(v))
  ) {
    (seats as Record<string, string>)[userId] = `p${values.length + 1}`;
  }
}

export function getOrCreateRoom<State>(
  sessionId: string,
  meta: {
    gameId: string;
    gameKey: string;
    drawingContext?: DrawingRoomContext;
    module: GameModule<State, unknown>;
    gender: "boy" | "girl" | "all";
    hostId: string | null;
    minPlayers?: number;
    roster?: RoomPlayer[];
    paused?: boolean;
    peakPlayerCount?: number;
    /** DB snapshot for `status='paused'` rows — skip idle `initialState` re-seeding. */
    resumedState?: unknown;
  }
): Room<State> {
  const existing = rooms.get(sessionId) as Room<State> | undefined;
  if (existing) {
    if (meta.drawingContext) existing.drawingContext = meta.drawingContext;
    existing.paused = existing.paused || meta.paused === true;
    if (meta.roster) {
      existing.roster = meta.roster;
    }
    return existing;
  }
  const resumed = meta.resumedState != null;
  const created: Room<State> = {
    sessionId,
    gameId: meta.gameId,
    gameKey: meta.gameKey,
    drawingContext: meta.drawingContext,
    gender: meta.gender,
    hostId: meta.hostId,
    minPlayers: meta.minPlayers ?? meta.module.minPlayers,
    module: meta.module,
    state: resumed
      ? (meta.resumedState as State)
      : meta.module.initialState([]),
    roster: meta.roster ?? [],
    players: new Map(),
    spectators: new Map(),
    childSpectatorIds: new Set(),
    hasBeenActive: resumed,
    paused: meta.paused === true,
    peakPlayerCount: meta.peakPlayerCount ?? 0
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

export function roomRoster<S>(room: Room<S>): RoomPlayer[] {
  const merged = new Map<string, RoomPlayer>();
  for (const p of room.roster) merged.set(p.userId, p);
  for (const p of room.players.values()) merged.set(p.userId, p);
  return Array.from(merged.values());
}

export function missingPlayers<S>(room: Room<S>): RoomPlayer[] {
  return roomRoster(room).filter((p) => !room.players.has(p.userId));
}

export function connectedPlayers<S>(room: Room<S>): RoomPlayer[] {
  return Array.from(room.players.values());
}

export function preservesHostOnDisconnect<S>(room: Room<S>): boolean {
  return room.drawingContext?.boardMode === "classroom";
}

/**
 * Turn-based modules rotate player order for a rematch so the starting role
 * (for example X, red, or player one) changes hands. Other game types retain
 * their current order.
 */
export function playersForRematch<S>(
  room: Room<S>,
  players = connectedPlayers(room)
): RoomPlayer[] {
  return room.module.rotateSeatsOnRematch ? [...players].reverse() : players;
}

/**
 * Removes a socket/player. Active rooms transfer a departing host to another
 * remaining player; paused rooms retain their host until that player returns.
 */
export function removePlayerFromRoom(
  sessionId: string,
  userId: string
): RemovePlayerResult {
  const r = rooms.get(sessionId);
  if (!r) return { roomEmpty: true, roomDeleted: true };
  const wasHost = r.hostId === userId;
  r.players.delete(userId);
  if (r.players.size === 0) {
    const roomDeleted = r.spectators.size === 0;
    if (roomDeleted) {
      rooms.delete(sessionId);
    }
    return { roomEmpty: true, roomDeleted };
  }
  if (wasHost && !r.paused) {
    const nextHost = r.players.keys().next().value as string;
    r.hostId = nextHost;
    return { newHostId: nextHost, roomEmpty: false, roomDeleted: false };
  }
  return { roomEmpty: false, roomDeleted: false };
}

/**
 * Teacher / observer: not counted as a player, does not touch DB player_ids.
 */
export function attachSpectator<S>(
  room: Room<S>,
  userId: string,
  displayName: string,
  options?: { childSpectator?: boolean }
): { spectator: RoomPlayer } {
  const existing = room.spectators.get(userId);
  if (existing) {
    if (options?.childSpectator) room.childSpectatorIds.add(userId);
    return { spectator: existing };
  }
  const spectator: RoomPlayer = { userId, displayName };
  room.spectators.set(userId, spectator);
  if (options?.childSpectator) room.childSpectatorIds.add(userId);
  return { spectator };
}

export function removeSpectatorFromRoom(sessionId: string, userId: string): void {
  const r = rooms.get(sessionId);
  if (!r) return;
  r.spectators.delete(userId);
  r.childSpectatorIds.delete(userId);
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
  room.peakPlayerCount = Math.max(room.peakPlayerCount || 0, room.players.size);
  if (!room.roster.some((p) => p.userId === userId)) {
    room.roster.push(player);
  }
  assignLateJoinSeatIfSequential(room, userId);
  if (wasIdle && !room.hasBeenActive && room.gameKey !== "drawing") {
    const seats: GameSeat[] = Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      displayName: p.displayName
    }));
    room.state = room.module.initialState(seats);
  }
  if (!isRoomIdle(room) || room.gameKey === "drawing") {
    room.hasBeenActive = true;
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

/** A paused game may resume only when its host is present and its configured
 * minimum number of player seats is occupied. Spectators are not players. */
export function canResumeGame<S>(
  room: Room<S>,
  userId: string
): { ok: true } | { ok: false; error: { code: string; message: string } } {
  const hostGuard = canStopGame(room, userId);
  if (!hostGuard.ok) return hostGuard;
  if (!room.paused) {
    return {
      ok: false,
      error: { code: "GAME_NOT_PAUSED", message: "המשחק אינו מושהה" }
    };
  }
  if (isRoomIdle(room)) {
    return {
      ok: false,
      error: {
        code: "NOT_ENOUGH_PLAYERS",
        message: "אין מספיק שחקנים מחוברים כדי להמשיך את המשחק"
      }
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
      error: { code: "NOT_IN_ROOM", message: "השחקן לא נמצא בחדר" }
    };
  }

  if (room.gameKey === "chess" && isChessSetTimeControlIntent(intent) && userId !== room.hostId) {
    return {
      ok: false,
      error: { code: "NOT_HOST", message: "רק המארח יכול לשנות בקרת זמן" }
    };
  }

  if (room.gameKey === "chess") {
    const chessState = room.state as ChessState;
    if (
      chessState.status === "playing" &&
      chessState.timeControl?.mode === "timed" &&
      chessState.clocks &&
      chessState.lastTickAt
    ) {
      const tick = applyChessIntent(chessState, chessState.next, { type: "check_timeout" });
      room.state = tick.state as S;
      if (tick.state.status !== "playing") {
        let outcome: GameOutcome | undefined;
        if (tick.state.status === "won" && tick.state.winner) {
          outcome = { kind: "won", winner: tick.state.winner };
        } else if (tick.state.status === "draw") {
          outcome = { kind: "draw" };
        }
        return { ok: true, state: tick.state as S, outcome };
      }
    }
  }

  const res = room.module.applyIntent(room.state, userId, intent);
  if (!res.ok) return res;
  room.state = res.state;
  return { ok: true, state: res.state, outcome: res.outcome };
}

/** Re-export of the registry type so callers don't import two packages. */
export type { AnyGameModule };
