import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersistedRoomState } from "./room";

/**
 * Supabase writes for `game_sessions` on lifecycle boundaries (join, leave,
 * pause, resume, stop, recess-end). Mirrors apps/game-server/src/sessionPersistence.ts
 * + lifecycle.ts but specialized to the voxel `game_state` shape.
 */

export interface MinimalSession {
  player_ids: string[];
  player_names: string[];
  status: "waiting" | "playing" | "paused" | "completed";
}

export interface PersistJoinArgs {
  supabase: SupabaseClient;
  sessionId: string;
  session: MinimalSession;
  userId: string;
  displayName: string;
  connectedPlayerIds?: string[];
  connectedPlayerNames?: string[];
  /** Voxel rooms count as "active" the moment one player joins. */
  roomStatusIsIdle: boolean;
  peakPlayerCount?: number;
}

export async function persistPlayerJoin(
  args: PersistJoinArgs
): Promise<boolean> {
  const {
    supabase,
    sessionId,
    session,
    userId,
    displayName,
    connectedPlayerIds = [],
    connectedPlayerNames = [],
    roomStatusIsIdle,
    peakPlayerCount
  } = args;
  if (session.player_ids.includes(userId)) {
    await supabase
      .from("game_sessions")
      .update({
        connected_player_ids: connectedPlayerIds,
        connected_player_names: connectedPlayerNames,
        last_activity: new Date().toISOString(),
        ...(peakPlayerCount !== undefined ? { peak_player_count: peakPlayerCount } : {})
      })
      .eq("id", sessionId);
    return false;
  }
  const nextPlayerIds = Array.from(new Set([...session.player_ids, userId]));
  const nextPlayerNames = [...session.player_names, displayName];
  const nextStatus =
    session.status === "completed"
      ? "completed"
      : roomStatusIsIdle
        ? session.status
        : "playing";
  await supabase
    .from("game_sessions")
    .update({
      player_ids: nextPlayerIds,
      player_names: nextPlayerNames,
      connected_player_ids: connectedPlayerIds,
      connected_player_names: connectedPlayerNames,
      status: nextStatus,
      last_activity: new Date().toISOString(),
      ...(peakPlayerCount !== undefined ? { peak_player_count: peakPlayerCount } : {})
    })
    .eq("id", sessionId);
  return true;
}

export interface LeaveResult {
  newHostId?: string;
  roomEmpty: boolean;
}

export interface PersistLeaveArgs {
  supabase: SupabaseClient;
  sessionId: string;
  result: LeaveResult;
  connectedPlayerIds?: string[];
  connectedPlayerNames?: string[];
  /** Voxel state to persist when the room empties. */
  gameState?: PersistedRoomState;
  peakPlayerCount?: number;
}

export async function persistPlayerLeave(
  args: PersistLeaveArgs
): Promise<void> {
  const {
    supabase,
    sessionId,
    result,
    connectedPlayerIds = [],
    connectedPlayerNames = [],
    gameState,
    peakPlayerCount
  } = args;
  if (result.newHostId) {
    const { data: kp } = await supabase
      .from("kid_profiles")
      .select("grade, full_name")
      .eq("id", result.newHostId)
      .maybeSingle();
    await supabase
      .from("game_sessions")
      .update({
        host_id: result.newHostId,
        host_name: kp?.full_name ?? connectedPlayerNames[0] ?? "שחקן",
        host_grade: kp?.grade ?? null,
        connected_player_ids: connectedPlayerIds,
        connected_player_names: connectedPlayerNames,
        last_activity: new Date().toISOString(),
        ...(peakPlayerCount !== undefined ? { peak_player_count: peakPlayerCount } : {})
      })
      .eq("id", sessionId);
  }
  if (result.roomEmpty) {
    const payload: {
      status: "paused";
      game_state?: Record<string, unknown>;
      connected_player_ids: string[];
      connected_player_names: string[];
      last_activity: string;
      peak_player_count?: number;
    } = {
      status: "paused",
      connected_player_ids: connectedPlayerIds,
      connected_player_names: connectedPlayerNames,
      last_activity: new Date().toISOString()
    };
    if (gameState !== undefined) {
      payload.game_state = gameState as unknown as Record<string, unknown>;
    }
    if (peakPlayerCount !== undefined) {
      payload.peak_player_count = peakPlayerCount;
    }
    await supabase
      .from("game_sessions")
      .update(payload)
      .eq("id", sessionId)
      .in("status", ["waiting", "playing", "paused"]);
  } else if (!result.newHostId) {
    await supabase
      .from("game_sessions")
      .update({
        connected_player_ids: connectedPlayerIds,
        connected_player_names: connectedPlayerNames,
        last_activity: new Date().toISOString(),
        ...(peakPlayerCount !== undefined ? { peak_player_count: peakPlayerCount } : {})
      })
      .eq("id", sessionId);
  }
}

export interface PersistGamePausedArgs {
  supabase: SupabaseClient;
  sessionId: string;
  gameState: PersistedRoomState;
  connectedPlayerIds?: string[];
  connectedPlayerNames?: string[];
  now?: string;
}

export async function persistGamePaused(
  args: PersistGamePausedArgs
): Promise<void> {
  const now = args.now ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "paused",
      game_state: args.gameState as unknown as Record<string, unknown>,
      connected_player_ids: args.connectedPlayerIds ?? [],
      connected_player_names: args.connectedPlayerNames ?? [],
      last_activity: now
    })
    .eq("id", args.sessionId);
}

/** Recess sweep uses the same payload shape; alias mirrors game-server. */
export const persistRecessPause = persistGamePaused;

export interface PersistGameResumedArgs {
  supabase: SupabaseClient;
  sessionId: string;
  connectedPlayerIds: string[];
  connectedPlayerNames: string[];
  now?: string;
}

export async function persistGameResumed(
  args: PersistGameResumedArgs
): Promise<void> {
  const now = args.now ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "playing",
      connected_player_ids: args.connectedPlayerIds,
      connected_player_names: args.connectedPlayerNames,
      last_activity: now
    })
    .eq("id", args.sessionId);
}

export interface PersistGameStoppedArgs {
  supabase: SupabaseClient;
  sessionId: string;
  stoppedBy: string;
  /** Last voxel snapshot — preserved for analytics, not for resume. */
  gameState: PersistedRoomState;
  endedAt?: string;
}

export async function persistGameStopped(
  args: PersistGameStoppedArgs
): Promise<void> {
  const endedAt = args.endedAt ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "completed",
      stopped_by: args.stoppedBy,
      game_state: args.gameState as unknown as Record<string, unknown>,
      connected_player_ids: [],
      connected_player_names: [],
      is_open: false,
      ended_at: endedAt,
      last_activity: endedAt
    })
    .eq("id", args.sessionId);
}

export interface PersistGameAutosaveArgs {
  supabase: SupabaseClient;
  sessionId: string;
  gameState: PersistedRoomState;
}

export async function persistGameAutosave(
  args: PersistGameAutosaveArgs
): Promise<void> {
  await args.supabase
    .from("game_sessions")
    .update({
      game_state: args.gameState as unknown as Record<string, unknown>,
      last_activity: new Date().toISOString()
    })
    .eq("id", args.sessionId)
    .in("status", ["playing", "waiting"]);
}

