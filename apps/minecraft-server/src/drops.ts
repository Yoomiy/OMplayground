import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import {
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  REGISTERED_ITEM_IDS,
  type Vec3,
  type WorldDrop,
  type WorldDropWireDelta
} from "./protocol";
import {
  addBlockCount,
  addItemCount,
  MAX_STACK,
  maxAddableBlockCount,
  maxAddableItemCount
} from "./inventory";
import type { PlayerRuntime, VoxelRoom } from "./room";
import type { WorldState } from "./world";
import { getVoxelID } from "./world";
import { TICK_INTERVAL_MS } from "./tick";

/** Squared radius — player anchor is ~torso height (see `pickupAnchor`). */
export const MAGNET_RADIUS_SQ = 2.25 * 2.25;

/** Drops despawn client-side-visible items after idle in world. */
export const DROP_TTL_MS = 1 * 60 * 1000;

/** NETWORK_BROADCAST_WORLD_DROP_UPDATES (~5 Hz). */
export const DROP_UPDATE_BROADCAST_MS = 200;

/**
 * Collision AABB vs voxels (~client drop cube 0.28). Diagonal clipping is avoided
 * by resolving this box vs solid cells, not a single center column.
 */
export const DROP_PHYS_HALF_XZ = 0.198; // 0.28 * sqrt(2) / 2
export const DROP_PHYS_HALF_Y = 0.142;

/** Center-to-center distance to merge sibling stacks (blocks). */
const MERGE_RADIUS_SQ = 0.38 * 0.38;

const GRAVITY_Y = -32;
const AIR_DRAG = 0.94;
const GROUND_DRAG = 0.86;

const EPS_POS = 1e-5;

export function listDropsWire(room: VoxelRoom): WorldDrop[] {
  return Array.from(room.drops.values());
}

function ensureDropBroadcast(room: VoxelRoom): void {
  if (!room.dropSyncIds) room.dropSyncIds = new Set();
}

function flagDropMoved(room: VoxelRoom, id: string): void {
  ensureDropBroadcast(room);
  room.dropSyncIds.add(id);
}

export interface SpawnDropOpts {
  spawnedAtMs?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export function spawnBlockDropAt(
  room: VoxelRoom,
  pos: Vec3,
  blockId: number,
  count: number,
  opts?: SpawnDropOpts
): WorldDrop | null {
  if (!PLACEABLE_BLOCK_IDS.includes(blockId) || count < 1) return null;
  const t = opts?.spawnedAtMs ?? Date.now();
  const drop: WorldDrop = {
    id: randomUUID(),
    kind: "block",
    pos: [...pos] as Vec3,
    blockId,
    count,
    spawnedAt: t
  };
  if (opts?.vx !== undefined) drop.vx = opts.vx;
  if (opts?.vy !== undefined) drop.vy = opts.vy;
  if (opts?.vz !== undefined) drop.vz = opts.vz;
  room.drops.set(drop.id, drop);
  return drop;
}

export function spawnItemDropAt(
  room: VoxelRoom,
  pos: Vec3,
  itemId: number,
  count: number,
  opts?: SpawnDropOpts
): WorldDrop | null {
  if (!REGISTERED_ITEM_IDS.has(itemId) || count < 1) return null;
  const t = opts?.spawnedAtMs ?? Date.now();
  const drop: WorldDrop = {
    id: randomUUID(),
    kind: "item",
    pos: [...pos] as Vec3,
    itemId,
    count,
    spawnedAt: t
  };
  if (opts?.vx !== undefined) drop.vx = opts.vx;
  if (opts?.vy !== undefined) drop.vy = opts.vy;
  if (opts?.vz !== undefined) drop.vz = opts.vz;
  room.drops.set(drop.id, drop);
  return drop;
}

export function clearDropsBroadcast(io: Server, room: VoxelRoom): void {
  if (room.drops.size === 0) return;
  ensureDropBroadcast(room);
  const sessionId = room.sessionId;
  for (const id of room.drops.keys()) {
    io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "WORLD_DROP_REMOVED",
      id
    });
  }
  room.drops.clear();
  room.dropSyncIds.clear();
}

