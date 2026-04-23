import { Chess, type Move } from "chess.js";
import type { GameModule, GameOutcome, GameSeat } from "./registry";

export type ChessSeat = "w" | "b";
export type ChessStatus = "playing" | "won" | "draw";
export type ChessPromotion = "q" | "r" | "b" | "n";
export type ChessDrawReason =
  | "stalemate"
  | "threefold_repetition"
  | "insufficient_material"
  | "fifty_move"
  | "draw";

export interface ChessIntent {
  from: string;
  to: string;
  promotion?: ChessPromotion;
}

export interface ChessState {
  fen: string;
  next: ChessSeat;
  status: ChessStatus;
  winner: ChessSeat | null;
  drawReason: ChessDrawReason | null;
  lastMove: {
    from: string;
    to: string;
    promotion?: ChessPromotion;
  } | null;
  history: Array<{ from: string; to: string; promotion?: ChessPromotion }>;
  seats?: Record<string, ChessSeat>;
}

export interface ChessApplyResult {
  state: ChessState;
  error?: { code: string; message: string };
}

function isSquare(value: unknown): value is string {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}

function isPromotion(value: unknown): value is ChessPromotion {
  return value === "q" || value === "r" || value === "b" || value === "n";
}

function hasFiftyMoveDraw(chess: Chess): boolean {
  const maybeFiftyMove = chess as unknown as {
    isDrawByFiftyMoves?: () => boolean;
    isFiftyMoves?: () => boolean;
  };
  if (typeof maybeFiftyMove.isDrawByFiftyMoves === "function") {
    return maybeFiftyMove.isDrawByFiftyMoves();
  }
  if (typeof maybeFiftyMove.isFiftyMoves === "function") {
    return maybeFiftyMove.isFiftyMoves();
  }
  return false;
}

function nextStatus(
  chess: Chess,
  mover: ChessSeat
): Pick<ChessState, "status" | "winner" | "drawReason"> {
  if (chess.isCheckmate()) {
    return { status: "won", winner: mover, drawReason: null };
  }
  const isStalemate = chess.isStalemate();
  const isThreefold = chess.isThreefoldRepetition();
  const isInsufficient = chess.isInsufficientMaterial();
  const isFiftyMove = hasFiftyMoveDraw(chess);
  const isDraw = chess.isDraw() || isStalemate || isThreefold || isInsufficient || isFiftyMove;
  if (isDraw) {
    let drawReason: ChessDrawReason = "draw";
    if (isStalemate) drawReason = "stalemate";
    else if (isThreefold) drawReason = "threefold_repetition";
    else if (isInsufficient) drawReason = "insufficient_material";
    else if (isFiftyMove) drawReason = "fifty_move";
    return { status: "draw", winner: null, drawReason };
  }
  return { status: "playing", winner: null, drawReason: null };
}

export function initialChessState(): ChessState {
  const chess = new Chess();
  return {
    fen: chess.fen(),
    next: "w",
    status: "playing",
    winner: null,
    drawReason: null,
    lastMove: null,
    history: []
  };
}

export function applyChessIntent(
  state: ChessState,
  seat: ChessSeat,
  intent: ChessIntent
): ChessApplyResult {
  if (state.status !== "playing") {
    return {
      state,
      error: { code: "GAME_OVER", message: "Game is not active" }
    };
  }
  if (!isSquare(intent.from) || !isSquare(intent.to)) {
    return {
      state,
      error: { code: "BAD_INTENT", message: "from/to must be chess squares" }
    };
  }
  if (intent.promotion !== undefined && !isPromotion(intent.promotion)) {
    return {
      state,
      error: { code: "BAD_INTENT", message: "promotion must be q/r/b/n" }
    };
  }
  if (seat !== state.next) {
    return {
      state,
      error: { code: "WRONG_PLAYER", message: "Not this player's turn" }
    };
  }

  const history = Array.isArray(state.history) ? state.history : [];
  const chess = new Chess();
  try {
    for (const played of history) {
      chess.move({
        from: played.from,
        to: played.to,
        promotion: played.promotion
      });
    }
    if (chess.fen() !== state.fen) {
      throw new Error("FEN mismatch");
    }
  } catch {
    return {
      state,
      error: { code: "BAD_STATE", message: "Invalid persisted chess history" }
    };
  }

  let move: Move | null = null;
  try {
    move = chess.move({
      from: intent.from,
      to: intent.to,
      promotion: intent.promotion
    });
  } catch {
    move = null;
  }
  if (!move) {
    return {
      state,
      error: { code: "ILLEGAL_MOVE", message: "Illegal chess move" }
    };
  }

  const status = nextStatus(chess, seat);
  return {
    state: {
      ...state,
      fen: chess.fen(),
      next: chess.turn() as ChessSeat,
      status: status.status,
      winner: status.winner,
      drawReason: status.drawReason,
      lastMove: {
        from: move.from,
        to: move.to,
        promotion: isPromotion(move.promotion) ? move.promotion : undefined
      },
      history: [
        ...history,
        {
          from: move.from,
          to: move.to,
          promotion: isPromotion(move.promotion) ? move.promotion : undefined
        }
      ]
    }
  };
}

export const chessModule: GameModule<ChessState, ChessIntent> = {
  key: "chess",
  minPlayers: 2,
  maxPlayers: 2,
  initialState(players: GameSeat[]) {
    const seats: Record<string, ChessSeat> = {};
    players.forEach((p, i) => {
      seats[p.userId] = i === 0 ? "w" : "b";
    });
    return { ...initialChessState(), seats };
  },
  applyIntent(state, playerId, intent) {
    const payload = (intent ?? {}) as Partial<ChessIntent>;
    if (!isSquare(payload.from) || !isSquare(payload.to)) {
      return {
        ok: false,
        error: {
          code: "BAD_INTENT",
          message: "from and to are required chess squares"
        }
      };
    }
    if (payload.promotion !== undefined && !isPromotion(payload.promotion)) {
      return {
        ok: false,
        error: { code: "BAD_INTENT", message: "promotion must be q/r/b/n" }
      };
    }

    const seat = state.seats?.[playerId];
    if (!seat) {
      return {
        ok: false,
        error: { code: "NOT_IN_ROOM", message: "Player not in session" }
      };
    }

    const res = applyChessIntent(state, seat, {
      from: payload.from,
      to: payload.to,
      promotion: payload.promotion
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
