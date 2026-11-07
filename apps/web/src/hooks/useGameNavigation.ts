import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { RoomPhase } from "@/lib/gameNavigation";
export function useGameNavigation() {
  const { pathname } = useLocation(),
    { user } = useAuth();
  const sessionId = pathname.startsWith("/play/") ? pathname.split("/")[2] : undefined;
  const protectedRoute = pathname.startsWith("/solo/") || pathname.startsWith("/classroom/");
  const key = `${user?.id}:${sessionId}:${protectedRoute}`;
  const [state, setState] = useState<{ key: string; phase: RoomPhase }>({
    key: "",
    phase: "unknown",
  });
  const live = useRef(key);
  live.current = key;
  const inspect = useCallback(async (): Promise<RoomPhase> => {
    if (!sessionId) return protectedRoute ? "unknown" : "none";
    let phase: RoomPhase = "unknown";
    try {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle();
      phase = error
        ? "unknown"
        : !data
          ? "completed"
          : ["waiting", "playing", "paused", "completed"].includes(data.status)
            ? data.status
            : "unknown";
    } catch {
      // A failed inspection must never authorize leaving a potentially active game.
    }
    if (live.current === key) setState({ key, phase });
    return live.current === key ? phase : "unknown";
  }, [sessionId, protectedRoute, key]);
  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      if (!disposed && !document.hidden) void inspect();
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    const channel = sessionId
      ? supabase
          .channel(`navigation:${sessionId}:${crypto.randomUUID()}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "game_sessions",
              filter: `id=eq.${sessionId}`,
            },
            refresh,
          )
          .subscribe()
      : null;
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      if (channel) void supabase.removeChannel(channel).catch(() => {});
    };
  }, [inspect, sessionId]);
  return {
    sessionId,
    phase:
      state.key === key
        ? state.phase
        : sessionId || protectedRoute
          ? ("unknown" as const)
          : ("none" as const),
    inspect,
  };
}
