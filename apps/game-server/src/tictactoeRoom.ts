import {
  applyTicTacToeIntent,
  initialTicTacToeState,
  type Player,
  type TicTacToeState
} from "@playground/game-logic";

export interface RoomPlayer {
  userId: string;
  displayName: string;
  symbol: Player;
}

export interface TicTacToeRoom {
  sessionId: string;
  gameId: string;
  gender: "boy" | "girl";
  /** Authoritative host for disconnect transfer (from game_sessions.host_id). */
  hostId: string;
  /** Minimum players required before the session transitions out of "waiting". */
  minPlayers: number;
  state: TicTacToeState;
  players: Map<string, RoomPlayer>;
}

const rooms = new Map<string, TicTacToeRoom>();

export function getOrCreateRoom(
  sessionId: string,
  meta: {
    gameId: string;
    gender: "boy" | "girl";
    hostId: string;
    minPlayers?: number;
  }
): TicTacToeRoom {
  let r = rooms.get(sessionId);
  if (!r) {
    r = {
      sessionId,
      gameId: meta.gameId,
      gender: meta.gender,
      hostId: meta.hostId,
      minPlayers: meta.minPlayers ?? 2,
      state: initialTicTacToeState(),
      players: new Map()
    };
    rooms.set(sessionId, r);
  }
  return r;
}

/**
 * Room is "idle" (session not yet truly playing) while fewer than `minPlayers`
 * have joined. Generalizes over 2p, 4p, etc. games.
 */
export function isRoomIdle(room: TicTacToeRoom): boolean {
  return room.players.size < room.minPlayers;
}

export function getRoom(sessionId: string): TicTacToeRoom | undefined {
  return rooms.get(sessionId);
}

/** Snapshot of live rooms for room-wide sweeps (recess end, cleanup). */
export function listRooms(): TicTacToeRoom[] {
  return Array.from(rooms.values());
}

export function deleteRoom(sessionId: string): void {
  rooms.delete(sessionId);
}

/**
 * Removes a socket/player. If the host disconnects, transfers host to another remaining player.
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

export function assignPlayer(
  room: TicTacToeRoom,
  userId: string,
  displayName: string
): { player: RoomPlayer } | { error: { code: string; message: string } } {
  if (room.players.has(userId)) {
    return { player: room.players.get(userId)! };
  }
  if (room.players.size >= 2) {
    return {
      error: { code: "ROOM_FULL", message: "Session already has two players" }
    };
  }
  const symbol: Player = room.players.size === 0 ? "X" : "O";
  const player: RoomPlayer = { userId, displayName, symbol };
  room.players.set(userId, player);
  return { player };
}

/**
 * Host-only guard for the STOP_GAME intent. Returns ok when the caller is
 * the room's current host; otherwise a structured error.
 */
export function canStopGame(
  room: TicTacToeRoom,
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

export function applyMove(
  room: TicTacToeRoom,
  userId: string,
  cellIndex: number
):
  | { state: TicTacToeState }
  | { error: { code: string; message: string } } {
  const p = room.players.get(userId);
  if (!p) {
    return { error: { code: "NOT_IN_ROOM", message: "Player not in session" } };
  }
  const res = applyTicTacToeIntent(room.state, {
    type: "MOVE",
    cellIndex,
    player: p.symbol
  });
  if (res.error) {
    return { error: res.error };
  }
  room.state = res.state;
  return { state: res.state };
}
