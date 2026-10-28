import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  acceptChallenge as acceptChallengeApi,
  declineChallenge as declineChallengeApi,
  type GameChallengeRow
} from "@/lib/challengeApi";

function notExpired(c: GameChallengeRow): boolean {
  return new Date(c.expires_at).getTime() > Date.now();
}

/**
 * Incoming pending challenge for the current user. Accepts via RLS update
 * (status -> accepted | declined).
 */
export function usePendingChallenge(userId: string | undefined) {
  const [challenge, setChallenge] = useState<GameChallengeRow | null>(null);

  useEffect(() => {
    if (!userId) {
      setChallenge(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("game_challenges")
        .select(
          "id, from_kid_id, to_kid_id, session_id, game_id, status, created_at, expires_at"
        )
        .eq("to_kid_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = (data?.[0] as GameChallengeRow | undefined) ?? null;
      setChallenge(row && notExpired(row) ? row : null);
    })();

    const channel = supabase
      .channel(`challenges:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_challenges",
          filter: `to_kid_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as GameChallengeRow;
          if (row.status === "pending" && notExpired(row)) {
            setChallenge(row);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_challenges",
          filter: `to_kid_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as GameChallengeRow;
          setChallenge((prev) => {
            if (!prev || prev.id !== row.id) return prev;
            if (row.status !== "pending" || !notExpired(row)) return null;
            return row;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const accept = useCallback(async () => {
    if (!challenge) return null;
    await acceptChallengeApi(challenge);
    const sessionId = challenge.session_id;
    setChallenge(null);
    return sessionId;
  }, [challenge]);

  const decline = useCallback(async () => {
    if (!challenge) return;
    await declineChallengeApi(challenge);
    setChallenge(null);
  }, [challenge]);

  return { challenge, accept, decline };
}
