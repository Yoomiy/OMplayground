import { getGameModule } from "@playground/game-logic";
import {
  cleanupStalePausedSessions,
  persistAdmissionHeartbeat,
  persistGameEnded,
  persistGameRematch,
  persistGameStopped,
  persistRecessPause
} from "./lifecycle";
import { assignPlayer, deleteRoom, getOrCreateRoom, type DrawingRoomContext } from "./room";

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
    in: jest.Mock;
    not: jest.Mock;
    lt: jest.Mock;
    then: (
      resolve: (v: { data: null; error: null }) => void
    ) => void;
  } = {
    eq: jest.fn(),
    in: jest.fn(),
    not: jest.fn(),
    lt: jest.fn(),
    then: (resolve) => resolve({ data: null, error: null })
  };
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.not.mockReturnValue(builder);
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
    in: builder.in,
    not: builder.not,
    lt: builder.lt
  };
}

describe("persistAdmissionHeartbeat", () => {
  const sessionId = "drawing-session";

  function drawingRoom(drawingContext: DrawingRoomContext) {
    return getOrCreateRoom(sessionId, {
      gameId: "drawing-game",
      gameKey: "drawing",
      module: getGameModule("drawing")!,
      drawingContext,
      gender: "all",
      hostId: null
    });
  }

  afterEach(() => deleteRoom(sessionId));

  it("keeps classroom guest and delegate identities out of game presence writes", async () => {
    const m = makeMockSupabase();
    const room = drawingRoom({ boardMode: "classroom", classroomId: "classroom", roomCode: "ROOM" });
    assignPlayer(room, "guest-example", "Guest");
    assignPlayer(room, "delegate:7f6bf31a-c984-4ce9-973d-45296fdacb9e", "Cohost");
    expect(room.players.size).toBe(2);

    await persistAdmissionHeartbeat(m.supabase, room);

    expect(m.from).not.toHaveBeenCalled();
  });

  it("renews presence for an ordinary drawing game with the IDs and names in the same order", async () => {
    const m = makeMockSupabase();
    const room = drawingRoom({ boardMode: "game" });
    const firstUserId = "12ce6b29-a7a4-48d7-8dee-c817c61e97dd";
    const secondUserId = "9b1f8d89-166b-4297-a452-a318c41b8ca1";
    assignPlayer(room, firstUserId, "First player");
    assignPlayer(room, secondUserId, "Second player");

    await persistAdmissionHeartbeat(m.supabase, room);

    expect(m.from).toHaveBeenCalledWith("game_sessions");
    expect(m.update).toHaveBeenCalledWith({
      connected_player_ids: [firstUserId, secondUserId],
      connected_player_names: ["First player", "Second player"]
    });
    expect(m.eq).toHaveBeenCalledWith("id", sessionId);
    expect(m.in).toHaveBeenCalledWith("status", ["waiting", "playing"]);
  });
});

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
    expect(m.not).toHaveBeenCalledWith("invitation_code", "like", "class-draw-%");
    expect(m.lt).toHaveBeenCalledWith(
      "last_activity",
      "2026-04-21T12:00:00.000Z"
    );
  });
});
