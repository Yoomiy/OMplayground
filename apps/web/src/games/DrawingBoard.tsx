import { useCallback, useRef, useState } from "react";
import type {
  DrawingPoint,
  DrawingState,
  DrawingStroke
} from "@playground/game-logic";

const PALETTE = ["#0f172a", "#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa"];
const WIDTHS = [2, 4, 8];

export interface DrawingBoardProps {
  gameState: DrawingState;
  /** If seat label is "p1" (server-side host), extra controls (Clear) are shown. */
  mySeat: string | null;
  onIntent: (
    intent:
      | { type: "ADD_STROKE"; stroke: DrawingStroke }
      | { type: "CLEAR" }
  ) => void;
}

/**
 * Dumb drawing surface. Captures one stroke at a time via pointer events;
 * on pointerup, emits ADD_STROKE with the sampled points. Renders the server
 * authoritative `drawings` array as SVG paths so every player sees the same
 * board regardless of who drew.
 */
export function DrawingBoard({ gameState, mySeat, onIntent }: DrawingBoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [width, setWidth] = useState<number>(WIDTHS[1]);
  const [live, setLive] = useState<DrawingPoint[] | null>(null);

  const toLocal = useCallback(
    (ev: React.PointerEvent<SVGSVGElement>): DrawingPoint => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    },
    []
  );

  const handleDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setLive([toLocal(ev)]);
  };
  const handleMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!live) return;
    const p = toLocal(ev);
    setLive((prev) => {
      if (!prev) return prev;
      const last = prev[prev.length - 1];
      // Skip near-duplicate samples to keep payload small.
      if (Math.abs(last.x - p.x) < 1 && Math.abs(last.y - p.y) < 1) return prev;
      if (prev.length >= 800) return prev;
      return [...prev, p];
    });
  };
  const handleUp = () => {
    if (live && live.length >= 2) {
      onIntent({
        type: "ADD_STROKE",
        stroke: { color, width, points: live }
      });
    }
    setLive(null);
  };

  const isHost = mySeat === "p1";

  return (
    <div className="mx-auto max-w-2xl space-y-3 rounded-3xl border border-indigo-100 bg-white/95 p-3 shadow-play">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="radiogroup" aria-label="צבע">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`צבע ${c}`}
              className={
                color === c
                  ? "h-7 w-7 rounded-full border-2 border-indigo-500 shadow-sm"
                  : "h-7 w-7 rounded-full border border-slate-300 shadow-sm"
              }
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="flex gap-1" role="radiogroup" aria-label="עובי">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={width === w}
              aria-label={`עובי ${w}`}
              className={
                width === w
                  ? "h-7 rounded-xl border border-indigo-300 bg-indigo-50 px-3 text-xs font-bold text-indigo-900"
                  : "h-7 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600"
              }
              onClick={() => setWidth(w)}
            >
              {w}
            </button>
          ))}
        </div>
        {isHost ? (
          <button
            type="button"
            className="ml-auto rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
            onClick={() => {
              if (window.confirm("לנקות את הציור עבור כולם?")) {
                onIntent({ type: "CLEAR" });
              }
            }}
          >
            נקה הכל
          </button>
        ) : null}
      </div>
      <svg
        ref={svgRef}
        className="h-80 w-full touch-none rounded-2xl border border-slate-200 bg-white shadow-inner"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        {gameState.drawings.map((stroke, i) => (
          <polyline
            key={i}
            points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {live ? (
          <polyline
            points={live.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </svg>
      <p className="text-xs font-medium text-slate-500">
        קווים שמורים: {gameState.drawings.length}
      </p>
    </div>
  );
}
