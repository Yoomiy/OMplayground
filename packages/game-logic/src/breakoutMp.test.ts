import { breakoutMpModule } from "./breakoutMp";

describe("Breakout Multiplayer rules", () => {
  it("initializes state with two players", () => {
    const players = [
      { userId: "u1", displayName: "Player 1" },
      { userId: "u2", displayName: "Player 2" }
    ];
    const state = breakoutMpModule.initialState(players);

    expect(state.seats).toEqual({
      u1: "A",
      u2: "B"
    });
    expect(state.status).toBe("playing");
    expect(state.winner).toBeNull();
    expect(typeof state.seed).toBe("number");
    expect(state.seed).toBeGreaterThan(0);
  });

  it("handles winning report-end intent", () => {
    const players = [
      { userId: "u1", displayName: "Player 1" },
      { userId: "u2", displayName: "Player 2" }
    ];
    const base = breakoutMpModule.initialState(players);

    const res = breakoutMpModule.applyIntent(base, "u1", {
      kind: "report-end",
      result: "won"
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.status).toBe("won");
      expect(res.state.winner).toBe("both");
      expect(res.outcome).toEqual({
        kind: "won",
        winner: "both"
      });
    }
  });

  it("handles losing report-end intent", () => {
    const players = [
      { userId: "u1", displayName: "Player 1" },
      { userId: "u2", displayName: "Player 2" }
    ];
    const base = breakoutMpModule.initialState(players);

    const res = breakoutMpModule.applyIntent(base, "u2", {
      kind: "report-end",
      result: "lost"
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.status).toBe("lost");
      expect(res.state.winner).toBeNull();
      expect(res.outcome).toEqual({
        kind: "won",
        winner: "none"
      });
    }
  });

  it("rejects intent from non-seated player", () => {
    const players = [
      { userId: "u1", displayName: "Player 1" },
      { userId: "u2", displayName: "Player 2" }
    ];
    const base = breakoutMpModule.initialState(players);

    const res = breakoutMpModule.applyIntent(base, "u3", {
      kind: "report-end",
      result: "won"
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("NOT_IN_ROOM");
    }
  });

  it("isTerminal works correctly", () => {
    const players = [
      { userId: "u1", displayName: "Player 1" },
      { userId: "u2", displayName: "Player 2" }
    ];
    const base = breakoutMpModule.initialState(players);

    expect(breakoutMpModule.isTerminal(base)).toBe(false);

    const wonRes = breakoutMpModule.applyIntent(base, "u1", {
      kind: "report-end",
      result: "won"
    });
    if (wonRes.ok) {
      expect(breakoutMpModule.isTerminal(wonRes.state)).toBe(true);
    }

    const lostRes = breakoutMpModule.applyIntent(base, "u1", {
      kind: "report-end",
      result: "lost"
    });
    if (lostRes.ok) {
      expect(breakoutMpModule.isTerminal(lostRes.state)).toBe(true);
    }
  });
});
