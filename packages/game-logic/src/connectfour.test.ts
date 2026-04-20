import {
  applyConnectFourIntent,
  connectfourModule,
  initialConnectFourState,
  type ConnectFourState
} from "./connectfour";

describe("Connect Four rules", () => {
  it("drops pieces to the lowest open row", () => {
    let s = initialConnectFourState();
    let r = applyConnectFourIntent(s, { type: "DROP", column: 2, player: "R" });
    expect(r.error).toBeUndefined();
    s = r.state;
    r = applyConnectFourIntent(s, { type: "DROP", column: 2, player: "Y" });
    expect(r.error).toBeUndefined();
    s = r.state;
    expect(s.board[5][2]).toBe("R");
    expect(s.board[4][2]).toBe("Y");
  });

  it("declares winner on horizontal line", () => {
    let s: ConnectFourState = initialConnectFourState();
    const seq: Array<[number, "R" | "Y"]> = [
      [0, "R"],
      [0, "Y"],
      [1, "R"],
      [1, "Y"],
      [2, "R"],
      [2, "Y"],
      [3, "R"]
    ];
    for (const [column, player] of seq) {
      const r = applyConnectFourIntent(s, { type: "DROP", column, player });
      expect(r.error).toBeUndefined();
      s = r.state;
    }
    expect(s.status).toBe("won");
    expect(s.winner).toBe("R");
  });

  it("rejects move in full column", () => {
    let s = initialConnectFourState();
    for (let i = 0; i < 6; i += 1) {
      const player = i % 2 === 0 ? "R" : "Y";
      const r = applyConnectFourIntent(s, { type: "DROP", column: 4, player });
      expect(r.error).toBeUndefined();
      s = r.state;
    }
    const r = applyConnectFourIntent(s, { type: "DROP", column: 4, player: "R" });
    expect(r.error?.code).toBe("COLUMN_FULL");
  });

  it("module rejects bad intent and wrong player", () => {
    const base = connectfourModule.initialState([
      { userId: "u1", displayName: "A" },
      { userId: "u2", displayName: "B" }
    ]);
    const bad = connectfourModule.applyIntent(base, "u1", {} as unknown as { column: number });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("BAD_INTENT");

    const wrong = connectfourModule.applyIntent(base, "u2", { column: 0 });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("WRONG_PLAYER");
  });
});
