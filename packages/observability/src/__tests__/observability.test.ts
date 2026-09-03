import { StatsCollector } from "../statsCollector";
import { newCorrelationId } from "../correlation";
import { redactSensitive } from "../telemetryIngest";
import { auditMetadata } from "../auditMetadata";
import { liveKitRoomContext } from "../livekitWebhook";
import { shouldLogSocketEvent } from "../socketLifecycle";

describe("Observability Package", () => {
  describe("Correlation ID Utility", () => {
    it("should generate a correlation ID prefixed with c-", () => {
      const id = newCorrelationId();
      expect(id).toMatch(/^c-[0-9a-fA-F-]+/);
    });
  });

  describe("StatsCollector", () => {
    let collector: StatsCollector;

    beforeEach(() => {
      collector = new StatsCollector("game-server");
    });

    it("should track connection and disconnection counts", () => {
      expect(collector.snapshot(() => []).activeConnections).toBe(0);

      collector.onConnection();
      collector.onConnection();
      expect(collector.snapshot(() => []).activeConnections).toBe(2);

      collector.onDisconnect();
      expect(collector.snapshot(() => []).activeConnections).toBe(1);

      collector.onDisconnect();
      collector.onDisconnect(); // Should not go below 0
      expect(collector.snapshot(() => []).activeConnections).toBe(0);
    });

    it("should track room states and uptime", () => {
      const mockRooms = [
        { sessionId: "room-1", gameType: "chess", playerCount: 2 },
        { sessionId: "room-2", gameType: "tictactoe", playerCount: 1 }
      ];

      collector.onRoomCreated("room-1", "chess");
      collector.onRoomCreated("room-2", "tictactoe");

      const snap = collector.snapshot(() => mockRooms);
      expect(snap.activeRoomsCount).toBe(2);
      expect(snap.rooms).toContainEqual(
        expect.objectContaining({
          sessionId: "room-1",
          gameType: "chess",
          playerCount: 2
        })
      );
    });

    it("should prune rooms that are no longer active in snapshot", () => {
      collector.onRoomCreated("room-1", "chess");
      collector.onRoomCreated("room-2", "tictactoe");

      // snapshot with only room-1 active
      const snap = collector.snapshot(() => [
        { sessionId: "room-1", gameType: "chess", playerCount: 2 }
      ]);
      expect(snap.activeRoomsCount).toBe(1);
      expect(snap.rooms[0].sessionId).toBe("room-1");
    });

    it("should track socket event rates and average latency", () => {
      collector.recordSocketEventProcessed(50);
      collector.recordSocketEventProcessed(150);

      const snap = collector.snapshot(() => []);
      expect(snap.averageSocketEventLatencyMs).toBe(100);
      // Throughput for 2 events in a 5s rate window = 2 / 5 = 0.4 events/sec
      expect(snap.socketEventsPerSecond).toBe(0.4);
    });

    it("should track socket event failures within 5 minute window", () => {
      collector.recordSocketEventFailed();
      collector.recordSocketEventFailed();

      const snap = collector.snapshot(() => []);
      expect(snap.socketEventFailuresLast5Min).toBe(2);
    });
  });

  describe("Telemetry Context Redaction", () => {
    it("should scrub sensitive keys at top level and nested fields", () => {
      const raw = {
        userId: "abc",
        password: "my-secret-password",
        nested: {
          token: "secret-token-123",
          ok: true
        },
        list: [
          { token: "abc", value: 42 }
        ]
      };

      const cleaned = redactSensitive(raw) as any;
      expect(cleaned.userId).toBe("abc");
      expect(cleaned.password).toBe("[REDACTED]");
      expect(cleaned.nested.token).toBe("[REDACTED]");
      expect(cleaned.nested.ok).toBe(true);
      expect(cleaned.list[0].token).toBe("[REDACTED]");
      expect(cleaned.list[0].value).toBe(42);
    });

    it("should truncate deeply nested objects to avoid call stack overflow", () => {
      const deep: any = { depth: 1 };
      let current = deep;
      for (let i = 2; i <= 6; i++) {
        current.child = { depth: i };
        current = current.child;
      }

      const redacted = redactSensitive(deep) as any;
      // depth 5 child is child.child.child.child
      expect(redacted.child.child.child.child.child).toBe("[REDACTED_DEPTH]");
    });
  });

  describe("Audit Metadata Helper", () => {
    it("should merge correlation_id into audit metadata when present", () => {
      const merged = auditMetadata("c-test-123", { action: "save" });
      expect(merged).toEqual({
        action: "save",
        correlation_id: "c-test-123"
      });
    });

    it("should return empty object if no arguments are provided", () => {
      expect(auditMetadata()).toEqual({});
    });
  });

  describe("LiveKit room classification", () => {
    it("keeps classroom room codes separate from game session ids", () => {
      expect(liveKitRoomContext("voxel-session-v1")).toEqual({ roomKind: "voxel-session", sessionId: "v1" });
      expect(liveKitRoomContext("game-session-g1")).toEqual({ roomKind: "game-session", sessionId: "g1" });
      expect(liveKitRoomContext("classroom-ABC123")).toEqual({ roomKind: "classroom", roomCode: "ABC123" });
      expect(liveKitRoomContext("misc-room")).toEqual({ roomKind: "unknown" });
    });
  });

  describe("socket event policy", () => {
    it("includes lifecycle mutations and excludes hot gameplay traffic", () => {
      expect(shouldLogSocketEvent("game-server", "PAUSE_GAME")).toBe(true);
      expect(shouldLogSocketEvent("game-server", "VOICE_TOKEN")).toBe(true);
      expect(shouldLogSocketEvent("minecraft-server", "SET_GAME_MODE")).toBe(true);
      expect(shouldLogSocketEvent("minecraft-server", "INPUT")).toBe(false);
      expect(shouldLogSocketEvent("minecraft-server", "BLOCK_DELTA")).toBe(false);
    });
  });
});
