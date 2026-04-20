import type { GameModule, GameOutcome, GameSeat } from "./registry";

export type ConnectFourDisc = "R" | "Y";
export type ConnectFourCell = ConnectFourDisc | null;

export interface ConnectFourState {
  board: ConnectFourCell[][];
  next: ConnectFourDisc;
  status: "playing" | "draw" | "won";
  winner: ConnectFourDisc | null;
  seats?: Record<string, ConnectFourDisc>;
}

export interface ConnectFourIntent {
  column: number;
}

export interface ApplyConnectFourIntent {
  type: "DROP";
  column: number;
  player: ConnectFourDisc;
}

function emptyBoard(): ConnectFourCell[][] {
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 7 }, () => null as ConnectFourCell)
  );
}

export function initialConnectFourState(): ConnectFourState {
  return {
    board: emptyBoard(),
    next: "R",
    status: "playing",
    winner: null
  };
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 6 && col >= 0 && col < 7;
}

function hasWinningLine(
  board: ConnectFourCell[][],
  row: number,
  col: number,
  player: ConnectFourDisc
): boolean {
  const directions: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  for (const [dr, dc] of directions) {
    let count = 1;
    for (const sign of [-1, 1] as const) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (inBounds(r, c) && board[r][c] === player) {
        count += 1;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

function boardIsFull(board: ConnectFourCell[][]): boolean {
  return board[0].every((cell) => cell !== null);
}

export interface ConnectFourApplyResult {
  state: ConnectFourState;
  error?: { code: string; message: string };
}

export function applyConnectFourIntent(
  state: ConnectFourState,
  intent: ApplyConnectFourIntent
): ConnectFourApplyResult {
  if (state.status !== "playing") {
    return {
      state,
      error: { code: "GAME_OVER", message: "Game is not active" }
    };
  }

  const { column, player } = intent;
  if (!Number.isInteger(column) || column < 0 || column > 6) {
    return {
      state,
      error: { code: "INVALID_COLUMN", message: "Column must be 0-6" }
    };
  }
  if (player !== state.next) {
    return {
      state,
      error: { code: "WRONG_PLAYER", message: "Not this player's turn" }
    };
  }

  let targetRow = -1;
  for (let row = 5; row >= 0; row -= 1) {
    if (state.board[row][column] === null) {
      targetRow = row;
      break;
    }
  }
  if (targetRow < 0) {
    return {
      state,
      error: { code: "COLUMN_FULL", message: "Column is full" }
    };
  }

  const board = state.board.map((r) => [...r]);
  board[targetRow][column] = player;

  if (hasWinningLine(board, targetRow, column, player)) {
    return {
      state: {
        ...state,
        board,
        next: player,
        status: "won",
        winner: player
      }
    };
  }

  if (boardIsFull(board)) {
    return {
      state: {
        ...state,
        board,
        next: player,
        status: "draw",
        winner: null
      }
    };
  }

  return {
    state: {
      ...state,
      board,
      next: player === "R" ? "Y" : "R",
      status: "playing",
      winner: null
    }
  };
}

export const connectfourModule: GameModule<ConnectFourState, ConnectFourIntent> =
  {
    key: "connectfour",
    minPlayers: 2,
    maxPlayers: 2,
    initialState(players: GameSeat[]) {
      const seats: Record<string, ConnectFourDisc> = {};
      players.forEach((p, i) => {
        seats[p.userId] = i === 0 ? "R" : "Y";
      });
      return { ...initialConnectFourState(), seats };
    },
    applyIntent(state, playerId, intent) {
      const column = (intent as { column?: unknown } | null | undefined)?.column;
      if (typeof column !== "number") {
        return {
          ok: false,
          error: { code: "BAD_INTENT", message: "column required" }
        };
      }
      const seat = state.seats?.[playerId];
      if (!seat) {
        return {
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "Player not in session" }
        };
      }
      const res = applyConnectFourIntent(state, {
        type: "DROP",
        column,
        player: seat
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
