import { RoomServiceClient } from "livekit-server-sdk";
import type { VoiceStats } from "./statsCollector";

const CACHE_MS = 12_000;

let cached: { at: number; stats: VoiceStats } | null = null;

export async function fetchLiveKitVoiceStats(
  livekitUrl: string,
  apiKey: string,
  apiSecret: string
): Promise<VoiceStats | undefined> {
  if (!livekitUrl || !apiKey || !apiSecret) return undefined;

  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    return cached.stats;
  }

  try {
    const host = livekitUrl
      .replace(/^wss:\/\//, "https://")
      .replace(/^ws:\/\//, "http://");
    const client = new RoomServiceClient(host, apiKey, apiSecret);
    const rooms = await client.listRooms();
    let totalParticipants = 0;
    for (const room of rooms) {
      totalParticipants += room.numParticipants ?? 0;
    }
    const stats: VoiceStats = {
      activeRooms: rooms.length,
      totalParticipants
    };
    cached = { at: now, stats };
    return stats;
  } catch {
    return cached?.stats;
  }
}
