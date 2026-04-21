import { useCallback, useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";

const COLORS = [
  { key: 0, bg: "bg-red-500", litBg: "bg-red-300" },
  { key: 1, bg: "bg-blue-500", litBg: "bg-blue-300" },
  { key: 2, bg: "bg-yellow-400", litBg: "bg-yellow-200" },
  { key: 3, bg: "bg-emerald-500", litBg: "bg-emerald-300" }
] as const;

const SHOW_ON_MS = 500;
const SHOW_OFF_MS = 220;

type Phase = "idle" | "showing" | "input" | "gameover";

interface SimonLocalState {
  sequence: number[];
  inputIndex: number;
  showingIndex: number;
  lit: number | null;
  phase: Phase;
  score: number;
}

type Action =
  | { type: "START_ROUND" }
  | { type: "SHOW_STEP"; lit: number | null; nextIndex: number }
  | { type: "BEGIN_INPUT" }
  | { type: "PRESS"; color: number }
  | { type: "RESET" };

function randomColor(): number {
  return Math.floor(Math.random() * 4);
}

function initialState(): SimonLocalState {
  return {
    sequence: [],
    inputIndex: 0,
    showingIndex: 0,
    lit: null,
    phase: "idle",
    score: 0
  };
}

function reducer(state: SimonLocalState, action: Action): SimonLocalState {
  switch (action.type) {
    case "RESET":
      return initialState();
    case "START_ROUND":
      return {
        ...state,
        sequence: [...state.sequence, randomColor()],
        inputIndex: 0,
        showingIndex: 0,
        lit: null,
        phase: "showing"
      };
    case "SHOW_STEP":
      return { ...state, lit: action.lit, showingIndex: action.nextIndex };
    case "BEGIN_INPUT":
      return { ...state, lit: null, phase: "input", inputIndex: 0 };
    case "PRESS": {
      if (state.phase !== "input") return state;
      const expected = state.sequence[state.inputIndex];
      if (action.color !== expected) {
        return { ...state, phase: "gameover", lit: null };
      }
      const nextIndex = state.inputIndex + 1;
      if (nextIndex >= state.sequence.length) {
        return {
          ...state,
          inputIndex: 0,
          score: state.score + 1,
          phase: "idle",
          lit: null
        };
      }
      return { ...state, inputIndex: nextIndex };
    }
    default:
      return state;
  }
}

export function SimonSolo() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Auto-start the first round.
  useEffect(() => {
    if (state.phase === "idle") {
      const id = window.setTimeout(() => dispatch({ type: "START_ROUND" }), 600);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "showing") return undefined;
    if (state.showingIndex >= state.sequence.length) {
      const t = window.setTimeout(() => dispatch({ type: "BEGIN_INPUT" }), 300);
      return () => window.clearTimeout(t);
    }
    const color = state.sequence[state.showingIndex];
    dispatch({ type: "SHOW_STEP", lit: color, nextIndex: state.showingIndex });
    const offTimer = window.setTimeout(() => {
      dispatch({
        type: "SHOW_STEP",
        lit: null,
        nextIndex: state.showingIndex
      });
    }, SHOW_ON_MS);
    const advanceTimer = window.setTimeout(() => {
      dispatch({
        type: "SHOW_STEP",
        lit: null,
        nextIndex: state.showingIndex + 1
      });
    }, SHOW_ON_MS + SHOW_OFF_MS);
    return () => {
      window.clearTimeout(offTimer);
      window.clearTimeout(advanceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.showingIndex]);

  const handlePress = useCallback(
    (color: number) => dispatch({ type: "PRESS", color }),
    []
  );

  // Brief flash when the user presses a pad during input.
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const litRef = useRef<{ color: number | null; until: number }>({
    color: null,
    until: 0
  });
  const flashOnPress = (color: number) => {
    litRef.current = { color, until: Date.now() + 180 };
    forceRender();
    window.setTimeout(() => forceRender(), 200);
  };

  const effectiveLit =
    state.phase === "showing"
      ? state.lit
      : litRef.current.until > Date.now()
        ? litRef.current.color
        : null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm text-slate-300">
        <span>ניקוד: {state.score}</span>
        <span>
          אורך רצף: {state.sequence.length}
          {state.phase === "showing"
            ? " · מציג…"
            : state.phase === "input"
              ? " · תורך"
              : state.phase === "gameover"
                ? " · נגמר"
                : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {COLORS.map((c) => {
          const isLit = effectiveLit === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-label={`צבע ${c.key}`}
              disabled={state.phase !== "input"}
              className={`h-28 w-28 rounded-xl border-2 border-slate-800 transition-colors disabled:opacity-70 ${
                isLit ? c.litBg : c.bg
              }`}
              onClick={() => {
                flashOnPress(c.key);
                handlePress(c.key);
              }}
            />
          );
        })}
      </div>
      {state.phase === "gameover" ? (
        <Button type="button" onClick={() => dispatch({ type: "RESET" })}>
          שחק שוב
        </Button>
      ) : null}
    </div>
  );
}