function distSq(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

function pickupAnchor(pos: Vec3): [number, number, number] {
  return [pos[0], pos[1] + 0.9, pos[2]];
}

function emitInventorySyncToPlayer(
  io: Server,
  sessionId: string,
  userId: string,
  player: PlayerRuntime
): void {
  void (async () => {
    const inv = player.inventory;
    const items = player.itemInventory;
    const craft = player.craftingGrid;
    const equipment = player.equipmentSlots;
    if (!inv || !items || !craft || !equipment) return;
    const socks = await io.in(`voxel:${sessionId}`).fetchSockets();
    for (const s of socks) {
      if (s.data.userId === userId) {
        s.emit("INVENTORY_SYNC", {
          slots: inv,
          itemSlots: items,
          equipmentSlots: equipment,
          craftingSlots: craft,
          craftingGridWidth: player.craftingGridWidth ?? 2
        });
        return;
      }
    }
  })();
}

function tryPickupDropForPlayer(
  io: Server,
  room: VoxelRoom,
  player: PlayerRuntime,
  dropId: string,
  drop: WorldDrop
): boolean {
  const sessionId = room.sessionId;
  const inv = player.inventory;
  const items = player.itemInventory;
  const craft = player.craftingGrid;
  if (!inv || !items || !craft) return false;

  if (drop.kind === "block") {
    if (!PLACEABLE_BLOCK_IDS.includes(drop.blockId)) return false;
    if (maxAddableBlockCount(inv, drop.blockId) < drop.count) return false;
    addBlockCount(inv, drop.blockId, drop.count);
  } else {
    if (!REGISTERED_ITEM_IDS.has(drop.itemId)) return false;
    if (maxAddableItemCount(items, drop.itemId) < drop.count) return false;
    addItemCount(items, drop.itemId, drop.count);
  }

  room.drops.delete(dropId);
  ensureDropBroadcast(room);
  room.dropSyncIds.delete(dropId);
  io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
    sessionId,
    kind: "WORLD_DROP_REMOVED",
    id: dropId
  });
  emitInventorySyncToPlayer(io, sessionId, player.userId, player);
  return true;
}

export function tickMagnetPickups(io: Server, room: VoxelRoom): void {
  if ((room.gameMode ?? "creative") !== "survival") return;
  if (room.drops.size === 0) return;

  const pickedDropIds = new Set<string>();
  for (const player of room.players.values()) {
    const a = pickupAnchor(player.pos);
    for (const [id, drop] of room.drops) {
      if (pickedDropIds.has(id)) continue;
      if (
        distSq(a[0], a[1], a[2], drop.pos[0], drop.pos[1], drop.pos[2]) >
        MAGNET_RADIUS_SQ
      ) {
        continue;
      }
      if (tryPickupDropForPlayer(io, room, player, id, drop)) {
        pickedDropIds.add(id);
        break;
      }
    }
  }
}

export function dropPositionInFrontOfPlayer(player: PlayerRuntime): Vec3 {
  const h = player.heading;
  const dx = Math.sin(h) * 0.65;
  const dz = Math.cos(h) * 0.65;
  return [player.pos[0] + dx, player.pos[1] + 0.2, player.pos[2] + dz];
}

/** Scatter + impulse for stacks popped from breaking a block voxel. */
export function scatterImpulseBreakDrop(): Pick<SpawnDropOpts, "vx" | "vy" | "vz"> {
  const theta = Math.random() * Math.PI * 2;
  const horiz = 0.9 + Math.random() * 0.55;
  return {
    vx: Math.sin(theta) * horiz,
    vy: 1.6 + Math.random() * 1.4,
    vz: Math.cos(theta) * horiz
  };
}

/** Horizontal jitter around block column center (+ small vertical lift). */
export function jitterBreakSpawnPosition(cx: number, cy: number, cz: number): Vec3 {
  const theta = Math.random() * Math.PI * 2;
  const r = 0.1 + Math.random() * 0.22;
  return [cx + 0.5 + Math.sin(theta) * r, cy + 0.22 + Math.random() * 0.08, cz + 0.5 + Math.cos(theta) * r];
}

function isSolid(world: WorldState, x: number, y: number, z: number): boolean {
  return getVoxelID(world, x, y, z) !== BLOCK_REGISTRY.AIR;
}

