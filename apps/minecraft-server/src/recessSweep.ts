import { listRooms, type VoxelRoom } from "./room";

export interface RecessSocketData {
  role?: string;
  grade?: string | null;
  gender?: "boy" | "girl";
  userId?: string;
}

export interface RecessIoShape {
  in(room: string): {
    fetchSockets(): Promise<{
      data: RecessSocketData;
      emit(event: string, payload: unknown): unknown;
      disconnect(close: boolean): void;
    }[]>;
  };
}

export interface RecessEndSweepDeps {
  io: RecessIoShape;
  isKidAllowed: (grade: string, gender: "boy" | "girl") => Promise<boolean>;
  rooms?: () => VoxelRoom[];
  logError?: (message: string, err: unknown) => void;
}

export interface RecessSweepState {}

export function createRecessSweepState(): RecessSweepState {
  return {};
}

export async function recessEndSweep(
  _state: RecessSweepState,
  deps: RecessEndSweepDeps
): Promise<{ evictedUserIds: string[] }> {
  const evictedUserIds: string[] = [];
  for (const room of (deps.rooms ?? listRooms)()) {
    const sockets = await deps.io.in(`voxel:${room.sessionId}`).fetchSockets();
    for (const socket of sockets) {
      const { role, grade, gender, userId } = socket.data;
      if (role !== "kid" || !grade || (gender !== "boy" && gender !== "girl")) continue;
      try {
        if (await deps.isKidAllowed(grade, gender)) continue;
        socket.emit("ROOM_EVENT", { sessionId: room.sessionId, kind: "RECESS_ENDED" });
        socket.disconnect(true);
        if (userId) evictedUserIds.push(userId);
      } catch (error) {
        deps.logError?.("recess sweep failed to evaluate class schedule", error);
      }
    }
  }
  return { evictedUserIds };
}
