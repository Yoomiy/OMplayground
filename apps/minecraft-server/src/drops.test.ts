import { BLOCK_REGISTRY } from "./protocol";
import {
  __resetRoomsForTest,
  assignPlayer,
  getOrCreateRoom,
  type VoxelRoom
} from "./room";
import type { Server } from "socket.io";
import {
  DROP_PHYS_HALF_XZ,
  DROP_TTL_MS,
  listDropsWire,
  MAGNET_RADIUS_SQ,
  spawnBlockDropAt,
  tickMagnetPickups,
  tickWorldDrops
} from "./drops";
import { applyDelta } from "./world";

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

  it("drops fall under gravity toward supporting terrain", () => {
    const room = survivalRoom("sess-drop-fall");
    const d = spawnBlockDropAt(room, [8, 90, -3], BLOCK_REGISTRY.STONE, 1);
    expect(d).not.toBeNull();
    const py0 = d!.pos[1];
    const io = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      in: jest.fn()
    } as unknown as Server;
    const tBase = 1_720_050_123_456;
    for (let step = 0; step < 180; step++) {
      tickWorldDrops(io, room, tBase + step * 70);
    }
    const still = room.drops.get(d!.id)!;
    expect(still.pos[1]).toBeLessThan(py0 - 8);
    expect(Number.isFinite(still.pos[1])).toBe(true);
  });

  it("WORLD_DROP_UPDATE is emitted once drops move past broadcast window", () => {
    const room = survivalRoom("sess-drop-broadcast");
    spawnBlockDropAt(room, [2, 85, 2], BLOCK_REGISTRY.DIRT, 1);
    const emit = jest.fn();
    const io = {
      to: jest.fn().mockReturnValue({ emit })
    } as unknown as Server;
    tickWorldDrops(io, room, 1_720_100_000_000);
    expect(
      emit.mock.calls.some(
        ([, payload]) =>
          typeof payload === "object" &&
          payload !== null &&
          "kind" in payload &&
          (payload as { kind?: string }).kind === "WORLD_DROP_UPDATE"
      )
    ).toBe(true);
  });

  it("drops despawn past TTL", () => {
    const room = survivalRoom("sess-drop-ttl");
    const frozen = Date.now();
    spawnBlockDropAt(room, [2, 65, 2], BLOCK_REGISTRY.DIRT, 1, {
      spawnedAtMs: frozen - DROP_TTL_MS - 10_000
    });
    const emit = jest.fn();
    const io = {
      to: jest.fn().mockReturnValue({ emit })
    } as unknown as Server;
    tickWorldDrops(io, room, frozen + 123);
    expect(room.drops.size).toBe(0);
    expect(
      emit.mock.calls.some(
        ([, payload]) =>
          typeof payload === "object" &&
          payload !== null &&
          "kind" in payload &&
          (payload as { kind?: string }).kind === "WORLD_DROP_REMOVED"
      )
    ).toBe(true);
  });

  it("pushes overlapping dissimilar stacks apart (collision, no merge)", () => {
    const room = survivalRoom("sess-drop-sep");
    const a = spawnBlockDropAt(room, [20, 200, -4], BLOCK_REGISTRY.STONE, 3);
    const b = spawnBlockDropAt(room, [20.001, 200, -4], BLOCK_REGISTRY.DIRT, 2);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const io = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      in: jest.fn()
    } as unknown as Server;
    const t0 = 1_720_300_000_000;
    for (let s = 0; s < 40; s++) {
      tickWorldDrops(io, room, t0 + s * 70);
    }
    expect(room.drops.size).toBe(2);
    const ds = [...room.drops.values()];
    const dx = ds[0]!.pos[0] - ds[1]!.pos[0];
    const dy = ds[0]!.pos[1] - ds[1]!.pos[1];
    const dz = ds[0]!.pos[2] - ds[1]!.pos[2];
    /** Touching clears AABB overlap (≈ 2 × half-extent along separation axis). */
    expect(Math.hypot(dx, dy, dz)).toBeGreaterThan(DROP_PHYS_HALF_XZ * 1.96);
  });

  it("resolves penetration when a solid block occupies the drop AABB (side wall)", () => {
    const room = survivalRoom("sess-drop-wall");
    applyDelta(room.world, 30, 70, -6, BLOCK_REGISTRY.STONE);
    const d = spawnBlockDropAt(room, [30.91, 70.15, -5.93], BLOCK_REGISTRY.GRASS, 1, {
      vx: 0,
      vy: 0,
      vz: 0
    });
    expect(d).not.toBeNull();
    const hx = DROP_PHYS_HALF_XZ;
    expect(d!.pos[0] + hx).toBeGreaterThan(30); // penetrates ix=30 stone from +x side

    const io = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      in: jest.fn()
    } as unknown as Server;
    const t0 = 1_720_400_000_000;
    for (let s = 0; s < 120; s++) {
      tickWorldDrops(io, room, t0 + s * 70);
    }
    const still = room.drops.get(d!.id)!;
    /** Drop AABB clears [30,31) x extent of stone at ix=30. */
    expect(still.pos[0] - hx).toBeGreaterThanOrEqual(31 - 8e-2);
    expect(Number.isFinite(still.pos[1])).toBe(true);
  });

  it("merges identical touching stacks when combined count fits MAX_STACK", () => {
    const room = survivalRoom("sess-drop-merge");
    spawnBlockDropAt(room, [12, 64, -4], BLOCK_REGISTRY.GRAVEL, 28);
    spawnBlockDropAt(room, [12.001, 64, -4], BLOCK_REGISTRY.GRAVEL, 31);
    const emit = jest.fn();
    const io = {
      to: jest.fn().mockReturnValue({ emit })
    } as unknown as Server;
    tickWorldDrops(io, room, 1_720_200_555_777);
    expect(room.drops.size).toBe(1);
    expect([...room.drops.values()][0]!.count).toBe(59);
  });
});

describe("MAGNET_RADIUS_SQ", () => {
  it("matches 2.25 block radius squared", () => {
    expect(MAGNET_RADIUS_SQ).toBeCloseTo(2.25 * 2.25);
  });
});
