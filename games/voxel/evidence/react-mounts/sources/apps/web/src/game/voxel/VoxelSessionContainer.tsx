import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getVoxelRuntimeUrl } from "@/lib/voxelRuntimeUrl";
import { createVoxelApi, VoxelApiError } from "./session-api";
import { VoxelSurface } from "./VoxelSurface";
import type { SessionProjection } from "./session-projection";

export function VoxelSessionContainer({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate(),
    [search, setSearch] = useSearchParams();
  const { user } = useAuth(),
    { profile } = useProfile(),
    { isAdmin } = useIsAdmin();
  const participation =
    search.get("mode") === "player"
      ? "player"
      : search.get("mode") === "observer"
        ? "observer"
        : undefined;
  const invitationCode = search.get("invite") ?? undefined;
  const getToken = useCallback(async () => {
    const result = await supabase.auth.getSession();
    if (
      result.error ||
      !result.data.session?.access_token ||
      result.data.session.user.id !== user?.id
    )
      throw new VoxelApiError("UNAUTHORIZED");
    return result.data.session.access_token;
  }, [user?.id]);
  const api = useMemo(() => {
    try {
      return createVoxelApi({
        serverUrl: getVoxelRuntimeUrl(),
        room: sessionId,
        invitationCode,
        participation,
        getToken,
      });
    } catch {
      return null;
    }
  }, [sessionId, invitationCode, participation, getToken]);
  const [session, setSession] = useState<SessionProjection | null>(null),
    [metadataUnavailable, setMetadataUnavailable] = useState(false);
  const telemetry = useRef(new Map<string, number>()),
    scopeAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    setSession(null);
    setMetadataUnavailable(false);
    if (!api) return;
    const abort = new AbortController();
    scopeAbort.current = abort;
    let running = false,
      ended = false;
    const refresh = async () => {
      if (running || ended || abort.signal.aborted) return;
      running = true;
      try {
        const next = await api.session(abort.signal);
        if (!abort.signal.aborted) {
          setSession(next);
          ended = next.status === "completed";
          setMetadataUnavailable(false);
        }
      } catch {
        if (!abort.signal.aborted) {
          setSession(null);
          setMetadataUnavailable(true);
        }
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      abort.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      if (scopeAbort.current === abort) scopeAbort.current = null;
    };
  }, [api]);
  const diagnostic = useCallback(
    (operation: string, code: string, buildId: string | null) => {
      if (!api || scopeAbort.current?.signal.aborted) return;
      const normalized = operation
          .toLowerCase()
          .replace(/[^a-z_]/g, "_")
          .slice(0, 40),
        key = normalized + ":" + code,
        now = Date.now();
      if (now - (telemetry.current.get(key) ?? 0) < 10000) return;
      telemetry.current.set(key, now);
      // Best-effort bounded telemetry never turns its transport failure into a game failure.
      void api
        .report(normalized, code, buildId, scopeAbort.current?.signal)
        .catch(() => {});
    },
    [api],
  );
  const back = () =>
    navigate(
      isAdmin
        ? "/admin"
        : profile?.role === "teacher" && participation !== "player"
          ? "/teacher"
          : "/home",
    );
  if (!api || !user)
    return (
      <main dir="rtl" className="p-8 text-center">
        <p>החיבור לעולם עדיין לא הוגדר.</p>
        <button type="button" onClick={back}>
          חזרה למגרש המשחקים
        </button>
      </main>
    );
  return (
    <>
      <VoxelSurface
        api={api}
        session={session}
        userId={user.id}
        isStaff={isAdmin || profile?.role === "teacher"}
        canChoosePlayer={!isAdmin && profile?.role === "teacher"}
        onExit={back}
        onDiagnostic={diagnostic}
        onParticipation={(mode) => {
          const next = new URLSearchParams(search);
          next.set("mode", mode);
          setSearch(next);
        }}
      />
      {metadataUnavailable && (
        <p className="voxel-session-metadata-error" role="status">
          פרטי המפגש אינם זמינים כרגע. הרשאות ניהול יוצגו אחרי שהחיבור יתחדש.
        </p>
      )}
    </>
  );
}
export default VoxelSessionContainer;
