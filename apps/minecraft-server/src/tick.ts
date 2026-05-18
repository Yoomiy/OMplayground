import type { RoomSnapshot } from "./protocol";
import { listRooms, type VoxelRoom } from "./room";

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
  /** Optional survival magnet pickups (skipped in tests). */
  magnetPickups?: (room: VoxelRoom) => void;
  /** Survival drop physics + WORLD_DROP_UPDATE coalescing. */
  worldDropsTick?: (room: VoxelRoom) => void;
}

function buildSnapshot(room: VoxelRoom): RoomSnapshot {
  const players: RoomSnapshot["players"] = {};
  for (const p of room.players.values()) {
    players[p.userId] = {
      pos: p.pos,
      heading: p.heading,
      pitch: p.pitch,
      jumping: p.jumping,
      t: p.t
    };
  }
  return { players };
}

export function tickOnce(deps: TickDeps): { emittedSessionIds: string[] } {
  const rooms = (deps.rooms ?? listRooms)();
  const now = (deps.now ?? Date.now)();
  const emitted: string[] = [];
  for (const room of rooms) {
    if (!room.paused && room.players.size > 0) {
      deps.worldDropsTick?.(room);
      deps.magnetPickups?.(room);
    }
    if (room.paused) continue;
    if (room.players.size === 0) continue;
    if (!room.dirty) continue;
    deps.io
      .to(`voxel:${room.sessionId}`)
      .emit("ROOM_SNAPSHOT", buildSnapshot(room));
    room.dirty = false;
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
      console.error(
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
