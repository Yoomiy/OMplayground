import type { RoomSnapshot } from "./protocol";
import { listRooms, markAllPlayersDirty, type VoxelRoom } from "./room";
import { cloneVitals } from "./vitals";

/**
 * 15 Hz coalesced snapshot emitter. We never emit more than once per tick
 * per room, and we skip rooms that are paused, empty, or have nothing new
 * since the last tick (`dirty` flag flipped by INPUT/BLOCK handlers).
 *
 * Pure function so the tick.test.ts harness can call it with a fake Io
 * and a fake clock — `index.ts` only owns the setInterval.
 */

export const TICK_INTERVAL_MS = 66;

export interface TickIoShape {
  to(room: string): {
    emit(event: string, payload: unknown): unknown;
  };
}

export interface TickDeps {
  io: TickIoShape;
  rooms?: () => VoxelRoom[];
  now?: () => number;
  onError?: (message: string, err: unknown) => void;
  /** Optional survival magnet pickups (skipped in tests). */
  magnetPickups?: (room: VoxelRoom) => void;
  /** Survival drop physics + WORLD_DROP_UPDATE coalescing. */
  worldDropsTick?: (room: VoxelRoom) => void;
  /** Survival hunger/health progression. */
  survivalVitalsTick?: (room: VoxelRoom, now: number) => void;
  /** Survival TNT fuses/explosions. */
  tntTick?: (room: VoxelRoom, now: number) => void;
  /** Climate/precipitation world mutations. */
  weatherTick?: (room: VoxelRoom, now: number) => void;
}

function buildPlayerSnapshot(
  room: VoxelRoom,
  userId: string,
  forTeachers: boolean
): RoomSnapshot["players"][string] | null {
  const p = room.players.get(userId);
  if (!p) return null;
  if (!forTeachers && p.isTeacherObserver) return null;
  return {
    pos: p.pos,
    heading: p.heading,
    pitch: p.pitch,
    jumping: p.jumping,
    t: p.t,
    isTeacher: p.isTeacher,
    isTeacherObserver: p.isTeacherObserver,
    ...(p.health !== undefined ? { vitals: cloneVitals(p) } : {})
  };
}

function buildPlayerDelta(
  room: VoxelRoom,
  userIds: Iterable<string>,
  forTeachers: boolean
): RoomSnapshot {
  const players: RoomSnapshot["players"] = {};
  for (const userId of userIds) {
    const snap = buildPlayerSnapshot(room, userId, forTeachers);
    if (snap) players[userId] = snap;
  }
  return { players };
}

export function buildSnapshot(room: VoxelRoom, forTeachers: boolean): RoomSnapshot {
  return buildPlayerDelta(room, room.players.keys(), forTeachers);
}

export function tickOnce(deps: TickDeps): { emittedSessionIds: string[] } {
  const rooms = (deps.rooms ?? listRooms)();
  const now = (deps.now ?? Date.now)();
  const emitted: string[] = [];
  for (const room of rooms) {
    const isSurvival = (room.gameMode ?? "survival") === "survival";
    if (!room.paused && room.players.size > 0 && isSurvival) {
      deps.survivalVitalsTick?.(room, now);
      deps.tntTick?.(room, now);
      deps.weatherTick?.(room, now);
      if (room.drops.size > 0 || room.activeTnts.size > 0) {
        deps.worldDropsTick?.(room);
        deps.magnetPickups?.(room);
      }
    }
    if (room.paused) continue;
    if (room.players.size === 0) continue;
    if (!room.dirty) continue;

    const syncIds =
      room.dirtyPlayerIds.size > 0
        ? room.dirtyPlayerIds
        : new Set(room.players.keys());

    deps.io
      .to(`voxel-snapshot:${room.sessionId}`)
      .emit("PLAYER_DELTA", buildPlayerDelta(room, syncIds, false));
    deps.io
      .to(`voxel-snapshot-teacher:${room.sessionId}`)
      .emit("PLAYER_DELTA", buildPlayerDelta(room, syncIds, true));

    room.dirty = false;
    room.dirtyPlayerIds.clear();
    room.lastTickAt = now;
    emitted.push(room.sessionId);
  }
  return { emittedSessionIds: emitted };
}

export function startTickLoop(deps: TickDeps): { stop: () => void } {
  const timer = setInterval(() => {
    try {
      tickOnce(deps);
    } catch (err) {
      deps.onError?.(
        "voxel tick error",
        err instanceof Error ? err.message : err
      );
    }
  }, TICK_INTERVAL_MS);
  timer.unref?.();
  return {
    stop: () => clearInterval(timer)
  };
}
