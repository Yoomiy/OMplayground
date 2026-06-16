import type { ConnectFourState } from "@playground/game-logic";

export interface ConnectFourBoardProps {
  gameState: ConnectFourState;
  mySeat: "R" | "Y" | null;
  onIntent: (intent: { column: number }) => void;
}

const COLUMNS = [0, 1, 2, 3, 4, 5, 6];

export function ConnectFourBoard({
  gameState,
  mySeat,
  onIntent
}: ConnectFourBoardProps) {
  const canPlay =
    gameState.status === "playing" && mySeat !== null && gameState.next === mySeat;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {COLUMNS.map((column) => (
          <button
            key={column}
            type="button"
            disabled={!canPlay || gameState.board[0][column] !== null}
            className="rounded-xl bg-gradient-to-b from-violet-500 to-indigo-600 border border-violet-400/30 px-2 py-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition hover:from-violet-400 hover:to-indigo-500 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:shadow-none disabled:from-violet-500/20 disabled:to-indigo-600/20 disabled:border-white/5"
            onClick={() => onIntent({ column })}
          >
            {column + 1}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {gameState.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="flex aspect-square w-full items-center justify-center rounded-full bg-black/40 shadow-inner ring-1 ring-white/10"
            >
              <span
                className={
                  cell === "R"
                    ? "h-4/5 w-4/5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                    : cell === "Y"
                      ? "h-4/5 w-4/5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                      : "h-4/5 w-4/5 rounded-full bg-white/5"
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

