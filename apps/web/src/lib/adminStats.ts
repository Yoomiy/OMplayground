export interface RoomStat {
  sessionId: string;
  gameType: string;
  playerCount: number;
  uptimeSeconds: number;
}

export interface ServiceStats {
  service: "game-server" | "minecraft-server";
  activeConnections: number;
  activeRoomsCount: number;
  intentsPerSecond: number;
  averageIntentLatencyMs: number;
  intentFailuresLast5Min: number;
  rooms: RoomStat[];
  voice?: { activeRooms: number; totalParticipants: number };
}

function gameServerUrl(): string {
  const fromEnv = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

function voxelServerUrl(): string {
  const fromEnv = import.meta.env.VITE_VOXEL_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "http://localhost:8081";
  throw new Error("VITE_VOXEL_SERVER_URL is not set");
}

async function fetchServiceStats(
  baseUrl: string,
  token: string
): Promise<ServiceStats | null> {
  const res = await fetch(`${baseUrl}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return (await res.json()) as ServiceStats;
}

export interface FederatedStats {
  game: ServiceStats | null;
  voxel: ServiceStats | null;
}

export async function fetchFederatedAdminStats(
  token: string
): Promise<FederatedStats> {
  const [game, voxel] = await Promise.all([
    fetchServiceStats(gameServerUrl(), token),
    fetchServiceStats(voxelServerUrl(), token)
  ]);
  return { game, voxel };
}
