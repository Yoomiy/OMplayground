import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type {
  ChessState,
  ConnectFourState,
  DrawingState,
  MemoryState,
  TicTacToeState
} from "@playground/game-logic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePersistedSessionChat } from "@/hooks/usePersistedSessionChat";
import { useTeacherSessionChat } from "@/hooks/useTeacherSessionChat";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ConnectFourBoard } from "@/games/ConnectFourBoard";
import { ChessBoard } from "@/games/ChessBoard";
import { DrawingBoard } from "@/games/DrawingBoard";
import { MemoryBoard } from "@/games/MemoryBoard";
import { TicTacToeBoard } from "@/games/TicTacToeBoard";

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

interface RoomPlayer {
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
  if (mySymbol && overlay.winner === mySymbol) return "ניצחת!";
  return "הפסדת";
}

/**
 * Map of `gameKey` (matches `games.game_url`) → client board renderer.
 * The container stays game-agnostic; new games just register here.
 */
interface BoardProps {
  gameState: unknown;
  mySymbol: string | null;
  myUserId: string | null;
  onIntent: (intent: unknown) => void;
}

interface BoardRegistryEntry {
  component: (props: BoardProps) => JSX.Element;
  fullscreen?: boolean;
}

const BOARD_REGISTRY: Record<string, BoardRegistryEntry> = {
  chess: {
    component: ({ gameState, mySymbol, onIntent }) => (
      <ChessBoard
        gameState={gameState as ChessState}
        mySeat={mySymbol === "w" || mySymbol === "b" ? mySymbol : null}
        onIntent={(intent) => onIntent(intent)}
      />
    )
  },
  tictactoe: {
    component: ({ gameState, mySymbol, onIntent }) => (
      <TicTacToeBoard
        gameState={gameState as TicTacToeState}
        mySymbol={mySymbol === "X" || mySymbol === "O" ? mySymbol : null}
        onCellPress={(i) => onIntent({ cellIndex: i })}
      />
    )
  },
  connectfour: {
    component: ({ gameState, mySymbol, onIntent }) => (
      <ConnectFourBoard
        gameState={gameState as ConnectFourState}
        mySeat={mySymbol === "R" || mySymbol === "Y" ? mySymbol : null}
        onIntent={(intent) => onIntent(intent)}
      />
    )
  },
  memory: {
    component: ({ gameState, myUserId, onIntent }) => (
      <MemoryBoard
        gameState={gameState as MemoryState}
        myUserId={myUserId}
        onIntent={(intent) => onIntent(intent)}
      />
    )
  },
  drawing: {
    component: ({ gameState, mySymbol, onIntent }) => (
      <DrawingBoard
        gameState={gameState as DrawingState}
        mySeat={mySymbol}
        onIntent={(intent) => onIntent(intent)}
      />
    )
  }
};

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
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { isAdmin } = useIsAdmin(user);
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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus("אין סשן — התחבר מחדש.");
        return;
      }
      if (cancelled) return;
      setMyUserId(data.session?.user.id ?? null);

      const s = io(gameServerUrl(), {
        auth: { token },
        reconnectionAttempts: 2,
        reconnectionDelay: 1500
      });
      socketRef.current = s;

      s.on("connect", () => {
        setStatus("מחובר");
        s.emit(
          "JOIN_ROOM",
          { sessionId },
          (ack: { ok?: boolean; error?: { message?: string } }) => {
            if (!ack?.ok) {
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
        setStatus(connectErrorLabel(err));
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
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

  /** Derived from authoritative state so clients never diverge on seat order. */
  const mySymbol = useMemo<string | null>(() => {
    const seats = (gameState as { seats?: Record<string, string> } | null)
      ?.seats;
    if (!seats || !myUserId) return null;
    return seats[myUserId] ?? null;
  }, [gameState, myUserId]);

  if (!gameState || !gameKey) {
    return <p className="text-sm text-slate-600">{status}</p>;
  }

  const boardEntry = BOARD_REGISTRY[gameKey];
  const Board = boardEntry?.component;
  const isFullscreen = boardEntry?.fullscreen === true;
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

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-40 space-y-4 overflow-auto bg-[rgb(var(--play-bg))] p-4"
          : "space-y-4"
      }
    >
      <p className="text-sm text-slate-600">
        {isTeacherObserver ? "צפייה בלבד (מורה) · " : ""}
        {status}
      </p>
      {toast && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm"
        >
          {toast}
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white/95 p-3 text-sm shadow-sm">
        <h2 className="font-bold text-slate-800">שחקנים בחדר</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(roster.length > 0 ? roster : players).map((p) => (
            <span
              key={p.userId}
              className={
                connectedIds.has(p.userId)
                  ? "rounded-lg bg-emerald-100 px-2 py-1 font-medium text-emerald-900"
                  : "rounded-lg bg-slate-200 px-2 py-1 text-slate-600"
              }
            >
              {p.displayName}
              {connectedIds.has(p.userId) ? " · מחובר" : " · חסר"}
            </span>
          ))}
        </div>
      </section>
      {paused ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 shadow-sm">
          <p className="font-medium">המשחק מושהה ונשמר להמשך.</p>
          {missingPlayers.length > 0 ? (
            <p className="mt-1">
              ממתינים להצטרפות:{" "}
              {missingPlayers.map((p) => p.displayName).join(", ")}
            </p>
          ) : (
            <p className="mt-1">כל השחקנים חזרו לחדר.</p>
          )}
          {iAmHost ? (
            <button
              type="button"
              className="mt-3 rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
              disabled={!canResume}
              onClick={() => resumeGame()}
            >
              המשך משחק
            </button>
          ) : null}
        </section>
      ) : null}
      {Board ? (
        <div
          className={
            isTeacherObserver || paused ? "pointer-events-none opacity-60" : undefined
          }
        >
          <Board
            gameState={gameState}
            mySymbol={mySymbol}
            myUserId={myUserId}
            onIntent={onIntent}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          משחק לא נתמך בלקוח: {gameKey}
        </p>
      )}
      {iAmHost && !endOverlay && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
            disabled={paused}
            onClick={() => pauseGame()}
          >
            השהה משחק
          </button>
          <button
            type="button"
            className="rounded bg-rose-700 px-3 py-1 text-sm text-white hover:bg-rose-600"
            onClick={() => stopGame()}
          >
            סיים משחק
          </button>
        </div>
      )}
      {endOverlay && (
        <div
          role="alertdialog"
          aria-label="המשחק הסתיים"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-play"
        >
          <p className="text-lg font-bold text-slate-900">
            {endOverlayHeadline(endOverlay, mySymbol, isTeacherObserver)}
          </p>
          {rematch && endOverlay.kind !== "stopped" ? (
            <p className="mt-2 text-sm text-slate-600">
              משחק חוזר: {rematch.accepted.length} אישרו
              {rematch.refused.length > 0
                ? ` · ${rematch.refused.length} סירבו`
                : ""}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {iAmHost && endOverlay.kind !== "stopped" && !rematch ? (
              <button
                type="button"
                className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500"
                onClick={() => requestRematch()}
              >
                בקש משחק חוזר
              </button>
            ) : null}
            {canVoteRematch ? (
              <>
                <button
                  type="button"
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                  disabled={acceptedRematch}
                  onClick={() => respondToRematch(true)}
                >
                  {acceptedRematch ? "אישרת משחק חוזר" : "אני רוצה משחק חוזר"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border-2 border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  disabled={refusedRematch}
                  onClick={() => respondToRematch(false)}
                >
                  {refusedRematch ? "סירבת" : "לא עכשיו"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500"
              onClick={() =>
                navigate(
                  isAdmin
                    ? "/admin"
                    : isTeacherObserver
                      ? "/teacher"
                      : "/home"
                )
              }
            >
              {isAdmin
                ? "חזרה לניהול"
                : isTeacherObserver
                  ? "חזרה ללוח המורה"
                  : "חזרה הביתה"}
            </button>
          </div>
        </div>
      )}
      {!isFullscreen && isTeacherObserver ? (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              צ׳אט (ניהול מורה)
            </h2>
            <button
              type="button"
              className="rounded-lg border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              onClick={() => {
                if (
                  !window.confirm("למחוק את כל ההודעות במפגש זה?")
                ) {
                  return;
                }
                void teacherChat.clearSession().catch((e: Error) =>
                  setStatus(e.message)
                );
              }}
            >
              ניקוי צ׳אט
            </button>
          </div>
          {teacherChat.error ? (
            <p className="text-xs font-medium text-amber-800">{teacherChat.error}</p>
          ) : null}
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm text-slate-800">
            {teacherChat.lines.map((l) => (
              <li
                key={l.id}
                className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1"
              >
                <span>
                  <span className="text-slate-500">{l.sender_name}:</span>{" "}
                  {l.message}
                </span>
                {!l.is_system ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-rose-400 underline"
                    onClick={() =>
                      void teacherChat.softDelete(l.id).catch((e: Error) =>
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
      ) : !isFullscreen ? (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">צ׳אט במשחק</h2>
          {kidChat.error ? (
            <p className="text-xs font-medium text-amber-800">{kidChat.error}</p>
          ) : null}
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-800">
            {kidChat.lines.map((l) => (
              <li key={l.id}>
                <span className="text-slate-500">{l.sender_name}:</span>{" "}
                {l.message}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className="min-h-10 flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="הודעה…"
              maxLength={500}
            />
            <button
              type="button"
              className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500"
              onClick={() => sendChat()}
            >
              שלח
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
