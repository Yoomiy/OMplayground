import { BLOCK_REGISTRY, SEA_LEVEL, sampleBiomeColumn } from "@playground/voxel-content";
import { freezeSurfaceWaterIfCold, tickWeatherFreezing } from "./weather";
import { applyDelta, createWorld, getVoxelID } from "./world";
import {
  __resetRoomsForTest,
  assignPlayer,
  getOrCreateRoom
} from "./room";

beforeEach(() => __resetRoomsForTest());

function snowWaterSample(seed: number): [number, number] {
  const x = -4880;
  const z = -4500;
  const column = sampleBiomeColumn(x, z, seed);
  expect(column.biome.temperature).toBeLessThanOrEqual(0.15);
  expect(column.biome.downfall).toBeGreaterThan(0.3);
  expect(column.height).toBeLessThan(SEA_LEVEL);
  return [x, z];
}

describe("weather freezing", () => {
  it("freezes exposed surface water in snowy biomes", () => {
    const seed = 1234567;
    const world = createWorld(seed);
    const [x, z] = snowWaterSample(seed);
    applyDelta(world, x, SEA_LEVEL, z, BLOCK_REGISTRY.WATER);

    expect(freezeSurfaceWaterIfCold(world, x, z)).toBe(true);
    expect(getVoxelID(world, x, SEA_LEVEL, z)).toBe(BLOCK_REGISTRY.ICE);
  });

  it("ticks around active players and returns authoritative deltas", () => {
    const seed = 1234567;
    const [x, z] = snowWaterSample(seed);
    const room = getOrCreateRoom("sess-weather", {
      gameId: "game-mc",
      gender: "boy",
      hostId: "u1",
      minPlayers: 1,
      maxPlayers: 4,
      roster: [{ userId: "u1", displayName: "A" }],
      paused: false
    });
    room.world = createWorld(seed);
    applyDelta(room.world, x, SEA_LEVEL, z, BLOCK_REGISTRY.WATER);
    const assigned = assignPlayer(room, "u1", "A");
    if ("error" in assigned) throw new Error(assigned.error.message);
    assigned.player.pos = [x, SEA_LEVEL + 1, z];

    const deltas = tickWeatherFreezing(room, 9000, () => 0.5);

    expect(deltas).toContainEqual({ pos: [x, SEA_LEVEL, z], blockId: BLOCK_REGISTRY.ICE });
    expect(room.dirty).toBe(true);
  });
});
