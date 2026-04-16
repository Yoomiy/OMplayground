import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function usePendingChallenge(userId: string | undefined) {
  const [challenge, setChallenge] = useState<unknown>(null);

  useEffect(() => {
    if (!userId) return;

    void (async () => {
      const { data } = await supabase
        .from("kid_profiles")
        .select("pending_challenge")
        .eq("id", userId)
        .maybeSingle();
      setChallenge(data?.pending_challenge ?? null);
    })();

    const channel = supabase
      .channel(`kid:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "kid_profiles",
          filter: `id=eq.${userId}`
        },
        (payload) => {
          const next = (payload.new as { pending_challenge?: unknown })
            ?.pending_challenge;
          setChallenge(next ?? null);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { challenge };
}
