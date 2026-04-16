import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Supabase Realtime Presence — not DB polling. Tracks how many clients report online in a shared channel.
 */
export function usePresence(userId: string | undefined) {
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setOnlineCount(0);
      return;
    }

    const channel = supabase.channel("presence:playground", {
      config: { presence: { key: userId } }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId, online_at: new Date().toISOString() });
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineCount(Object.keys(state).length);
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { onlineCount };
}
