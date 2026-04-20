import type { SupabaseClient } from "@supabase/supabase-js";
import { isWithinRecess, type RecessWindowRow } from "./recess";
import { persistRecessPause } from "./lifecycle";
import { deleteRoom, listRooms, type Room } from "./room";

/**
 * Shape of the Socket.io surface we depend on. Kept narrow so tests can
 * drop in a stub instead of booting a real server.
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
  rooms?: () => Room<unknown>[];
  remove?: (sessionId: string) => void;
}

/**
 * Tracks whether the previous tick saw an active recess window. Only when
 * the flag flips true→false do we evict rooms — steady-state ticks are
 * no-ops so the sweep can run cheaply at 30s intervals.
 */
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
  const schedules = await deps.loadSchedules();
  if (!schedules.length) {
    state.activeLastTick = null;
    return { evictedSessionIds: [] };
  }
  const now = (deps.now ?? (() => new Date()))();
  const active = isWithinRecess(now, schedules);
  const flippedToInactive = state.activeLastTick === true && !active;
  state.activeLastTick = active;
  if (!flippedToInactive) return { evictedSessionIds: [] };

  const iso = now.toISOString();
  const rooms = (deps.rooms ?? listRooms)();
  const remove = deps.remove ?? deleteRoom;
  const evicted: string[] = [];
  for (const room of rooms) {
    const sessionId = room.sessionId;
    await persistRecessPause({
      supabase: deps.supabase,
      sessionId,
      gameState: room.state,
      now: iso
    });
    deps.io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "RECESS_ENDED"
    });
    const sockets = await deps.io.in(`session:${sessionId}`).fetchSockets();
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
