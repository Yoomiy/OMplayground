import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Balloon {
  id: number;
  x: number;
  y: number;
  speed: number;
  hue: number;
}

interface BalloonLocalState {
  balloons: Balloon[];
  score: number;
  lives: number;
  status: "playing" | "gameover";
  nextId: number;
}

const START_LIVES = 3;
const SPAWN_MIN_MS = 650;
const SPAWN_MAX_MS = 1400;
const BASE_SPEED = 0.06;
const MAX_SPEED = 0.22;

function initialState(): BalloonLocalState {
  return {
    balloons: [],
    score: 0,
    lives: START_LIVES,
    status: "playing",
    nextId: 1
  };
}

export function BalloonPopSolo() {
  const stateRef = useRef<BalloonLocalState>(initialState());
  const [, forceUpdate] = useState(0);

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextSpawnAtRef = useRef<number>(Date.now() + 400);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

    const step = useCallback(
      (now: number) => {
        const s = stateRef.current;
        if (s.status !== "playing") return;

        const prev = lastFrameRef.current ?? now;
        const dt = Math.min(50, now - prev);
        lastFrameRef.current = now;

        let escapedCount = 0;
        const moved = s.balloons.map((b) => {
          const newY = b.y - b.speed * dt;
          if (newY + 28 <= 0) escapedCount++;
          return { ...b, y: newY };
        });

        const inField = moved.filter((b) => b.y + 28 > 0);
        let balloons = inField;
        if (Date.now() >= nextSpawnAtRef.current) {
          const hue = Math.floor(Math.random() * 360);
          balloons = [
            ...balloons,
            {
              id: s.nextId,
              x: 20 + Math.random() * Math.max(1, size.w - 60),
              y: size.h - 20,
              speed: Math.min(MAX_SPEED, BASE_SPEED + s.score * 0.003),
              hue
            }
          ];
          stateRef.current.nextId += 1;
          const delay =
            SPAWN_MAX_MS -
            Math.min(SPAWN_MAX_MS - SPAWN_MIN_MS, s.score * 30);
          nextSpawnAtRef.current = Date.now() + delay;
        }
        stateRef.current.balloons = balloons;

        if (escapedCount > 0) {
          stateRef.current.lives = Math.max(0, s.lives - escapedCount);
        }

        if (stateRef.current.lives <= 0) {
          stateRef.current.status = "gameover";
        }
        forceUpdate(c => c + 1);
        rafRef.current = window.requestAnimationFrame(step);
      },
      [size.w, size.h]
    );

    // rAF game loop — local only, no server roundtrip per frame.
    useEffect(() => {
      if (stateRef.current.status !== "playing") return undefined;
      if (size.w === 0 || size.h === 0) return undefined;
      rafRef.current = window.requestAnimationFrame(step);
      return () => {
        if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
        lastFrameRef.current = null;
      };
    }, [stateRef.current.status, size.w, size.h, step]);

    const pop = useCallback((id: number) => {
      const s = stateRef.current;
      if (s.status !== "playing") return;
      if (!s.balloons.some((b) => b.id === id)) return;
      stateRef.current.balloons = s.balloons.filter((b) => b.id !== id);
      stateRef.current.score = s.score + 1;
      forceUpdate(c => c + 1);
    }, []);

    const reset = () => {
      nextSpawnAtRef.current = Date.now() + 400;
      lastFrameRef.current = null;
      stateRef.current = initialState();
      forceUpdate(c => c + 1);
    };

    const state = stateRef.current;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-3xl border border-sky-100 bg-white/95 p-3 shadow-play">
      <div className="flex w-full items-center justify-between text-sm font-medium text-slate-700">
        <span>ניקוד: {state.score}</span>
        <span>חיים: {"❤️".repeat(Math.max(0, state.lives))}</span>
      </div>
      <div
        ref={fieldRef}
        className="relative h-[70vh] w-full overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-b from-sky-100 via-cyan-50 to-emerald-50 shadow-inner"
      >
        {state.balloons.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-label="בלון"
            disabled={state.status !== "playing"}
            className="absolute flex h-14 w-12 items-center justify-center rounded-full text-3xl shadow-lg"
            style={{
              left: b.x,
              top: b.y,
              backgroundColor: `hsl(${b.hue}, 80%, 60%)`,
              transform: "translate(-50%, -50%)"
            }}
            onClick={() => pop(b.id)}
          >
            🎈
          </button>
        ))}
        {state.status === "gameover" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-play">
              <p className="text-lg font-bold text-slate-900">
                המשחק הסתיים · {state.score} נק'
              </p>
              <Button type="button" onClick={reset}>
                שחק שוב
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
