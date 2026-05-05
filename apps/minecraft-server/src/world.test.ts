import {
  applyDelta,
  createWorld,
  getVoxelID,
  hydrateDeltas,
  proceduralVoxelID,
  seedFromSessionId,
  serializeDeltas,
  spawnPointFor
} from "./world";
import { BLOCK_REGISTRY } from "./protocol";

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
    expect(proceduralVoxelID(0, 200, 0, seed)).toBe(BLOCK_REGISTRY.AIR);
    expect(proceduralVoxelID(10, 100, 10, seed)).toBe(BLOCK_REGISTRY.AIR);
  });

  it("returns solid blocks below ground", () => {
    const seed = seedFromSessionId("sess-stone");
    expect(proceduralVoxelID(0, -10, 0, seed)).toBe(BLOCK_REGISTRY.STONE);
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
    const [sx, sy, sz] = spawnPointFor(seed, "user-1");
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const iz = Math.floor(sz);
    expect(proceduralVoxelID(ix, iy, iz, seed)).toBe(BLOCK_REGISTRY.AIR);
    expect(proceduralVoxelID(ix, iy - 3, iz, seed)).not.toBe(BLOCK_REGISTRY.AIR);
  });

  it("offsets per-user so two players don't share a column", () => {
    const seed = seedFromSessionId("sess-spawn-2");
    const a = spawnPointFor(seed, "user-a");
    const b = spawnPointFor(seed, "user-b");
    expect(a[0] === b[0] && a[2] === b[2]).toBe(false);
  });
});
