import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type { ConnectFourState, TicTacToeState } from "@playground/game-logic";
import { supabase } from "@/lib/supabase";
import { ConnectFourBoard } from "@/games/ConnectFourBoard";
import { TicTacToeBoard } from "@/games/TicTacToeBoard";

type RoomEvent =
  | {
      kind: "GAME_ENDED";
      outcome: { kind: "won"; winner: string } | { kind: "draw" };
    }
  | { kind: "GAME_STOPPED"; stoppedBy?: string }
  | { kind: "HOST_LEFT"; newHostId?: string }
  | { kind: "RECESS_ENDED" };

type EndOverlay =
  | { kind: "won"; winner: string }
  | { kind: "draw" }
  | { kind: "stopped" };

function endOverlayHeadline(
  overlay: EndOverlay,
  mySymbol: string | null
): string {
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
  onIntent: (intent: unknown) => void;
}

interface BoardRegistryEntry {
  component: (props: BoardProps) => JSX.Element;
  fullscreen?: boolean;
}

const BOARD_REGISTRY: Record<string, BoardRegistryEntry> = {
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
  const socketRef = useRef<Socket | null>(null);
  const recessEndedRef = useRef(false);
  const [gameKey, setGameKey] = useState<string | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [status, setStatus] = useState<string>("מתחבר…");
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [endOverlay, setEndOverlay] = useState<EndOverlay | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLines, setChatLines] = useState<
    { senderName: string; message: string }[]
  >([]);

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
        }) => {
          if (payload?.gameKey) {
            setGameKey(payload.gameKey);
          }
          if (payload?.gameState !== undefined) {
            setGameState(payload.gameState);
          }
          if (payload?.hostId) {
            setHostId(payload.hostId);
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
          case "HOST_LEFT":
            setToast("המארח עזב — הקברניט הוחלף");
            return;
          case "RECESS_ENDED":
            recessEndedRef.current = true;
            setToast("ההפסקה הסתיימה");
            return;
        }
      });

      s.on("disconnect", () => {
        if (recessEndedRef.current) {
          navigate("/login", { replace: true });
        }
      });

      s.on(
        "CHAT_MESSAGE",
        (payload: { senderName?: string; message?: string }) => {
          const message = payload?.message;
          if (!message) return;
          setChatLines((prev) => [
            ...prev,
            {
              senderName: payload.senderName ?? "?",
              message
            }
          ]);
        }
      );

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
    [sessionId]
  );

  /** Derived from authoritative state so clients never diverge on seat order. */
  const mySymbol = useMemo<string | null>(() => {
    const seats = (gameState as { seats?: Record<string, string> } | null)
      ?.seats;
    if (!seats || !myUserId) return null;
    return seats[myUserId] ?? null;
  }, [gameState, myUserId]);

  if (!gameState || !gameKey) {
    return <p className="text-sm text-slate-400">{status}</p>;
  }

  const boardEntry = BOARD_REGISTRY[gameKey];
  const Board = boardEntry?.component;
  const isFullscreen = boardEntry?.fullscreen === true;
  const iAmHost = myUserId != null && hostId != null && myUserId === hostId;

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-40 space-y-4 overflow-auto bg-slate-950 p-4"
          : "space-y-4"
      }
    >
      <p className="text-sm text-slate-400">{status}</p>
      {toast && (
        <div
          role="status"
          className="rounded border border-amber-500 bg-amber-950/60 px-3 py-2 text-sm text-amber-100"
        >
          {toast}
        </div>
      )}
      {Board ? (
        <Board gameState={gameState} mySymbol={mySymbol} onIntent={onIntent} />
      ) : (
        <p className="text-sm text-amber-300">
          משחק לא נתמך בלקוח: {gameKey}
        </p>
      )}
      {iAmHost && !endOverlay && (
        <button
          type="button"
          className="rounded bg-rose-700 px-3 py-1 text-sm text-white hover:bg-rose-600"
          onClick={() => stopGame()}
        >
          עצור משחק
        </button>
      )}
      {endOverlay && (
        <div
          role="alertdialog"
          aria-label="המשחק הסתיים"
          className="rounded-lg border border-slate-600 bg-slate-900 p-4 text-center"
        >
          <p className="text-lg font-bold text-slate-100">
            {endOverlayHeadline(endOverlay, mySymbol)}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500"
              onClick={() => navigate("/home")}
            >
              חזרה הביתה
            </button>
          </div>
        </div>
      )}
      {!isFullscreen && (
        <section className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          <h2 className="text-sm font-medium text-slate-300">צ׳אט במשחק</h2>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-200">
            {chatLines.map((l, i) => (
              <li key={`${l.senderName}-${i}`}>
                <span className="text-slate-500">{l.senderName}:</span>{" "}
                {l.message}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
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
      )}
    </div>
  );
}
