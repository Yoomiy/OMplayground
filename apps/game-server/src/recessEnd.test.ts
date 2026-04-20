import {
  createRecessSweepState,
  recessEndSweep,
  type RecessIoShape
} from "./recessSweep";
import type { TicTacToeRoom } from "./tictactoeRoom";
import { initialTicTacToeState } from "@playground/game-logic";

/**
 * Milestone A — recess-end eviction.
 * We pin the clock at a known recess window and then flip it outside, and
 * assert:
 *   - on the flip tick, persistRecessPause was called per live room with
 *     status='paused' + game_state preserved,
 *   - ROOM_EVENT { kind: 'RECESS_ENDED' } was emitted to each room,
 *   - kid sockets got disconnect(true),
 *   - the room was removed from the in-memory map.
 */
const SCHEDULES = [
  {
    day_of_week: 0,
    start_time: "00:00",
    end_time: "23:59",
    is_active: true
  },
  {
    day_of_week: 1,
    start_time: "00:00",
    end_time: "23:59",
    is_active: true
  },
  {
    day_of_week: 2,
    start_time: "00:00",
    end_time: "23:59",
    is_active: true
  },
  {
    day_of_week: 3,
    start_time: "00:00",
    end_time: "23:59",
    is_active: true
  },
  {
    day_of_week: 4,
    start_time: "10:00",
    end_time: "10:15",
    is_active: true
  },
  {
    day_of_week: 5,
    start_time: "00:00",
    end_time: "23:59",
    is_active: true
  },
  {
    day_of_week: 6,
    start_time: "00:00",
    end_time: "23:59",
    is_active: true
  }
];

function buildMockIo() {
  const emit = jest.fn();
  const disconnect = jest.fn();
  const fetchSockets = jest
    .fn<
      Promise<
        { data: { role?: string }; disconnect(close: boolean): void }[]
      >,
      []
    >()
    .mockResolvedValue([{ data: { role: "kid" }, disconnect }]);
  const io: RecessIoShape = {
    to: jest.fn().mockReturnValue({ emit }),
    in: jest.fn().mockReturnValue({ fetchSockets })
  };
  return { io, emit, disconnect, fetchSockets };
}

function buildMockSupabase() {
  const eq = jest.fn().mockResolvedValue({ data: null, error: null });
  const update = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ update });
  const supabase = { from } as unknown;
  return { supabase, from, update, eq };
}

function roomWithState(sessionId: string): TicTacToeRoom {
  return {
    sessionId,
    gameId: "g1",
    gender: "boy",
    hostId: "host-user",
    minPlayers: 2,
    state: initialTicTacToeState(),
    players: new Map()
  };
}

describe("recessEndSweep", () => {
  it("no-ops on a single tick while recess is still active", async () => {
    const { io, emit } = buildMockIo();
    const { supabase, update } = buildMockSupabase();
    const state = createRecessSweepState();

    const room = roomWithState("sess-r1");
    const removed: string[] = [];

    const inRecess = new Date("2026-04-19T09:00:00Z"); // Sun 12:00 Jerusalem, inside full-day window
    const { evictedSessionIds } = await recessEndSweep(state, {
      supabase: supabase as never,
      loadSchedules: async () => SCHEDULES,
      io,
      now: () => inRecess,
      rooms: () => [room],
      remove: (id) => removed.push(id)
    });

    expect(evictedSessionIds).toEqual([]);
    expect(update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it("evicts rooms + persists pause + closes kid sockets on the flip tick", async () => {
    const { io, emit, disconnect } = buildMockIo();
    const { supabase, update, eq } = buildMockSupabase();
    const state = createRecessSweepState();

    const room = roomWithState("sess-r2");
    const removed: string[] = [];

    // Tick 1: inside a full-day window for Sun (day_of_week 0), Jerusalem time.
    const tick1 = new Date("2026-04-19T09:00:00Z"); // Sun Jerusalem 12:00
    await recessEndSweep(state, {
      supabase: supabase as never,
      loadSchedules: async () => SCHEDULES,
      io,
      now: () => tick1,
      rooms: () => [room],
      remove: (id) => removed.push(id)
    });
    expect(state.activeLastTick).toBe(true);

    // Tick 2: Thursday 13:00 Jerusalem — outside the 10:00-10:15 window.
    const tick2 = new Date("2026-04-16T10:00:00Z"); // Thu 13:00 Jerusalem, outside window
    const { evictedSessionIds } = await recessEndSweep(state, {
      supabase: supabase as never,
      loadSchedules: async () => SCHEDULES,
      io,
      now: () => tick2,
      rooms: () => [room],
      remove: (id) => removed.push(id)
    });

    expect(evictedSessionIds).toEqual(["sess-r2"]);
    const payload = update.mock.calls[0][0] as {
      status: string;
      game_state: unknown;
      last_activity: string;
    };
    expect(payload.status).toBe("paused");
    expect(payload.game_state).toEqual(room.state);
    expect(payload.last_activity).toBe(tick2.toISOString());
    expect(eq).toHaveBeenCalledWith("id", "sess-r2");

    expect(io.to).toHaveBeenCalledWith("session:sess-r2");
    expect(emit).toHaveBeenCalledWith(
      "ROOM_EVENT",
      expect.objectContaining({
        sessionId: "sess-r2",
        kind: "RECESS_ENDED"
      })
    );
    expect(disconnect).toHaveBeenCalledWith(true);
    expect(removed).toEqual(["sess-r2"]);
  });

  it("skips disconnecting non-kid sockets (teachers stay connected)", async () => {
    const emit = jest.fn();
    const kidDisconnect = jest.fn();
    const teacherDisconnect = jest.fn();
    const fetchSockets = jest.fn().mockResolvedValue([
      { data: { role: "kid" }, disconnect: kidDisconnect },
      { data: { role: "teacher" }, disconnect: teacherDisconnect }
    ]);
    const io: RecessIoShape = {
      to: jest.fn().mockReturnValue({ emit }),
      in: jest.fn().mockReturnValue({ fetchSockets })
    };
    const { supabase } = buildMockSupabase();
    const state = createRecessSweepState();
    state.activeLastTick = true; // shortcut: already in-recess last tick.

    const tick = new Date("2026-04-16T10:00:00Z"); // Thu 13:00 Jerusalem, outside window
    await recessEndSweep(state, {
      supabase: supabase as never,
      loadSchedules: async () => SCHEDULES,
      io,
      now: () => tick,
      rooms: () => [roomWithState("sess-r3")],
      remove: () => {}
    });

    expect(kidDisconnect).toHaveBeenCalledWith(true);
    expect(teacherDisconnect).not.toHaveBeenCalled();
  });
});
