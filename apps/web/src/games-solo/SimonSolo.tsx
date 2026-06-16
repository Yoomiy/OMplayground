import { useCallback, useEffect, useReducer, useRef } from "react";
import { useSoloAutoSave } from "@/hooks/useSoloAutoSave";
import {
  isJsonObject,
  type JsonValue,
  type SoloGameSaveControls
} from "@/lib/soloGameSaves";

const COLORS = [
  { key: 0, bg: "bg-rose-500/25 border-rose-500/30 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.1)]", litBg: "bg-rose-500 border-rose-400/60 text-white shadow-[0_0_20px_rgba(244,63,94,0.6)] scale-105" },
  { key: 1, bg: "bg-blue-500/25 border-blue-500/30 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.1)]", litBg: "bg-blue-500 border-blue-400/60 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-105" },
  { key: 2, bg: "bg-amber-500/25 border-amber-500/30 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.1)]", litBg: "bg-amber-400 border-amber-300/60 text-white shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-105" },
  { key: 3, bg: "bg-emerald-500/25 border-emerald-500/30 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.1)]", litBg: "bg-emerald-500 border-emerald-400/60 text-white shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-105" }
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

function initialState(saved?: JsonValue | null): SimonLocalState {
  if (
    isJsonObject(saved) &&
    Array.isArray(saved.sequence) &&
    saved.sequence.every((n) => typeof n === "number" && n >= 0 && n <= 3) &&
    typeof saved.inputIndex === "number" &&
    typeof saved.showingIndex === "number" &&
    (typeof saved.lit === "number" || saved.lit === null) &&
    typeof saved.score === "number" &&
    (saved.phase === "idle" ||
      saved.phase === "showing" ||
      saved.phase === "input")
  ) {
    const sequence = saved.sequence as number[];
    const base: SimonLocalState = {
      sequence,
      inputIndex: saved.inputIndex,
      showingIndex: saved.showingIndex,
      lit: saved.lit as number | null,
      phase: saved.phase as Phase,
      score: saved.score
    };
    // Resume mid-round: replay the full pattern before continuing input at saved progress.
    if (
      sequence.length > 0 &&
      (base.phase === "input" || base.phase === "showing")
    ) {
      return {
        ...base,
        phase: "showing",
        showingIndex: 0,
        lit: null
      };
    }
    return base;
  }
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
      // Keep inputIndex (START_ROUND sets 0; resume replay preserves saved progress).
      return { ...state, lit: null, phase: "input" };
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

export function SimonSolo({ save }: { save: SoloGameSaveControls }) {
  const [state, dispatch] = useReducer(
    reducer,
    save.savedState,
    initialState
  );
  useSoloAutoSave(
    save,
    state as unknown as JsonValue,
    state.phase !== "gameover"
  );

  useEffect(() => {
    if (state.phase === "gameover") void save.clearSave();
  }, [save, state.phase]);

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
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex w-full items-center justify-between text-sm font-semibold text-white/80">
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
      <div className="grid grid-cols-2 gap-4">
        {COLORS.map((c) => {
          const isLit = effectiveLit === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-label={`צבע ${c.key}`}
              disabled={state.phase !== "input"}
              className={`h-28 w-28 rounded-3xl border-2 transition-all duration-200 hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed ${
                isLit ? c.litBg : `${c.bg} disabled:opacity-40`
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
        <button
          type="button"
          onClick={() => {
            void save.clearSave();
            dispatch({ type: "RESET" });
          }}
          className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 border border-violet-400/50 px-6 py-2.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.6)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
        >
          שחק שוב
        </button>
      ) : null}
    </div>
  );
}

