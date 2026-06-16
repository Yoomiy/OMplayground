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
    <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between text-sm font-medium text-white/70">
        <span>
          אני: <strong className="text-white font-bold">{meScore}</strong>
        </span>
        <span>
          יריב: <strong className="text-white font-bold">{opponentScore}</strong>
        </span>
        <span
          className={
            isMyTurn
              ? "text-emerald-400 font-bold"
              : gameState.status !== "playing"
                ? "text-white/40"
                : "text-amber-400 font-bold"
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
                  ? "flex aspect-square items-center justify-center rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 text-3xl shadow-[0_0_12px_rgba(16,185,129,0.2)] text-white"
                  : "flex aspect-square items-center justify-center rounded-2xl border-2 border-white/10 bg-white/5 text-2xl font-black text-violet-400/80 shadow-sm transition hover:border-violet-500/50 hover:bg-white/10 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-30"
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

