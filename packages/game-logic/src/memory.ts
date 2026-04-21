import type { GameModule, GameOutcome, GameSeat } from "./registry";

export interface MemoryCard {
  id: number;
  emoji: string;
}

export interface MemoryState {
  cards: MemoryCard[];
  seed: number;
  matched: number[];
  revealed: number[];
  scores: Record<string, number>;
  nextPlayerId: string | null;
  status: "playing" | "won" | "draw";
  winner: string | null;
  seats?: Record<string, "p1" | "p2">;
}

export interface MemoryIntent {
  cardIndex: number;
}

const EMOJIS = ["🎮", "🎨", "🎵", "🎯", "🎪", "🎭", "🎬", "🎤"] as const;

function seededShuffle<T>(source: T[], seed: number): T[] {
  const out = [...source];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function buildCards(seed: number): MemoryCard[] {
  const pairs = EMOJIS.flatMap((emoji, i) => [
    { id: i * 2, emoji },
    { id: i * 2 + 1, emoji }
  ]);
  return seededShuffle(pairs, seed);
}

export const memoryModule: GameModule<MemoryState, MemoryIntent> = {
  key: "memory",
  minPlayers: 2,
  maxPlayers: 2,
  initialState(players: GameSeat[]) {
    const seats: Record<string, "p1" | "p2"> = {};
    const scores: Record<string, number> = {};
    players.forEach((p, i) => {
      seats[p.userId] = i === 0 ? "p1" : "p2";
      scores[p.userId] = 0;
    });
    const firstPlayerId = players[0]?.userId ?? null;
    // Fresh seed per initialState call so every new game shuffles differently.
    // applyIntent stays pure because it only reads state.cards / state.seed.
    const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    return {
      cards: buildCards(seed),
      seed,
      matched: [],
      revealed: [],
      scores,
      nextPlayerId: firstPlayerId,
      status: "playing",
      winner: null,
      seats
    };
  },
  applyIntent(state, playerId, intent) {
    if (!state.seats?.[playerId]) {
      return {
        ok: false,
        error: { code: "NOT_IN_ROOM", message: "Player not in session" }
      };
    }
    if (state.status !== "playing") {
      return {
        ok: false,
        error: { code: "GAME_OVER", message: "Game is over" }
      };
    }
    if (state.nextPlayerId !== playerId) {
      return {
        ok: false,
        error: { code: "WRONG_PLAYER", message: "Not your turn" }
      };
    }
    // If 2 cards are revealed, it means we're starting a new turn after a
    // mismatch. Clear the revealed cards before processing the new intent.
    let currentState = state;
    if (currentState.revealed.length === 2) {
      const [a, b] = currentState.revealed;
      const isMatch =
        currentState.cards[a].emoji === currentState.cards[b].emoji;
      if (!isMatch) {
        currentState = { ...currentState, revealed: [] };
      }
    }

    if (
      !intent ||
      typeof intent.cardIndex !== "number" ||
      !Number.isInteger(intent.cardIndex)
    ) {
      return {
        ok: false,
        error: { code: "BAD_INTENT", message: "cardIndex required" }
      };
    }
    const idx = intent.cardIndex;
    if (idx < 0 || idx >= state.cards.length) {
      return {
        ok: false,
        error: { code: "INVALID_CARD", message: "Card index out of bounds" }
      };
    }
    if (currentState.matched.includes(idx) || currentState.revealed.includes(idx)) {
      return {
        ok: false,
        error: {
          code: "CARD_UNAVAILABLE",
          message: "Card already matched/revealed"
        }
      };
    }

    const revealed = [...currentState.revealed, idx];
    if (revealed.length < 2) {
      return { ok: true, state: { ...currentState, revealed } };
    }

    const [a, b] = revealed;
    const isMatch = currentState.cards[a].emoji === currentState.cards[b].emoji;
    let nextState: MemoryState;
    if (isMatch) {
      const scores = {
        ...currentState.scores,
        [playerId]: (currentState.scores[playerId] ?? 0) + 1
      };
      nextState = {
        ...currentState,
        revealed: [],
        scores,
        matched: [...currentState.matched, a, b]
        // turn stays on the matching player
      };
    } else {
      const playerIds = Object.keys(currentState.seats ?? {});
      const other = playerIds.find((id) => id !== playerId) ?? playerId;
      nextState = {
        ...currentState,
        revealed,
        nextPlayerId: other
      };
    }

    let outcome: GameOutcome | undefined;
    if (nextState.matched.length === nextState.cards.length) {
      const playerIds = Object.keys(state.seats ?? {});
      const [p1, p2] = playerIds;
      const s1 = nextState.scores[p1] ?? 0;
      const s2 = nextState.scores[p2] ?? 0;
      if (s1 === s2) {
        nextState = { ...nextState, status: "draw", winner: null };
        outcome = { kind: "draw" };
      } else {
        const winner = s1 > s2 ? p1 : p2;
        nextState = { ...nextState, status: "won", winner };
        outcome = { kind: "won", winner };
      }
    }

    return { ok: true, state: nextState, outcome };
  },
  isTerminal(state) {
    return state.status === "won" || state.status === "draw";
  }
};
