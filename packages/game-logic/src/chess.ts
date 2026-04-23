import { Chess, type Move, type Square } from "chess.js";
import type { GameModule, GameOutcome, GameSeat } from "./registry";

export type ChessSeat = "w" | "b";
export type ChessStatus = "playing" | "won" | "draw";
export type ChessPromotion = "q" | "r" | "b" | "n";
export type ChessDrawReason =
  | "stalemate"
  | "threefold_repetition"
  | "insufficient_material"
  | "fifty_move"
  | "draw"
  | "draw_by_agreement";

export type ChessIntent =
  | { type: "move"; from: string; to: string; promotion?: ChessPromotion }
  | { type: "resign" }
  | { type: "offer_draw" }
  | { type: "accept_draw" }
  | { type: "decline_draw" };

export interface ChessState {
  fen: string;
  next: ChessSeat;
  status: ChessStatus;
  winner: ChessSeat | null;
  drawReason: ChessDrawReason | null;
  drawOfferFrom: ChessSeat | null;
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
    drawOfferFrom: null,
    lastMove: null,
    history: []
  };
}

/** Legal destination squares for a piece on `from` in the current `fen` position. */
export function legalTargetSquares(fen: string, from: string): string[] {
  if (!isSquare(from)) return [];
  const chess = new Chess(fen);
  return chess.moves({ verbose: true, square: from as Square }).map((m) => m.to);
}

export function isPlayersPiece(fen: string, square: string, seat: ChessSeat): boolean {
  if (!isSquare(square)) return false;
  const chess = new Chess(fen);
  const p = chess.get(square as Square);
  return p !== undefined && p.color === seat;
}

/** Pawn move to 8th/1st rank; caller should choose promotion piece. */
export function moveNeedsPromotion(fen: string, from: string, to: string): boolean {
  if (!isSquare(from) || !isSquare(to)) return false;
  const chess = new Chess(fen);
  const p = chess.get(from as Square);
  if (!p || p.type !== "p") return false;
  const tr = to[1];
  return p.color === "w" ? tr === "8" : tr === "1";
}

/**
 * Square of the side-to-move’s king when that side is in check, else `null`.
 * Use with current position FEN (after a move, it is the next player in check or not).
 */
export function kingSquareInCheck(fen: string): string | null {
  const chess = new Chess(fen);
  if (!chess.inCheck()) return null;
  const color = chess.turn();
  const kingSquares = chess.findPiece({ type: "k", color });
  return (kingSquares[0] as string | undefined) ?? null;
}

/** Black pieces taken by white; white pieces taken by black (piece type letters, chess.js). */
export function capturedMaterialFromHistory(
  history: Array<{ from: string; to: string; promotion?: ChessPromotion }>
): { wTakes: string[]; bTakes: string[] } {
  const wTakes: string[] = [];
  const bTakes: string[] = [];
  const chess = new Chess();
  for (const played of history) {
    const m = chess.move({
      from: played.from,
      to: played.to,
      promotion: played.promotion
    });
    if (m.captured) {
      if (m.color === "w") wTakes.push(m.captured);
      else bTakes.push(m.captured);
    }
  }
  return { wTakes, bTakes };
}

