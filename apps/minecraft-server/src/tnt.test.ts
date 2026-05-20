import { BLOCK_REGISTRY } from "./protocol";
import {
  __resetRoomsForTest,
  assignPlayer,
  getOrCreateRoom,
  type PlayerRuntime,
  type VoxelRoom
} from "./room";
import { applyTntExplosion, primeTnt, TNT_FUSE_MS } from "./tnt";
import { applyDelta, getVoxelID } from "./world";

beforeEach(() => __resetRoomsForTest());

function makeSurvivalRoom(): { room: VoxelRoom; player: PlayerRuntime } {
  const room = getOrCreateRoom("sess-tnt", {
    gameId: "game-mc",
    gender: "boy",
    hostId: "u1",
    minPlayers: 1,
    maxPlayers: 4,
    roster: [{ userId: "u1", displayName: "A" }],
    paused: false
  });
  room.gameMode = "survival";
  const assigned = assignPlayer(room, "u1", "A");
  if ("error" in assigned) throw new Error(assigned.error.message);
  return { room, player: assigned.player };
}

describe("server-authoritative TNT", () => {
  it("primes TNT by replacing the block and registering a fuse", () => {
    const { room } = makeSurvivalRoom();
    applyDelta(room.world, 10, 70, 10, BLOCK_REGISTRY.TNT);

    const primed = primeTnt(room, [10, 70, 10], "u1", 1000);

    expect(primed).toEqual({
      id: "10,70,10",
      pos: [10, 70, 10],
      primedAt: 1000,
      explodeAt: 1000 + TNT_FUSE_MS,
      by: "u1"
    });
    expect(room.activeTnts.get("10,70,10")).toBe(primed);
    expect(getVoxelID(room.world, 10, 70, 10)).not.toBe(BLOCK_REGISTRY.TNT);
    expect(room.dirty).toBe(true);
  });

  it("destroys breakable blocks, leaves blast-proof blocks, and damages nearby players", () => {
    const { room, player } = makeSurvivalRoom();
    player.pos = [20.5, 70, 20.5];
    applyDelta(room.world, 20, 70, 20, BLOCK_REGISTRY.TNT);
    applyDelta(room.world, 21, 70, 20, BLOCK_REGISTRY.DIRT);
    applyDelta(room.world, 22, 70, 20, BLOCK_REGISTRY.OBSIDIAN);
    const primed = primeTnt(room, [20, 70, 20], "u1", 1000);
    expect(primed).not.toBeNull();

    const result = applyTntExplosion(room, primed!);

    expect(result.blockDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pos: [21, 70, 20],
          destroyedBlockId: BLOCK_REGISTRY.DIRT
        })
      ])
    );
    expect(getVoxelID(room.world, 21, 70, 20)).not.toBe(BLOCK_REGISTRY.DIRT);
    expect(getVoxelID(room.world, 22, 70, 20)).toBe(BLOCK_REGISTRY.OBSIDIAN);
    expect(result.playerDamage).toHaveLength(1);
    expect(result.playerDamage[0]!.amount).toBeGreaterThan(0);
    expect(result.playerDamage[0]!.impulse.length).toBe(3);
    expect(player.health).toBeLessThan(20);
    expect(room.activeTnts.size).toBe(0);
  });
});
