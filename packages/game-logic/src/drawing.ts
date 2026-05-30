import type { GameModule, GameSeat } from "./registry";

export interface DrawingCanvasSnapshot {
  engine: "excalidraw";
  version: number;
  updatedAt: number;
  elements: unknown[];
  files: Record<string, unknown>;
}

export interface DrawingState {
  status: "playing";
  seats?: Record<string, string>;
  canvas: DrawingCanvasSnapshot;
}

export type DrawingIntent =
  | { type: "CHECKPOINT"; version: number; elements: unknown[]; files: Record<string, unknown> }
  | { type: "CLEAR_CANVAS" };

export const MAX_ELEMENTS = 5000;
export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 512 * 1024; // 512KB per file
export const MAX_STATE_BYTES = 2 * 1024 * 1024; // 2MB total state JSON

function byteLength(val: unknown): number {
  return Buffer.byteLength(JSON.stringify(val));
}

function isValidCheckpoint(
  version: number,
  elements: unknown[],
  files: Record<string, unknown>
): boolean {
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return false;
  if (!Array.isArray(elements) || elements.length > MAX_ELEMENTS) return false;
  if (!files || typeof files !== "object") return false;
  
  const fileKeys = Object.keys(files);
  if (fileKeys.length > MAX_FILES) return false;
  
  // check each file size
  for (const key of fileKeys) {
    const fileData = files[key];
    if (byteLength(fileData) > MAX_FILE_BYTES) return false;
  }
  
  // check total JSON serialization size
  if (byteLength({ elements, files }) > MAX_STATE_BYTES) return false;
  
  return true;
}

export const drawingModule: GameModule<DrawingState, DrawingIntent> = {
  key: "drawing",
  minPlayers: 1,
  maxPlayers: 10,
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
            updatedAt: Date.now(),
            elements: [],
            files: {}
          }
        }
      };
    }

    if (intent?.type === "CHECKPOINT") {
      const { version, elements, files } = intent;
      if (version <= state.canvas.version) {
        return {
          ok: false,
          error: {
            code: "STALE_VERSION",
            message: `Version ${version} is stale (current: ${state.canvas.version})`
          }
        };
      }
      if (!isValidCheckpoint(version, elements, files)) {
        return {
          ok: false,
          error: {
            code: "BAD_CHECKPOINT",
            message: "Checkpoint exceeds size or element limits"
          }
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          canvas: {
            engine: "excalidraw",
            version,
            updatedAt: Date.now(),
            elements,
            files
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