function applyChessMove(
  state: ChessState,
  seat: ChessSeat,
  from: string,
  to: string,
  promotion: ChessPromotion | undefined
): ChessApplyResult {
  if (state.status !== "playing") {
    return {
      state,
      error: { code: "GAME_OVER", message: "Game is not active" }
    };
  }
  if (!isSquare(from) || !isSquare(to)) {
    return {
      state,
      error: { code: "BAD_INTENT", message: "from/to must be chess squares" }
    };
  }
  if (promotion !== undefined && !isPromotion(promotion)) {
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
      from,
      to,
      promotion
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
      drawOfferFrom: null,
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

function applyResign(state: ChessState, seat: ChessSeat): ChessApplyResult {
  if (state.status !== "playing") {
    return { state, error: { code: "GAME_OVER", message: "Game is not active" } };
  }
  const winner: ChessSeat = seat === "w" ? "b" : "w";
  return {
    state: {
      ...state,
      status: "won",
      winner,
      drawReason: null,
      drawOfferFrom: null
    }
  };
}

function applyOfferDraw(state: ChessState, seat: ChessSeat): ChessApplyResult {
  if (state.status !== "playing") {
    return { state, error: { code: "GAME_OVER", message: "Game is not active" } };
  }
  if (seat !== state.next) {
    return { state, error: { code: "WRONG_PLAYER", message: "Not this player's turn" } };
  }
  if (state.drawOfferFrom === seat) {
    return { state };
  }
  if (state.drawOfferFrom && state.drawOfferFrom !== seat) {
    return {
      state,
      error: { code: "DRAW_PENDING", message: "Respond to the pending draw offer first" }
    };
  }
  return {
    state: { ...state, drawOfferFrom: seat }
  };
}

function applyAcceptDraw(state: ChessState, seat: ChessSeat): ChessApplyResult {
  if (state.status !== "playing") {
    return { state, error: { code: "GAME_OVER", message: "Game is not active" } };
  }
  const from = state.drawOfferFrom;
  if (!from || from === seat) {
    return { state, error: { code: "BAD_INTENT", message: "No draw offer from opponent" } };
  }
  return {
    state: {
      ...state,
      status: "draw",
      drawReason: "draw_by_agreement",
      winner: null,
      drawOfferFrom: null
    }
  };
}

function applyDeclineDraw(state: ChessState, seat: ChessSeat): ChessApplyResult {
  if (state.status !== "playing") {
    return { state, error: { code: "GAME_OVER", message: "Game is not active" } };
  }
  const from = state.drawOfferFrom;
  if (!from || from === seat) {
    return { state, error: { code: "BAD_INTENT", message: "No draw offer to decline" } };
  }
  return {
    state: { ...state, drawOfferFrom: null }
  };
}

export function applyChessIntent(
  state: ChessState,
  seat: ChessSeat,
  intent: ChessIntent
): ChessApplyResult {
  switch (intent.type) {
    case "move":
      return applyChessMove(
        state,
        seat,
        intent.from,
        intent.to,
        intent.promotion
      );
    case "resign":
      return applyResign(state, seat);
    case "offer_draw":
      return applyOfferDraw(state, seat);
    case "accept_draw":
      return applyAcceptDraw(state, seat);
    case "decline_draw":
      return applyDeclineDraw(state, seat);
    default:
      return { state, error: { code: "BAD_INTENT", message: "Unknown intent" } };
  }
}

function parseLegacyMoveIntent(
  raw: Record<string, unknown>
): { type: "move"; from: string; to: string; promotion?: ChessPromotion } | null {
  if (raw.type !== undefined && raw.type !== "move") {
    return null;
  }
  if (!isSquare(raw.from) || !isSquare(raw.to)) {
    return null;
  }
  if (raw.promotion !== undefined && !isPromotion(raw.promotion)) {
    return null;
  }
  return {
    type: "move",
    from: raw.from,
    to: raw.to,
    promotion: raw.promotion as ChessPromotion | undefined
  };
}

function parseChessIntentPayload(intent: unknown): ChessIntent | null {
  if (!intent || typeof intent !== "object") return null;
  const raw = intent as Record<string, unknown>;
  const t = raw.type;
  if (t === "resign") return { type: "resign" };
  if (t === "offer_draw") return { type: "offer_draw" };
  if (t === "accept_draw") return { type: "accept_draw" };
  if (t === "decline_draw") return { type: "decline_draw" };
  if (t === "move") {
    if (!isSquare(raw.from) || !isSquare(raw.to)) return null;
    if (raw.promotion !== undefined && !isPromotion(raw.promotion)) return null;
    return {
      type: "move",
      from: raw.from,
      to: raw.to,
      promotion: raw.promotion as ChessPromotion | undefined
    };
  }
  if (t === undefined) {
    return parseLegacyMoveIntent(raw);
  }
  return null;
}

export const chessModule: GameModule<ChessState, unknown> = {
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
  applyIntent(state, playerId, intent: unknown) {
    const seat = state.seats?.[playerId];
    if (!seat) {
      return {
        ok: false,
        error: { code: "NOT_IN_ROOM", message: "Player not in session" }
      };
    }

    const parsed = parseChessIntentPayload(intent);
    if (!parsed) {
      return {
        ok: false,
        error: { code: "BAD_INTENT", message: "Invalid chess intent" }
      };
    }

    const res = applyChessIntent(state, seat, parsed);
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
