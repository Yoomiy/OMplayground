import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Chessboard } from "react-chessboard";
import type { ChessIntent, ChessPromotion, ChessState } from "@playground/game-logic";
import {
  capturedMaterialFromHistory,
  isPlayersPiece,
  kingSquareInCheck,
  legalTargetSquares,
  moveNeedsPromotion
} from "@playground/game-logic";
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

export interface ChessBoardProps {
  gameState: ChessState;
  mySeat: "w" | "b" | null;
  onIntent: (intent: ChessIntent) => void;
}

export function ChessBoard({ gameState, mySeat, onIntent }: ChessBoardProps) {
  const canPlay =
    gameState.status === "playing" && mySeat !== null && gameState.next === mySeat;
  const inActiveGame = gameState.status === "playing" && mySeat !== null;
  const orientation: "white" | "black" = mySeat === "b" ? "black" : "white";
  const drawOfferFrom = gameState.drawOfferFrom ?? null;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const fen = gameState.fen;

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [fen]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [] as string[];
    return legalTargetSquares(fen, selectedSquare);
  }, [fen, selectedSquare]);

  const checkSquare = useMemo(() => {
    if (gameState.status !== "playing") return null;
    return kingSquareInCheck(fen);
  }, [fen, gameState.status]);

  const { wTakes, bTakes } = useMemo(
    () => capturedMaterialFromHistory(gameState.history),
    [gameState.history]
  );

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    const lm = gameState.lastMove;
    if (lm) {
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
  }, [gameState.lastMove, selectedSquare, legalTargets, checkSquare]);

  function sendMove(from: string, to: string, promotion?: ChessPromotion) {
    const intent: ChessIntent = {
      type: "move",
      from,
      to,
      ...(promotion ? { promotion } : {})
    };
    onIntent(intent);
  }

  function tryMove(from: string, to: string) {
    if (moveNeedsPromotion(fen, from, to)) {
      setPendingPromotion({ from, to });
      return;
    }
    sendMove(from, to);
  }

  return (
    <div className="space-y-3 rounded-3xl border border-indigo-100 bg-white/95 p-3 shadow-play">
      <p className="text-sm font-medium text-slate-700">
        {gameState.status === "playing"
          ? gameState.next === "w"
            ? "תור לבן"
            : "תור שחור"
          : gameState.status === "won"
            ? gameState.winner === "w"
              ? "לבן ניצח"
              : "שחור ניצח"
            : "תיקו"}
      </p>

      {/* LTR: keeps files a..h and capture trays matching the board; avoids RTL mirroring the grid */}
      <div dir="ltr" className="space-y-3">
        {inActiveGame && drawOfferFrom === mySeat && (
          <p className="text-end text-sm font-medium text-amber-800" dir="rtl">
            הצעת תיקו ממתינה לתגובה
          </p>
        )}

        {inActiveGame && drawOfferFrom && drawOfferFrom !== mySeat && (
          <p className="text-end text-sm font-medium text-amber-800" dir="rtl">
            היריב הציע תיקו
          </p>
        )}

        <div className="flex min-h-[2.75rem] flex-col justify-center">
          {pendingPromotion && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-600" dir="rtl">
                הפיכה — בחר כלי:
              </span>
              {PROMOTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 shadow-sm hover:bg-indigo-100"
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
                className="text-sm font-medium text-slate-500 underline"
                dir="rtl"
                onClick={() => setPendingPromotion(null)}
              >
                ביטול
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
          {/* bTakes: Black captured (White’s material) — must show as white-skin men */}
          <div className="order-1 flex min-h-[2rem] flex-1 flex-wrap content-start items-center gap-0.5 sm:max-w-[3.5rem]">
            {sortCaptureTypes(bTakes).map((p, i) => {
              const id = pieceIdForCaptureType(p, "w");
              return id ? (
                <CburnettChessPiece key={`by-black-${i}-${p}`} piece={id} size={22} />
              ) : null;
            })}
          </div>

          <div className="order-2 min-w-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 shadow-play">
            <Chessboard
              position={fen}
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
                if (!canPlay || !mySeat) return false;
                if (!isPlayersPiece(fen, from, mySeat)) return false;
                if (!legalTargetSquares(fen, from).includes(to)) return false;
                if (moveNeedsPromotion(fen, from, to)) {
                  setPendingPromotion({ from, to });
                  return false;
                }
                sendMove(from, to);
                return true;
              }}
              onSquareClick={(square) => {
                if (pendingPromotion || !canPlay || !mySeat) {
                  if (!canPlay) setSelectedSquare(null);
                  return;
                }

                if (!selectedSquare) {
                  if (isPlayersPiece(fen, square, mySeat)) {
                    setSelectedSquare(square);
                  }
                  return;
                }

                if (square === selectedSquare) {
                  setSelectedSquare(null);
                  return;
                }

                if (isPlayersPiece(fen, square, mySeat)) {
                  setSelectedSquare(square);
                  return;
                }

                if (!legalTargetSquares(fen, selectedSquare).includes(square)) {
                  setSelectedSquare(null);
                  return;
                }

                const from = selectedSquare;
                setSelectedSquare(null);
                tryMove(from, square);
              }}
            />
          </div>

          {/* wTakes: White captured (Black’s material) — must show as black-skin men */}
          <div className="order-3 flex min-h-[2rem] flex-1 flex-wrap content-start items-end justify-end gap-0.5 sm:max-w-[3.5rem] sm:justify-start">
            {sortCaptureTypes(wTakes).map((p, i) => {
              const id = pieceIdForCaptureType(p, "b");
              return id ? (
                <CburnettChessPiece key={`by-white-${i}-${p}`} piece={id} size={22} />
              ) : null;
            })}
          </div>
        </div>
        {inActiveGame && (
          <div className="flex flex-wrap gap-2" dir="rtl">
            {drawOfferFrom && drawOfferFrom !== mySeat ? (
              <>
                <button
                  type="button"
                  className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
                  onClick={() => onIntent({ type: "accept_draw" })}
                >
                  קבל תיקו
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => onIntent({ type: "decline_draw" })}
                >
                  דחה
                </button>
              </>
            ) : null}
            {canPlay && (!drawOfferFrom || drawOfferFrom === mySeat) && (
              <button
                type="button"
                disabled={!!(drawOfferFrom && drawOfferFrom === mySeat)}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onIntent({ type: "offer_draw" })}
              >
                {drawOfferFrom === mySeat ? "הצעה נשלחה" : "הצע תיקו"}
              </button>
            )}
            <button
              type="button"
              className="rounded bg-rose-800/80 px-3 py-1.5 text-sm text-white hover:bg-rose-700"
              onClick={() => onIntent({ type: "resign" })}
            >
              הכנע
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
