import { BLOCK_REGISTRY } from "./protocol";
import {
  __resetRoomsForTest,
  assignPlayer,
  getOrCreateRoom,
  type VoxelRoom
} from "./room";
import type { Server } from "socket.io";
import {
  listDropsWire,
  MAGNET_RADIUS_SQ,
  spawnBlockDropAt,
  tickMagnetPickups
} from "./drops";

beforeEach(() => __resetRoomsForTest());

function ioMockForUser(userId: string): { io: Server; socketEmit: jest.Mock } {
  const socketEmit = jest.fn();
  const fetchSockets = jest.fn().mockResolvedValue([
    {
      data: { userId },
      emit: socketEmit
    }
  ]);
  const io = {
    to: jest.fn().mockReturnValue({
      emit: jest.fn()
    }),
    in: jest.fn().mockReturnValue({ fetchSockets })
  };
  return { io: io as unknown as Server, socketEmit };
}

function survivalRoom(sessionId: string): VoxelRoom {
  const room = getOrCreateRoom(sessionId, {
    gameId: "game-mc",
    gender: "boy",
    hostId: "host-user",
    minPlayers: 1,
    maxPlayers: 4,
    roster: [],
    paused: false
  });
  room.gameMode = "survival";
  return room;
}

describe("world drops", () => {
  it("spawnBlockDropAt adds a pickable stack to the room", () => {
    const room = survivalRoom("sess-drop-1");
    const d = spawnBlockDropAt(room, [1, 2, 3], BLOCK_REGISTRY.DIRT, 2);
    expect(d).not.toBeNull();
    expect(room.drops.size).toBe(1);
    expect(listDropsWire(room)).toHaveLength(1);
    expect(listDropsWire(room)[0]?.kind).toBe("block");
  });

  it("magnet pickup adds blocks when the player is within range", async () => {
    const room = survivalRoom("sess-drop-2");
    assignPlayer(room, "host-user", "Host");
    const player = room.players.get("host-user")!;
    player.pos = [10, 64, 10];
    spawnBlockDropAt(room, [10, 64.2, 10.5], BLOCK_REGISTRY.DIRT, 3);

    const { io, socketEmit } = ioMockForUser("host-user");
    tickMagnetPickups(io, room);

    await new Promise<void>((r) => setImmediate(r));

    expect(room.drops.size).toBe(0);
    expect(player.inventory).toBeDefined();
    const dirtCount = player
      .inventory!.filter((s) => s.blockId === BLOCK_REGISTRY.DIRT)
      .reduce((a, s) => a + s.count, 0);
    expect(dirtCount).toBe(3);
    expect(socketEmit).toHaveBeenCalledWith(
      "INVENTORY_SYNC",
      expect.objectContaining({
        slots: expect.any(Array)
      })
    );
  });

  it("does not pick up when the hotbar cannot fit the full stack", () => {
    const room = survivalRoom("sess-drop-3");
    assignPlayer(room, "host-user", "Host");
    const player = room.players.get("host-user")!;
    player.pos = [0, 64, 0];
    if (!player.inventory) throw new Error("expected inventory");
    for (let i = 0; i < 9; i++) {
      player.inventory[i] = { blockId: BLOCK_REGISTRY.STONE, count: 64 };
    }
    spawnBlockDropAt(room, [0, 64.1, 0.2], BLOCK_REGISTRY.DIRT, 8);
    const { io } = ioMockForUser("host-user");
    tickMagnetPickups(io, room);
    expect(room.drops.size).toBe(1);
  });

  it("magnet uses torso height anchor (vertical slack)", () => {
    const room = survivalRoom("sess-drop-4");
    assignPlayer(room, "host-user", "Host");
    const player = room.players.get("host-user")!;
    player.pos = [5, 60, 5];
    spawnBlockDropAt(room, [5, 61.05, 5], BLOCK_REGISTRY.GRASS, 1);
    const { io } = ioMockForUser("host-user");
    tickMagnetPickups(io, room);
    expect(room.drops.size).toBe(0);
    const grass = player.inventory!.find((s) => s.blockId === BLOCK_REGISTRY.GRASS);
    expect(grass?.count).toBeGreaterThanOrEqual(1);
  });
});

describe("MAGNET_RADIUS_SQ", () => {
  it("matches 2.25 block radius squared", () => {
    expect(MAGNET_RADIUS_SQ).toBeCloseTo(2.25 * 2.25);
  });
});
