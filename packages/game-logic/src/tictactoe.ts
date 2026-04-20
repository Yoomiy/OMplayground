import type { GameModule, GameOutcome, GameSeat } from "./registry";

export type Player = "X" | "O";
export type Cell = Player | null;

export interface TicTacToeState {
  board: [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];
  next: Player;
  status: "playing" | "draw" | "won";
  winner: Player | null;
  winningLine: number[] | null;
  /** userId → symbol, populated by the module when seating players. */
  seats?: Record<string, Player>;
}

export type TicTacToeIntent =
  | { type: "MOVE"; cellIndex: number; player: Player }
  | { type: "RESET" };

const emptyBoard = (): TicTacToeState["board"] => [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null
];

export function initialTicTacToeState(): TicTacToeState {
  return {
    board: emptyBoard(),
    next: "X",
    status: "playing",
    winner: null,
    winningLine: null
  };
}

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function findWinner(board: TicTacToeState["board"]): {
  winner: Player;
  line: number[];
} | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      return { winner: v, line };
    }
  }
  return null;
}

export interface ApplyIntentResult {
  state: TicTacToeState;
  error?: { code: string; message: string };
}

export function applyTicTacToeIntent(
  state: TicTacToeState,
  intent: TicTacToeIntent
): ApplyIntentResult {
  if (intent.type === "RESET") {
    return { state: initialTicTacToeState() };
  }

  if (state.status !== "playing") {
    return {
      state,
      error: { code: "GAME_OVER", message: "Game is not active" }
    };
  }

  const { cellIndex, player } = intent;
  if (cellIndex < 0 || cellIndex > 8 || !Number.isInteger(cellIndex)) {
    return {
      state,
      error: { code: "INVALID_CELL", message: "Cell index must be 0–8" }
    };
  }

  if (player !== state.next) {
    return {
      state,
      error: { code: "WRONG_PLAYER", message: "Not this player's turn" }
    };
  }

  if (state.board[cellIndex] !== null) {
    return {
      state,
      error: { code: "CELL_TAKEN", message: "Cell already occupied" }
    };
  }

  const board = [...state.board] as TicTacToeState["board"];
  board[cellIndex] = player;

  const win = findWinner(board);
  if (win) {
    return {
      state: {
        ...state,
        board,
        next: player,
        status: "won",
        winner: win.winner,
        winningLine: win.line
      }
    };
  }

  const isDraw = board.every((c) => c !== null);
  if (isDraw) {
    return {
      state: {
        ...state,
        board,
        next: player,
        status: "draw",
        winner: null,
        winningLine: null
      }
    };
  }

  return {
    state: {
      ...state,
      board,
      next: player === "X" ? "O" : "X",
      status: "playing",
      winner: null,
      winningLine: null
    }
  };
}

export interface TicTacToeIntentPayload {
  cellIndex: number;
}

/**
 * Wraps the pure reducer in the generic GameModule contract. Seat→symbol
 * assignment happens in `initialState`; `applyIntent` looks up the symbol
 * from `state.seats` rather than trusting the client.
 */
export const tictactoeModule: GameModule<TicTacToeState, TicTacToeIntentPayload> =
  {
    key: "tictactoe",
    minPlayers: 2,
    maxPlayers: 2,
    initialState(players: GameSeat[]) {
      const seats: Record<string, Player> = {};
      players.forEach((p, i) => {
        seats[p.userId] = i === 0 ? "X" : "O";
      });
      return { ...initialTicTacToeState(), seats };
    },
    applyIntent(state, playerId, intent) {
      const cellIndex = (intent as { cellIndex?: unknown } | null | undefined)
        ?.cellIndex;
      if (typeof cellIndex !== "number") {
        return {
          ok: false,
          error: { code: "BAD_INTENT", message: "cellIndex required" }
        };
      }
      const symbol = state.seats?.[playerId];
      if (!symbol) {
        return {
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "Player not in session" }
        };
      }
      const res = applyTicTacToeIntent(state, {
        type: "MOVE",
        cellIndex,
        player: symbol
      });
      if (res.error) {
        return { ok: false, error: res.error };
      }
      let outcome: GameOutcome | undefined;
      if (res.state.status === "won" && res.state.winner) {
        outcome = { kind: "won", winner: res.state.winner };
      } else if (res.state.status === "draw") {
        outcome = { kind: "draw" };
      }
      return { ok: true, state: res.state, outcome };
    },
    isTerminal(state) {
      return state.status === "won" || state.status === "draw";
    }
  };
