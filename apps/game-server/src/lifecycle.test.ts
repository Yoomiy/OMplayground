import {
  cleanupStalePausedSessions,
  persistGameEnded,
  persistGameRematch,
  persistGameStopped,
  persistRecessPause
} from "./lifecycle";

/**
 * Layer 2 — persistence boundaries for game lifecycle. Uses a chained
 * mock Supabase builder so we can assert both the column payload and the
 * .eq/.lt filters each helper applies.
 */
function makeMockSupabase() {
  // PostgREST-style thenable: each filter method returns the same builder so
  // callers can keep chaining, and the builder resolves on await.
  const builder: {
    eq: jest.Mock;
    lt: jest.Mock;
    then: (
      resolve: (v: { data: null; error: null }) => void
    ) => void;
  } = {
    eq: jest.fn(),
    lt: jest.fn(),
    then: (resolve) => resolve({ data: null, error: null })
  };
  builder.eq.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  const update = jest.fn().mockReturnValue(builder);
  const from = jest.fn().mockReturnValue({ update });
  return {
    supabase: { from } as unknown as Parameters<
      typeof persistGameEnded
    >[0]["supabase"],
    from,
    update,
    eq: builder.eq,
    lt: builder.lt
  };
}

describe("persistGameEnded", () => {
  it("writes status='completed' with the final game_state and ended_at", async () => {
    const m = makeMockSupabase();
    await persistGameEnded({
      supabase: m.supabase,
      sessionId: "sess-end",
      gameState: { status: "won", winner: "X" },
      endedAt: "2026-04-21T10:00:00.000Z"
    });

    expect(m.from).toHaveBeenCalledWith("game_sessions");
    const payload = m.update.mock.calls[0][0] as {
      status: string;
      game_state: { status: string };
      ended_at: string;
      last_activity: string;
    };
    expect(payload.status).toBe("completed");
    expect(payload.game_state.status).toBe("won");
    expect(payload.ended_at).toBe("2026-04-21T10:00:00.000Z");
    expect(payload.last_activity).toBe("2026-04-21T10:00:00.000Z");
    expect(m.eq).toHaveBeenCalledWith("id", "sess-end");
  });
});

describe("persistGameRematch", () => {
  it("sets status='playing', clears ended_at and stopped_by, writes fresh game_state", async () => {
    const m = makeMockSupabase();
    const fresh = {
      board: Array(9).fill(null),
      next: "X",
      status: "playing",
      winner: null,
      winningLine: null,
      seats: {}
    };
    await persistGameRematch({
      supabase: m.supabase,
      sessionId: "sess-rematch",
      gameState: fresh,
      now: "2026-04-21T14:00:00.000Z"
    });

    const payload = m.update.mock.calls[0][0] as {
      status: string;
      game_state: typeof fresh;
      ended_at: null;
      stopped_by: null;
      last_activity: string;
    };
    expect(payload.status).toBe("playing");
    expect(payload.ended_at).toBeNull();
    expect(payload.stopped_by).toBeNull();
    expect(payload.game_state).toEqual(fresh);
    expect(payload.last_activity).toBe("2026-04-21T14:00:00.000Z");
    expect(m.eq).toHaveBeenCalledWith("id", "sess-rematch");
  });
});

describe("persistGameStopped", () => {
  it("records stopped_by alongside status='completed'", async () => {
    const m = makeMockSupabase();
    await persistGameStopped({
      supabase: m.supabase,
      sessionId: "sess-stop",
      stoppedBy: "host-user",
      gameState: { status: "playing" },
      endedAt: "2026-04-21T10:05:00.000Z"
    });

    const payload = m.update.mock.calls[0][0] as {
      status: string;
      stopped_by: string;
      ended_at: string;
    };
    expect(payload.status).toBe("completed");
    expect(payload.stopped_by).toBe("host-user");
    expect(payload.ended_at).toBe("2026-04-21T10:05:00.000Z");
    expect(m.eq).toHaveBeenCalledWith("id", "sess-stop");
  });
});

describe("persistRecessPause", () => {
  it("snapshots game_state with status='paused' on the recess boundary", async () => {
    const m = makeMockSupabase();
    const snapshot = { board: ["X", null, null], next: "O" };
    await persistRecessPause({
      supabase: m.supabase,
      sessionId: "sess-recess",
      gameState: snapshot,
      now: "2026-04-21T10:30:00.000Z"
    });

    const payload = m.update.mock.calls[0][0] as {
      status: string;
      game_state: typeof snapshot;
      last_activity: string;
    };
    expect(payload.status).toBe("paused");
    expect(payload.game_state).toEqual(snapshot);
    expect(payload.last_activity).toBe("2026-04-21T10:30:00.000Z");
    expect(m.eq).toHaveBeenCalledWith("id", "sess-recess");
  });
});

describe("cleanupStalePausedSessions", () => {
  it("ages only paused rows whose last_activity is older than the cutoff", async () => {
    const m = makeMockSupabase();
    const now = new Date("2026-04-22T12:00:00.000Z");
    await cleanupStalePausedSessions({
      supabase: m.supabase,
      olderThanMs: 24 * 60 * 60 * 1000,
      now
    });

    expect(m.from).toHaveBeenCalledWith("game_sessions");
    const payload = m.update.mock.calls[0][0] as {
      status: string;
      ended_at: string;
    };
    expect(payload.status).toBe("completed");
    expect(payload.ended_at).toBe(now.toISOString());
    expect(m.eq).toHaveBeenCalledWith("status", "paused");
    expect(m.lt).toHaveBeenCalledWith(
      "last_activity",
      "2026-04-21T12:00:00.000Z"
    );
  });
});
