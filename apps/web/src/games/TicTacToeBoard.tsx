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
    <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-3 rounded-3xl border border-indigo-100 bg-white/95 p-3 shadow-play">
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
          className="flex aspect-square items-center justify-center rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50 text-4xl font-black text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:from-indigo-50 hover:to-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onCellPress(i)}
        >
          {cell ?? ""}
        </button>
      ))}
    </div>
  );
}
