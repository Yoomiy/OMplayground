import type { GameSeat } from "./registry";
import { memoryModule, type MemoryState } from "./memory";

const P1: GameSeat = { userId: "u1", displayName: "A" };
const P2: GameSeat = { userId: "u2", displayName: "B" };

function init(): { state: MemoryState; players: GameSeat[] } {
  const players: GameSeat[] = [P1, P2];
  return {
    state: memoryModule.initialState(players) as MemoryState,
    players
  };
}

/** Find two indices in `state.cards` forming a matching emoji pair. */
function findPair(s: MemoryState): [number, number] {
  for (let i = 0; i < s.cards.length; i += 1) {
    for (let j = i + 1; j < s.cards.length; j += 1) {
      if (s.cards[i].emoji === s.cards[j].emoji) return [i, j];
    }
  }
  throw new Error("no pair found");
}

/** Find two indices with DIFFERENT emojis. */
function findMismatch(s: MemoryState): [number, number] {
  for (let i = 0; i < s.cards.length; i += 1) {
    for (let j = i + 1; j < s.cards.length; j += 1) {
      if (s.cards[i].emoji !== s.cards[j].emoji) return [i, j];
    }
  }
  throw new Error("no mismatch found");
}

describe("Memory rules", () => {
  it("builds a 16-card deck with 8 pairs and a seed captured in state", () => {
    const { state: s } = init();
    expect(s.cards.length).toBe(16);
    const byEmoji = new Map<string, number>();
    for (const c of s.cards) {
      byEmoji.set(c.emoji, (byEmoji.get(c.emoji) ?? 0) + 1);
    }
    for (const count of byEmoji.values()) expect(count).toBe(2);
    expect(typeof s.seed).toBe("number");
    expect(s.seed).toBeGreaterThan(0);
  });

  it("varies the deck across games (fresh seed per initialState)", () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 20; i += 1) {
      seeds.add(init().state.seed);
    }
    // Extremely unlikely to collide 20 times with a 32-bit seed space.
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("match keeps the turn, increments scorer, mismatch swaps turn", () => {
    const { state: s0, players } = init();
    const firstPlayerId = players[0]?.userId;
    if (!firstPlayerId) throw new Error("No player 1");

    const [a, b] = findPair(s0);
    const r1 = memoryModule.applyIntent(s0, firstPlayerId, { cardIndex: a });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = memoryModule.applyIntent(r1.state, firstPlayerId, { cardIndex: b });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const afterMatch = r2.state as MemoryState;
    expect(afterMatch.matched).toContain(a);
    expect(afterMatch.matched).toContain(b);
    expect(afterMatch.scores[firstPlayerId]).toBe(1);
    expect(afterMatch.nextPlayerId).toBe(firstPlayerId);

    const [c, d] = findMismatch(afterMatch);
    const freeA = afterMatch.matched.includes(c)
      ? afterMatch.cards.findIndex((_, i) => !afterMatch.matched.includes(i))
      : c;
    const freeB = afterMatch.cards.findIndex(
      (card, i) =>
        i !== freeA &&
        !afterMatch.matched.includes(i) &&
        card.emoji !== afterMatch.cards[freeA].emoji
    );
    expect(freeB).toBeGreaterThanOrEqual(0);

    const r3 = memoryModule.applyIntent(afterMatch, firstPlayerId, {
      cardIndex: freeA
    });
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    const r4 = memoryModule.applyIntent(r3.state, firstPlayerId, {
      cardIndex: freeB
    });
    expect(r4.ok).toBe(true);
    if (!r4.ok) return;
    expect((r4.state as MemoryState).nextPlayerId).toBe(P2.userId);
    expect((r4.state as MemoryState).revealed).toEqual([freeA, freeB]);
    void d;
  });

  it("rejects wrong player, out-of-turn", () => {
    const { state: s } = init();
    const r = memoryModule.applyIntent(s, P2.userId, { cardIndex: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("WRONG_PLAYER");
  });

  it("clears revealed cards on subsequent turn after a mismatch", () => {
    const { state: s0 } = init();
    const [a, b] = findMismatch(s0);
    const r1 = memoryModule.applyIntent(s0, P1.userId, { cardIndex: a });
    if (!r1.ok) return;
    const r2 = memoryModule.applyIntent(r1.state, P1.userId, { cardIndex: b });
    if (!r2.ok) return;
    expect((r2.state as MemoryState).revealed).toEqual([a, b]);
    expect((r2.state as MemoryState).nextPlayerId).toBe(P2.userId);

    // Now P2 plays; the two revealed cards from P1's turn should be cleared.
    const [c] = findPair(r2.state as MemoryState);
    const r3 = memoryModule.applyIntent(r2.state, P2.userId, { cardIndex: c });
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect((r3.state as MemoryState).revealed).toEqual([c]);
  });

  it("ends as won when a single player matches every pair", () => {
    let { state: s } = init();
    const consumed = new Set<number>();
    while (consumed.size < s.cards.length) {
      let a = -1;
      let b = -1;
      for (let i = 0; i < s.cards.length; i += 1) {
        if (consumed.has(i)) continue;
        if (a === -1) {
          a = i;
          continue;
        }
        if (s.cards[i].emoji === s.cards[a].emoji) {
          b = i;
          break;
        }
      }
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      const r1 = memoryModule.applyIntent(s, P1.userId, { cardIndex: a });
      expect(r1.ok).toBe(true);
      if (!r1.ok) return;
      const r2 = memoryModule.applyIntent(r1.state, P1.userId, { cardIndex: b });
      expect(r2.ok).toBe(true);
      if (!r2.ok) return;
      s = r2.state as MemoryState;
      consumed.add(a);
      consumed.add(b);
      if (r2.outcome) {
        expect(r2.outcome).toEqual({ kind: "won", winner: P1.userId });
      }
    }
    expect(s.status).toBe("won");
    expect(s.winner).toBe(P1.userId);
  });
});
