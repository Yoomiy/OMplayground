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
    <div className="mx-auto max-w-md space-y-3 rounded-3xl border border-indigo-100 bg-white/95 p-3 shadow-play">
      <div className="flex items-center justify-between text-sm font-medium">
        <span className="text-slate-600">
          אני: <strong className="text-slate-900">{meScore}</strong>
        </span>
        <span className="text-slate-600">
          יריב: <strong className="text-slate-900">{opponentScore}</strong>
        </span>
        <span
          className={
            isMyTurn
              ? "text-emerald-700"
              : gameState.status !== "playing"
                ? "text-slate-500"
                : "text-amber-700"
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
                  ? "flex aspect-square items-center justify-center rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-3xl shadow-sm"
                  : "flex aspect-square items-center justify-center rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 text-2xl font-black text-indigo-400 shadow-sm transition hover:border-indigo-300 hover:from-indigo-100 hover:to-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
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
