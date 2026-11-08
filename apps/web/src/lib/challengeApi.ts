import { supabase } from "@/lib/supabase";
import { getCorrelationId } from "@/utils/correlation";
import { reportCaughtError } from "@/utils/telemetry";
import { backendUnavailable } from "./featureRecovery";

export interface GameChallengeRow {
  id: string;
  from_kid_id: string;
  to_kid_id: string;
  session_id: string;
  game_id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
}

function challengeError(message: string): string {
  if (message.includes("CHALLENGE_UNAVAILABLE") || message.includes("CHALLENGE_NOT_FOUND"))
    return "ההזמנה כבר אינה זמינה. הרשימה תתעדכן בקרוב";
  if (message.includes("SESSION_ALREADY_ENTERED"))
    return "שחקן כבר נכנס למשחק. יש לצאת דרך מסך המשחק";
  if (message.includes("CHALLENGE_NOT_ALLOWED") || message.includes("PROFILE_NOT_AVAILABLE"))
    return "לא ניתן להזמין את השחקן כרגע";
  if (message.includes("GAME_NOT_AVAILABLE") || message.includes("SESSION_UNAVAILABLE"))
    return "המשחק אינו זמין כרגע";
  return "לא ניתן לעדכן את ההזמנה כרגע. אפשר לנסות שוב";
}

function reportChallengeFailure(operation: string, error: unknown, challengeId?: string) {
  reportCaughtError(
    "Game challenge operation failed",
    error,
    {
      appArea: "game-challenge",
      operation,
      challengeId,
      code: error && typeof error === "object" && "code" in error ? error.code : "TRANSPORT_ERROR",
      reason:
        error && typeof error === "object" && "message" in error
          ? String(error.message).match(
              /\b(?:CHALLENGE_[A-Z_]+|SESSION_[A-Z_]+|game_sessions_authoritative_field|UNAUTHENTICATED)\b/,
            )?.[0]
          : undefined,
    },
    "game-server",
    "warn",
  );
}

/**
 * Creates the private game session and challenge atomically. Role-direction
 * validation and the teacher audit entry are owned by the database function.
 */
export async function sendChallenge(args: {
  toId: string;
  gameId: string;
  toName?: string;
}): Promise<{ sessionId: string; challengeId: string }> {
  const { data, error } = await supabase.rpc("create_game_challenge", {
    p_to_id: args.toId,
    p_game_id: args.gameId,
    p_correlation_id: getCorrelationId(),
  });
  if (error) {
    reportCaughtError("Game challenge creation failed", error, {
      appArea: "game-challenge",
      operation: "create",
    });
    throw new Error(challengeError(error.message));
  }

  const result = data as {
    session_id?: unknown;
    challenge_id?: unknown;
  } | null;
  if (typeof result?.session_id !== "string" || typeof result.challenge_id !== "string") {
    throw new Error("FAILED_TO_CREATE_CHALLENGE");
  }

  window.dispatchEvent(
    new CustomEvent("challenge-sent", {
      detail: {
        challengeId: result.challenge_id,
        sessionId: result.session_id,
        recipientName: args.toName,
      },
    }),
  );
  window.dispatchEvent(new Event("challenges-changed"));
  return {
    sessionId: result.session_id,
    challengeId: result.challenge_id,
  };
}

export async function respondChallenge(
  id: string,
  action: "accept" | "decline" | "cancel",
): Promise<void> {
  try {
    const { error } = await supabase.rpc("respond_game_challenge", { p_id: id, p_action: action });
    if (error) throw error;
  } catch (error) {
    reportChallengeFailure(action, error, id);
    throw new Error(
      backendUnavailable(error)
        ? "ההזמנות אינן זמינות כרגע. אפשר לנסות שוב בהמשך"
        : challengeError(
            error && typeof error === "object" && "message" in error ? String(error.message) : "",
          ),
    );
  }
}
export async function resolveChallenges(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const { error } = await supabase.rpc("resolve_game_challenges", { p_ids: ids });
    if (error) throw error;
  } catch (error) {
    reportChallengeFailure("resolve-all", error);
    throw new Error("לא ניתן לבטל ולהסיר את ההזמנות כרגע. אפשר לנסות שוב");
  }
}
export const acceptChallenge = (c: GameChallengeRow) => respondChallenge(c.id, "accept");
export const declineChallenge = (c: GameChallengeRow) => respondChallenge(c.id, "decline");
export const expireOwnChallenge = (c: GameChallengeRow) => respondChallenge(c.id, "cancel");
