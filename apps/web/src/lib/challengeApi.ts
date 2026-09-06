import { supabase } from "@/lib/supabase";
import { getCorrelationId } from "@/utils/correlation";
import { reportCaughtError } from "@/utils/telemetry";

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

/**
 * Creates the private game session and challenge atomically. Role-direction
 * validation and the teacher audit entry are owned by the database function.
 */
export async function sendChallenge(args: {
  toId: string;
  gameId: string;
}): Promise<{ sessionId: string; challengeId: string }> {
  const { data, error } = await supabase.rpc("create_game_challenge", {
    p_to_id: args.toId,
    p_game_id: args.gameId,
    p_correlation_id: getCorrelationId()
  });
  if (error) {
    reportCaughtError(
      "Game challenge creation failed",
      error,
      { appArea: "game-challenge", operation: "create" }
    );
    throw new Error(error.message);
  }

  const result = data as {
    session_id?: unknown;
    challenge_id?: unknown;
  } | null;
  if (
    typeof result?.session_id !== "string" ||
    typeof result.challenge_id !== "string"
  ) {
    throw new Error("FAILED_TO_CREATE_CHALLENGE");
  }

  return {
    sessionId: result.session_id,
    challengeId: result.challenge_id
  };
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