/** Y center for a resting drop atop the nearest solid voxel under `py`. */
function findSupportingRestY(
  world: WorldState,
  ix: number,
  iz: number,
  py: number
): number | null {
  const footProbe = py - DROP_PHYS_HALF_Y;
  let scan = Math.floor(footProbe - 1e-4);
  for (let k = 0; k < 240; k++) {
    const yi = scan - k;
    if (yi < -280) return null;
    if (!isSolid(world, ix, yi, iz)) continue;
    return yi + 1 + DROP_PHYS_HALF_Y + 1e-3;
  }
  return null;
}

const DEPENET_EPS = 1.2e-3;

/** Push axis-aligned physics box out of overlapping solid cells (floors/walls/diagonal corners). */
function depenetrateDropFromVoxels(
  world: WorldState,
  px: number,
  py: number,
  pz: number,
  vx: number,
  vy: number,
  vz: number
): { px: number; py: number; pz: number; vx: number; vy: number; vz: number } {
  let x = px;
  let y = py;
  let z = pz;
  let cvx = vx;
  let cvy = vy;
  let cvz = vz;

  const hx = DROP_PHYS_HALF_XZ;
  const hy = DROP_PHYS_HALF_Y;
  const hz = DROP_PHYS_HALF_XZ;

  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    const gx0 = Math.floor(x - hx);
    const gx1 = Math.floor(x + hx);
    const gy0 = Math.floor(y - hy);
    const gy1 = Math.floor(y + hy);
    const gz0 = Math.floor(z - hz);
    const gz1 = Math.floor(z + hz);

    for (let bx = gx0; bx <= gx1; bx++) {
      for (let by = gy0; by <= gy1; by++) {
        for (let bz = gz0; bz <= gz1; bz++) {
          if (!isSolid(world, bx, by, bz)) continue;

          const ox =
            Math.min(x + hx, bx + 1 + 4e-7) -
            Math.max(x - hx, bx - 4e-7);
          const oy =
            Math.min(y + hy, by + 1 + 4e-7) -
            Math.max(y - hy, by - 4e-7);
          const oz =
            Math.min(z + hz, bz + 1 + 4e-7) -
            Math.max(z - hz, bz - 4e-7);

          if (ox <= 0 || oy <= 0 || oz <= 0) continue;

          if (ox < oy && ox < oz) {
            const sign = x < bx + 0.5 ? -1 : 1;
            x += sign * (ox + DEPENET_EPS);
            cvx *= 0.12;
          } else if (oy < oz) {
            const sign = y < by + 0.5 ? -1 : 1;
            y += sign * (oy + DEPENET_EPS);
            cvy *= 0.08;
          } else {
            const sign = z < bz + 0.5 ? -1 : 1;
            z += sign * (oz + DEPENET_EPS);
            cvz *= 0.12;
          }

          moved = true;
          break;
        }
        if (moved) break;
      }
      if (moved) break;
    }

    if (!moved) break;
  }

  return { px: x, py: y, pz: z, vx: cvx, vy: cvy, vz: cvz };
}

function sameStackPayload(a: WorldDrop, b: WorldDrop): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "block") {
    return b.kind === "block" && a.blockId === b.blockId;
  }
  return b.kind === "item" && a.itemId === b.itemId;
}

