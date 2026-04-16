import type { TicTacToeState } from "@playground/game-logic";

export interface TicTacToeBoardProps {
  gameState: TicTacToeState;
  mySymbol: "X" | "O" | null;
  onCellPress: (index: number) => void;
}

export function TicTacToeBoard({
  gameState,
  mySymbol,
  onCellPress
}: TicTacToeBoardProps) {
  return (
    <div className="grid max-w-sm grid-cols-3 gap-2">
      {gameState.board.map((cell, i) => (
        <button
          key={i}
          type="button"
          disabled={
            cell !== null ||
            gameState.status !== "playing" ||
            mySymbol === null ||
            gameState.next !== mySymbol
          }
          className="flex h-24 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-3xl font-bold text-slate-100 hover:bg-slate-800 disabled:opacity-40"
          onClick={() => onCellPress(i)}
        >
          {cell ?? ""}
        </button>
      ))}
    </div>
  );
}
