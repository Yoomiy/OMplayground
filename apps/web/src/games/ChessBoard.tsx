import { Chessboard } from "react-chessboard";
import type { ChessIntent, ChessState } from "@playground/game-logic";

export interface ChessBoardProps {
  gameState: ChessState;
  mySeat: "w" | "b" | null;
  onIntent: (intent: ChessIntent) => void;
}

function pieceAtSquare(fen: string, square: string): string | null {
  const board = fen.split(" ")[0];
  const rows = board.split("/");
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]);
  const rowIndex = 8 - rank;
  const row = rows[rowIndex];
  if (!row || file < 0 || file > 7 || rank < 1 || rank > 8) {
    return null;
  }

  let col = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) {
      col += Number(ch);
      continue;
    }
    if (col === file) return ch;
    col += 1;
  }
  return null;
}

function choosePromotion(
  fen: string,
  from: string,
  to: string
): "q" | "r" | "b" | "n" | undefined {
  const piece = pieceAtSquare(fen, from);
  if (piece !== "P" && piece !== "p") return undefined;
  const targetRank = Number(to[1]);
  if (targetRank !== 1 && targetRank !== 8) return undefined;
  const raw = window
    .prompt("Promotion piece (q/r/b/n)", "q")
    ?.trim()
    .toLowerCase();
  if (!raw) return "q";
  return raw === "q" || raw === "r" || raw === "b" || raw === "n" ? raw : "q";
}

export function ChessBoard({ gameState, mySeat, onIntent }: ChessBoardProps) {
  const canMove =
    gameState.status === "playing" && mySeat !== null && gameState.next === mySeat;
  const orientation: "white" | "black" = mySeat === "b" ? "black" : "white";

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
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
      <Chessboard
        position={gameState.fen}
        boardOrientation={orientation}
        arePiecesDraggable={canMove}
        onPieceDrop={(from: string, to: string) => {
          if (!canMove) return false;
          const promotion = choosePromotion(gameState.fen, from, to);
          onIntent({ from, to, promotion });
          return true;
        }}
      />
    </div>
  );
}
