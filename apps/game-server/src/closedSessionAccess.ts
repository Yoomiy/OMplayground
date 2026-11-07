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

  const { data, error } = await args.supabase
    .from("game_challenges")
    .select("id")
    .eq("session_id", args.sessionId)
    .or(`from_kid_id.eq.${args.userId},to_kid_id.eq.${args.userId}`)
    .eq("status", "accepted")
    .maybeSingle();
  if (error) throw error;

  return !!data;
}
