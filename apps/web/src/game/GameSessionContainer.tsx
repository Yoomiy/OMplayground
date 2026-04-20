import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { TicTacToeState } from "@playground/game-logic";
import { supabase } from "@/lib/supabase";
import { TicTacToeBoard } from "@/games/TicTacToeBoard";

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
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<TicTacToeState | null>(null);
  const [mySymbol, setMySymbol] = useState<"X" | "O" | null>(null);
  const [status, setStatus] = useState<string>("מתחבר…");
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
          (ack: {
            ok?: boolean;
            error?: { message?: string };
            player?: { symbol: "X" | "O" };
          }) => {
            if (!ack?.ok) {
              setStatus(ack?.error?.message ?? "הצטרפות לחדר נכשלה");
              return;
            }
            if (ack.player?.symbol) {
              setMySymbol(ack.player.symbol);
            }
          }
        );
      });

      s.on("ROOM_SNAPSHOT", (payload: { gameState?: TicTacToeState }) => {
        if (payload?.gameState) {
          setGameState(payload.gameState);
        }
      });

      s.on(
        "CHAT_MESSAGE",
        (payload: { senderName?: string; message?: string }) => {
          if (!payload?.message) return;
          setChatLines((prev) => [
            ...prev,
            {
              senderName: payload.senderName ?? "?",
              message: payload.message
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

  const onCellPress = useCallback(
    (index: number) => {
      const s = socketRef.current;
      if (!s?.connected) {
        setStatus("אין חיבור פעיל");
        return;
      }
      s.emit(
        "INTENT_GAME",
        { sessionId, cellIndex: index },
        (ack: { ok?: boolean; error?: { message?: string } }) => {
          if (!ack?.ok) {
            setStatus(ack?.error?.message ?? "מהלך לא חוקי");
          }
        }
      );
    },
    [sessionId]
  );

  if (!gameState) {
    return <p className="text-sm text-slate-400">{status}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{status}</p>
      <TicTacToeBoard
        gameState={gameState}
        mySymbol={mySymbol}
        onCellPress={onCellPress}
      />
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
    </div>
  );
}
