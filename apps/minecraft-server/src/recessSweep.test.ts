import { createRecessSweepState, recessEndSweep, type RecessIoShape } from "./recessSweep";
import type { VoxelRoom } from "./room";

function room(sessionId: string): VoxelRoom {
  return {
    sessionId, gameId: "voxel", gender: "boy", hostId: "host", minPlayers: 1, maxPlayers: 8,
    world: {} as VoxelRoom["world"], players: new Map(), roster: [], spawnPoints: new Map(), paused: false,
    disconnectedInventories: new Map(), disconnectedItemInventories: new Map(), disconnectedCraftingGrids: new Map(),
    disconnectedEquipmentSlots: new Map(), disconnectedVitals: new Map(), chests: new Map(), chestLocks: new Map(),
    dirty: false, dirtyPlayerIds: new Set(), lastTickAt: 0, drops: new Map(), activeTnts: new Map(),
    lastWeatherAt: 0, dropSyncIds: new Set(), lastDropBroadcastAt: 0, peakPlayerCount: 0
  };
}

describe("voxel recess sweep", () => {
  it("disconnects only kids whose class is no longer in recess", async () => {
    const endedDisconnect = jest.fn();
    const allowedDisconnect = jest.fn();
    const io: RecessIoShape = {
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([
        { data: { role: "kid", grade: "ג", gender: "boy", userId: "ended" }, emit: jest.fn(), disconnect: endedDisconnect },
        { data: { role: "kid", grade: "ד", gender: "boy", userId: "allowed" }, emit: jest.fn(), disconnect: allowedDisconnect }
      ]) })
    };
    const result = await recessEndSweep(createRecessSweepState(), {
      io,
      isKidAllowed: async (grade) => grade === "ד",
      rooms: () => [room("voxel-room")]
    });
    expect(result.evictedUserIds).toEqual(["ended"]);
    expect(endedDisconnect).toHaveBeenCalledWith(true);
    expect(allowedDisconnect).not.toHaveBeenCalled();
  });
});
