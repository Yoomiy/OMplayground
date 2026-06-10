import {
  __resetRoomsForTest,
  assignPlayer,
  getOrCreateRoom,
  markAllPlayersDirty,
  type VoxelRoom
} from "./room";
import { tickOnce, type TickIoShape } from "./tick";

beforeEach(() => __resetRoomsForTest());

function buildIo() {
  const emit = jest.fn();
  const io: TickIoShape = {
    to: jest.fn().mockReturnValue({ emit })
  };
  return { io, emit };
}

function buildRoom(sessionId: string): VoxelRoom {
  const room = getOrCreateRoom(sessionId, {
    gameId: "game-mc",
    gender: "boy",
    hostId: "host-user",
    minPlayers: 1,
    maxPlayers: 4,
    roster: [],
    paused: false
  });
  assignPlayer(room, "host-user", "Host");
  return room;
}

describe("tickOnce", () => {
  it("emits a PLAYER_DELTA for a dirty room and clears the dirty flag", () => {
    const { io, emit } = buildIo();
    const room = buildRoom("sess-tick-1");
    markAllPlayersDirty(room);
    const result = tickOnce({ io, rooms: () => [room] });
    expect(result.emittedSessionIds).toEqual(["sess-tick-1"]);
    expect(io.to).toHaveBeenCalledWith("voxel-snapshot:sess-tick-1");
    expect(io.to).toHaveBeenCalledWith("voxel-snapshot-teacher:sess-tick-1");
    expect(emit).toHaveBeenCalledWith(
      "PLAYER_DELTA",
      expect.objectContaining({
        players: expect.objectContaining({
          "host-user": expect.objectContaining({
            pos: expect.any(Array),
            heading: expect.any(Number)
          })
        })
      })
    );
    expect(room.dirty).toBe(false);
  });

  it("skips clean rooms (coalesces multiple inputs into one tick)", () => {
    const { io, emit } = buildIo();
    const room = buildRoom("sess-tick-clean");
    room.dirty = false;
    room.dirtyPlayerIds.clear();
    const result = tickOnce({ io, rooms: () => [room] });
    expect(result.emittedSessionIds).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
  });

  it("runs survival vitals before dirty coalescing", () => {
    const { io, emit } = buildIo();
    const room = buildRoom("sess-tick-vitals");
    room.gameMode = "survival";
    room.dirty = false;
    room.dirtyPlayerIds.clear();
    const survivalVitalsTick = jest.fn((r: VoxelRoom) => {
      markAllPlayersDirty(r);
    });

    const result = tickOnce({
      io,
      rooms: () => [room],
      now: () => 123,
      survivalVitalsTick
    });

    expect(survivalVitalsTick).toHaveBeenCalledWith(room, 123);
    expect(result.emittedSessionIds).toEqual(["sess-tick-vitals"]);
    expect(emit).toHaveBeenCalledWith(
      "PLAYER_DELTA",
      expect.objectContaining({ players: expect.any(Object) })
    );
  });

  it("skips paused rooms even when dirty", () => {
    const { io, emit } = buildIo();
    const room = buildRoom("sess-tick-paused");
    room.paused = true;
    markAllPlayersDirty(room);
    const result = tickOnce({ io, rooms: () => [room] });
    expect(result.emittedSessionIds).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
  });

  it("only emits to the room scoped to its session (no global broadcast)", () => {
    const { io, emit } = buildIo();
    const a = buildRoom("sess-tick-A");
    const b = buildRoom("sess-tick-B");
    markAllPlayersDirty(a);
    b.dirty = false;
    b.dirtyPlayerIds.clear();
    tickOnce({ io, rooms: () => [a, b] });
    expect(io.to).toHaveBeenCalledTimes(2);
    expect(io.to).toHaveBeenCalledWith("voxel-snapshot:sess-tick-A");
    expect(io.to).toHaveBeenCalledWith("voxel-snapshot-teacher:sess-tick-A");
    expect(emit).toHaveBeenCalledTimes(2);
  });
});
