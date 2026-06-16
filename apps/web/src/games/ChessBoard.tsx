import { useEffect, useMemo, useState, useRef, useCallback, memo, type CSSProperties } from "react";
import { Chessboard } from "react-chessboard";
import type { ChessIntent, ChessPromotion, ChessState, ChessTimeControl } from "@playground/game-logic";
import {
  capturedMaterialFromHistory,
  isPlayersPiece,
  kingSquareInCheck,
  legalTargetSquares,
  moveNeedsPromotion,
  fenAtHistoryIndex,
  capturesAtHistoryIndex
} from "@playground/game-logic";
import { chessSounds } from "./chessSounds";
import {
  CburnettChessPiece,
  type CburnettPieceId,
  cburnettCustomPieces,
  pieceIdForCaptureType
} from "./chessCburnettPieces";

const PROMOTIONS: ChessPromotion[] = ["q", "r", "b", "n"];
const PROMO_PIECE: Record<ChessPromotion, "Q" | "R" | "B" | "N"> = {
  q: "Q",
  r: "R",
  b: "B",
  n: "N"
};

function promotionChoicePiece(
  seat: "w" | "b",
  choice: ChessPromotion
): CburnettPieceId {
  const p = seat === "w" ? "w" : "b";
  return `${p}${PROMO_PIECE[choice]}` as CburnettPieceId;
}

function sortCaptureTypes(s: string[]): string[] {
  const order: Record<string, number> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
  return [...s].sort(
    (a, b) => (order[a.toLowerCase()] ?? 9) - (order[b.toLowerCase()] ?? 9)
  );
}