/** Non-mergeable stacks behave like small crates: separate overlapping collision boxes. */
function separateDissimilarDrops(room: VoxelRoom, changed: Set<string>): void {
  const list = [...room.drops.values()];
  const hx = DROP_PHYS_HALF_XZ;
  const hy = DROP_PHYS_HALF_Y;
  const hz = DROP_PHYS_HALF_XZ;

  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      if (sameStackPayload(a, b)) continue;

      const dx = b.pos[0] - a.pos[0];
      const dy = b.pos[1] - a.pos[1];
      const dz = b.pos[2] - a.pos[2];

      const ox = Math.min(a.pos[0] + hx, b.pos[0] + hx) - Math.max(a.pos[0] - hx, b.pos[0] - hx);
      const oy = Math.min(a.pos[1] + hy, b.pos[1] + hy) - Math.max(a.pos[1] - hy, b.pos[1] - hy);
      const oz = Math.min(a.pos[2] + hz, b.pos[2] + hz) - Math.max(a.pos[2] - hz, b.pos[2] - hz);

      if (ox <= 0 || oy <= 0 || oz <= 0) continue;

      let pushAxis: "x" | "y" | "z";
      let mag: number;
      if (ox < oy && ox < oz) {
        pushAxis = "x";
        mag = (ox + DEPENET_EPS) * 0.5;
      } else if (oy < oz) {
        pushAxis = "y";
        mag = (oy + DEPENET_EPS) * 0.5;
      } else {
        pushAxis = "z";
        mag = (oz + DEPENET_EPS) * 0.5;
      }

      let sx = 0;
      let sy = 0;
      let sz = 0;
      if (pushAxis === "x") {
        if (Math.abs(dx) > 1e-5) sx = dx > 0 ? 1 : -1;
        else sx = a.id.localeCompare(b.id) <= 0 ? -1 : 1;
      } else if (pushAxis === "y") {
        if (Math.abs(dy) > 1e-5) sy = dy > 0 ? 1 : -1;
        else sy = a.id.localeCompare(b.id) <= 0 ? -1 : 1;
      } else if (Math.abs(dz) > 1e-5) {
        sz = dz > 0 ? 1 : -1;
      } else {
        sz = a.id.localeCompare(b.id) <= 0 ? -1 : 1;
      }

      a.pos[0] -= sx * mag;
      a.pos[1] -= sy * mag;
      a.pos[2] -= sz * mag;
      b.pos[0] += sx * mag;
      b.pos[1] += sy * mag;
      b.pos[2] += sz * mag;

      if (sx !== 0) {
        a.vx = (a.vx ?? 0) * 0.35;
        b.vx = (b.vx ?? 0) * 0.35;
      }
      if (sy !== 0) {
        a.vy = (a.vy ?? 0) * 0.35;
        b.vy = (b.vy ?? 0) * 0.35;
      }
      if (sz !== 0) {
        a.vz = (a.vz ?? 0) * 0.35;
        b.vz = (b.vz ?? 0) * 0.35;
      }

      changed.add(a.id);
      changed.add(b.id);
    }
  }
}

function simulateOneDrop(
  world: WorldState,
  drop: WorldDrop,
  dt: number,
  markChanged: (id: string) => void
): void {
  const id = drop.id;
  let [px, py, pz] = drop.pos;
  const ox = px;
  const oy = py;
  const oz = pz;

  let vx = drop.vx ?? 0;
  let vy = drop.vy ?? 0;
  let vz = drop.vz ?? 0;

  vy += GRAVITY_Y * dt;
  px += vx * dt;
  py += vy * dt;
  pz += vz * dt;

  const solved = depenetrateDropFromVoxels(world, px, py, pz, vx, vy, vz);
  px = solved.px;
  py = solved.py;
  pz = solved.pz;
  vx = solved.vx;
  vy = solved.vy;
  vz = solved.vz;

  const ix = Math.floor(px);
  const iz = Math.floor(pz);

  let grounded = false;
  const restY = findSupportingRestY(world, ix, iz, py);
  if (restY !== null && py <= restY + 0.12 && vy <= 1.35) {
    py = restY;
    vy = 0;
    vx *= GROUND_DRAG;
    vz *= GROUND_DRAG;
    grounded = true;
  }

  if (!grounded) {
    vx *= AIR_DRAG;
    vz *= AIR_DRAG;
  }

  drop.pos = [px, py, pz];
  drop.vx = vx;
  drop.vy = vy;
  drop.vz = vz;

  if (
    Math.abs(px - ox) > EPS_POS ||
    Math.abs(py - oy) > EPS_POS ||
    Math.abs(pz - oz) > EPS_POS
  ) {
    markChanged(id);
  }
}

/** Merge pairwise equal stacks closer than merge radius (partial merges). */
function mergeStackingDrops(io: Server, room: VoxelRoom): void {
  const sessionId = room.sessionId;
  const ids = [...room.drops.keys()];
  const tomb = new Set<string>();

  for (let i = 0; i < ids.length; i++) {
    const idA = ids[i];
    if (tomb.has(idA)) continue;
    const a = room.drops.get(idA);
    if (!a) continue;

    for (let j = i + 1; j < ids.length; j++) {
      const idB = ids[j];
      if (tomb.has(idB)) continue;
      const b = room.drops.get(idB);
      if (!b) continue;
      if (!sameStackPayload(a, b)) continue;

      if (
        distSq(a.pos[0], a.pos[1], a.pos[2], b.pos[0], b.pos[1], b.pos[2]) >
        MERGE_RADIUS_SQ
      ) {
        continue;
      }

      const keeper = idA.localeCompare(idB) < 0 ? a : b;
      const loser = keeper === a ? b : a;
      const loserId = keeper === a ? idB : idA;
      const keeperId = keeper === a ? idA : idB;

      const space = MAX_STACK - keeper.count;
      if (space <= 0) continue;
      const take = Math.min(space, loser.count);
      keeper.count += take;
      loser.count -= take;
      ensureDropBroadcast(room);
      room.dropSyncIds.add(keeperId);
      if (loser.count <= 0) {
        room.drops.delete(loserId);
        tomb.add(loserId);
        room.dropSyncIds.delete(loserId);
        io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "WORLD_DROP_REMOVED",
          id: loserId
        });
      } else {
        loser.pos = [...keeper.pos] as Vec3;
        loser.vx = keeper.vx;
        loser.vy = keeper.vy;
        loser.vz = keeper.vz;
        room.dropSyncIds.add(loserId);
      }
    }
  }
}

