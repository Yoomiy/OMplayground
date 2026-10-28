"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsCollector = void 0;
const FIVE_MIN_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 5_000;
class StatsCollector {
    service;
    connections = 0;
    roomMeta = new Map();
    socketEventSamples = [];
    socketEventFailures = [];
    voiceParticipants = 0;
    constructor(service) {
        this.service = service;
    }
    onConnection() {
        this.connections += 1;
    }
    onDisconnect() {
        this.connections = Math.max(0, this.connections - 1);
    }
    onRoomCreated(sessionId, gameType) {
        if (!this.roomMeta.has(sessionId)) {
            this.roomMeta.set(sessionId, { gameType, createdAt: Date.now() });
        }
    }
    onRoomDeleted(sessionId) {
        this.roomMeta.delete(sessionId);
    }
    recordSocketEventProcessed(durationMs) {
        const now = Date.now();
        this.socketEventSamples.push({ at: now, durationMs });
        this.pruneSocketEventSamples(now);
    }
    recordSocketEventFailed() {
        this.socketEventFailures.push(Date.now());
        this.pruneFailures(Date.now());
    }
    setVoiceParticipants(count) {
        this.voiceParticipants = Math.max(0, count);
    }
    adjustVoiceParticipants(delta) {
        this.voiceParticipants = Math.max(0, this.voiceParticipants + delta);
    }
    snapshot(listRooms, voice) {
        const now = Date.now();
        this.pruneSocketEventSamples(now);
        this.pruneFailures(now);
        const rooms = listRooms().map((r) => {
            const meta = this.roomMeta.get(r.sessionId);
            if (!meta) {
                this.roomMeta.set(r.sessionId, {
                    gameType: r.gameType,
                    createdAt: now
                });
            }
            const createdAt = meta?.createdAt ?? now;
            return {
                sessionId: r.sessionId,
                gameType: r.gameType,
                playerCount: r.playerCount,
                uptimeSeconds: Math.floor((now - createdAt) / 1000)
            };
        });
        for (const id of [...this.roomMeta.keys()]) {
            if (!rooms.some((r) => r.sessionId === id)) {
                this.roomMeta.delete(id);
            }
        }
        const recentSocketEvents = this.socketEventSamples.filter((s) => now - s.at <= RATE_WINDOW_MS);
        const socketEventsPerSecond = recentSocketEvents.length / (RATE_WINDOW_MS / 1000);
        const averageSocketEventLatencyMs = recentSocketEvents.length === 0
            ? 0
            : recentSocketEvents.reduce((sum, s) => sum + s.durationMs, 0) /
                recentSocketEvents.length;
        return {
            service: this.service,
            activeConnections: this.connections,
            activeRoomsCount: rooms.length,
            socketEventsPerSecond: Math.round(socketEventsPerSecond * 100) / 100,
            averageSocketEventLatencyMs: Math.round(averageSocketEventLatencyMs * 10) / 10,
            socketEventFailuresLast5Min: this.socketEventFailures.length,
            rooms,
            ...(voice ? { voice } : {})
        };
    }
    pruneSocketEventSamples(now) {
        this.socketEventSamples = this.socketEventSamples.filter((s) => now - s.at <= FIVE_MIN_MS);
    }
    pruneFailures(now) {
        this.socketEventFailures = this.socketEventFailures.filter((t) => now - t <= FIVE_MIN_MS);
    }
}
exports.StatsCollector = StatsCollector;
//# sourceMappingURL=statsCollector.js.map