function formatTime(ms: number): string {
  const totalSecs = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function gameOverHeadline(state: ChessState, mySeat: "w" | "b" | null): string {
  if (state.status === "draw") return "תיקו!";
  if (state.timeoutWinner) {
    return state.timeoutWinner === "w" ? "לבן ניצח בזמן!" : "שחור ניצח בזמן!";
  }
  if (state.status === "won") {
    if (mySeat) {
      return state.winner === mySeat ? "ניצחת!" : "הפסדת";
    }
    return state.winner === "w" ? "לבן ניצח" : "שחור ניצח";
  }
  return "";
}

/**
 * Self-ticking chess clock — runs its own 100ms interval internally so
 * the parent ChessBoard doesn't re-render on every tick.
 */
const ChessClock = memo(function ChessClock({
  seat,
  label,
  serverMs,
  lastTickAt,
  activeTurn,
  gameStatus,
  isMine,
  onTimeout
}: {
  seat: "w" | "b";
  label: string;
  serverMs: number;
  lastTickAt: number | null;
  activeTurn: "w" | "b";
  gameStatus: string;
  isMine?: boolean;
  onTimeout?: () => void;
}) {
  const isMyTurn = activeTurn === seat;
  const active = isMyTurn && gameStatus === "playing";
  const shouldTick = active && lastTickAt != null;

  const [displayMs, setDisplayMs] = useState(serverMs);
  const timeoutSentRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Reset when server clocks update
  useEffect(() => {
    setDisplayMs(serverMs);
    timeoutSentRef.current = false;
  }, [serverMs]);

  // Self-tick
  useEffect(() => {
    if (!shouldTick || lastTickAt == null) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastTickAt;
      const next = Math.max(0, serverMs - elapsed);
      setDisplayMs(next);

      if (next <= 0 && !timeoutSentRef.current) {
        timeoutSentRef.current = true;
        onTimeoutRef.current?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [shouldTick, lastTickAt, serverMs]);

  const ms = shouldTick ? displayMs : serverMs;
  const low = active && ms > 0 && ms < 30_000;
  const isBlack = seat === "b";
  const shell = isBlack
    ? active
      ? "border-indigo-500/40 bg-gradient-to-br from-indigo-950/20 to-slate-900/20 text-white shadow-[0_0_12px_rgba(99,102,241,0.2)] ring-2 ring-indigo-400/25"
      : "border-white/10 bg-white/5 text-white/50"
    : active
      ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/20 text-white shadow-[0_0_12px_rgba(251,191,36,0.2)] ring-2 ring-amber-400/25"
      : "border-white/10 bg-white/5 text-white/80";

  return (
    <div
      className={`min-w-[7.5rem] rounded-2xl border px-4 py-2.5 text-center shadow-md transition-all ${shell} ${
        isMine ? "md:scale-[1.03]" : ""
      } ${low ? "border-rose-400 !text-rose-300" : ""}`}
    >
      <div
        className={`text-[10px] font-black uppercase tracking-widest ${
          active ? "text-white/80" : "text-white/40"
        }`}
      >
        {label}
      </div>
      <div
        className={`font-mono text-2xl font-black tabular-nums leading-tight ${
          low ? "animate-pulse" : ""
        }`}
      >
        {formatTime(ms)}
      </div>
    </div>
  );
});

function getTimeControlDescription(tc?: ChessTimeControl): string {
  if (!tc || tc.mode === "none") return "ללא שעון (משחק חופשי)";
  const mins = tc.initialMs / 60000;
  const inc = tc.incrementMs ? tc.incrementMs / 1000 : 0;
  if (inc > 0) {
    return `${mins} דקות + ${inc} שניות תוספת`;
  }
  return `${mins} דקות`;
}

export interface ChessBoardProps {
  gameState: ChessState;
  mySeat: "w" | "b" | null;
  onIntent: (intent: ChessIntent) => void;
  isHost?: boolean;
  onPlayAgain?: () => void;
  onExit?: () => void;
  sessionEnd?: { kind: "won" | "draw" | "stopped"; winner?: string } | null;
  rematch?: { accepted: string[]; refused: string[] } | null;
  canRequestRematch?: boolean;
  canVoteRematch?: boolean;
  acceptedRematch?: boolean;
  refusedRematch?: boolean;
  onRequestRematch?: () => void;
  onRespondRematch?: (accept: boolean) => void;
  onGoHome?: () => void;
  allowDrawOffers?: boolean;
}

export function ChessBoard({
  gameState,
  mySeat,
  onIntent,
  isHost,
  onPlayAgain,
  onExit,
  sessionEnd,
  rematch,
  canRequestRematch,
  canVoteRematch,
  acceptedRematch,
  refusedRematch,
  onRequestRematch,
  onRespondRematch,
  onGoHome,
  allowDrawOffers = true
}: ChessBoardProps) {
  const [viewIndex, setViewIndex] = useState<number>(-1);
  const [customMins, setCustomMins] = useState<string>("15");
  const [customInc, setCustomInc] = useState<string>("10");
  const [confirmResign, setConfirmResign] = useState(false);
  const [viewBoardAfterEnd, setViewBoardAfterEnd] = useState(false);

  const activeFen = useMemo(() => {
    return fenAtHistoryIndex(gameState, viewIndex);
  }, [gameState, viewIndex]);

  const viewCaptures = useMemo(() => {
    return capturesAtHistoryIndex(gameState.history, viewIndex);
  }, [gameState.history, viewIndex]);

  const canPlay =
    gameState.status === "playing" &&
    mySeat !== null &&
    gameState.next === mySeat &&
    viewIndex === -1;

  const inActiveGame = gameState.status === "playing" && mySeat !== null;
  const orientation: "white" | "black" = mySeat === "b" ? "black" : "white";
  const drawOfferFrom = gameState.drawOfferFrom ?? null;
  const myColor = mySeat ?? "w";
  const opponentColor: "w" | "b" = myColor === "w" ? "b" : "w";
  const showEndOverlay =
    (gameState.status !== "playing" || sessionEnd?.kind === "stopped") &&
    !viewBoardAfterEnd &&
    viewIndex === -1;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // Clocks: server-side clocks are passed directly to self-ticking ChessClock
  // components that handle their own 100ms intervals, avoiding re-rendering
  // the entire board 10x/sec.
  const hasClocks = gameState.clocks != null && gameState.timeControl?.mode === "timed";

  const handleClockTimeout = useCallback(() => {
    onIntent({ type: "check_timeout" });
  }, [onIntent]);

  useEffect(() => {
    if (!inActiveGame) setConfirmResign(false);
  }, [inActiveGame]);

  useEffect(() => {
    if (gameState.status === "playing") {
      setViewBoardAfterEnd(false);
    }
  }, [gameState.status]);

  // When opponent plays a move, auto-return to live
  useEffect(() => {
    setViewIndex(-1);
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [gameState.history.length]);

  // Sound triggering
  const historyLenRef = useRef(gameState.history.length);
  const prevStatusRef = useRef(gameState.status);

  useEffect(() => {
    chessSounds.prime();
  }, []);

  useEffect(() => {
    const len = gameState.history.length;
    if (len > historyLenRef.current) {
      chessSounds.playMove();

      const lastLen = historyLenRef.current;
      const prevCaps = capturedMaterialFromHistory(gameState.history.slice(0, lastLen));
      const currCaps = capturedMaterialFromHistory(gameState.history.slice(0, len));
      const wasCapture =
        prevCaps.wTakes.length + prevCaps.bTakes.length <
        currCaps.wTakes.length + currCaps.bTakes.length;

      if (gameState.status === "won" && !gameState.timeoutWinner) {
        chessSounds.playMate();
      } else if (gameState.status === "draw") {
        chessSounds.playGameEnd(null);
      } else if (kingSquareInCheck(gameState.fen)) {
        chessSounds.playCheck();
      } else if (wasCapture) {
        chessSounds.playCapture();
      }
    }
    historyLenRef.current = len;
  }, [gameState.history.length, gameState.fen, gameState.status, gameState.timeoutWinner]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (gameState.status !== prev && gameState.status !== "playing") {
      const historyUnchanged = gameState.history.length === historyLenRef.current;
      const endedByMove =
        (gameState.status === "won" && !gameState.timeoutWinner && !historyUnchanged) ||
        (gameState.status === "draw" && !historyUnchanged);

      if (!endedByMove) {
        const won = mySeat ? gameState.winner === mySeat : gameState.winner === "w";
        if (gameState.status === "won") {
          chessSounds.playGameEnd(won);
        } else if (gameState.status === "draw") {
          chessSounds.playGameEnd(null);
        }
      }
    }
    prevStatusRef.current = gameState.status;
  }, [gameState.status, gameState.winner, gameState.timeoutWinner, mySeat]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [] as string[];
    return legalTargetSquares(activeFen, selectedSquare);
  }, [activeFen, selectedSquare]);

  const checkSquare = useMemo(() => {
    if (gameState.status !== "playing") return null;
    return kingSquareInCheck(activeFen);
  }, [activeFen, gameState.status]);

  const { wTakes, bTakes } = viewCaptures;

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    const lm = gameState.lastMove;
    if (lm && viewIndex === -1) {
      styles[lm.from] = { backgroundColor: "rgba(14, 165, 233, 0.36)" };
      styles[lm.to] = { backgroundColor: "rgba(14, 165, 233, 0.4)" };
    }
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(16, 185, 129, 0.42)" };
      for (const t of legalTargets) {
        styles[t] = {
          backgroundColor: "rgba(16, 185, 129, 0.22)",
          boxShadow: "inset 0 0 0 2px rgba(16, 185, 129, 0.38)"
        };
      }
    }
    if (checkSquare) {
      styles[checkSquare] = {
        backgroundColor: "rgba(244, 63, 94, 0.48)",
        boxShadow: "inset 0 0 0 2px rgba(251, 113, 133, 0.9)"
      };
    }
    return styles;
  }, [gameState.lastMove, selectedSquare, legalTargets, checkSquare, viewIndex]);

  function sendMove(from: string, to: string, promotion?: ChessPromotion) {
    chessSounds.prime();
    const intent: ChessIntent = {
      type: "move",
      from,
      to,
      ...(promotion ? { promotion } : {})
    };
    onIntent(intent);
  }

  function tryMove(from: string, to: string) {
    if (moveNeedsPromotion(activeFen, from, to)) {
      setPendingPromotion({ from, to });
      return;
    }
    sendMove(from, to);
  }

  function renderClock(seat: "w" | "b") {
    if (!hasClocks || !gameState.clocks) return null;
    const label = seat === "w" ? "לבן" : "שחור";
    return (
      <ChessClock
        seat={seat}
        label={label}
        serverMs={gameState.clocks[seat]}
        lastTickAt={gameState.lastTickAt ?? null}
        activeTurn={gameState.next}
        gameStatus={gameState.status}
        isMine={seat === myColor}
        onTimeout={seat === gameState.next ? handleClockTimeout : undefined}
      />
    );
  }

  const boardBlock = (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-3xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      <Chessboard
        position={activeFen}
        boardOrientation={orientation}
        animationDuration={orientation === "black" ? 0 : 300}
        arePiecesDraggable={canPlay}
        customPieces={cburnettCustomPieces}
        customBoardStyle={{ borderRadius: "1.5rem" }}
        customDarkSquareStyle={{ backgroundColor: "#93c5fd" }}
        customLightSquareStyle={{ backgroundColor: "#eff6ff" }}
        isDraggablePiece={({ piece }) =>
          canPlay && piece[0] === (mySeat === "w" ? "w" : "b")
        }
        customSquareStyles={customSquareStyles}
        onPieceDrop={(from, to) => {
          chessSounds.prime();
          if (!canPlay || !mySeat) return false;
          if (!isPlayersPiece(activeFen, from, mySeat)) return false;
          if (!legalTargetSquares(activeFen, from).includes(to)) return false;
          if (moveNeedsPromotion(activeFen, from, to)) {
            setPendingPromotion({ from, to });
            return false;
          }
          sendMove(from, to);
          return true;
        }}
        onSquareClick={(square) => {
          chessSounds.prime();
          if (pendingPromotion || !canPlay || !mySeat) {
            if (!canPlay) setSelectedSquare(null);
            return;
          }

          if (!selectedSquare) {
            if (isPlayersPiece(activeFen, square, mySeat)) {
              setSelectedSquare(square);
            }
            return;
          }

          if (square === selectedSquare) {
            setSelectedSquare(null);
            return;
          }

          if (isPlayersPiece(activeFen, square, mySeat)) {
            setSelectedSquare(square);
            return;
          }

          if (!legalTargetSquares(activeFen, selectedSquare).includes(square)) {
            setSelectedSquare(null);
            return;
          }

          const from = selectedSquare;
          setSelectedSquare(null);
          tryMove(from, square);
        }}
      />

      {showEndOverlay ? (
        <div
          role="alertdialog"
          aria-label="המשחק הסתיים"
          className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-black/60 backdrop-blur-md"
        >
          <div className="mx-4 max-w-sm rounded-3xl border border-white/10 bg-black/80 p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.7)] backdrop-blur-lg" dir="rtl">
            <p className="text-2xl font-black text-white">
              {sessionEnd?.kind === "stopped"
                ? isHost
                  ? "המשחק נעצר"
                  : "המארח עצר את המשחק"
                : gameOverHeadline(gameState, mySeat)}
            </p>
            {gameState.status === "draw" && gameState.drawReason ? (
              <p className="mt-1 text-sm font-semibold text-white/50">
                {gameState.drawReason === "stalemate"
                  ? "פט"
                  : gameState.drawReason === "draw_by_agreement"
                    ? "תיקו בהסכמה"
                    : "תיקו"}
              </p>
            ) : null}

            {rematch && sessionEnd?.kind !== "stopped" ? (
              <p className="mt-2 text-sm font-semibold text-white/60">
                משחק חוזר: {rematch.accepted.length} אישרו
                {rematch.refused.length > 0 ? ` · ${rematch.refused.length} סירבו` : ""}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {canRequestRematch ? (
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 border border-emerald-500 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] transition duration-200"
                  onClick={onRequestRematch}
                >
                  בקש משחק חוזר
                </button>
              ) : null}
              {canVoteRematch ? (
                <>
                  <button
                    type="button"
                    disabled={acceptedRematch}
                    className="rounded-xl bg-emerald-600 border border-emerald-500 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] transition duration-200"
                    onClick={() => onRespondRematch?.(true)}
                  >
                    {acceptedRematch ? "אישרת משחק חוזר" : "אני רוצה משחק חוזר"}
                  </button>
                  <button
                    type="button"
                    disabled={refusedRematch}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 transition duration-200"
                    onClick={() => onRespondRematch?.(false)}
                  >
                    {refusedRematch ? "סירבת" : "לא עכשיו"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                onClick={() => setViewBoardAfterEnd(true)}
              >
                צפה בלוח
              </button>
              {onPlayAgain ? (
                <button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-2 text-sm font-black text-white hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200"
                  onClick={onPlayAgain}
                >
                  משחק חדש
                </button>
              ) : null}
              {onExit ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={onExit}
                >
                  חזרה להגדרות
                </button>
              ) : null}
              {onGoHome ? (
                <button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-2 text-sm font-black text-white hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200"
                  onClick={onGoHome}
                >
                  חזרה הביתה
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
      {/* Time Control Panel - shown only before the first move */}
      {gameState.history.length === 0 && gameState.status === "playing" && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-3" dir="rtl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-black text-white/80">בקרת זמן פעילה:</span>
            <span className="text-sm font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-xl">
              {getTimeControlDescription(gameState.timeControl)}
            </span>
          </div>

          {isHost && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <p className="text-xs font-bold text-white/50">שינוי בקרת זמן (מארח):</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={() => onIntent({ type: "set_time_control", timeControl: { mode: "none" } })}
                >
                  ללא שעון
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={() => onIntent({ type: "set_time_control", timeControl: { mode: "timed", initialMs: 1 * 60000, incrementMs: 0 } })}
                >
                  1 דקה (קליע)
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={() => onIntent({ type: "set_time_control", timeControl: { mode: "timed", initialMs: 3 * 60000, incrementMs: 0 } })}
                >
                  3 דקות (בליץ)
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={() => onIntent({ type: "set_time_control", timeControl: { mode: "timed", initialMs: 5 * 60000, incrementMs: 0 } })}
                >
                  5 דקות (בליץ)
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={() => onIntent({ type: "set_time_control", timeControl: { mode: "timed", initialMs: 10 * 60000, incrementMs: 0 } })}
                >
                  10 דקות (מהיר)
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="text-xs font-bold text-white/80">מותאם אישית:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customMins}
                    onChange={(e) => setCustomMins(e.target.value)}
                    className="w-12 rounded-lg border border-white/10 bg-white/5 text-white p-1 text-center text-xs font-bold focus:bg-white/10 focus:outline-none"
                  />
                  <span className="text-xs text-white/40">דקות</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={customInc}
                    onChange={(e) => setCustomInc(e.target.value)}
                    className="w-12 rounded-lg border border-white/10 bg-white/5 text-white p-1 text-center text-xs font-bold focus:bg-white/10 focus:outline-none"
                  />
                  <span className="text-xs text-white/40">שניות תוספת</span>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 text-white px-3 py-1 text-xs font-bold hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200"
                  onClick={() => {
                    const mins = Math.max(1, parseInt(customMins) || 5);
                    const inc = Math.max(0, parseInt(customInc) || 0);
                    onIntent({
                      type: "set_time_control",
                      timeControl: {
                        mode: "timed",
                        initialMs: mins * 60000,
                        incrementMs: inc * 1000
                      }
                    });
                  }}
                >
                  החל
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState.status === "playing" ? (
        <p className="text-center text-sm font-semibold text-white/80" dir="rtl">
          {gameState.next === mySeat ? "תורך!" : gameState.next === "w" ? "תור לבן" : "תור שחור"}
        </p>
      ) : null}

      {/* LTR: keeps files a..h and capture trays matching the board; avoids RTL mirroring the grid */}
      <div dir="ltr" className="space-y-3">
        {inActiveGame && drawOfferFrom === mySeat && (
          <p className="text-end text-sm font-medium text-amber-400" dir="rtl">
            הצעת תיקו ממתינה לתגובה
          </p>
        )}

        {inActiveGame && drawOfferFrom && drawOfferFrom !== mySeat && (
          <p className="text-end text-sm font-medium text-amber-400" dir="rtl">
            היריב הציע תיקו
          </p>
        )}

        <div className="flex min-h-[2.75rem] flex-col justify-center">
          {pendingPromotion && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white/70" dir="rtl">
                הפיכה — בחר כלי:
              </span>
              {PROMOTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-sm hover:bg-white/10 transition duration-200"
                  onClick={() => {
                    sendMove(pendingPromotion.from, pendingPromotion.to, p);
                    setPendingPromotion(null);
                  }}
                >
                  {mySeat ? (
                    <CburnettChessPiece
                      piece={promotionChoicePiece(mySeat, p)}
                      size={28}
                    />
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                className="text-sm font-medium text-white/50 underline hover:text-white/80 transition duration-200"
                dir="rtl"
                onClick={() => setPendingPromotion(null)}
              >
                ביטול
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-center md:gap-4">
          {hasClocks ? (
            <div className="order-1 flex justify-center md:order-1 md:w-32 md:shrink-0">
              {renderClock(opponentColor)}
            </div>
          ) : null}

          <div className="order-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3 md:order-2 md:min-w-0 md:flex-1 md:max-w-xl">
          {/* bTakes: Black captured (White’s material) — must show as white-skin men */}
          <div className="order-1 flex min-h-[2rem] flex-1 flex-wrap content-start items-center gap-0.5 sm:max-w-[3.5rem]">
            {sortCaptureTypes(bTakes).map((p, i) => {
              const id = pieceIdForCaptureType(p, "w");
              return id ? (
                <CburnettChessPiece key={`by-black-${i}-${p}`} piece={id} size={22} />
              ) : null;
            })}
          </div>

          <div className="order-2 min-w-0 flex-1">{boardBlock}</div>

          {/* wTakes: White captured (Black's material) — must show as black-skin men */}
          <div className="order-3 flex min-h-[2rem] flex-1 flex-wrap content-start items-end justify-end gap-0.5 sm:max-w-[3.5rem] sm:justify-start">
            {sortCaptureTypes(wTakes).map((p, i) => {
              const id = pieceIdForCaptureType(p, "b");
              return id ? (
                <CburnettChessPiece key={`by-white-${i}-${p}`} piece={id} size={22} />
              ) : null;
            })}
          </div>
          </div>

          {hasClocks ? (
            <div className="order-3 flex justify-center md:order-3 md:w-32 md:shrink-0">
              {renderClock(myColor)}
            </div>
          ) : null}
        </div>

        {/* History Replay Navigation Controls */}
        {gameState.history.length > 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 border border-white/10 p-2" dir="rtl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-8 px-2.5 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                onClick={() => setViewIndex(0)}
                title="תחילת המשחק"
              >
                |&lt;&lt;
              </button>
              <button
                type="button"
                className="flex h-8 px-3.5 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                onClick={() =>
                  setViewIndex((prev) =>
                    prev === -1 ? Math.max(0, gameState.history.length - 1) : Math.max(0, prev - 1)
                  )
                }
                title="מהלך קודם"
              >
                &lt;
              </button>
              <span className="min-w-[6rem] text-center text-xs font-black text-white/60">
                {viewIndex === -1
                  ? `מהלך ${gameState.history.length}/${gameState.history.length}`
                  : `מהלך ${viewIndex}/${gameState.history.length}`}
              </span>
              <button
                type="button"
                className="flex h-8 px-3.5 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                onClick={() =>
                  setViewIndex((prev) =>
                    prev === -1 ? -1 : prev >= gameState.history.length - 1 ? -1 : prev + 1
                  )
                }
                title="מהלך הבא"
              >
                &gt;
              </button>
              <button
                type="button"
                className="flex h-8 px-2.5 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                onClick={() => setViewIndex(-1)}
                title="חזור למשחק"
              >
                &gt;&gt;|
              </button>
            </div>
            {viewIndex !== -1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-400">
                  צופה בהיסטוריית המהלכים.
                </span>
                <button
                  type="button"
                  className="text-xs font-black text-indigo-400 underline hover:text-indigo-300 transition duration-200"
                  onClick={() => setViewIndex(-1)}
                >
                  חזור למשחק
                </button>
              </div>
            )}
          </div>
        )}

        {(gameState.status !== "playing" || sessionEnd?.kind === "stopped") &&
          (viewBoardAfterEnd || viewIndex !== -1) && (
            <div
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-center"
              dir="rtl"
            >
              <span className="text-sm font-bold text-white">
                המשחק הסתיים ({gameOverHeadline(gameState, mySeat)}). 
              </span>
              <button
                type="button"
                className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-1.5 text-xs font-black text-white hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] transition duration-200 shadow-sm"
                onClick={() => {
                  setViewBoardAfterEnd(false);
                  setViewIndex(-1);
                }}
              >
                הצג אפשרויות סיום ומשחק חוזר
              </button>
            </div>
          )}

        {inActiveGame && (
          <div className="flex flex-wrap gap-2" dir="rtl">
            {allowDrawOffers && drawOfferFrom && drawOfferFrom !== mySeat ? (
              <>
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 border border-emerald-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition duration-200"
                  onClick={() => onIntent({ type: "accept_draw" })}
                >
                  קבל תיקו
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={() => onIntent({ type: "decline_draw" })}
                >
                  דחה
                </button>
              </>
            ) : null}
            {allowDrawOffers && canPlay && (!drawOfferFrom || drawOfferFrom === mySeat) && (
              <button
                type="button"
                disabled={!!(drawOfferFrom && drawOfferFrom === mySeat)}
                className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 transition duration-200"
                onClick={() => onIntent({ type: "offer_draw" })}
              >
                {drawOfferFrom === mySeat ? "הצעה נשלחה" : "הצע תיקו"}
              </button>
            )}
            <button
              type="button"
              className="rounded-xl bg-rose-600/80 border border-rose-500/50 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-600 transition duration-200"
              onClick={() => setConfirmResign(true)}
            >
              הכנע
            </button>
            {confirmResign ? (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                <span className="text-sm font-bold text-rose-200">לוודא שברצונך להיכנע?</span>
                <button
                  type="button"
                  className="rounded-lg bg-rose-600 border border-rose-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-rose-500 transition duration-250"
                  onClick={() => {
                    setConfirmResign(false);
                    onIntent({ type: "resign" });
                  }}
                >
                  כן, היכנע
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                  onClick={() => setConfirmResign(false)}
                >
                  ביטול
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
