import {
  __resetRoomsForTest,
  assignPlayer,
  canStopGame,
  getOrCreateRoom,
  removePlayerFromRoom,
  snapshotPersistedState
} from "./room";
import { applyDelta } from "./world";
import { BLOCK_REGISTRY } from "./protocol";

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

  it("snapshotPersistedState writes voxel:true + seed + deltas", () => {
    const room = makeRoom("sess-persist");
    applyDelta(room.world, 1, 50, 1, BLOCK_REGISTRY.WOOD);
    const snap = snapshotPersistedState(room);
    expect(snap.voxel).toBe(true);
    expect(snap.seed).toBe(room.world.seed);
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
  });
});
