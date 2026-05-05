import { BLOCK_REGISTRY, type Vec3 } from "./protocol";

/**
 * Pure voxel-world helpers. The server never renders; this module only
 * computes deterministic block IDs from a seed and tracks sparse deltas
 * applied on top of the procedural baseline.
 *
 * Hard rules (so persistence + tests stay sane):
 *   - getVoxelID is deterministic for a given (seed, x, y, z).
 *   - applyDelta is the only mutator; serializeDeltas / hydrateDeltas
 *     round-trip the resulting state.
 */

export interface WorldState {
  seed: number;
  /** key = "x,y,z" → blockId; air-overrides are stored as 0. */
  deltas: Map<string, number>;
}

export function createWorld(seed: number): WorldState {
  return { seed, deltas: new Map() };
}

export function deltaKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/**
 * djb2-style hash of the sessionId — turned into a positive 31-bit int so
 * the seed is stable across restarts and the test harness.
 */
export function seedFromSessionId(sessionId: string): number {
  let h = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    h = ((h << 5) + h + sessionId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Cheap deterministic hash for procedural noise — not crypto-grade. */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x9e3779b1);
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function smoothNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const h00 = hash3(xi, 0, zi, seed);
  const h10 = hash3(xi + 1, 0, zi, seed);
  const h01 = hash3(xi, 0, zi + 1, seed);
  const h11 = hash3(xi + 1, 0, zi + 1, seed);
  const fx = xf * xf * (3 - 2 * xf);
  const fz = zf * zf * (3 - 2 * zf);
  const a = h00 * (1 - fx) + h10 * fx;
  const b = h01 * (1 - fx) + h11 * fx;
  return a * (1 - fz) + b * fz;
}

/**
 * Returns the procedural block at (x,y,z), ignoring deltas. Tuned for a
 * gentle rolling terrain centered on y≈8 so the spawn point is always
 * above ground and reachable.
 */
export function proceduralVoxelID(
  x: number,
  y: number,
  z: number,
  seed: number
): number {
  const base = 8;
  const amp = 4;
  const heightF =
    smoothNoise(x / 16, z / 16, seed) * amp +
    smoothNoise(x / 4, z / 4, seed ^ 0x1234) * 1.2;
  const height = Math.floor(base + heightF);
  if (y > height) return BLOCK_REGISTRY.AIR;
  if (y === height) return BLOCK_REGISTRY.GRASS;
  if (y > height - 3) return BLOCK_REGISTRY.DIRT;
  return BLOCK_REGISTRY.STONE;
}

/**
 * Combined lookup honoring deltas. Use this on the client too (after
 * hydrating deltas) so views stay consistent.
 */
export function getVoxelID(
  world: WorldState,
  x: number,
  y: number,
  z: number
): number {
  const k = deltaKey(x, y, z);
  if (world.deltas.has(k)) {
    return world.deltas.get(k) as number;
  }
  return proceduralVoxelID(x, y, z, world.seed);
}

export function applyDelta(
  world: WorldState,
  x: number,
  y: number,
  z: number,
  blockId: number
): void {
  const k = deltaKey(x, y, z);
  if (blockId === proceduralVoxelID(x, y, z, world.seed)) {
    // Delta matches procedural baseline → drop to keep the map small.
    world.deltas.delete(k);
    return;
  }
  world.deltas.set(k, blockId);
}

export type DeltaTuple = [number, number, number, number];

export function serializeDeltas(world: WorldState): DeltaTuple[] {
  const out: DeltaTuple[] = [];
  for (const [k, v] of world.deltas) {
    const parts = k.split(",");
    if (parts.length !== 3) continue;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }
    out.push([x, y, z, v]);
  }
  return out;
}

export function hydrateDeltas(world: WorldState, list: DeltaTuple[]): void {
  for (const [x, y, z, id] of list) {
    world.deltas.set(deltaKey(x, y, z), id);
  }
}

/**
 * Returns a stable spawn 3 blocks above the procedural surface at the
 * given (x,z), so kids never spawn inside terrain. Per-user offset keeps
 * teammates from stacking on each other.
 */
export function spawnPointFor(
  seed: number,
  userId: string
): Vec3 {
  let h = 1469598103;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 16777619) ^ userId.charCodeAt(i);
  }
  const dx = ((h | 0) % 6) - 3;
  const dz = (((h >> 8) | 0) % 6) - 3;
  let surface = 8;
  for (let y = 24; y >= 0; y--) {
    if (proceduralVoxelID(dx, y, dz, seed) !== BLOCK_REGISTRY.AIR) {
      surface = y;
      break;
    }
  }
  return [dx + 0.5, surface + 3, dz + 0.5];
}
