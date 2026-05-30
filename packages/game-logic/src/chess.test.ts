import {
  applyChessIntent,
  capturedMaterialFromHistory,
  chessModule,
  initialChessState,
  kingSquareInCheck,
  legalTargetSquares,
  fenAtHistoryIndex,
  capturesAtHistoryIndex,
  randomLegalMove,
  type ChessSeat,
  type ChessState
} from "./chess";

function move(from: string, to: string, promotion?: "q" | "r" | "b" | "n") {
  return promotion
    ? { type: "move" as const, from, to, promotion }
    : { type: "move" as const, from, to };
}

function play(state: ChessState, seat: ChessSeat, from: string, to: string) {
  const res = applyChessIntent(state, seat, move(from, to));
  expect(res.error).toBeUndefined();
  return res.state;
}

describe("Chess rules", () => {
  it("applies legal moves and rotates turns", () => {
    const state = initialChessState();
    const after = applyChessIntent(state, "w", move("e2", "e4"));
    expect(after.error).toBeUndefined();
    expect(after.state.next).toBe("b");
    expect(after.state.status).toBe("playing");
    expect(after.state.fen).toContain(" b ");
  });

  it("rejects wrong player turn", () => {
    const state = initialChessState();
    const res = applyChessIntent(state, "b", move("e7", "e5"));
    expect(res.error?.code).toBe("WRONG_PLAYER");
  });

  it("rejects illegal moves", () => {
    const state = initialChessState();
    const res = applyChessIntent(state, "w", move("e2", "e5"));
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
      const res = applyChessIntent(s, seat, move(from, to));
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
      ["white", { from: "f2" as const, to: "f3" as const }],
      ["black", { from: "e7" as const, to: "e5" as const }],
      ["white", { from: "g2" as const, to: "g4" as const }],
      ["black", { from: "d8" as const, to: "h4" as const }]
    ] as const;

    let outcome: { kind: "won"; winner: string } | { kind: "draw" } | undefined;
    for (const [playerId, m] of moves) {
      const res = chessModule.applyIntent(
        state,
        playerId,
        { from: m.from, to: m.to }
      );
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

  it("accepts legacy move intent from module without type field", () => {
    const state = chessModule.initialState([
      { userId: "u1", displayName: "u1" },
      { userId: "u2", displayName: "u2" }
    ]);
    const res = chessModule.applyIntent(state, "u1", { from: "e2", to: "e4" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.next).toBe("b");
    }
  });

  it("resign lets opponent win", () => {
    const state = chessModule.initialState([
      { userId: "u1", displayName: "u1" },
      { userId: "u2", displayName: "u2" }
    ]);
    const res = chessModule.applyIntent(state, "u1", { type: "resign" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.status).toBe("won");
      expect(res.state.winner).toBe("b");
      expect(res.outcome).toEqual({ kind: "won", winner: "b" });
    }
  });

  it("rejects resign when game over", () => {
    let s = initialChessState();
    s = play(s, "w", "f2", "f3");
    s = play(s, "b", "e7", "e5");
    s = play(s, "w", "g2", "g4");
    s = play(s, "b", "d8", "h4");
    expect(s.status).toBe("won");
    const res = applyChessIntent(s, "w", { type: "resign" });
    expect(res.error?.code).toBe("GAME_OVER");
  });

  it("offer and accept draw", () => {
    const state0 = chessModule.initialState([
      { userId: "u1", displayName: "u1" },
      { userId: "u2", displayName: "u2" }
    ]);
    const r1 = chessModule.applyIntent(state0, "u1", { type: "offer_draw" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.drawOfferFrom).toBe("w");
    const r2 = chessModule.applyIntent(r1.state, "u2", { type: "accept_draw" });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.state.status).toBe("draw");
      expect(r2.state.drawReason).toBe("draw_by_agreement");
    }
  });

  it("decline clears draw offer", () => {
    const state0 = chessModule.initialState([
      { userId: "u1", displayName: "u1" },
      { userId: "u2", displayName: "u2" }
    ]);
    const r1 = chessModule.applyIntent(state0, "u1", { type: "offer_draw" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = chessModule.applyIntent(r1.state, "u2", { type: "decline_draw" });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.state.drawOfferFrom).toBeNull();
    }
  });

  it("legal move clears pending draw offer", () => {
    const state0 = chessModule.initialState([
      { userId: "u1", displayName: "u1" },
      { userId: "u2", displayName: "u2" }
    ]);
    const r1 = chessModule.applyIntent(state0, "u1", { type: "offer_draw" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = chessModule.applyIntent(r1.state, "u1", { from: "e2", to: "e4" });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.state.drawOfferFrom).toBeNull();
    }
  });
});

describe("chess helpers", () => {
  it("legalTargetSquares lists e2 pawn moves in start position", () => {
    const fen = initialChessState().fen;
    const targets = legalTargetSquares(fen, "e2");
    expect(new Set(targets)).toEqual(new Set(["e3", "e4"]));
  });

  it("capturedMaterialFromHistory counts a capture", () => {
    const history = [{ from: "e2", to: "e4" }, { from: "d7", to: "d5" }, { from: "e4", to: "d5" }];
    const cap = capturedMaterialFromHistory(history);
    expect(cap.wTakes).toContain("p");
  });

  it("kingSquareInCheck returns checked king’s square for side to move", () => {
    // Black to move, Kg8 in check from Qh7, white Ke2
    const fen = "6k1/7Q/8/8/8/8/4K3/8 b - - 0 1";
    expect(kingSquareInCheck(fen)).toBe("g8");
    expect(kingSquareInCheck(initialChessState().fen)).toBeNull();
  });
});

describe("chess time control and history replay", () => {
  it("rejects set_time_control after the first move", () => {
    let state = initialChessState({ mode: "timed", initialMs: 60000 });
    state = play(state, "w", "e2", "e4");
    const res = applyChessIntent(state, "w", {
      type: "set_time_control",
      timeControl: { mode: "none" }
    });
    expect(res.error?.code).toBe("GAME_STARTED");
  });

  it("rejects invalid time control values", () => {
    const state = initialChessState();
    const res = applyChessIntent(state, "w", {
      type: "set_time_control",
      timeControl: { mode: "timed", initialMs: 500, incrementMs: -1 }
    });
    expect(res.error?.code).toBe("BAD_INTENT");
  });

  it("leaves opponent clock untouched on white's first timed move", () => {
    let state = initialChessState({ mode: "timed", initialMs: 60000, incrementMs: 2000 });
    const res = applyChessIntent(state, "w", { type: "move", from: "e2", to: "e4" });
    expect(res.error).toBeUndefined();
    expect(res.state.clocks?.w).toBe(62000);
    expect(res.state.clocks?.b).toBe(60000);
  });

  it("check_timeout is a no-op without lastTickAt", () => {
    const state = initialChessState({ mode: "timed", initialMs: 60000 });
    const res = applyChessIntent(state, "w", { type: "check_timeout" });
    expect(res.state.status).toBe("playing");
    expect(res.state.clocks?.w).toBe(60000);
  });

  it("randomLegalMove returns a legal opening move", () => {
    const move = randomLegalMove(initialChessState().fen);
    expect(move).not.toBeNull();
    if (!move) return;
    const res = applyChessIntent(initialChessState(), "w", {
      type: "move",
      from: move.from,
      to: move.to,
      promotion: move.promotion
    });
    expect(res.error).toBeUndefined();
  });

  it("initializes clocks on timed mode and handles time control intent", () => {
    let state = initialChessState({ mode: "timed", initialMs: 60000 });
    expect(state.clocks).toEqual({ w: 60000, b: 60000 });
    expect(state.lastTickAt).toBeNull();

    // Now set a different time control
    const res = applyChessIntent(state, "w", {
      type: "set_time_control",
      timeControl: { mode: "timed", initialMs: 120000, incrementMs: 5000 }
    });
    expect(res.error).toBeUndefined();
    expect(res.state.timeControl).toEqual({ mode: "timed", initialMs: 120000, incrementMs: 5000 });
    expect(res.state.clocks).toEqual({ w: 120000, b: 120000 });
  });

  it("deducts time and adds increment on move", () => {
    let state = initialChessState({ mode: "timed", initialMs: 60000, incrementMs: 2000 });
    // First move by white sets lastTickAt but does not deduct time
    let res = applyChessIntent(state, "w", { type: "move", from: "e2", to: "e4" });
    expect(res.error).toBeUndefined();
    state = res.state;
    expect(state.lastTickAt).not.toBeNull();
    // Clocks should still be white: 60000 + 2000 increment, black: 60000 (white's move completed successfully, so increment added)
    expect(state.clocks?.w).toBe(62000);

    // Mock lastTickAt to simulate elapsed time (e.g. 10 seconds elapsed)
    const tenSecsAgo = Date.now() - 10000;
    state.lastTickAt = tenSecsAgo;

    // Black plays d7-d5. They should have 10 seconds deducted from 60000, and then get 2000 increment.
    // Remaining time: 60000 - 10000 + 2000 = 52000.
    res = applyChessIntent(state, "b", { type: "move", from: "d7", to: "d5" });
    expect(res.error).toBeUndefined();
    expect(res.state.clocks?.b).toBe(52000);
  });

  it("triggers timeout victory", () => {
    let state = initialChessState({ mode: "timed", initialMs: 60000 });
    state.lastTickAt = Date.now() - 70000; // White's turn, 70 seconds elapsed (expired!)
    
    // Check timeout manually
    let res = applyChessIntent(state, "w", { type: "check_timeout" });
    expect(res.state.status).toBe("won");
    expect(res.state.winner).toBe("b");
    expect(res.state.timeoutWinner).toBe("b");
    expect(res.state.clocks?.w).toBe(0);

    // Or trying to play a move should fail and declare opponent winner immediately
    let state2 = initialChessState({ mode: "timed", initialMs: 60000 });
    state2.lastTickAt = Date.now() - 70000;
    let resMove = applyChessIntent(state2, "w", { type: "move", from: "e2", to: "e4" });
    expect(resMove.error?.code).toBe("TIME_EXPIRED");
    expect(resMove.state.status).toBe("won");
    expect(resMove.state.winner).toBe("b");
  });

  it("correctly replays history FENs and sliced captures", () => {
    let state = initialChessState();
    state = play(state, "w", "e2", "e4"); // Move 1
    state = play(state, "b", "d7", "d5"); // Move 2
    state = play(state, "w", "e4", "d5"); // Move 3 (pawn capture!)

    expect(state.history.length).toBe(3);

    // Index 0: starting position
    const fen0 = fenAtHistoryIndex(state, 0);
    expect(fen0).toBe(initialChessState().fen);
    expect(capturesAtHistoryIndex(state.history, 0)).toEqual({ wTakes: [], bTakes: [] });

    // Index 1: after white e4
    const fen1 = fenAtHistoryIndex(state, 1);
    expect(fen1).not.toBe(fen0);
    expect(capturesAtHistoryIndex(state.history, 1)).toEqual({ wTakes: [], bTakes: [] });

    // Index 2: after black d5
    const fen2 = fenAtHistoryIndex(state, 2);
    expect(fen2).not.toBe(fen1);
    expect(capturesAtHistoryIndex(state.history, 2)).toEqual({ wTakes: [], bTakes: [] });

    // Index 3 (or live): after white takes d5
    const fen3 = fenAtHistoryIndex(state, 3);
    expect(fen3).toBe(state.fen);
    expect(capturesAtHistoryIndex(state.history, 3).wTakes).toContain("p");
  });
});