function expireTimedOutDrops(io: Server, room: VoxelRoom, nowMs: number): void {
  const sessionId = room.sessionId;
  for (const [id, drop] of [...room.drops]) {
    if (drop.spawnedAt === undefined) {
      drop.spawnedAt = nowMs;
      continue;
    }
    if (nowMs - drop.spawnedAt <= DROP_TTL_MS) continue;
    ensureDropBroadcast(room);
    room.dropSyncIds.delete(id);
    room.drops.delete(id);
    io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "WORLD_DROP_REMOVED",
      id
    });
  }
}

function emitDropUpdateBatch(io: Server, room: VoxelRoom, nowMs: number): void {
  ensureDropBroadcast(room);
  if (nowMs - room.lastDropBroadcastAt < DROP_UPDATE_BROADCAST_MS) return;
  if (room.dropSyncIds.size === 0) return;

  const updates: WorldDropWireDelta[] = [];
  for (const id of [...room.dropSyncIds]) {
    const d = room.drops.get(id);
    if (d) updates.push({ id, pos: [...d.pos] as Vec3, count: d.count });
  }
  room.dropSyncIds.clear();
  room.lastDropBroadcastAt = nowMs;
  if (updates.length === 0) return;
  io.to(`voxel:${room.sessionId}`).emit("ROOM_EVENT", {
    sessionId: room.sessionId,
    kind: "WORLD_DROP_UPDATE",
    updates
  });
}

/**
 * One server tick (~15 Hz): TTL, kinematics toward voxel column support, merges,
 * then batched position broadcast (~5 Hz).
 */
export function tickWorldDrops(io: Server, room: VoxelRoom, nowMs: number): void {
  if ((room.gameMode ?? "creative") !== "survival") return;
  ensureDropBroadcast(room);
  if (room.drops.size === 0) {
    emitDropUpdateBatch(io, room, nowMs);
    return;
  }

  expireTimedOutDrops(io, room, nowMs);

  const dt = TICK_INTERVAL_MS / 1000;
  const ids = [...room.drops.keys()];
  const changed = (id: string): void => flagDropMoved(room, id);

  for (const id of ids) {
    const d = room.drops.get(id);
    if (!d) continue;
    if (d.spawnedAt === undefined) d.spawnedAt = nowMs;
    simulateOneDrop(room.world, d, dt, changed);
  }

  const pairTouched = new Set<string>();
  separateDissimilarDrops(room, pairTouched);
  for (const id of pairTouched) flagDropMoved(room, id);

  for (const d of room.drops.values()) {
    const ox = d.pos[0];
    const oy = d.pos[1];
    const oz = d.pos[2];
    const s = depenetrateDropFromVoxels(
      room.world,
      d.pos[0],
      d.pos[1],
      d.pos[2],
      d.vx ?? 0,
      d.vy ?? 0,
      d.vz ?? 0
    );
    d.pos[0] = s.px;
    d.pos[1] = s.py;
    d.pos[2] = s.pz;
    d.vx = s.vx;
    d.vy = s.vy;
    d.vz = s.vz;
    if (
      Math.abs(d.pos[0] - ox) > EPS_POS ||
      Math.abs(d.pos[1] - oy) > EPS_POS ||
      Math.abs(d.pos[2] - oz) > EPS_POS
    ) {
      flagDropMoved(room, d.id);
    }
  }

  mergeStackingDrops(io, room);
  emitDropUpdateBatch(io, room, nowMs);
}
