import { persistPlayerJoin } from "./sessionPersistence";

/**
 * Layer 2 — verifies game_sessions row persistence on JOIN_ROOM.
 * The hot path in index.ts calls `persistPlayerJoin`, and we assert it:
 *   - issues an update when a new kid joins
 *   - short-circuits when an existing kid reconnects (unless resuming `paused`)
 */
describe("persistPlayerJoin", () => {
  function makeMockSupabase() {
    const eq = jest.fn().mockResolvedValue({ data: null, error: null });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });
    return {
      supabase: { from } as unknown as Parameters<
        typeof persistPlayerJoin
      >[0]["supabase"],
      from,
      update,
      eq
    };
  }

  it("issues a game_sessions update when a new kid joins", async () => {
    const m = makeMockSupabase();
    const wrote = await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-1",
      session: {
        player_ids: ["host-1"],
        player_names: ["Host"],
        status: "waiting"
      },
      userId: "guest-1",
      displayName: "Guest",
      roomStatusIsIdle: true
    });

    expect(wrote).toBe(true);
    expect(m.from).toHaveBeenCalledWith("game_sessions");
    expect(m.update).toHaveBeenCalledTimes(1);
    const payload = m.update.mock.calls[0][0] as {
      player_ids: string[];
      player_names: string[];
      status: string;
    };
    expect(payload.player_ids).toEqual(["host-1", "guest-1"]);
    expect(payload.player_names).toEqual(["Host", "Guest"]);
    expect(payload.status).toBe("waiting");
    expect(m.eq).toHaveBeenCalledWith("id", "sess-1");
  });

  it("flips status to 'playing' when room state has left idle", async () => {
    const m = makeMockSupabase();
    await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-2",
      session: {
        player_ids: ["host-1"],
        player_names: ["Host"],
        status: "waiting"
      },
      userId: "guest-1",
      displayName: "Guest",
      roomStatusIsIdle: false
    });
    const payload = m.update.mock.calls[0][0] as { status: string };
    expect(payload.status).toBe("playing");
  });

  it("updates presence when an existing kid reconnects", async () => {
    const m = makeMockSupabase();
    const wrote = await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-3",
      session: {
        player_ids: ["host-1", "guest-1"],
        player_names: ["Host", "Guest"],
        status: "playing"
      },
      userId: "guest-1",
      displayName: "Guest",
      connectedPlayerIds: ["host-1", "guest-1"],
      connectedPlayerNames: ["Host", "Guest"],
      roomStatusIsIdle: false
    });
    expect(wrote).toBe(false);
    expect(m.from).toHaveBeenCalledWith("game_sessions");
    const payload = m.update.mock.calls[0][0] as {
      connected_player_ids: string[];
      connected_player_names: string[];
    };
    expect(payload.connected_player_ids).toEqual(["host-1", "guest-1"]);
    expect(payload.connected_player_names).toEqual(["Host", "Guest"]);
  });

  it("keeps paused status while a listed kid rejoins an idle paused room", async () => {
    const m = makeMockSupabase();
    const wrote = await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-paused",
      session: {
        player_ids: ["kid-1"],
        player_names: ["Kid"],
        status: "paused"
      },
      userId: "kid-1",
      displayName: "Kid",
      connectedPlayerIds: ["kid-1"],
      connectedPlayerNames: ["Kid"],
      roomStatusIsIdle: true
    });
    expect(wrote).toBe(false);
    expect(m.from).toHaveBeenCalledWith("game_sessions");
    expect(m.update).toHaveBeenCalledTimes(1);
    const payload = m.update.mock.calls[0][0] as {
      status?: string;
      connected_player_ids: string[];
    };
    expect(payload.status).toBeUndefined();
    expect(payload.connected_player_ids).toEqual(["kid-1"]);
  });

  it("keeps paused status while a listed kid rejoins an active paused room", async () => {
    const m = makeMockSupabase();
    await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-paused-2",
      session: {
        player_ids: ["a", "b"],
        player_names: ["A", "B"],
        status: "paused"
      },
      userId: "a",
      displayName: "A",
      connectedPlayerIds: ["a"],
      connectedPlayerNames: ["A"],
      roomStatusIsIdle: false
    });
    const payload = m.update.mock.calls[0][0] as {
      status?: string;
      connected_player_ids: string[];
    };
    expect(payload.status).toBeUndefined();
    expect(payload.connected_player_ids).toEqual(["a"]);
  });

  it("keeps status 'completed' when a new kid joins after a finished game (room not idle)", async () => {
    const m = makeMockSupabase();
    await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-completed",
      session: {
        player_ids: ["host-1"],
        player_names: ["Host"],
        status: "completed"
      },
      userId: "guest-1",
      displayName: "Guest",
      roomStatusIsIdle: false
    });
    const payload = m.update.mock.calls[0][0] as { status: string };
    expect(payload.status).toBe("completed");
  });

  it("updates presence when a kid reconnects to a completed live session", async () => {
    const m = makeMockSupabase();
    const wrote = await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-completed-2",
      session: {
        player_ids: ["host-1", "guest-1"],
        player_names: ["Host", "Guest"],
        status: "completed"
      },
      userId: "guest-1",
      displayName: "Guest",
      connectedPlayerIds: ["host-1", "guest-1"],
      connectedPlayerNames: ["Host", "Guest"],
      roomStatusIsIdle: false
    });
    expect(wrote).toBe(false);
    expect(m.from).toHaveBeenCalledWith("game_sessions");
    const payload = m.update.mock.calls[0][0] as {
      connected_player_ids: string[];
    };
    expect(payload.connected_player_ids).toEqual(["host-1", "guest-1"]);
  });
});
