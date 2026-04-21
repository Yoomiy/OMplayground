import { useEffect, useState } from "react";
import type { MemoryState } from "@playground/game-logic";

export interface MemoryBoardProps {
  gameState: MemoryState;
  myUserId: string | null;
  onIntent: (intent: { cardIndex: number }) => void;
}

export function MemoryBoard({ gameState, myUserId, onIntent }: MemoryBoardProps) {
  const [visuallyRevealed, setVisuallyRevealed] = useState<number[]>([]);

  useEffect(() => {
    // When the server sends down revealed cards, we'll show them.
    setVisuallyRevealed(gameState.revealed);
    // If it's a pair (i.e. a mismatch), set a timer to hide them again
    // purely on the client-side for visual effect.
    if (gameState.revealed.length === 2) {
      const timer = setTimeout(() => {
        setVisuallyRevealed([]);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [gameState.revealed]);


  const isMyTurn =
    gameState.status === "playing" &&
    myUserId !== null &&
    gameState.nextPlayerId === myUserId;

  const scoreEntries = Object.entries(gameState.scores ?? {});
  const meScore = myUserId ? (gameState.scores?.[myUserId] ?? 0) : 0;
  const opponentScore =
    scoreEntries.find(([id]) => id !== myUserId)?.[1] ?? 0;

  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">
          אני: <strong className="text-slate-100">{meScore}</strong>
        </span>
        <span className="text-slate-300">
          יריב: <strong className="text-slate-100">{opponentScore}</strong>
        </span>
        <span
          className={
            isMyTurn
              ? "text-emerald-300"
              : gameState.status !== "playing"
                ? "text-slate-500"
                : "text-amber-300"
          }
        >
          {gameState.status === "playing"
            ? isMyTurn
              ? "תורך"
              : "תור היריב"
            : "המשחק הסתיים"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {gameState.cards.map((card, index) => {
          const matched = gameState.matched.includes(index);
          const revealed = visuallyRevealed.includes(index);
          const shown = matched || revealed;
          // Disable all cards if a mismatch is being shown.
          const disabled = !isMyTurn || shown || visuallyRevealed.length === 2;
          return (
            <button
              key={card.id}
              type="button"
              disabled={disabled}
              aria-label={shown ? `קלף ${card.emoji}` : "קלף הפוך"}
              className={
                shown
                  ? "flex aspect-square items-center justify-center rounded-lg border border-emerald-700 bg-emerald-950/40 text-3xl"
                  : "flex aspect-square items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-2xl text-slate-500 hover:bg-slate-800 disabled:opacity-40"
              }
              onClick={() => onIntent({ cardIndex: index })}
            >
              {shown ? card.emoji : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
