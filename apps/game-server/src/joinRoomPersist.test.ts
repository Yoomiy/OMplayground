import { persistPlayerJoin } from "./sessionPersistence";

/**
 * Layer 2 — verifies game_sessions row persistence on JOIN_ROOM.
 * The hot path in index.ts calls `persistPlayerJoin`, and we assert it:
 *   - issues an update when a new kid joins
 *   - short-circuits (no update) when an existing kid reconnects
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

  it("does not issue an update when an existing kid reconnects", async () => {
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
      roomStatusIsIdle: false
    });
    expect(wrote).toBe(false);
    expect(m.from).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
});
