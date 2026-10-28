"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLiveKitVoiceStats = fetchLiveKitVoiceStats;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const CACHE_MS = 12_000;
let cached = null;
async function fetchLiveKitVoiceStats(livekitUrl, apiKey, apiSecret) {
    if (!livekitUrl || !apiKey || !apiSecret)
        return undefined;
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MS) {
        return cached.stats;
    }
    try {
        const host = livekitUrl
            .replace(/^wss:\/\//, "https://")
            .replace(/^ws:\/\//, "http://");
        const client = new livekit_server_sdk_1.RoomServiceClient(host, apiKey, apiSecret);
        const rooms = await client.listRooms();
        let totalParticipants = 0;
        for (const room of rooms) {
            totalParticipants += room.numParticipants ?? 0;
        }
        const stats = {
            activeRooms: rooms.length,
            totalParticipants
        };
        cached = { at: now, stats };
        return stats;
    }
    catch {
        return cached?.stats;
    }
}
//# sourceMappingURL=livekitVoiceStats.js.map