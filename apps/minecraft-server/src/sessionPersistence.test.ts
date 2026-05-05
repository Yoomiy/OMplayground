import {
  persistGamePaused,
  persistGameResumed,
  persistGameStopped,
  persistPlayerJoin,
  persistPlayerLeave
} from "./sessionPersistence";

/**
 * Layer 2 — verifies game_sessions persistence helpers issue the right
 * UPDATEs with a chained mock Supabase builder. Mirrors the lifecycle
 * tests in apps/game-server.
 */

function makeMockSupabase() {
  const builder: {
    eq: jest.Mock;
    in: jest.Mock;
    then: (resolve: (v: { data: null; error: null }) => void) => void;
  } = {
    eq: jest.fn(),
    in: jest.fn(),
    then: (resolve) => resolve({ data: null, error: null })
  };
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  const update = jest.fn().mockReturnValue(builder);
  const maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: { grade: 4, full_name: "Guest" }, error: null });
  const eqKp = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq: eqKp });
  const from = jest.fn((table: string) => {
    if (table === "kid_profiles") {
      return { select };
    }
    return { update };
  });
  return {
    supabase: { from } as unknown as Parameters<
      typeof persistPlayerJoin
    >[0]["supabase"],
    from,
    update,
    eq: builder.eq,
    in: builder.in,
    select,
    eqKp,
    maybeSingle
  };
}

describe("persistPlayerJoin", () => {
  it("flips status to playing for a fresh kid joining a waiting voxel session", async () => {
    const m = makeMockSupabase();
    const wrote = await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-mc-1",
      session: {
        player_ids: ["host"],
        player_names: ["Host"],
        status: "waiting"
      },
      userId: "guest",
      displayName: "Guest",
      roomStatusIsIdle: false
    });
    expect(wrote).toBe(true);
    const payload = m.update.mock.calls[0][0] as {
      player_ids: string[];
      status: string;
    };
    expect(payload.player_ids).toEqual(["host", "guest"]);
    expect(payload.status).toBe("playing");
    expect(m.eq).toHaveBeenCalledWith("id", "sess-mc-1");
  });

  it("keeps paused status while a roster kid rejoins a paused voxel session", async () => {
    const m = makeMockSupabase();
    const wrote = await persistPlayerJoin({
      supabase: m.supabase,
      sessionId: "sess-mc-paused",
      session: {
        player_ids: ["kid"],
        player_names: ["Kid"],
        status: "paused"
      },
      userId: "kid",
      displayName: "Kid",
      roomStatusIsIdle: false
    });
    expect(wrote).toBe(false);
    const payload = m.update.mock.calls[0][0] as { status?: string };
    expect(payload.status).toBeUndefined();
  });
});

describe("persistPlayerLeave", () => {
  it("writes status='paused' with the voxel game_state when the room empties", async () => {
    const m = makeMockSupabase();
    await persistPlayerLeave({
      supabase: m.supabase,
      sessionId: "sess-mc-leave",
      result: { roomEmpty: true },
      gameState: {
        voxel: true,
        seed: 42,
        deltas: [[1, 50, 1, 4]],
        spawnPoints: { kid: [0, 11, 0] }
      }
    });
    expect(m.update).toHaveBeenCalledTimes(1);
    const payload = m.update.mock.calls[0][0] as {
      status: string;
      game_state: { voxel: boolean; seed: number };
    };
    expect(payload.status).toBe("paused");
    expect(payload.game_state.voxel).toBe(true);
    expect(payload.game_state.seed).toBe(42);
    expect(m.in).toHaveBeenCalledWith(
      "status",
      ["waiting", "playing", "paused"]
    );
  });

  it("writes the new host_id when the host leaves with others remaining", async () => {
    const m = makeMockSupabase();
    await persistPlayerLeave({
      supabase: m.supabase,
      sessionId: "sess-mc-host",
      result: { roomEmpty: false, newHostId: "next-host" }
    });
    expect(m.from).toHaveBeenCalledWith("kid_profiles");
    expect(m.update).toHaveBeenCalledTimes(1);
    const payload = m.update.mock.calls[0][0] as {
      host_id: string;
      host_name: string;
      host_grade: number;
    };
    expect(payload.host_id).toBe("next-host");
    expect(payload.host_name).toBe("Guest");
    expect(payload.host_grade).toBe(4);
  });
});

describe("lifecycle persistence", () => {
  it("persistGamePaused snapshots voxel game_state with status='paused'", async () => {
    const m = makeMockSupabase();
    await persistGamePaused({
      supabase: m.supabase,
      sessionId: "sess-pause",
      gameState: {
        voxel: true,
        seed: 1,
        deltas: [],
        spawnPoints: {}
      },
      now: "2026-04-21T10:30:00.000Z"
    });
    const payload = m.update.mock.calls[0][0] as {
      status: string;
      game_state: { voxel: boolean };
      last_activity: string;
    };
    expect(payload.status).toBe("paused");
    expect(payload.game_state.voxel).toBe(true);
    expect(payload.last_activity).toBe("2026-04-21T10:30:00.000Z");
  });

  it("persistGameResumed sets status='playing' without writing game_state", async () => {
    const m = makeMockSupabase();
    await persistGameResumed({
      supabase: m.supabase,
      sessionId: "sess-resume",
      connectedPlayerIds: ["a", "b"],
      connectedPlayerNames: ["A", "B"],
      now: "2026-04-21T11:00:00.000Z"
    });
    const payload = m.update.mock.calls[0][0] as {
      status: string;
      game_state?: unknown;
    };
    expect(payload.status).toBe("playing");
    expect(payload.game_state).toBeUndefined();
  });

  it("persistGameStopped records stopped_by and is_open=false", async () => {
    const m = makeMockSupabase();
    await persistGameStopped({
      supabase: m.supabase,
      sessionId: "sess-stop",
      stoppedBy: "host-user",
      gameState: {
        voxel: true,
        seed: 1,
        deltas: [],
        spawnPoints: {}
      },
      endedAt: "2026-04-21T12:00:00.000Z"
    });
    const payload = m.update.mock.calls[0][0] as {
      status: string;
      stopped_by: string;
      is_open: boolean;
      ended_at: string;
    };
    expect(payload.status).toBe("completed");
    expect(payload.stopped_by).toBe("host-user");
    expect(payload.is_open).toBe(false);
    expect(payload.ended_at).toBe("2026-04-21T12:00:00.000Z");
  });
});
