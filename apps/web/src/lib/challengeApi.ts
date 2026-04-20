import { supabase } from "@/lib/supabase";

export interface GameChallengeRow {
  id: string;
  from_kid_id: string;
  to_kid_id: string;
  session_id: string;
  game_id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  created_at: string;
  expires_at: string;
}

function makeInvitationCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Creates a `game_sessions` row owned by the sender, then inserts a
 * `game_challenges` row addressed to `toId`. Returns the new session id so the
 * caller can navigate to `/play/:sessionId` to wait.
 */
export async function sendChallenge(args: {
  meId: string;
  meDisplayName: string;
  meGender: "boy" | "girl";
  toId: string;
  gameId: string;
}): Promise<{ sessionId: string; challengeId: string }> {
  const { data: session, error: sessErr } = await supabase
    .from("game_sessions")
    .insert({
      game_id: args.gameId,
      host_id: args.meId,
      host_name: args.meDisplayName,
      player_ids: [args.meId],
      player_names: [args.meDisplayName],
      status: "waiting",
      is_open: false,
      invitation_code: makeInvitationCode(),
      gender: args.meGender
    })
    .select("id")
    .maybeSingle();
  if (sessErr || !session?.id) {
    throw new Error(sessErr?.message ?? "FAILED_TO_CREATE_SESSION");
  }

  const { data: challenge, error: chErr } = await supabase
    .from("game_challenges")
    .insert({
      from_kid_id: args.meId,
      to_kid_id: args.toId,
      session_id: session.id,
      game_id: args.gameId
    })
    .select("id")
    .maybeSingle();
  if (chErr || !challenge?.id) {
    throw new Error(chErr?.message ?? "FAILED_TO_CREATE_CHALLENGE");
  }

  return { sessionId: session.id as string, challengeId: challenge.id as string };
}

export async function acceptChallenge(c: GameChallengeRow): Promise<void> {
  const { error } = await supabase
    .from("game_challenges")
    .update({ status: "accepted" })
    .eq("id", c.id);
  if (error) throw new Error(error.message);
}

export async function declineChallenge(c: GameChallengeRow): Promise<void> {
  const { error } = await supabase
    .from("game_challenges")
    .update({ status: "declined" })
    .eq("id", c.id);
  if (error) throw new Error(error.message);
}

export async function expireOwnChallenge(c: GameChallengeRow): Promise<void> {
  const { error } = await supabase
    .from("game_challenges")
    .update({ status: "expired" })
    .eq("id", c.id);
  if (error) throw new Error(error.message);
}
