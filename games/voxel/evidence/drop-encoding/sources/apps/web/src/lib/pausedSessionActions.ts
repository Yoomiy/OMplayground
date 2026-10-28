import { supabase } from "@/lib/supabase";

export function leavePausedGameSession(sessionId: string) {
  return supabase.rpc("leave_paused_game_session", {
    p_session_id: sessionId
  });
}

/** Waiting lobbies where this kid is host and no one else ever joined. */
export function discardMySoloWaitingSessions() {
  return supabase.rpc("discard_my_solo_waiting_sessions");
}
