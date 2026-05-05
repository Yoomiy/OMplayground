import {
  createRecessSweepState,
  recessEndSweep,
  type RecessIoShape
} from "./recessSweep";
import { __resetRoomsForTest, getOrCreateRoom, type VoxelRoom } from "./room";
import { applyDelta } from "./world";
import { BLOCK_REGISTRY } from "./protocol";

beforeEach(() => __resetRoomsForTest());

const SCHEDULES = [
  { day_of_week: 0, start_time: "00:00", end_time: "23:59", is_active: true },
  { day_of_week: 1, start_time: "00:00", end_time: "23:59", is_active: true },
  { day_of_week: 2, start_time: "00:00", end_time: "23:59", is_active: true },
  { day_of_week: 3, start_time: "00:00", end_time: "23:59", is_active: true },
  { day_of_week: 4, start_time: "10:00", end_time: "10:15", is_active: true },
  { day_of_week: 5, start_time: "00:00", end_time: "23:59", is_active: true },
  { day_of_week: 6, start_time: "00:00", end_time: "23:59", is_active: true }
];

function buildMockIo() {
  const emit = jest.fn();
  const disconnect = jest.fn();
  const fetchSockets = jest
    .fn()
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
  return { supabase: { from } as unknown, from, update, eq };
}

function makeRoom(sessionId: string): VoxelRoom {
  const room = getOrCreateRoom(sessionId, {
    gameId: "game-mc",
    gender: "boy",
    hostId: "host-user",
    minPlayers: 1,
    maxPlayers: 4,
    roster: [{ userId: "host-user", displayName: "Host" }],
    paused: false
  });
  applyDelta(room.world, 0, 50, 0, BLOCK_REGISTRY.WOOD);
  return room;
}

describe("recessEndSweep — voxel rooms", () => {
  it("no-ops on a steady-state in-recess tick", async () => {
    const { io, emit } = buildMockIo();
    const { supabase, update } = buildMockSupabase();
    const state = createRecessSweepState();

    await recessEndSweep(state, {
      supabase: supabase as never,
      loadSchedules: async () => SCHEDULES,
      io,
      now: () => new Date("2026-04-19T09:00:00Z"),
      rooms: () => [makeRoom("sess-mc-r1")],
      remove: () => {}
    });

    expect(update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("evicts voxel rooms with status='paused' + voxel game_state on the flip tick, room scope only", async () => {
    const { io, emit, disconnect } = buildMockIo();
    const { supabase, update } = buildMockSupabase();
    const state = createRecessSweepState();
    state.activeLastTick = true;

    const room = makeRoom("sess-mc-flip");
    const removed: string[] = [];

    const { evictedSessionIds } = await recessEndSweep(state, {
      supabase: supabase as never,
      loadSchedules: async () => SCHEDULES,
      io,
      now: () => new Date("2026-04-16T10:00:00Z"),
      rooms: () => [room],
      remove: (id) => removed.push(id)
    });

    expect(evictedSessionIds).toEqual(["sess-mc-flip"]);
    const payload = update.mock.calls[0][0] as {
      status: string;
      game_state: { voxel: boolean; seed: number; deltas: unknown[] };
    };
    expect(payload.status).toBe("paused");
    expect(payload.game_state.voxel).toBe(true);
    expect(payload.game_state.seed).toBe(room.world.seed);
    expect(payload.game_state.deltas.length).toBeGreaterThanOrEqual(1);
    expect(io.to).toHaveBeenCalledWith("voxel:sess-mc-flip");
    expect(emit).toHaveBeenCalledWith(
      "ROOM_EVENT",
      expect.objectContaining({ kind: "RECESS_ENDED" })
    );
    expect(disconnect).toHaveBeenCalledWith(true);
    expect(removed).toEqual(["sess-mc-flip"]);
  });
});
