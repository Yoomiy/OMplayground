import { createRecessSweepState, recessEndSweep, type RecessIoShape } from "./recessSweep";
import type { Room } from "./room";
import { initialTicTacToeState, tictactoeModule } from "@playground/game-logic";

function room(sessionId: string): Room<unknown> {
  return {
    sessionId, gameId: "g1", gameKey: tictactoeModule.key,
    module: tictactoeModule as unknown as Room<unknown>["module"], gender: "boy", hostId: "host",
    minPlayers: 2, state: initialTicTacToeState(), roster: [], players: new Map(), spectators: new Map(), childSpectatorIds: new Set(),
    hasBeenActive: false, paused: false, peakPlayerCount: 0
  };
}

describe("recessEndSweep", () => {
  it("evicts only the class whose recess ended in a mixed room", async () => {
    const endedEmit = jest.fn();
    const endedDisconnect = jest.fn();
    const allowedEmit = jest.fn();
    const allowedDisconnect = jest.fn();
    const io: RecessIoShape = {
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([
        { data: { role: "kid", grade: "א", gender: "boy", userId: "ended" }, emit: endedEmit, disconnect: endedDisconnect },
        { data: { role: "kid", grade: "ב", gender: "boy", userId: "allowed" }, emit: allowedEmit, disconnect: allowedDisconnect },
        { data: { role: "teacher", userId: "teacher" }, emit: jest.fn(), disconnect: jest.fn() }
      ]) })
    };
    const result = await recessEndSweep(createRecessSweepState(), {
      io,
      isKidAllowed: async (grade) => grade === "ב",
      rooms: () => [room("mixed")]
    });
    expect(result.evictedUserIds).toEqual(["ended"]);
    expect(endedEmit).toHaveBeenCalledWith("ROOM_EVENT", { sessionId: "mixed", kind: "RECESS_ENDED" });
    expect(endedDisconnect).toHaveBeenCalledWith(true);
    expect(allowedDisconnect).not.toHaveBeenCalled();
  });

  it("does not touch classroom drawing rooms", async () => {
    const disconnect = jest.fn();
    const io: RecessIoShape = { in: jest.fn() };
    const classroom = room("classroom");
    classroom.drawingContext = { boardMode: "classroom", classroomId: "id", roomCode: "code" };
    const result = await recessEndSweep(createRecessSweepState(), {
      io,
      isKidAllowed: async () => false,
      rooms: () => [classroom]
    });
    expect(result.evictedUserIds).toEqual([]);
    expect(io.in).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("keeps players connected when schedule evaluation is temporarily unavailable", async () => {
    const disconnect = jest.fn();
    const io: RecessIoShape = {
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([
        { data: { role: "kid", grade: "א", gender: "girl", userId: "kid" }, emit: jest.fn(), disconnect }
      ]) })
    };
    const result = await recessEndSweep(createRecessSweepState(), {
      io,
      isKidAllowed: async () => { throw new Error("temporary"); },
      rooms: () => [room("safe")]
    });
    expect(result.evictedUserIds).toEqual([]);
    expect(disconnect).not.toHaveBeenCalled();
  });
});
