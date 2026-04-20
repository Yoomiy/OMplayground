import { tictactoeModule } from "@playground/game-logic";
import { persistGameStopped } from "./lifecycle";
import {
  assignPlayer,
  canStopGame,
  getOrCreateRoom
} from "./room";

/**
 * Milestone A — STOP_GAME intent.
 * We test the two pieces the socket handler composes:
 *   1. canStopGame: host-only guard.
 *   2. persistGameStopped: session row gets status='completed' + stopped_by.
 * The socket emit itself is covered by Socket.io's own room semantics
 * (see roomIsolation.test.ts); duplicating it here would add no signal.
 */
describe("STOP_GAME / canStopGame guard", () => {
  it("allows the host to stop the game", () => {
    const room = getOrCreateRoom("sess-stop-1", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    });
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");

    const res = canStopGame(room, "host-user");
    expect(res.ok).toBe(true);
  });

  it("rejects a non-host with NOT_HOST", () => {
    const room = getOrCreateRoom("sess-stop-2", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    });
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");

    const res = canStopGame(room, "guest-user");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("NOT_HOST");
    }
  });

  it("rejects a caller that is not in the room with NOT_IN_ROOM", () => {
    const room = getOrCreateRoom("sess-stop-3", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    });
    assignPlayer(room, "host-user", "Host");

    const res = canStopGame(room, "stranger");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("NOT_IN_ROOM");
    }
  });
});

describe("STOP_GAME persistence", () => {
  it("writes status='completed' with stopped_by=hostId", async () => {
    const eq = jest.fn().mockResolvedValue({ data: null, error: null });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });
    const supabase = { from } as unknown as Parameters<
      typeof persistGameStopped
    >[0]["supabase"];

    await persistGameStopped({
      supabase,
      sessionId: "sess-stop-4",
      stoppedBy: "host-user",
      gameState: { status: "playing", board: [null, null, null] },
      endedAt: "2026-04-21T12:00:00.000Z"
    });

    const payload = update.mock.calls[0][0] as {
      status: string;
      stopped_by: string;
      ended_at: string;
    };
    expect(payload.status).toBe("completed");
    expect(payload.stopped_by).toBe("host-user");
    expect(payload.ended_at).toBe("2026-04-21T12:00:00.000Z");
    expect(eq).toHaveBeenCalledWith("id", "sess-stop-4");
  });
});
