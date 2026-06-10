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
  intentsPerSecond: number;
  averageIntentLatencyMs: number;
  intentFailuresLast5Min: number;
  rooms: RoomStat[];
  voice?: VoiceStats;
}

interface RoomMeta {
  gameType: string;
  createdAt: number;
}

interface IntentSample {
  at: number;
  durationMs: number;
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 5_000;

export class StatsCollector {
  private connections = 0;
  private roomMeta = new Map<string, RoomMeta>();
  private intentSamples: IntentSample[] = [];
  private intentFailures: number[] = [];
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

  recordIntentProcessed(durationMs: number): void {
    const now = Date.now();
    this.intentSamples.push({ at: now, durationMs });
    this.pruneIntentSamples(now);
  }

  recordIntentFailed(): void {
    this.intentFailures.push(Date.now());
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
    this.pruneIntentSamples(now);
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

    const recentIntents = this.intentSamples.filter(
      (s) => now - s.at <= RATE_WINDOW_MS
    );
    const intentsPerSecond =
      recentIntents.length / (RATE_WINDOW_MS / 1000);
    const averageIntentLatencyMs =
      recentIntents.length === 0
        ? 0
        : recentIntents.reduce((sum, s) => sum + s.durationMs, 0) /
          recentIntents.length;

    return {
      service: this.service,
      activeConnections: this.connections,
      activeRoomsCount: rooms.length,
      intentsPerSecond: Math.round(intentsPerSecond * 100) / 100,
      averageIntentLatencyMs: Math.round(averageIntentLatencyMs * 10) / 10,
      intentFailuresLast5Min: this.intentFailures.length,
      rooms,
      ...(voice ? { voice } : {})
    };
  }

  private pruneIntentSamples(now: number): void {
    this.intentSamples = this.intentSamples.filter(
      (s) => now - s.at <= FIVE_MIN_MS
    );
  }

  private pruneFailures(now: number): void {
    this.intentFailures = this.intentFailures.filter(
      (t) => now - t <= FIVE_MIN_MS
    );
  }
}
