import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const ROUND_MS = 30_000;
const MOLE_REROLL_MS = 800;

interface MoleState {
  activeCell: number;
  score: number;
  timeLeftMs: number;
  status: "playing" | "done";
}

function randomCell(exclude: number): number {
  let n = Math.floor(Math.random() * 9);
  if (n === exclude) n = (n + 1) % 9;
  return n;
}

export function WhackAMoleSolo() {
  const [state, setState] = useState<MoleState>({
    activeCell: Math.floor(Math.random() * 9),
    score: 0,
    timeLeftMs: ROUND_MS,
    status: "playing"
  });
  const startedAtRef = useRef<number>(Date.now());

  // Time-left tick: compute from absolute start time to avoid drift.
  useEffect(() => {
    if (state.status !== "playing") return undefined;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const left = Math.max(0, ROUND_MS - elapsed);
      setState((s) =>
        s.status === "playing"
          ? { ...s, timeLeftMs: left, status: left <= 0 ? "done" : "playing" }
          : s
      );
    }, 200);
    return () => window.clearInterval(id);
  }, [state.status]);

  // Mole re-roll: only while playing.
  useEffect(() => {
    if (state.status !== "playing") return undefined;
    const id = window.setInterval(() => {
      setState((s) =>
        s.status === "playing"
          ? { ...s, activeCell: randomCell(s.activeCell) }
          : s
      );
    }, MOLE_REROLL_MS);
    return () => window.clearInterval(id);
  }, [state.status]);

  const whack = (cell: number) => {
    if (state.status !== "playing") return;
    if (cell !== state.activeCell) return;
    setState((s) => ({
      ...s,
      score: s.score + 1,
      activeCell: randomCell(cell)
    }));
  };

  const reset = () => {
    startedAtRef.current = Date.now();
    setState({
      activeCell: Math.floor(Math.random() * 9),
      score: 0,
      timeLeftMs: ROUND_MS,
      status: "playing"
    });
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-amber-100 bg-white/95 p-4 shadow-play">
      <div className="flex w-full items-center justify-between text-sm font-medium text-slate-700">
        <span>ניקוד: {state.score}</span>
        <span>זמן: {(state.timeLeftMs / 1000).toFixed(1)}s</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }, (_, i) => {
          const isActive = state.activeCell === i && state.status === "playing";
          return (
            <button
              key={i}
              type="button"
              aria-label={`תא ${i}${isActive ? " — חפרפרת" : ""}`}
              disabled={state.status !== "playing"}
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-100 to-orange-100 text-3xl shadow-inner hover:from-amber-200 hover:to-orange-200 disabled:opacity-50"
              onClick={() => whack(i)}
            >
              {isActive ? "🐹" : ""}
            </button>
          );
        })}
      </div>
      {state.status === "done" ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-lg font-bold text-slate-900">
            המשחק הסתיים · {state.score} נק'
          </p>
          <Button type="button" onClick={reset}>
            שחק שוב
          </Button>
        </div>
      ) : null}
    </div>
  );
}
