import {
  applyDelta,
  createWorld,
  getVoxelID,
  hydrateDeltas,
  isSpawnPointSafe,
  proceduralVoxelID,
  replacementBlockAfterBreak,
  seedFromSessionId,
  serializeDeltas,
  spawnPointFor
} from "./world";
import { BLOCK_REGISTRY } from "./protocol";
import { SEA_LEVEL } from "@playground/voxel-content";

/**
 * Layer 1 — pure voxel-world logic. No socket, no supabase.
 */

describe("seedFromSessionId", () => {
  it("is deterministic for the same sessionId", () => {
    const a = seedFromSessionId("session-abc");
    const b = seedFromSessionId("session-abc");
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it("differs across sessionIds (no global world)", () => {
    const a = seedFromSessionId("session-aaa");
    const b = seedFromSessionId("session-bbb");
    expect(a).not.toBe(b);
  });
});

describe("proceduralVoxelID", () => {
  it("returns the same id for the same seed + coords", () => {
    const seed = seedFromSessionId("sess-1");
    expect(proceduralVoxelID(0, 0, 0, seed)).toBe(
      proceduralVoxelID(0, 0, 0, seed)
    );
    expect(proceduralVoxelID(7, 12, -3, seed)).toBe(
      proceduralVoxelID(7, 12, -3, seed)
    );
  });

  it("returns AIR sufficiently above the surface", () => {
    const seed = seedFromSessionId("sess-air");
    expect(proceduralVoxelID(0, 220, 0, seed)).toBe(BLOCK_REGISTRY.AIR);
    expect(proceduralVoxelID(10, 220, 10, seed)).toBe(BLOCK_REGISTRY.AIR);
  });

  it("returns solid blocks below ground", () => {
    const seed = seedFromSessionId("sess-stone");
    expect(proceduralVoxelID(0, -10, 0, seed)).not.toBe(BLOCK_REGISTRY.AIR);
  });

  it("generates an unbreakable bedrock floor deep underground", () => {
    const seed = seedFromSessionId("sess-bedrock");
    expect(proceduralVoxelID(0, -28, 0, seed)).toBe(BLOCK_REGISTRY.BEDROCK);
    expect(proceduralVoxelID(12, -40, -9, seed)).toBe(BLOCK_REGISTRY.BEDROCK);
  });

  it("sprinkles ore blocks through the underground sample volume", () => {
    const seed = seedFromSessionId("sess-ores");
    const ores = new Set<number>([
      BLOCK_REGISTRY.COAL_ORE,
      BLOCK_REGISTRY.IRON_ORE,
      BLOCK_REGISTRY.GOLD_ORE,
      BLOCK_REGISTRY.DIAMOND_ORE
    ]);
    let foundOre = false;
    for (let x = -20; x <= 20 && !foundOre; x++) {
      for (let y = 5; y <= 58 && !foundOre; y++) {
        for (let z = -20; z <= 20 && !foundOre; z++) {
          foundOre = ores.has(proceduralVoxelID(x, y, z, seed));
        }
      }
    }
    expect(foundOre).toBe(true);
  });
});

describe("applyDelta + getVoxelID", () => {
  it("read-back returns the delta for non-baseline blocks", () => {
    const w = createWorld(seedFromSessionId("sess-d"));
    applyDelta(w, 4, 50, 4, BLOCK_REGISTRY.WOOD);
    expect(getVoxelID(w, 4, 50, 4)).toBe(BLOCK_REGISTRY.WOOD);
  });

  it("removes the delta when it matches the procedural baseline", () => {
    const w = createWorld(seedFromSessionId("sess-baseline"));
    const x = 5;
    const y = 50;
    const z = 5;
    const baseline = proceduralVoxelID(x, y, z, w.seed);
    applyDelta(w, x, y, z, BLOCK_REGISTRY.GLASS);
    expect(w.deltas.size).toBe(1);
    applyDelta(w, x, y, z, baseline);
    expect(w.deltas.size).toBe(0);
    expect(getVoxelID(w, x, y, z)).toBe(baseline);
  });

  it("supports breaking a block (writing AIR over solid)", () => {
    const w = createWorld(seedFromSessionId("sess-break"));
    applyDelta(w, 0, -5, 0, BLOCK_REGISTRY.AIR);
    expect(getVoxelID(w, 0, -5, 0)).toBe(BLOCK_REGISTRY.AIR);
  });
});

describe("serializeDeltas / hydrateDeltas", () => {
  it("round-trips an arbitrary set of deltas", () => {
    const w = createWorld(seedFromSessionId("sess-rt"));
    applyDelta(w, 1, 50, 1, BLOCK_REGISTRY.WOOD);
    applyDelta(w, -2, 51, 3, BLOCK_REGISTRY.STONE);
    applyDelta(w, 0, -10, 0, BLOCK_REGISTRY.AIR);
    const tuples = serializeDeltas(w);
    expect(tuples.length).toBe(3);

    const w2 = createWorld(w.seed);
    hydrateDeltas(w2, tuples);
    expect(getVoxelID(w2, 1, 50, 1)).toBe(BLOCK_REGISTRY.WOOD);
    expect(getVoxelID(w2, -2, 51, 3)).toBe(BLOCK_REGISTRY.STONE);
    expect(getVoxelID(w2, 0, -10, 0)).toBe(BLOCK_REGISTRY.AIR);
  });
});

describe("spawnPointFor", () => {
  it("produces a point above the procedural surface (always solid below, air at spawn)", () => {
    const seed = seedFromSessionId("sess-spawn");
    const world = createWorld(seed);
    const [sx, sy, sz] = spawnPointFor(seed, "user-1");
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const iz = Math.floor(sz);
    expect(proceduralVoxelID(ix, iy, iz, seed)).toBe(BLOCK_REGISTRY.AIR);
    expect(proceduralVoxelID(ix, iy - 2, iz, seed)).not.toBe(BLOCK_REGISTRY.AIR);
    expect(isSpawnPointSafe(world, [sx, sy, sz])).toBe(true);
  });

  it("offsets per-user so two players don't share a column", () => {
    const seed = seedFromSessionId("sess-spawn-2");
    const a = spawnPointFor(seed, "user-a");
    const b = spawnPointFor(seed, "user-b");
    expect(a[0] === b[0] && a[2] === b[2]).toBe(false);
  });

  it("rejects underwater or unsupported spawn points", () => {
    const seed = seedFromSessionId("sess-spawn-safe");
    const world = createWorld(seed);
    expect(isSpawnPointSafe(world, [0.5, SEA_LEVEL - 4, 0.5])).toBe(false);
    expect(isSpawnPointSafe(world, [0.5, SEA_LEVEL + 20, 0.5])).toBe(false);
  });
});

describe("replacementBlockAfterBreak", () => {
  it("restores water when breaking a placed block in water", () => {
    const seed = seedFromSessionId("sess-water-break");
    const world = createWorld(seed);
    let waterPos: [number, number, number] | null = null;
    for (let x = -200; x <= 200 && !waterPos; x += 20) {
      for (let z = -200; z <= 200 && !waterPos; z += 20) {
        if (proceduralVoxelID(x, SEA_LEVEL, z, seed) === BLOCK_REGISTRY.WATER) {
          waterPos = [x, SEA_LEVEL, z];
        }
      }
    }
    expect(waterPos).not.toBeNull();
    const [x, y, z] = waterPos!;
    applyDelta(world, x, y, z, BLOCK_REGISTRY.STONE);
    expect(getVoxelID(world, x, y, z)).toBe(BLOCK_REGISTRY.STONE);
    expect(replacementBlockAfterBreak(world, x, y, z)).toBe(BLOCK_REGISTRY.WATER);
  });
});
