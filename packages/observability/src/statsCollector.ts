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

interface RoomMeta {
  gameType: string;
  createdAt: number;
}

interface SocketEventSample {
  at: number;
  durationMs: number;
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 5_000;

export class StatsCollector {
  private connections = 0;
  private roomMeta = new Map<string, RoomMeta>();
  private socketEventSamples: SocketEventSample[] = [];
  private socketEventFailures: number[] = [];
  private voiceParticipants = 0;

  constructor(private readonly service: ServiceName) {}

  onConnection(): void {
    this.connections += 1;
  }

  onDisconnect(): void {
    this.connections = Math.max(0, this.connections - 1);
  }

  onRoomCreated(sessionId: string, gameType: string): void {
    if (!this.roomMeta.has(sessionId)) {
      this.roomMeta.set(sessionId, { gameType, createdAt: Date.now() });
    }
  }

  onRoomDeleted(sessionId: string): void {
    this.roomMeta.delete(sessionId);
  }

  recordSocketEventProcessed(durationMs: number): void {
    const now = Date.now();
    this.socketEventSamples.push({ at: now, durationMs });
    this.pruneSocketEventSamples(now);
  }

  recordSocketEventFailed(): void {
    this.socketEventFailures.push(Date.now());
    this.pruneFailures(Date.now());
  }

  setVoiceParticipants(count: number): void {
    this.voiceParticipants = Math.max(0, count);
  }

  adjustVoiceParticipants(delta: number): void {
    this.voiceParticipants = Math.max(0, this.voiceParticipants + delta);
  }

  snapshot(
    listRooms: () => Array<{
      sessionId: string;
      gameType: string;
      playerCount: number;
    }>,
    voice?: VoiceStats
  ): ServiceStats {
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

    const recentSocketEvents = this.socketEventSamples.filter(
      (s) => now - s.at <= RATE_WINDOW_MS
    );
    const socketEventsPerSecond =
      recentSocketEvents.length / (RATE_WINDOW_MS / 1000);
    const averageSocketEventLatencyMs =
      recentSocketEvents.length === 0
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

  private pruneSocketEventSamples(now: number): void {
    this.socketEventSamples = this.socketEventSamples.filter(
      (s) => now - s.at <= FIVE_MIN_MS
    );
  }

  private pruneFailures(now: number): void {
    this.socketEventFailures = this.socketEventFailures.filter(
      (t) => now - t <= FIVE_MIN_MS
    );
  }
}
