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

export type ChessTimeControl =
  | { mode: "none" }
  | { mode: "timed"; initialMs: number; incrementMs?: number };

const MIN_INITIAL_MS = 60_000;
const MAX_INITIAL_MS = 180 * 60_000;
const MAX_INCREMENT_MS = 60_000;

export function isValidTimeControl(tc: ChessTimeControl): boolean {
  if (tc.mode === "none") return true;
  if (tc.initialMs < MIN_INITIAL_MS || tc.initialMs > MAX_INITIAL_MS) return false;
  if (tc.incrementMs !== undefined) {
    if (tc.incrementMs < 0 || tc.incrementMs > MAX_INCREMENT_MS) return false;
  }
  return true;
}

export function isChessSetTimeControlIntent(intent: unknown): boolean {
  return (
    typeof intent === "object" &&
    intent !== null &&
    (intent as { type?: string }).type === "set_time_control"
  );
}

export type ChessIntent =
  | { type: "move"; from: string; to: string; promotion?: ChessPromotion }
  | { type: "resign" }
  | { type: "offer_draw" }
  | { type: "accept_draw" }
  | { type: "decline_draw" }
  | { type: "set_time_control"; timeControl: ChessTimeControl }
  | { type: "check_timeout" };

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
  // Clock fields:
  clocks?: { w: number; b: number };      // ms remaining
  lastTickAt?: number | null;              // server ms timestamp of last active moment
  timeControl?: ChessTimeControl;
  timeoutWinner?: ChessSeat | null;
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

export function initialChessState(timeControl?: ChessTimeControl): ChessState {
  const chess = new Chess();
  const tc = timeControl ?? { mode: "none" };
  const state: ChessState = {
    fen: chess.fen(),
    next: "w",
    status: "playing",
    winner: null,
    drawReason: null,
    drawOfferFrom: null,
    lastMove: null,
    history: [],
    timeControl: tc
  };
  if (tc.mode === "timed") {
    state.clocks = { w: tc.initialMs, b: tc.initialMs };
    state.lastTickAt = null;
  }
  return state;
}

/** Pick a random legal move for engine fallback when UCI output is unusable. */
export function randomLegalMove(
  fen: string
): { from: string; to: string; promotion?: ChessPromotion } | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const pick = moves[Math.floor(Math.random() * moves.length)];
  return {
    from: pick.from,
    to: pick.to,
    promotion: isPromotion(pick.promotion) ? pick.promotion : undefined
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
    try {
      const m = chess.move({
        from: played.from,
        to: played.to,
        promotion: played.promotion
      });
      if (m.captured) {
        if (m.color === "w") wTakes.push(m.captured);
        else bTakes.push(m.captured);
      }
    } catch {
      // Ignored
    }
  }
  return { wTakes, bTakes };
}

/** FEN position at historical move index (0 = start position, k = after k moves, -1 or history.length = live) */
export function fenAtHistoryIndex(state: ChessState, index: number): string {
  const len = Array.isArray(state.history) ? state.history.length : 0;
  if (index === -1 || index >= len) {
    return state.fen;
  }
  if (index === 0) {
    return new Chess().fen();
  }
  const chess = new Chess();
  for (let i = 0; i < index; i++) {
    try {
      chess.move({
        from: state.history[i].from,
        to: state.history[i].to,
        promotion: state.history[i].promotion
      });
    } catch {
      break;
    }
  }
  return chess.fen();
}

