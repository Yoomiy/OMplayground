import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase writes for `game_sessions` on join/leave. Kept in its own module
 * so it can be unit-tested with a mocked client (see joinRoomPersist.test.ts
 * and leaveRoom.test.ts). `index.ts` must never reach into `supabaseAdmin`
 * for these two hot paths directly.
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
  /** Room's in-memory game status; when the ruleset is still idle we leave session.status alone. */
  roomStatusIsIdle: boolean;
}

/**
 * Returns `true` when a row-update was issued, `false` if the user was
 * already listed and we short-circuited.
 */
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
    roomStatusIsIdle
  } = args;
  if (session.player_ids.includes(userId)) {
    await supabase
      .from("game_sessions")
      .update({
        connected_player_ids: connectedPlayerIds,
        connected_player_names: connectedPlayerNames,
        last_activity: new Date().toISOString()
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
      last_activity: new Date().toISOString()
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
  gameState?: unknown;
}

/**
 * Mirrors the disconnect persistence block: if host transferred, write the
 * new host; if room went empty, mark the session paused.
 */
export async function persistPlayerLeave(
  args: PersistLeaveArgs
): Promise<void> {
  const {
    supabase,
    sessionId,
    result,
    connectedPlayerIds = [],
    connectedPlayerNames = [],
    gameState
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
        last_activity: new Date().toISOString()
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
    } = {
      status: "paused",
      connected_player_ids: connectedPlayerIds,
      connected_player_names: connectedPlayerNames,
      last_activity: new Date().toISOString()
    };
    if (gameState !== undefined) {
      payload.game_state = gameState as Record<string, unknown>;
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
        last_activity: new Date().toISOString()
      })
      .eq("id", sessionId);
  }
}
