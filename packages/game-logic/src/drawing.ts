import type { GameModule, GameSeat } from "./registry";

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  color: string;
  width: number;
  points: DrawingPoint[];
}

export interface DrawingState {
  drawings: DrawingStroke[];
  /** Never terminal. Status exists only to match the common `seats/status` pattern. */
  status: "playing";
  seats?: Record<string, string>;
}

export type DrawingIntent =
  | { type: "ADD_STROKE"; stroke: DrawingStroke }
  | { type: "CLEAR" };

export const MAX_STROKES = 500;
export const MAX_POINTS_PER_STROKE = 800;
export const MIN_WIDTH = 1;
export const MAX_WIDTH = 20;

/** `#RGB`, `#RRGGBB`, `#RRGGBBAA`. Lowercase or uppercase. */
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function isValidStroke(stroke: unknown): stroke is DrawingStroke {
  if (!stroke || typeof stroke !== "object") return false;
  const s = stroke as Partial<DrawingStroke>;
  if (typeof s.color !== "string" || !COLOR_RE.test(s.color)) return false;
  if (
    typeof s.width !== "number" ||
    !Number.isFinite(s.width) ||
    s.width < MIN_WIDTH ||
    s.width > MAX_WIDTH
  ) {
    return false;
  }
  if (!Array.isArray(s.points)) return false;
  if (s.points.length < 2 || s.points.length > MAX_POINTS_PER_STROKE) return false;
  return s.points.every(
    (p) =>
      p != null &&
      typeof p.x === "number" &&
      Number.isFinite(p.x) &&
      typeof p.y === "number" &&
      Number.isFinite(p.y)
  );
}

export const drawingModule: GameModule<DrawingState, DrawingIntent> = {
  key: "drawing",
  minPlayers: 1,
  maxPlayers: 4,
  initialState(players: GameSeat[]) {
    const seats: Record<string, string> = {};
    players.forEach((p, i) => {
      seats[p.userId] = `p${i + 1}`;
    });
    return { drawings: [], status: "playing", seats };
  },
  applyIntent(state, playerId, intent) {
    if (!state.seats?.[playerId]) {
      return {
        ok: false,
        error: { code: "NOT_IN_ROOM", message: "Player not in session" }
      };
    }

    if (intent?.type === "CLEAR") {
      // Host-only clear: seat "p1" is the original first joiner / host.
      if (state.seats?.[playerId] !== "p1") {
        return {
          ok: false,
          error: { code: "HOST_ONLY", message: "Only the host may clear" }
        };
      }
      return { ok: true, state: { ...state, drawings: [] } };
    }
    if (intent?.type !== "ADD_STROKE") {
      return {
        ok: false,
        error: { code: "BAD_INTENT", message: "Unknown intent" }
      };
    }
    if (!isValidStroke(intent.stroke)) {
      return {
        ok: false,
        error: { code: "BAD_INTENT", message: "stroke is invalid" }
      };
    }
    const drawings = [...state.drawings, intent.stroke];
    const bounded =
      drawings.length > MAX_STROKES ? drawings.slice(-MAX_STROKES) : drawings;
    return { ok: true, state: { ...state, drawings: bounded } };
  },
  isTerminal() {
    return false;
  }
};
