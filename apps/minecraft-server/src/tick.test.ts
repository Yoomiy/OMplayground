import {
  __resetRoomsForTest,
  assignPlayer,
  getOrCreateRoom,
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
  it("emits a ROOM_SNAPSHOT for a dirty room and clears the dirty flag", () => {
    const { io, emit } = buildIo();
    const room = buildRoom("sess-tick-1");
    room.dirty = true;
    const result = tickOnce({ io, rooms: () => [room] });
    expect(result.emittedSessionIds).toEqual(["sess-tick-1"]);
    expect(io.to).toHaveBeenCalledWith("voxel:sess-tick-1");
    expect(emit).toHaveBeenCalledWith(
      "ROOM_SNAPSHOT",
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
    const result = tickOnce({ io, rooms: () => [room] });
    expect(result.emittedSessionIds).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
  });

  it("skips paused rooms even when dirty", () => {
    const { io, emit } = buildIo();
    const room = buildRoom("sess-tick-paused");
    room.paused = true;
    room.dirty = true;
    const result = tickOnce({ io, rooms: () => [room] });
    expect(result.emittedSessionIds).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
  });

  it("only emits to the room scoped to its session (no global broadcast)", () => {
    const { io, emit } = buildIo();
    const a = buildRoom("sess-tick-A");
    const b = buildRoom("sess-tick-B");
    a.dirty = true;
    b.dirty = false;
    tickOnce({ io, rooms: () => [a, b] });
    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith("voxel:sess-tick-A");
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
