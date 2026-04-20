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
  const { supabase, sessionId, session, userId, displayName, roomStatusIsIdle } =
    args;
  if (session.player_ids.includes(userId)) {
    return false;
  }
  const nextPlayerIds = Array.from(new Set([...session.player_ids, userId]));
  const nextPlayerNames = [...session.player_names, displayName];
  await supabase
    .from("game_sessions")
    .update({
      player_ids: nextPlayerIds,
      player_names: nextPlayerNames,
      status: roomStatusIsIdle ? session.status : "playing",
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
}

/**
 * Mirrors the disconnect persistence block: if host transferred, write the
 * new host; if room went empty, mark the session paused.
 */
export async function persistPlayerLeave(
  args: PersistLeaveArgs
): Promise<void> {
  const { supabase, sessionId, result } = args;
  if (result.newHostId) {
    const { data: kp } = await supabase
      .from("kid_profiles")
      .select("grade")
      .eq("id", result.newHostId)
      .maybeSingle();
    await supabase
      .from("game_sessions")
      .update({
        host_id: result.newHostId,
        host_grade: kp?.grade ?? null,
        last_activity: new Date().toISOString()
      })
      .eq("id", sessionId);
  }
  if (result.roomEmpty) {
    await supabase
      .from("game_sessions")
      .update({
        status: "paused",
        last_activity: new Date().toISOString()
      })
      .eq("id", sessionId);
  }
}
