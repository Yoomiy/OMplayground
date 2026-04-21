import { useCallback, useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";

const GRID = 20;
const TICK_MS = 160;

interface Point {
  x: number;
  y: number;
}

interface SnakeLocalState {
  snake: Point[];
  food: Point;
  direction: Point;
  pendingDirection: Point | null;
  score: number;
  status: "playing" | "gameover";
}

type Action =
  | { type: "TICK" }
  | { type: "SET_DIRECTION"; direction: Point }
  | { type: "RESET" };

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const candidates: Point[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!occupied.has(`${x},${y}`)) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return { x: 0, y: 0 };
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function initialState(): SnakeLocalState {
  const snake = [{ x: 10, y: 10 }];
  return {
    snake,
    food: randomFood(snake),
    direction: { x: 1, y: 0 },
    pendingDirection: null,
    score: 0,
    status: "playing"
  };
}

function isReverse(a: Point, b: Point) {
  return a.x + b.x === 0 && a.y + b.y === 0;
}

function reducer(state: SnakeLocalState, action: Action): SnakeLocalState {
  switch (action.type) {
    case "RESET":
      return initialState();
    case "SET_DIRECTION": {
      if (state.status !== "playing") return state;
      const d = action.direction;
      if (Math.abs(d.x) + Math.abs(d.y) !== 1) return state;
      if (isReverse(state.direction, d)) return state;
      return { ...state, pendingDirection: d };
    }
    case "TICK": {
      if (state.status !== "playing") return state;
      const direction = state.pendingDirection ?? state.direction;
      const head = state.snake[0];
      const next = { x: head.x + direction.x, y: head.y + direction.y };
      const outside =
        next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID;
      const bodyHit = state.snake.some((s) => samePoint(s, next));
      if (outside || bodyHit) {
        return { ...state, direction, pendingDirection: null, status: "gameover" };
      }
      const ate = samePoint(next, state.food);
      const moved = [next, ...state.snake];
      if (!ate) moved.pop();
      return {
        ...state,
        snake: moved,
        food: ate ? randomFood(moved) : state.food,
        direction,
        pendingDirection: null,
        score: ate ? state.score + 1 : state.score
      };
    }
    default:
      return state;
  }
}

export function SnakeSolo() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const statusRef = useRef(state.status);
  statusRef.current = state.status;

  useEffect(() => {
    const id = window.setInterval(() => {
      if (statusRef.current === "playing") dispatch({ type: "TICK" });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const setDir = useCallback((dx: number, dy: number) => {
    dispatch({ type: "SET_DIRECTION", direction: { x: dx, y: dy } });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          setDir(0, -1);
          break;
        case "ArrowDown":
          setDir(0, 1);
          break;
        case "ArrowLeft":
          setDir(-1, 0);
          break;
        case "ArrowRight":
          setDir(1, 0);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setDir]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4" dir="ltr">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-slate-300">ניקוד: {state.score}</span>
        {state.status === "gameover" ? (
          <span className="text-rose-300">המשחק הסתיים</span>
        ) : null}
      </div>
      <div
        className="grid gap-px rounded bg-slate-700 p-1"
        style={{
          gridTemplateColumns: `repeat(${GRID}, 1rem)`,
          gridTemplateRows: `repeat(${GRID}, 1rem)`
        }}
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID;
          const y = Math.floor(i / GRID);
          const isHead = state.snake[0]?.x === x && state.snake[0]?.y === y;
          const isBody =
            !isHead && state.snake.some((s) => s.x === x && s.y === y);
          const isFood = state.food.x === x && state.food.y === y;
          return (
            <div
              key={i}
              className={
                isHead
                  ? "h-4 w-4 rounded-sm bg-emerald-300"
                  : isBody
                    ? "h-4 w-4 rounded-sm bg-emerald-600"
                    : isFood
                      ? "h-4 w-4 rounded-sm bg-rose-500"
                      : "h-4 w-4 bg-slate-900"
              }
            />
          );
        })}
      </div>
      <div className="grid w-40 grid-cols-3 grid-rows-2 gap-2">
        <button
          type="button"
          aria-label="למעלה"
          className="col-start-2 rounded border border-slate-600 bg-slate-800 py-2 text-slate-200"
          onClick={() => setDir(0, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="שמאלה"
          className="col-start-1 row-start-2 rounded border border-slate-600 bg-slate-800 py-2 text-slate-200"
          onClick={() => setDir(-1, 0)}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="למטה"
          className="col-start-2 row-start-2 rounded border border-slate-600 bg-slate-800 py-2 text-slate-200"
          onClick={() => setDir(0, 1)}
        >
          ↓
        </button>
        <button
          type="button"
          aria-label="ימינה"
          className="col-start-3 row-start-2 rounded border border-slate-600 bg-slate-800 py-2 text-slate-200"
          onClick={() => setDir(1, 0)}
        >
          →
        </button>
      </div>
      {state.status === "gameover" ? (
        <Button type="button" onClick={() => dispatch({ type: "RESET" })}>
          שחק שוב
        </Button>
      ) : null}
    </div>
  );
}
