export type Player = "X" | "O";
export type Cell = Player | null;

export interface TicTacToeState {
  board: [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];
  next: Player;
  status: "playing" | "draw" | "won";
  winner: Player | null;
  winningLine: number[] | null;
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
      board,
      next: player === "X" ? "O" : "X",
      status: "playing",
      winner: null,
      winningLine: null
    }
  };
}
