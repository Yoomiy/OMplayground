import {
  applyChessIntent,
  chessModule,
  initialChessState,
  type ChessSeat,
  type ChessState
} from "./chess";

function play(state: ChessState, seat: ChessSeat, from: string, to: string) {
  const res = applyChessIntent(state, seat, { from, to });
  expect(res.error).toBeUndefined();
  return res.state;
}

describe("Chess rules", () => {
  it("applies legal moves and rotates turns", () => {
    const state = initialChessState();
    const after = applyChessIntent(state, "w", { from: "e2", to: "e4" });
    expect(after.error).toBeUndefined();
    expect(after.state.next).toBe("b");
    expect(after.state.status).toBe("playing");
    expect(after.state.fen).toContain(" b ");
  });

  it("rejects wrong player turn", () => {
    const state = initialChessState();
    const res = applyChessIntent(state, "b", { from: "e7", to: "e5" });
    expect(res.error?.code).toBe("WRONG_PLAYER");
  });

  it("rejects illegal moves", () => {
    const state = initialChessState();
    const res = applyChessIntent(state, "w", { from: "e2", to: "e5" });
    expect(res.error?.code).toBe("ILLEGAL_MOVE");
  });

  it("declares winner on checkmate (fool's mate)", () => {
    let s = initialChessState();
    s = play(s, "w", "f2", "f3");
    s = play(s, "b", "e7", "e5");
    s = play(s, "w", "g2", "g4");
    s = play(s, "b", "d8", "h4");
    expect(s.status).toBe("won");
    expect(s.winner).toBe("b");
  });

  it("returns draw on threefold repetition", () => {
    let s = initialChessState();
    const seq: Array<[ChessSeat, string, string]> = [
      ["w", "g1", "f3"],
      ["b", "g8", "f6"],
      ["w", "f3", "g1"],
      ["b", "f6", "g8"],
      ["w", "g1", "f3"],
      ["b", "g8", "f6"],
      ["w", "f3", "g1"],
      ["b", "f6", "g8"]
    ];
    for (const [seat, from, to] of seq) {
      const res = applyChessIntent(s, seat, { from, to });
      expect(res.error).toBeUndefined();
      s = res.state;
    }
    expect(s.status).toBe("draw");
    expect(s.drawReason).toBe("threefold_repetition");
  });

  it("module validates unknown intent payload", () => {
    const state = chessModule.initialState([
      { userId: "u1", displayName: "u1" },
      { userId: "u2", displayName: "u2" }
    ]);
    const res = chessModule.applyIntent(state, "u1", { to: "e4" } as never);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("BAD_INTENT");
    }
  });

  it("module returns outcome when game reaches checkmate", () => {
    let state = chessModule.initialState([
      { userId: "white", displayName: "white" },
      { userId: "black", displayName: "black" }
    ]);
    const moves = [
      ["white", { from: "f2", to: "f3" }],
      ["black", { from: "e7", to: "e5" }],
      ["white", { from: "g2", to: "g4" }],
      ["black", { from: "d8", to: "h4" }]
    ] as const;

    let outcome: { kind: "won"; winner: string } | { kind: "draw" } | undefined;
    for (const [playerId, intent] of moves) {
      const res = chessModule.applyIntent(state, playerId, intent);
      expect(res.ok).toBe(true);
      if (res.ok) {
        state = res.state;
        outcome = res.outcome;
      }
    }

    expect(state.status).toBe("won");
    expect(state.winner).toBe("b");
    expect(outcome).toEqual({ kind: "won", winner: "b" });
  });
});
