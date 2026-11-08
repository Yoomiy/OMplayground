import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { gameActivityForPath, roomPhaseFromResponse, type RoomPhase } from "@/lib/gameNavigation";
import { reportCaughtError } from "@/utils/telemetry";
import { backendUnavailable, FeatureRequestError, FeatureRetryGate } from "@/lib/featureRecovery";
export function useGameNavigation() {
  const { pathname } = useLocation(),
    { user } = useAuth();
  const { sessionId, phase: localPhase } = gameActivityForPath(pathname);
  const key = `${user?.id}:${pathname}`;
  const retryGate = useMemo(() => new FeatureRetryGate(), [key]);
  const [state, setState] = useState<{ key: string; phase: RoomPhase }>({
    key: "",
    phase: "unknown",
  });
  const live = useRef(key);
  live.current = key;
  const inFlight = useRef<{
    key: string;
    controller: AbortController;
    promise: Promise<RoomPhase>;
  } | null>(null);
  const inspect = useCallback(async (manual = true): Promise<RoomPhase> => {
    if (live.current !== key) return "unknown";
    if (!sessionId) return localPhase;
    if (inFlight.current?.key === key) return inFlight.current.promise;
    if (!retryGate.allows(manual)) return "unknown";
    inFlight.current?.controller.abort();
    const request = {
      key,
      controller: new AbortController(),
      promise: Promise.resolve<RoomPhase>("unknown"),
    };
    inFlight.current = request;
    request.promise = (async () => {
      let phase: RoomPhase = "unknown";
      try {
        const { data, error } = await supabase
          .from("game_sessions")
          .select("status")
          .eq("id", sessionId)
          .abortSignal(AbortSignal.any([request.controller.signal, AbortSignal.timeout(8000)]))
          .maybeSingle();
        if (error) throw error;
        phase = roomPhaseFromResponse(data);
        if (phase === "unknown") throw new FeatureRequestError("Unrecognized room status", true);
        retryGate.success();
      } catch (error) {
        // Failure never authorizes leaving. Manual entry can retry this inspection.
        if (live.current === key && !request.controller.signal.aborted) {
          retryGate.fail(backendUnavailable(error) ? new FeatureRequestError("Room lookup unavailable", true) : error);
          reportCaughtError("Challenge current room inspection failed", error, {
            sessionId, appArea: "challenges", operation: "inspect-current-room",
            code: typeof error === "object" && error && "code" in error ? error.code : undefined,
          }, "game-server");
        }
      } finally {
        if (inFlight.current === request) inFlight.current = null;
      }
      if (live.current !== key || request.controller.signal.aborted) return "unknown";
      setState({ key, phase });
      return phase;
    })();
    return request.promise;
  }, [sessionId, localPhase, key, retryGate]);
  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    const refresh = () => {
      if (!disposed && !document.hidden) void inspect(false);
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
      if (inFlight.current?.key === key) inFlight.current.controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      if (channel) void supabase.removeChannel(channel).catch(() => {});
    };
  }, [inspect, sessionId, key]);
  return {
    key,
    pathname,
    sessionId,
    phase:
      !sessionId ? localPhase : state.key === key
        ? state.phase
        : ("unknown" as const),
    inspect,
  };
}
