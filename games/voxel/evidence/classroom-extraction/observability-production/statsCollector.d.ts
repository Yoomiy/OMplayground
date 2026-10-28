import type { ServiceName } from "./logger";
export interface RoomStat {
    sessionId: string;
    gameType: string;
    playerCount: number;
    uptimeSeconds: number;
}
export interface VoiceStats {
    activeRooms: number;
    totalParticipants: number;
}
export interface ServiceStats {
    service: ServiceName;
    activeConnections: number;
    activeRoomsCount: number;
    socketEventsPerSecond: number;
    averageSocketEventLatencyMs: number;
    socketEventFailuresLast5Min: number;
    rooms: RoomStat[];
    voice?: VoiceStats;
}
export declare class StatsCollector {
    private readonly service;
    private connections;
    private roomMeta;
    private socketEventSamples;
    private socketEventFailures;
    private voiceParticipants;
    constructor(service: ServiceName);
    onConnection(): void;
    onDisconnect(): void;
    onRoomCreated(sessionId: string, gameType: string): void;
    onRoomDeleted(sessionId: string): void;
    recordSocketEventProcessed(durationMs: number): void;
    recordSocketEventFailed(): void;
    setVoiceParticipants(count: number): void;
    adjustVoiceParticipants(delta: number): void;
    snapshot(listRooms: () => Array<{
        sessionId: string;
        gameType: string;
        playerCount: number;
    }>, voice?: VoiceStats): ServiceStats;
    private pruneSocketEventSamples;
    private pruneFailures;
}
//# sourceMappingURL=statsCollector.d.ts.map