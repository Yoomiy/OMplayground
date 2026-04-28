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
    <div className="mx-auto w-full max-w-md space-y-3">
      <div className="grid grid-cols-7 gap-2">
        {COLUMNS.map((column) => (
          <button
            key={column}
            type="button"
            disabled={!canPlay || gameState.board[0][column] !== null}
            className="rounded-xl bg-indigo-600 px-2 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onIntent({ column })}
          >
            {column + 1}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-3 shadow-play">
        {gameState.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="flex aspect-square w-full items-center justify-center rounded-full bg-white/90 shadow-inner ring-1 ring-indigo-100"
            >
              <span
                className={
                  cell === "R"
                    ? "h-4/5 w-4/5 rounded-full bg-rose-500 shadow-sm"
                    : cell === "Y"
                      ? "h-4/5 w-4/5 rounded-full bg-amber-400 shadow-sm"
                      : "h-4/5 w-4/5 rounded-full bg-slate-100"
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
