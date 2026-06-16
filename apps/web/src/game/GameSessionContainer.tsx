import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { usePersistedSessionChat } from "@/hooks/usePersistedSessionChat";
import { useTeacherSessionChat } from "@/hooks/useTeacherSessionChat";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { LazyGameBoard } from "@/game/lazyBoards";
import { desktopPanelClass } from "@/components/KidDesktopShell";
import { reportTelemetry } from "@/utils/telemetry";

type RoomEvent =
  | {
      kind: "GAME_ENDED";
      outcome: { kind: "won"; winner: string } | { kind: "draw" };
    }
  | { kind: "GAME_STOPPED"; stoppedBy?: string }
  | { kind: "GAME_PAUSED" }
  | { kind: "GAME_RESUMED" }
  | { kind: "HOST_LEFT"; newHostId?: string }
  | { kind: "RECESS_ENDED" }
  | { kind: "PLAYER_JOINED"; player?: RoomPlayer }
  | { kind: "PLAYER_LEFT"; player?: RoomPlayer }
  | { kind: "REMATCH_REQUESTED"; requestedBy: string }
  | { kind: "REMATCH_CANCELLED" }
  | { kind: "REMATCH_STARTED" };

export interface RoomPlayer {
  userId: string;
  displayName: string;
}

interface RematchState {
  requestedBy: string;
  accepted: string[];
  refused: string[];
}

type EndOverlay =
  | { kind: "won"; winner: string }
  | { kind: "draw" }
  | { kind: "stopped" };

function endOverlayHeadline(
  overlay: EndOverlay,
  mySymbol: string | null,
  isTeacherObserver: boolean
): string {
  if (isTeacherObserver) {
    if (overlay.kind === "draw") return "תיקו!";
    if (overlay.kind === "stopped") return "המשחק נעצר";
    return "המשחק הסתיים";
  }
  if (overlay.kind === "draw") return "תיקו!";
  if (overlay.kind === "stopped") return "המארח עצר את המשחק";
  if (mySymbol && (overlay.winner === mySymbol || overlay.winner === "both")) return "ניצחת!";
  return "הפסדת";
}

/**
 * Map of `gameKey` (matches `games.game_url`) → client board renderer.
 * The container stays game-agnostic; new games just register here.
 */


