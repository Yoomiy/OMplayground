import { BLOCK_REGISTRY, ITEM_REGISTRY } from "./protocol";
import { applyDelta, createWorld } from "./world";
import {
  __resetRoomsForTest,
  assignPlayer,
  getOrCreateRoom
} from "./room";
import {
  applySuffocationDamage,
  handlePlayerDeath,
  isSuffocatingBlockId
} from "./death";

beforeEach(() => __resetRoomsForTest());

function survivalRoom() {
  const room = getOrCreateRoom("sess-death", {
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

describe("death and suffocation", () => {
  it("treats solid blocks as suffocating and pass-through blocks as safe", () => {
    expect(isSuffocatingBlockId(BLOCK_REGISTRY.STONE)).toBe(true);
    expect(isSuffocatingBlockId(BLOCK_REGISTRY.CHEST)).toBe(true);
    expect(isSuffocatingBlockId(BLOCK_REGISTRY.WATER)).toBe(false);
    expect(isSuffocatingBlockId(BLOCK_REGISTRY.TORCH)).toBe(false);
  });

  it("applies suffocation damage when a player head is inside a solid block", () => {
    const { player } = survivalRoom();
    const world = createWorld(123);
    player.pos = [4.3, 70, -2.7];
    applyDelta(world, 4, 71, -3, BLOCK_REGISTRY.STONE);

    const amount = applySuffocationDamage(world, player, 1000);

    expect(amount).toBe(1);
    expect(player.health).toBe(19);
  });

  it("spills inventory, resets vitals, and respawns the player", () => {
    const { room, player } = survivalRoom();
    player.pos = [8, 72, -4];
    player.inventory![0] = { blockId: BLOCK_REGISTRY.DIRT, itemId: 0, count: 3 };
    player.itemInventory![0] = { itemId: ITEM_REGISTRY.BREAD, count: 2 };
    player.equipmentSlots![1] = { itemId: ITEM_REGISTRY.HEAVY_SHIELD, count: 1 };
    player.craftingGrid![0] = { blockId: BLOCK_REGISTRY.AIR, itemId: ITEM_REGISTRY.STICK, count: 4 };
    player.health = 0;

    const result = handlePlayerDeath(room, player, 2000);

    expect(result.deathPos).toEqual([8, 72, -4]);
    expect(result.respawnPos).toEqual(player.pos);
    expect(result.drops.length).toBeGreaterThanOrEqual(4);
    expect(player.health).toBe(20);
    expect(player.hunger).toBe(20);
    expect(player.inventory!.every((slot) => slot.count === 0)).toBe(true);
    expect(player.itemInventory!.every((slot) => slot.count === 0)).toBe(true);
    expect(player.equipmentSlots!.every((slot) => slot.count === 0)).toBe(true);
    expect(player.craftingGrid!.every((slot) => slot.count === 0)).toBe(true);
    expect(room.dirty).toBe(true);
  });
});