/** Captured material list up to historical index (0 = none, k = after k moves, -1 or history.length = live) */
export function capturesAtHistoryIndex(
  history: Array<{ from: string; to: string; promotion?: ChessPromotion }>,
  index: number
): { wTakes: string[]; bTakes: string[] } {
  const len = Array.isArray(history) ? history.length : 0;
  if (index === -1 || index >= len) {
    return capturedMaterialFromHistory(history);
  }
  return capturedMaterialFromHistory(history.slice(0, index));
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

  const now = Date.now();
  let nextClocks = state.clocks ? { ...state.clocks } : undefined;
  if (state.timeControl?.mode === "timed" && nextClocks) {
    if (state.lastTickAt) {
      const elapsed = now - state.lastTickAt;
      const currentVal = seat === "w" ? nextClocks.w : nextClocks.b;
      const newVal = Math.max(0, currentVal - elapsed);
      if (seat === "w") {
        nextClocks.w = newVal;
      } else {
        nextClocks.b = newVal;
      }
      if (newVal <= 0) {
        const winner: ChessSeat = seat === "w" ? "b" : "w";
        return {
          state: {
            ...state,
            status: "won",
            winner,
            drawReason: null,
            timeoutWinner: winner,
            clocks: nextClocks
          },
          error: { code: "TIME_EXPIRED", message: "Time has expired" }
        };
      }
    }
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

  // Mover played a valid move. Apply increment to mover's clock.
  if (state.timeControl?.mode === "timed" && nextClocks && state.timeControl.incrementMs) {
    if (seat === "w") {
      nextClocks.w += state.timeControl.incrementMs;
    } else {
      nextClocks.b += state.timeControl.incrementMs;
    }
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
      ],
      clocks: nextClocks,
      lastTickAt: state.timeControl?.mode === "timed" ? now : null
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

function applySetTimeControl(
  state: ChessState,
  _seat: ChessSeat,
  tc: ChessTimeControl
): ChessApplyResult {
  if (!isValidTimeControl(tc)) {
    return {
      state,
      error: { code: "BAD_INTENT", message: "Invalid time control values" }
    };
  }
  if (state.history.length > 0) {
    return {
      state,
      error: { code: "GAME_STARTED", message: "Cannot change time control after game has started" }
    };
  }
  const clocks = tc.mode === "timed" ? { w: tc.initialMs, b: tc.initialMs } : undefined;
  return {
    state: {
      ...state,
      timeControl: tc,
      clocks,
      lastTickAt: null
    }
  };
}

function applyCheckTimeout(state: ChessState): ChessApplyResult {
  if (state.status !== "playing") {
    return { state };
  }
  if (state.timeControl?.mode !== "timed" || !state.clocks || !state.lastTickAt) {
    return { state };
  }
  const now = Date.now();
  const elapsed = now - state.lastTickAt;
  const activeSeat = state.next;
  const currentVal = activeSeat === "w" ? state.clocks.w : state.clocks.b;
  const newVal = Math.max(0, currentVal - elapsed);

  if (newVal <= 0) {
    const winner: ChessSeat = activeSeat === "w" ? "b" : "w";
    const nextClocks = { ...state.clocks };
    if (activeSeat === "w") {
      nextClocks.w = 0;
    } else {
      nextClocks.b = 0;
    }
    return {
      state: {
        ...state,
        status: "won",
        winner,
        drawReason: null,
        timeoutWinner: winner,
        clocks: nextClocks
      }
    };
  }

  const nextClocks = { ...state.clocks };
  if (activeSeat === "w") {
    nextClocks.w = newVal;
  } else {
    nextClocks.b = newVal;
  }
  return {
    state: {
      ...state,
      clocks: nextClocks,
      lastTickAt: now
    }
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
    case "set_time_control":
      return applySetTimeControl(state, seat, intent.timeControl);
    case "check_timeout":
      return applyCheckTimeout(state);
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

function isTimeControl(value: unknown): value is ChessTimeControl {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  if (raw.mode === "none") return true;
  if (raw.mode === "timed") {
    if (typeof raw.initialMs !== "number") return false;
    if (raw.incrementMs !== undefined && typeof raw.incrementMs !== "number") return false;
    return isValidTimeControl(raw as ChessTimeControl);
  }
  return false;
}

function parseChessIntentPayload(intent: unknown): ChessIntent | null {
  if (!intent || typeof intent !== "object") return null;
  const raw = intent as Record<string, unknown>;
  const t = raw.type;
  if (t === "resign") return { type: "resign" };
  if (t === "offer_draw") return { type: "offer_draw" };
  if (t === "accept_draw") return { type: "accept_draw" };
  if (t === "decline_draw") return { type: "decline_draw" };
  if (t === "check_timeout") return { type: "check_timeout" };
  if (t === "set_time_control") {
    if (isTimeControl(raw.timeControl)) {
      return { type: "set_time_control", timeControl: raw.timeControl };
    }
  }
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
  initialState(players: GameSeat[], timeControl?: ChessTimeControl) {
    const seats: Record<string, ChessSeat> = {};
    players.forEach((p, i) => {
      seats[p.userId] = i === 0 ? "w" : "b";
    });
    return { ...initialChessState(timeControl), seats };
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
