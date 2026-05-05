import type { SupabaseClient } from "@supabase/supabase-js";
import { isWithinRecess, type RecessWindowRow } from "./recess";
import {
  connectedPlayers,
  deleteRoom,
  listRooms,
  snapshotPersistedState,
  type VoxelRoom
} from "./room";
import { persistRecessPause } from "./sessionPersistence";

/**
 * Recess-end sweep — adapted from apps/game-server/src/recessSweep.ts. The
 * shape is identical so tests can stay close to the existing pattern; the
 * only difference is the gameState payload is the voxel snapshot.
 */

export interface RecessIoShape {
  to(room: string): {
    emit(event: string, payload: unknown): unknown;
  };
  in(room: string): {
    fetchSockets(): Promise<
      { data: { role?: string }; disconnect(close: boolean): void }[]
    >;
  };
}

export interface RecessEndSweepDeps {
  supabase: SupabaseClient | null;
  loadSchedules: () => Promise<RecessWindowRow[]>;
  io: RecessIoShape;
  now?: () => Date;
  rooms?: () => VoxelRoom[];
  remove?: (sessionId: string) => void;
}

export interface RecessSweepState {
  activeLastTick: boolean | null;
}

export function createRecessSweepState(): RecessSweepState {
  return { activeLastTick: null };
}

export async function recessEndSweep(
  state: RecessSweepState,
  deps: RecessEndSweepDeps
): Promise<{ evictedSessionIds: string[] }> {
  if (!deps.supabase) return { evictedSessionIds: [] };
  let schedules: RecessWindowRow[];
  try {
    schedules = await deps.loadSchedules();
  } catch (err) {
    console.error(
      "recess sweep failed to load schedules",
      err instanceof Error ? err.message : err
    );
    return { evictedSessionIds: [] };
  }
  const now = (deps.now ?? (() => new Date()))();
  const active = schedules.length > 0 && isWithinRecess(now, schedules);
  const flippedToInactive = state.activeLastTick === true && !active;
  state.activeLastTick = active;
  if (!flippedToInactive) return { evictedSessionIds: [] };

  const iso = now.toISOString();
  const rooms = (deps.rooms ?? listRooms)();
  const remove = deps.remove ?? deleteRoom;
  const evicted: string[] = [];
  for (const room of rooms) {
    const sessionId = room.sessionId;
    const connected = connectedPlayers(room);
    await persistRecessPause({
      supabase: deps.supabase,
      sessionId,
      gameState: snapshotPersistedState(room),
      connectedPlayerIds: connected.map((p) => p.userId),
      connectedPlayerNames: connected.map((p) => p.displayName),
      now: iso
    });
    deps.io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "RECESS_ENDED"
    });
    const sockets = await deps.io.in(`voxel:${sessionId}`).fetchSockets();
    for (const s of sockets) {
      if (s.data.role === "kid") {
        s.disconnect(true);
      }
    }
    remove(sessionId);
    evicted.push(sessionId);
  }
  return { evictedSessionIds: evicted };
}