/** In dev, prefer same-origin + Vite proxy so the browser does not hit :8080 directly (avoids wrong URL / CORS). */
function gameServerUrl(): string {
  const fromEnv = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

function connectErrorLabel(err: Error): string {
  const raw = err.message;
  if (raw === "xhr poll error" || raw === "websocket error") {
    return "לא ניתן להתחבר לשרת המשחק — הפעל אותו מקומית (npm run dev:server, פורט 8080) או הגדר VITE_GAME_SERVER_URL.";
  }
  switch (raw) {
    case "UNAUTHORIZED":
      return "לא מאומת — נסה להתחבר מחדש.";
    case "FORBIDDEN":
      return "אין הרשאה לשחק (פרופיל לא נמצא או לא פעיל).";
    case "RECESS_DENIED":
      return "מחוץ לזמן ההפסקה — לא ניתן לשחק כרגע.";
    case "SERVER_CONFIG":
      return "שרת המשחק לא מוגדר (בדוק משתני Supabase בשרת).";
    default:
      return `שגיאת חיבור לשרת המשחק: ${raw}`;
  }
}

export interface GameSessionContainerProps {
  sessionId: string;
}

export function GameSessionContainer({ sessionId }: GameSessionContainerProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? undefined;
  const { profile } = useProfile();
  const { isAdmin } = useIsAdmin();
  const isTeacherObserver = profile?.role === "teacher";
  const teacherChat = useTeacherSessionChat(
    isTeacherObserver ? sessionId : undefined
  );
  const kidChat = usePersistedSessionChat(
    !isTeacherObserver ? sessionId : undefined
  );
  const socketRef = useRef<Socket | null>(null);
  const recessEndedRef = useRef(false);
  const [gameKey, setGameKey] = useState<string | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [status, setStatus] = useState<string>("מתחבר…");
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [roster, setRoster] = useState<RoomPlayer[]>([]);
  const [missingPlayers, setMissingPlayers] = useState<RoomPlayer[]>([]);
  const [paused, setPaused] = useState(false);
  const [canResume, setCanResume] = useState(false);
  const [rematch, setRematch] = useState<RematchState | null>(null);
  const [endOverlay, setEndOverlay] = useState<EndOverlay | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [roomIsOpen, setRoomIsOpen] = useState<boolean | null>(null);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [inviteFallbackLink, setInviteFallbackLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        reportTelemetry(
          {
            level: "warn",
            message: "Game session socket setup without auth token",
            sessionId,
            context: { appArea: "game-session" }
          },
          "game-server"
        );
        setStatus("אין סשן — התחבר מחדש.");
        return;
      }
      if (cancelled) return;
      setMyUserId(data.session?.user.id ?? null);

      const { getCorrelationId } = await import("@/utils/correlation");
      const s = io(gameServerUrl(), {
        auth: { token, correlationId: getCorrelationId() },
        reconnectionAttempts: 2,
        reconnectionDelay: 1500
      });
      socketRef.current = s;

      s.on("connect", () => {
        setStatus("מחובר");
        s.emit(
          "JOIN_ROOM",
          { sessionId, ...(inviteCode ? { invitationCode: inviteCode } : {}) },
          (ack: { ok?: boolean; error?: { code?: string; message?: string } }) => {
            if (!ack?.ok) {
              reportTelemetry(
                {
                  level: "warn",
                  message: "JOIN_ROOM failed",
                  sessionId,
                  context: {
                    appArea: "game-session",
                    code: ack?.error?.code,
                    event: "JOIN_ROOM"
                  }
                },
                "game-server"
              );
              setStatus(ack?.error?.message ?? "הצטרפות לחדר נכשלה");
            }
          }
        );
      });

      s.on(
        "ROOM_SNAPSHOT",
        (payload: {
          gameKey?: string;
          gameState?: unknown;
          hostId?: string;
          players?: RoomPlayer[];
          roster?: RoomPlayer[];
          missingPlayers?: RoomPlayer[];
          paused?: boolean;
          canResume?: boolean;
          rematch?: RematchState | null;
        }) => {
          if (payload?.gameKey) {
            setGameKey(payload.gameKey);
          }
          if (payload?.gameState !== undefined) {
            setGameState(payload.gameState);
            const st = payload.gameState as { status?: string };
            if (st?.status === "playing") {
              setEndOverlay(null);
            }
          }
          if (payload?.hostId) {
            setHostId(payload.hostId);
          }
          if (payload?.players) {
            setPlayers(payload.players);
          }
          if (payload?.roster) {
            setRoster(payload.roster);
          }
          if (payload?.missingPlayers) {
            setMissingPlayers(payload.missingPlayers);
          }
          if (typeof payload?.paused === "boolean") {
            setPaused(payload.paused);
          }
          if (typeof payload?.canResume === "boolean") {
            setCanResume(payload.canResume);
          }
          if ("rematch" in payload) {
            setRematch(payload.rematch ?? null);
          }
        }
      );

      s.on("ROOM_EVENT", (ev: RoomEvent) => {
        switch (ev.kind) {
          case "GAME_ENDED":
            setEndOverlay(ev.outcome);
            return;
          case "GAME_STOPPED":
            setEndOverlay({ kind: "stopped" });
            return;
          case "GAME_PAUSED":
            setToast("המשחק הושהה");
            return;
          case "GAME_RESUMED":
            setToast("המשחק חודש");
            return;
          case "HOST_LEFT":
            setToast("המארח עזב — הקברניט הוחלף");
            return;
          case "RECESS_ENDED":
            recessEndedRef.current = true;
            setToast("ההפסקה הסתיימה");
            return;
          case "PLAYER_JOINED":
            setToast(`${ev.player?.displayName ?? "שחקן"} הצטרף לחדר`);
            return;
          case "PLAYER_LEFT":
            setToast(`${ev.player?.displayName ?? "שחקן"} עזב את החדר`);
            return;
          case "REMATCH_REQUESTED":
            setToast("המארח ביקש משחק חוזר");
            return;
          case "REMATCH_CANCELLED":
            setToast("המשחק החוזר בוטל");
            return;
          case "REMATCH_STARTED":
            setEndOverlay(null);
            setToast("משחק חוזר התחיל");
            return;
        }
      });

      s.on("disconnect", () => {
        if (recessEndedRef.current) {
          navigate("/login", { replace: true });
        }
      });

      s.on("connect_error", (err: Error) => {
        reportTelemetry(
          {
            level: "error",
            message: "Game socket connect_error",
            sessionId,
            context: { appArea: "game-session", code: err.message }
          },
          "game-server"
        );
        setStatus(connectErrorLabel(err));
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, inviteCode, navigate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("is_open, invitation_code")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setRoomIsOpen(data.is_open);
      setInvitationCode(data.invitation_code);
    })();

    const channel = supabase
      .channel(`session-privacy:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          const next = payload.new as {
            is_open?: boolean;
            invitation_code?: string;
          };
          if (typeof next.is_open === "boolean") {
            setRoomIsOpen(next.is_open);
          }
          if (typeof next.invitation_code === "string") {
            setInvitationCode(next.invitation_code);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const stopGame = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit(
      "STOP_GAME",
      { sessionId },
      (ack: { ok?: boolean; error?: { message?: string } }) => {
        if (!ack?.ok) {
          setStatus(ack?.error?.message ?? "עצירה נכשלה");
        }
      }
    );
  }, [sessionId]);

  const pauseGame = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit(
      "PAUSE_GAME",
      { sessionId },
      (ack: { ok?: boolean; error?: { message?: string } }) => {
        if (!ack?.ok) {
          setStatus(ack?.error?.message ?? "השהיית המשחק נכשלה");
        }
      }
    );
  }, [sessionId]);

  const resumeGame = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit(
      "RESUME_GAME",
      { sessionId },
      (ack: { ok?: boolean; error?: { message?: string } }) => {
        if (!ack?.ok) {
          setToast(ack?.error?.message ?? "חידוש המשחק נכשל");
        }
      }
    );
  }, [sessionId]);

  const requestRematch = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit(
      "REMATCH",
      { sessionId },
      (ack: {
        ok?: boolean;
        error?: { code?: string; message?: string };
      }) => {
        if (!ack?.ok) {
          setToast(ack?.error?.message ?? "משחק חוזר נכשל");
        }
      }
    );
  }, [sessionId]);

  const respondToRematch = useCallback(
    (accept: boolean) => {
      const s = socketRef.current;
      if (!s?.connected) return;
      s.emit(
        "REMATCH_RESPONSE",
        { sessionId, accept },
        (ack: { ok?: boolean; error?: { message?: string } }) => {
          if (!ack?.ok) {
            setToast(ack?.error?.message ?? "תגובה למשחק חוזר נכשלה");
          }
        }
      );
    },
    [sessionId]
  );

  const sendChat = useCallback(() => {
    const s = socketRef.current;
    const text = chatDraft.trim();
    if (!s?.connected || !text) return;
    s.emit(
      "CHAT_MESSAGE",
      { sessionId, message: text },
      (ack: { ok?: boolean; error?: { message?: string } }) => {
        if (!ack?.ok) {
          setStatus(ack?.error?.message ?? "שליחת צ׳אט נכשלה");
        } else {
          setChatDraft("");
        }
      }
    );
  }, [chatDraft, sessionId]);

  const toggleRoomVisibility = useCallback(async () => {
    if (!myUserId || !hostId || myUserId !== hostId || roomIsOpen === null) return;
    setUpdatingVisibility(true);
    setInviteFallbackLink(null);
    const { data, error } = await supabase
      .from("game_sessions")
      .update({ is_open: !roomIsOpen })
      .eq("id", sessionId)
      .eq("host_id", myUserId)
      .select("is_open")
      .maybeSingle();
    setUpdatingVisibility(false);
    if (error || !data) {
      setStatus(error?.message ?? "עדכון פרטיות נכשל");
      return;
    }
    setRoomIsOpen(data.is_open);
    setToast(data.is_open ? "החדר פתוח להצטרפות" : "החדר פרטי עכשיו");
  }, [hostId, myUserId, roomIsOpen, sessionId]);

  const copyInviteLink = useCallback(async () => {
    if (!invitationCode) return;
    const inviteUrl = `${window.location.origin}/join/${invitationCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteFallbackLink(null);
      setToast("קישור ההזמנה הועתק");
    } catch {
      setInviteFallbackLink(inviteUrl);
      setToast("אי אפשר להעתיק אוטומטית בדפדפן הזה");
    }
  }, [invitationCode]);

  const onIntent = useCallback(
    (intent: unknown) => {
      if (isTeacherObserver) return;
      if (paused) {
        setStatus("המשחק מושהה");
        return;
      }
      const s = socketRef.current;
      if (!s?.connected) {
        setStatus("אין חיבור פעיל");
        return;
      }
      s.emit(
        "INTENT_GAME",
        { sessionId, intent },
        (ack: { ok?: boolean; error?: { message?: string } }) => {
          if (!ack?.ok) {
            setStatus(ack?.error?.message ?? "מהלך לא חוקי");
          }
        }
      );
    },
    [sessionId, isTeacherObserver, paused]
  );
  const onLiveDelta = useCallback(
    (delta: unknown) => {
      if (isTeacherObserver) return;
      if (paused) return;
      const s = socketRef.current;
      if (!s?.connected) return;
      s.emit("LIVE_DELTA", { sessionId, delta });
    },
    [sessionId, isTeacherObserver, paused]
  );

  const subscribeLiveDeltas = useCallback(
    (cb: (payload: any) => void) => {
      const s = socketRef.current;
      if (!s) return () => {};
      const handler = (payload: { from: string; delta: any }) => {
        cb(payload);
      };
      s.on("LIVE_DELTA", handler);
      return () => {
        s.off("LIVE_DELTA", handler);
      };
    },
    []
  );

  /** Derived from authoritative state so clients never diverge on seat order. */
  const mySymbol = useMemo<string | null>(() => {
    const seats = (gameState as { seats?: Record<string, string> } | null)
      ?.seats;
    if (!seats || !myUserId) return null;
    return seats[myUserId] ?? null;
  }, [gameState, myUserId]);

  if (!gameState || !gameKey) {
    return <p className="text-sm text-white/50">{status}</p>;
  }

  const iAmHost =
    !isTeacherObserver &&
    myUserId != null &&
    hostId != null &&
    myUserId === hostId;
  const connectedIds = new Set(players.map((p) => p.userId));
  const acceptedRematch = myUserId ? rematch?.accepted.includes(myUserId) : false;
  const refusedRematch = myUserId ? rematch?.refused.includes(myUserId) : false;
  const canVoteRematch =
    !isTeacherObserver &&
    !!endOverlay &&
    endOverlay.kind !== "stopped" &&
    !!rematch &&
    !!myUserId &&
    roster.some((p) => p.userId === myUserId);

  const chatPanel = isTeacherObserver ? (
    <section className={desktopPanelClass("space-y-2 p-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-white">צ׳אט (ניהול מורה)</h2>
        <button
          type="button"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition duration-200"
          onClick={() => {
            if (!window.confirm("למחוק את כל ההודעות במפגש זה?")) return;
            void teacherChat.clearSession().catch((e: Error) => setStatus(e.message));
          }}
        >
          ניקוי צ׳אט
        </button>
      </div>
      {teacherChat.error ? (
        <p className="text-xs font-medium text-amber-300">{teacherChat.error}</p>
      ) : null}
      <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-white/80">
        {teacherChat.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-2 border-b border-white/10 pb-1">
            <span>
              <span className="text-white/40">{line.sender_name}:</span>{" "}
              {line.message}
            </span>
            {!line.is_system ? (
              <button
                type="button"
                className="shrink-0 text-xs text-rose-400 hover:text-rose-300 underline transition duration-200"
                onClick={() =>
                  void teacherChat.softDelete(line.id).catch((e: Error) =>
                    setStatus(e.message)
                  )
                }
              >
                מחק
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  ) : (
    <section className={desktopPanelClass("space-y-2 p-3")}>
      <h2 className="text-sm font-black text-white">צ׳אט במשחק</h2>
      {kidChat.error ? (
        <p className="text-xs font-medium text-amber-300">{kidChat.error}</p>
      ) : null}
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm text-white/80">
        {kidChat.lines.map((line) => (
          <li key={line.id}>
            <span className="text-white/40">{line.sender_name}:</span>{" "}
            {line.message}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="min-h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/20 transition"
          value={chatDraft}
          onChange={(e) => setChatDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendChat();
            }
          }}
          placeholder="הודעה…"
          maxLength={500}
        />
        <button
          type="button"
          className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-3.5 py-1 text-sm font-bold text-white hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] transition duration-200"
          onClick={() => sendChat()}
        >
          שלח
        </button>
      </div>
    </section>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="min-w-0 space-y-4">
        <div className={desktopPanelClass("flex flex-wrap items-center justify-between gap-3 px-4 py-3")}>
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-white/80">
              {isTeacherObserver ? "צפייה בלבד (מורה) · " : ""}
              {status}
            </p>
            {toast ? (
              <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-200">
                {toast}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
              onClick={() =>
                navigate(isAdmin ? "/admin" : isTeacherObserver ? "/teacher" : "/home")
              }
            >
              {isAdmin ? "חזרה לניהול" : isTeacherObserver ? "חזרה ללוח המורה" : "יציאה"}
            </button>
          </div>
        </div>

        <section className={desktopPanelClass("min-h-[560px] p-4")}>
          {paused ? (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <p className="font-bold">המשחק מושהה ונשמר להמשך.</p>
              <p className="mt-1">
                {missingPlayers.length > 0
                  ? `ממתינים להצטרפות: ${missingPlayers.map((p) => p.displayName).join(", ")}`
                  : "כל השחקנים חזרו לחדר."}
              </p>
            </div>
          ) : null}

          <div
            className={
              isTeacherObserver || paused
                ? "pointer-events-none mx-auto max-w-5xl opacity-60"
                : "mx-auto max-w-5xl"
            }
          >
            <LazyGameBoard
              gameKey={gameKey}
              boardProps={{
                gameState,
                mySymbol,
                myUserId: myUserId ?? "",
                onIntent,
                isHost: iAmHost,
                endOverlay,
                rematch,
                canVoteRematch,
                acceptedRematch,
                refusedRematch,
                onRequestRematch: requestRematch,
                onRespondRematch: respondToRematch,
                onLiveDelta,
                subscribeLiveDeltas,
                paused,
                onGoHome: () =>
                  navigate(isAdmin ? "/admin" : isTeacherObserver ? "/teacher" : "/home"),
                players: roster.length > 0 ? roster : players,
                connectedPlayers: players
              }}
            />
          </div>
        </section>

        {endOverlay && gameKey !== "chess" ? (
          <div role="alertdialog" aria-label="המשחק הסתיים" className={desktopPanelClass("p-4 text-center")}>
            <p className="text-lg font-black text-white">
              {endOverlayHeadline(endOverlay, mySymbol, isTeacherObserver)}
            </p>
            {rematch && endOverlay.kind !== "stopped" ? (
              <p className="mt-2 text-sm font-semibold text-white/60">
                משחק חוזר: {rematch.accepted.length} אישרו
                {rematch.refused.length > 0 ? ` · ${rematch.refused.length} סירבו` : ""}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {iAmHost && endOverlay.kind !== "stopped" && !rematch && gameKey !== "breakout" ? (
                <button type="button" className="rounded-lg bg-emerald-600 border border-emerald-500/50 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition duration-200" onClick={() => requestRematch()}>
                  בקש משחק חוזר
                </button>
              ) : null}
              {canVoteRematch && gameKey !== "breakout" ? (
                <>
                  <button type="button" className="rounded-lg bg-emerald-600 border border-emerald-500/50 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition duration-200" disabled={acceptedRematch} onClick={() => respondToRematch(true)}>
                    {acceptedRematch ? "אישרת משחק חוזר" : "אני רוצה משחק חוזר"}
                  </button>
                  <button type="button" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 transition duration-200" disabled={refusedRematch} onClick={() => respondToRematch(false)}>
                    {refusedRematch ? "סירבת" : "לא עכשיו"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-3.5 py-2 text-sm font-bold text-white hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] transition duration-200"
                onClick={() =>
                  navigate(isAdmin ? "/admin" : isTeacherObserver ? "/teacher" : "/home")
                }
              >
                {isAdmin ? "חזרה לניהול" : isTeacherObserver ? "חזרה ללוח המורה" : "חזרה הביתה"}
              </button>
            </div>
          </div>
        ) : null}
      </main>

      <aside className="space-y-4">
          <section className={desktopPanelClass("p-4 text-sm")}>
            <h2 className="font-black text-white/95">שחקנים בחדר</h2>
            <div className="mt-3 space-y-2">
              {(roster.length > 0 ? roster : players).map((player) => (
                <div
                  key={player.userId}
                  className={
                    connectedIds.has(player.userId)
                      ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-bold text-emerald-300"
                      : "rounded-xl border border-white/5 bg-white/5 px-3 py-2 font-semibold text-white/50"
                  }
                >
                  {player.displayName}
                  <span className="block text-xs">
                    {connectedIds.has(player.userId) ? "מחובר" : "חסר"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {paused && iAmHost ? (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
              <p className="font-bold">אפשר לחדש כשהשחקנים חזרו.</p>
              <button
                type="button"
                className="mt-3 rounded-lg bg-emerald-600 border border-emerald-500/50 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition duration-200"
                disabled={!canResume}
                onClick={() => resumeGame()}
              >
                המשך משחק
              </button>
            </section>
          ) : null}

          {iAmHost && !endOverlay ? (
            <section className={desktopPanelClass("space-y-3 p-4")}>
              <h2 className="text-sm font-black text-white/95">ניהול חדר</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-amber-600 border border-amber-500/50 px-3 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50 transition duration-200" disabled={paused} onClick={() => pauseGame()}>
                  השהה
                </button>
                <button type="button" className="rounded-lg bg-rose-600 border border-rose-500/50 px-3 py-2 text-sm font-bold text-white hover:bg-rose-500 transition duration-200" onClick={() => stopGame()}>
                  סיים
                </button>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-black text-white">
                  {roomIsOpen === null ? "טוען פרטיות…" : roomIsOpen ? "חדר פתוח" : "חדר פרטי"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 transition duration-200" disabled={updatingVisibility || roomIsOpen === null} onClick={() => void toggleRoomVisibility()}>
                    {updatingVisibility ? "מעדכן…" : roomIsOpen ? "הפוך לפרטי" : "הפוך לפתוח"}
                  </button>
                  <button type="button" className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm font-bold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 transition duration-200" disabled={!invitationCode} onClick={() => void copyInviteLink()}>
                    העתק הזמנה
                  </button>
                </div>
              </div>
              {inviteFallbackLink ? (
                <p className="break-all rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-300">
                  {inviteFallbackLink}
                </p>
              ) : null}
            </section>
          ) : null}

          {chatPanel}
        </aside>
    </div>
  );
}
