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
    <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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
          className={`flex aspect-square items-center justify-center rounded-2xl border text-4xl font-black transition shadow-sm
            ${cell === null
              ? "border-white/10 bg-white/5 text-white hover:border-violet-500/50 hover:bg-white/10 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              : cell === "X"
                ? "bg-violet-500/10 border-violet-500/30 text-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.2)]"
                : "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,0.2)]"
            }`}
          onClick={() => onCellPress(i)}
        >
          {cell ?? ""}
        </button>
      ))}
    </div>
  );
}

