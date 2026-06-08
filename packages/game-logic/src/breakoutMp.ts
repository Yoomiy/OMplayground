import type { GameModule, GameOutcome, GameSeat } from "./registry";

export interface BreakoutMpState {
  seats?: Record<string, "A" | "B">;
  seed: number;                 // shared deterministic seed for both sims
  currentLevel: number;         // level index to resume from (0-based)
  status: "playing" | "won" | "lost";
  winner: string | null;
}

export type BreakoutMpIntent =
  | { kind: "report-end"; result: "won" | "lost" }
  | { kind: "checkpoint"; currentLevel: number };

export const breakoutMpModule: GameModule<BreakoutMpState, BreakoutMpIntent> = {
  key: "breakout",
  minPlayers: 2,
  maxPlayers: 2,
  initialState(players: GameSeat[]): BreakoutMpState {
    const seats: Record<string, "A" | "B"> = {};
    if (players[0]) seats[players[0].userId] = "A";
    if (players[1]) seats[players[1].userId] = "B";

    // Generate a random integer seed for deterministic lockstep physics
    const seed = Math.floor(Math.random() * 1000000) + 1;

    return {
      seats,
      seed,
      currentLevel: 0,
      status: "playing",
      winner: null,
    };
  },
  applyIntent(state, playerId, intent) {
    if (!state.seats?.[playerId]) {
      return {
        ok: false,
        error: { code: "NOT_IN_ROOM", message: "Player not in session" }
      };
    }

    if (intent?.kind === "checkpoint") {
      return {
        ok: true,
        state: {
          ...state,
          currentLevel: Math.max(0, Math.floor(intent.currentLevel)),
        },
      };
    }

    if (intent?.kind === "report-end") {
      const nextStatus = intent.result; // "won" | "lost"
      const nextState: BreakoutMpState = {
        ...state,
        status: nextStatus,
        winner: nextStatus === "won" ? "both" : null,
      };

      const outcome: GameOutcome = {
        kind: "won",
        winner: nextStatus === "won" ? "both" : "none",
      };

      return {
        ok: true,
        state: nextState,
        outcome,
      };
    }

    return {
      ok: false,
      error: { code: "BAD_INTENT", message: "Unknown intent" }
    };
  },
  isTerminal(state) {
    return state.status === "won" || state.status === "lost";
  }
};

