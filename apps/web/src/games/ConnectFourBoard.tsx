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
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2">
        {COLUMNS.map((column) => (
          <button
            key={column}
            type="button"
            disabled={!canPlay || gameState.board[0][column] !== null}
            className="rounded bg-indigo-700 px-2 py-1 text-sm text-white hover:bg-indigo-600 disabled:opacity-40"
            onClick={() => onIntent({ column })}
          >
            {column + 1}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 rounded-lg bg-slate-900 p-2">
        {gameState.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="flex h-12 w-12 items-center justify-center rounded bg-slate-800"
            >
              <span
                className={
                  cell === "R"
                    ? "h-9 w-9 rounded-full bg-rose-500"
                    : cell === "Y"
                      ? "h-9 w-9 rounded-full bg-amber-400"
                      : "h-9 w-9 rounded-full bg-slate-700"
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
