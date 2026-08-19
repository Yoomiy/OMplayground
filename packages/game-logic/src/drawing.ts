import type { GameModule, GameSeat } from "./registry";

export interface DrawingCanvasSnapshot {
  engine: "excalidraw";
  version: number;
  /** Monotonic clear revision; only this permits clients to erase local Yjs state. */
  clearVersion: number;
  updatedAt: number;
  elements: unknown[];
  files: Record<string, unknown>;
}

export interface DrawingState {
  status: "playing";
  seats?: Record<string, string>;
  canvas: DrawingCanvasSnapshot;
}

export type DrawingIntent = { type: "CLEAR_CANVAS" };

export const MAX_ELEMENTS = 5000;
export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 1024 * 1024; // 1MB per file
export const MAX_STATE_BYTES = 5 * 1024 * 1024; // 5MB total state JSON

export const drawingModule: GameModule<DrawingState, DrawingIntent> = {
  key: "drawing",
  minPlayers: 1,
  maxPlayers: 100,
  initialState(players: GameSeat[]): DrawingState {
    const seats: Record<string, string> = {};
    players.forEach((p, i) => {
      seats[p.userId] = `p${i + 1}`;
    });
    return {
      status: "playing",
      seats,
      canvas: {
        engine: "excalidraw",
        version: 0,
        clearVersion: 0,
        updatedAt: Date.now(),
        elements: [],
        files: {}
      }
    };
  },
  applyIntent(state, playerId, intent) {
    if (!state.seats?.[playerId]) {
      return {
        ok: false,
        error: { code: "NOT_IN_ROOM", message: "Player not in session" }
      };
    }

    if (intent?.type === "CLEAR_CANVAS") {
      return {
        ok: true,
        state: {
          ...state,
          canvas: {
            engine: "excalidraw",
            version: state.canvas.version + 1,
            clearVersion: state.canvas.clearVersion + 1,
            updatedAt: Date.now(),
            elements: [],
            files: {}
          }
        }
      };
    }

    return {
      ok: false,
      error: { code: "BAD_INTENT", message: "Unknown intent" }
    };
  },
  isTerminal() {
    return false;
  }
};
