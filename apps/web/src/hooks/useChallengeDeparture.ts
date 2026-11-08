import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { supabase } from "@/lib/supabase";
import {
  backendUnavailable,
  FeatureRequestError,
  FeatureRetryGate,
  isRecord,
} from "@/lib/featureRecovery";

/** Apply invitation withdrawal through each runtime's existing unmount/leave path. */
export function useChallengeDeparture() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const sessionId = pathname.startsWith("/play/") ? pathname.split("/")[2] : undefined;
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!user || !sessionId) return;
    let disposed = false,
      leaving = false;
    const gate = new FeatureRetryGate();
    const leave = (actor: unknown, closedRoom: boolean) => {
      if (disposed || leaving || (actor !== user.id && !closedRoom)) return;
      leaving = true;
      setNotice(
        actor === user.id ? "ההזמנה בוטלה ויצאתם מהחדר" : "ההזמנה כבר אינה זמינה. החדר נסגר",
      );
      navigate("/home", { replace: true });
    };
    const refresh = async () => {
      if (disposed || !gate.allows()) return;
      try {
        const { data, error } = await supabase.rpc("challenge_departure", {
          p_session_id: sessionId,
        });
        if (error)
          throw new FeatureRequestError("Challenge status unavailable", backendUnavailable(error));
        if (disposed) return;
        gate.success();
        if (isRecord(data) && typeof data.closed_room === "boolean")
          leave(data.actor, data.closed_room);
      } catch (error) {
        if (!disposed) gate.fail(error);
      }
    };
    const changed = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.sessionId === sessionId) leave(detail.actor, detail.closedRoom === true);
    };
    void refresh();
    const channel = supabase
      .channel(`challenge-departure:${user.id}:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_challenges",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new;
          if (isRecord(row) && row.session_id === sessionId && row.withdrawn_at)
            leave(row.withdrawn_by, row.withdrawn_phase === "waiting");
          else void refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    const timer = window.setInterval(() => void refresh(), 5000);
    const onFocus = () => void refresh();
    window.addEventListener("challenge-withdrawn", changed);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("challenge-withdrawn", changed);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel).catch(() => {});
    };
  }, [sessionId, user?.id, navigate]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  return { notice, dismiss: () => setNotice("") };
}
