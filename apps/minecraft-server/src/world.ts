import {
  BLOCK_REGISTRY,
  SEA_LEVEL,
  SPAWN_SCAN_MAX_Y,
  blockReplaceable,
  findSurfaceY,
  isSpawnLocationSafe,
  proceduralVoxelID
} from "@playground/voxel-content";
import type { Vec3 } from "./protocol";

export { proceduralVoxelID };

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

const SPAWN_SURFACE_CLEARANCE = 2;
const SPAWN_SEARCH_RADIUS = 1024;
const SPAWN_SEARCH_STEP = 8;

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
 * Returns a stable spawn 2 blocks above a dry procedural surface at the
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

  const baseX = ((h | 0) % 12) - 6;
  const baseZ = (((h >> 8) | 0) % 12) - 6;
  for (let radius = 0; radius <= SPAWN_SEARCH_RADIUS; radius += SPAWN_SEARCH_STEP) {
    const probes = radius === 0 ? 1 : Math.max(12, Math.ceil(radius / 16));
    for (let i = 0; i < probes; i++) {
      const angle = ((i + (h & 7)) / probes) * Math.PI * 2;
      const x = Math.round(baseX + Math.cos(angle) * radius);
      const z = Math.round(baseZ + Math.sin(angle) * radius);
      if (isSpawnLocationSafe(x, z, seed)) {
        return [
          x + 0.5,
          findSurfaceY(x, z, seed) + SPAWN_SURFACE_CLEARANCE,
          z + 0.5
        ];
      }
    }
  }

  const surface = findSurfaceY(0, 0, seed);
  let y = Math.max(
    surface + SPAWN_SURFACE_CLEARANCE,
    SEA_LEVEL + SPAWN_SURFACE_CLEARANCE
  );
  while (
    y <= SPAWN_SCAN_MAX_Y + 8 &&
    proceduralVoxelID(0, y, 0, seed) !== BLOCK_REGISTRY.AIR
  ) {
    y += 1;
  }
  return [0.5, y, 0.5];
}

export function isSpawnPointSafe(world: WorldState, point: Vec3): boolean {
  const [px, py, pz] = point;
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
    return false;
  }
  const x = Math.floor(px);
  const y = Math.floor(py);
  const z = Math.floor(pz);
  const floorBlock = getVoxelID(world, x, y - SPAWN_SURFACE_CLEARANCE, z);
  if (
    floorBlock === BLOCK_REGISTRY.AIR ||
    floorBlock === BLOCK_REGISTRY.WATER ||
    blockReplaceable(floorBlock)
  ) {
    return false;
  }
  for (let yy = y - 1; yy <= y + 1; yy++) {
    const blockId = getVoxelID(world, x, yy, z);
    if (blockId !== BLOCK_REGISTRY.AIR) return false;
  }
  return true;
}

export function replacementBlockAfterBreak(
  world: WorldState,
  x: number,
  y: number,
  z: number
): number {
  if (y > SEA_LEVEL) return BLOCK_REGISTRY.AIR;
  if (proceduralVoxelID(x, y, z, world.seed) === BLOCK_REGISTRY.WATER) {
    return BLOCK_REGISTRY.WATER;
  }
  const neighbors = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ] as const;
  for (const [dx, dy, dz] of neighbors) {
    if (getVoxelID(world, x + dx, y + dy, z + dz) === BLOCK_REGISTRY.WATER) {
      return BLOCK_REGISTRY.WATER;
    }
  }
  return BLOCK_REGISTRY.AIR;
}
