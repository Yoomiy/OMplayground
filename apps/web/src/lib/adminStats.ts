import { getClassroomServerUrl } from "./classroomServerUrl";
import { getVoxelRuntimeUrl } from "./voxelRuntimeUrl";

export interface RoomStat {
  sessionId: string;
  gameType: string;
  playerCount?: number;
  connectionCount?: number;
  uptimeSeconds?: number;
}

export interface ServiceStats {
  service: "game-server" | "voxel-server" | "classroom-server";
  activeConnections: number;
  activeRoomsCount: number;
  socketEventsPerSecond?: number;
  averageSocketEventLatencyMs?: number;
  socketEventFailuresLast5Min?: number;
  rooms: RoomStat[];
  voice?: { activeRooms: number; totalParticipants: number };
  mediaConnections?: number;
}

function gameServerUrl(): string {
  const fromEnv = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") return window.location.origin;
  return "http://localhost:8080";
}

async function fetchServiceStats(
  url: () => string,
  token: string,
  service: ServiceStats["service"]
): Promise<ServiceStats | null> {
  try {
    const voxel = service === "voxel-server";
    const res = await fetch(`${url().replace(/\/+$/, "")}${voxel ? "/api/voxel/admin-stats" : "/api/admin/stats"}`, {
      method: voxel ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(voxel ? { "Content-Type": "application/json" } : {}) },
      ...(voxel ? { body: "{}" } : {}),
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return null;
    const value = await res.json() as ServiceStats;
    if (value?.service !== service || !Array.isArray(value.rooms) ||
        !Number.isFinite(value.activeConnections) || value.activeConnections < 0 ||
        !Number.isFinite(value.activeRoomsCount) || value.activeRoomsCount < 0) return null;
    return value;
  } catch {
    // Configuration, timeout or an unavailable service must not hide healthy services.
    return null;
  }
}

export interface FederatedStats {
  game: ServiceStats | null;
  voxel: ServiceStats | null;
  classroom: ServiceStats | null;
}

export async function fetchFederatedAdminStats(token: string): Promise<FederatedStats> {
  const [game, voxel, classroom] = await Promise.all([
    fetchServiceStats(gameServerUrl, token, "game-server"),
    fetchServiceStats(getVoxelRuntimeUrl, token, "voxel-server"),
    fetchServiceStats(getClassroomServerUrl, token, "classroom-server")
  ]);
  return { game, voxel, classroom };
}
