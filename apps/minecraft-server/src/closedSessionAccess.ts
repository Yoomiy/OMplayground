import type { SupabaseClient } from "@supabase/supabase-js";

export async function canJoinClosedSession(args: {
  supabase: SupabaseClient;
  sessionId: string;
  userId: string;
  sessionInvitationCode: string;
  invitationCode?: string;
}): Promise<boolean> {
  const code = args.invitationCode?.trim();
  if (code && code === args.sessionInvitationCode) {
    return true;
  }

  const { data } = await args.supabase
    .from("game_challenges")
    .select("id")
    .eq("session_id", args.sessionId)
    .eq("to_kid_id", args.userId)
    .eq("status", "accepted")
    .maybeSingle();

  return !!data;
}
