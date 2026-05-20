import {
  __resetRoomsForTest,
  assignPlayer,
  canStopGame,
  getOrCreateRoom,
  removePlayerFromRoom,
  snapshotPersistedState
} from "./room";
import { applyDelta } from "./world";
import { BLOCK_REGISTRY, ITEM_REGISTRY } from "./protocol";
import { createEmptyCraftingGrid } from "./inventory";

beforeEach(() => __resetRoomsForTest());

/**
 * Layer 2 — VoxelRoom helpers (host transfer, max players, persisted state).
 * No sockets here; index.ts wires these into JOIN_ROOM/STOP_GAME.
 */

describe("VoxelRoom", () => {
  function makeRoom(sessionId = "sess-room") {
    return getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "host-user",
      minPlayers: 1,
      maxPlayers: 2,
      roster: [],
      paused: false
    });
  }

  it("rejects new joiners once maxPlayers is reached", () => {
    const room = makeRoom();
    expect("error" in assignPlayer(room, "host-user", "Host")).toBe(false);
    expect("error" in assignPlayer(room, "guest-user", "Guest")).toBe(false);
    const third = assignPlayer(room, "third-user", "Third");
    expect("error" in third).toBe(true);
    if ("error" in third) {
      expect(third.error.code).toBe("ROOM_FULL");
    }
  });

  it("transfers host to remaining player on host disconnect", () => {
    const room = makeRoom("sess-host");
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");
    const r = removePlayerFromRoom("sess-host", "host-user");
    expect(r.roomEmpty).toBe(false);
    expect(r.newHostId).toBe("guest-user");
    expect(room.hostId).toBe("guest-user");
  });

  it("blocks STOP_GAME when caller is not the host", () => {
    const room = makeRoom("sess-stop");
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");
    const guard = canStopGame(room, "guest-user");
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.error.code).toBe("NOT_HOST");
  });

  it("snapshotPersistedState writes voxel:true + seed + deltas + default gameMode", () => {
    const room = makeRoom("sess-persist");
    applyDelta(room.world, 1, 50, 1, BLOCK_REGISTRY.WOOD);
    const snap = snapshotPersistedState(room);
    expect(snap.voxel).toBe(true);
    expect(snap.seed).toBe(room.world.seed);
    expect(snap.gameMode).toBe("creative");
    expect(snap.deltas).toEqual(
      expect.arrayContaining([[1, 50, 1, BLOCK_REGISTRY.WOOD]])
    );
  });

  it("rehydrates a paused room from persisted state without re-seeding", () => {
    const sessionId = "sess-resume";
    const first = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "host-user",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "host-user", displayName: "Host" }],
      paused: false
    });
    applyDelta(first.world, 2, 51, 2, BLOCK_REGISTRY.STONE);
    const persisted = snapshotPersistedState(first);
    __resetRoomsForTest();

    const second = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "host-user",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "host-user", displayName: "Host" }],
      paused: true,
      resumedState: persisted
    });
    expect(second.world.seed).toBe(first.world.seed);
    expect(second.world.deltas.get("2,51,2")).toBe(BLOCK_REGISTRY.STONE);
    expect(second.gameMode).toBe("creative");
  });

  it("round-trips survival inventories via persisted state", () => {
    const sessionId = "sess-surv-inv";
    const room = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: false
    });
    room.gameMode = "survival";
    assignPlayer(room, "u1", "A");
    const p = room.players.get("u1");
    expect(p?.inventory).toBeDefined();
    p!.inventory![0] = { blockId: BLOCK_REGISTRY.DIRT, itemId: 0, count: 4 };
    const persisted = snapshotPersistedState(room);
    expect(persisted.gameMode).toBe("survival");
    expect(persisted.inventories?.u1?.[0]).toEqual({
      blockId: BLOCK_REGISTRY.DIRT,
      itemId: 0,
      count: 4
    });
    __resetRoomsForTest();

    const again = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: true,
      resumedState: persisted
    });
    expect((again.gameMode ?? "creative") === "survival").toBe(true);
    const re = assignPlayer(again, "u1", "A");
    expect("error" in re).toBe(false);
    if (!("error" in re)) {
      expect(re.player.inventory?.[0]).toEqual({
        blockId: BLOCK_REGISTRY.DIRT,
        itemId: 0,
        count: 4
      });
    }
  });

  it("round-trips survival item inventories via persisted state", () => {
    const sessionId = "sess-surv-items";
    const room = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: false
    });
    room.gameMode = "survival";
    assignPlayer(room, "u1", "A");
    const p = room.players.get("u1");
    expect(p?.itemInventory).toBeDefined();
    p!.itemInventory![0] = { itemId: ITEM_REGISTRY.PLANKS, count: 8 };
    const persisted = snapshotPersistedState(room);
    expect(persisted.itemInventories?.u1?.[0]).toEqual({
      itemId: ITEM_REGISTRY.PLANKS,
      count: 8
    });
    __resetRoomsForTest();

    const again = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: true,
      resumedState: persisted
    });
    expect((again.gameMode ?? "creative") === "survival").toBe(true);
    const re = assignPlayer(again, "u1", "A");
    expect("error" in re).toBe(false);
    if (!("error" in re)) {
      expect(re.player.itemInventory?.[0]).toEqual({
        itemId: ITEM_REGISTRY.PLANKS,
        count: 8
      });
    }
  });

  it("round-trips survival equipment slots via persisted state", () => {
    const sessionId = "sess-surv-equipment";
    const room = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: false
    });
    room.gameMode = "survival";
    assignPlayer(room, "u1", "A");
    const p = room.players.get("u1");
    expect(p?.equipmentSlots).toBeDefined();
    p!.equipmentSlots![3] = { itemId: ITEM_REGISTRY.HELIUM_BOOTS, count: 1 };
    const persisted = snapshotPersistedState(room);
    expect(persisted.equipmentSlots?.u1?.[3]).toEqual({
      itemId: ITEM_REGISTRY.HELIUM_BOOTS,
      count: 1
    });
    __resetRoomsForTest();

    const again = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: true,
      resumedState: persisted
    });
    expect((again.gameMode ?? "creative") === "survival").toBe(true);
    const re = assignPlayer(again, "u1", "A");
    expect("error" in re).toBe(false);
    if (!("error" in re)) {
      expect(re.player.equipmentSlots?.[3]).toEqual({
        itemId: ITEM_REGISTRY.HELIUM_BOOTS,
        count: 1
      });
    }
  });

  it("round-trips survival vitals via persisted state", () => {
    const sessionId = "sess-surv-vitals";
    const room = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: false
    });
    room.gameMode = "survival";
    assignPlayer(room, "u1", "A");
    const p = room.players.get("u1");
    expect(p?.health).toBeDefined();
    p!.health = 13;
    p!.hunger = 7;
    p!.saturation = 1.5;
    p!.exhaustion = 2.25;
    const persisted = snapshotPersistedState(room);
    expect(persisted.vitals?.u1).toEqual(
      expect.objectContaining({
        health: 13,
        hunger: 7,
        saturation: 1.5,
        exhaustion: 2.25
      })
    );
    __resetRoomsForTest();

    const again = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: true,
      resumedState: persisted
    });
    const re = assignPlayer(again, "u1", "A");
    expect("error" in re).toBe(false);
    if (!("error" in re)) {
      expect(re.player.health).toBe(13);
      expect(re.player.hunger).toBe(7);
      expect(re.player.saturation).toBe(1.5);
      expect(re.player.exhaustion).toBe(2.25);
    }
  });

  it("round-trips survival crafting grids via persisted state", () => {
    const sessionId = "sess-surv-craft";
    const room = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: false
    });
    room.gameMode = "survival";
    assignPlayer(room, "u1", "A");
    const p = room.players.get("u1");
    expect(p?.craftingGrid).toBeDefined();
    const cg = p!.craftingGrid ?? createEmptyCraftingGrid();
    cg[0] = { blockId: BLOCK_REGISTRY.WOOD, itemId: 0, count: 1 };
    const persisted = snapshotPersistedState(room);
    expect(persisted.craftingGrids?.u1?.[0]).toEqual({
      blockId: BLOCK_REGISTRY.WOOD,
      itemId: 0,
      count: 1
    });
    __resetRoomsForTest();

    const again = getOrCreateRoom(sessionId, {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: true,
      resumedState: persisted
    });
    const re = assignPlayer(again, "u1", "A");
    expect("error" in re).toBe(false);
    if (!("error" in re)) {
      expect(re.player.craftingGrid?.[0]).toEqual({
        blockId: BLOCK_REGISTRY.WOOD,
        itemId: 0,
        count: 1
      });
    }
  });
});
