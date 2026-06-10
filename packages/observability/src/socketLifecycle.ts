import type { Socket } from "socket.io";
import type { Logger } from "pino";
import type { StatsCollector } from "./statsCollector";
import type { ServiceName } from "./logger";

const GAME_SERVER_EVENTS = new Set([
  "JOIN_ROOM",
  "INTENT",
  "STOP_GAME",
  "REMATCH",
  "SPECTATE"
]);
const MINECRAFT_SERVER_EVENTS = new Set([
  "JOIN_ROOM",
  "LEAVE_ROOM",
  "STOP_GAME",
  "MUTE_ALL"
]);

export interface SocketEventOutcome {
  ok: boolean;
  code?: string;
  sessionId?: string;
  durationMs: number;
}

export function logSocketEvent(
  logger: Logger,
  stats: StatsCollector,
  service: ServiceName,
  socket: Socket,
  event: string,
  outcome: SocketEventOutcome
): void {
  const whitelist =
    service === "minecraft-server"
      ? MINECRAFT_SERVER_EVENTS
      : GAME_SERVER_EVENTS;

  if (!whitelist.has(event)) return;

  const level = outcome.ok ? "info" : "warn";
  logger[level]({
    correlationId: socket.data.correlationId,
    userId: socket.data.userId,
    sessionId: outcome.sessionId,
    protocol: "socket",
    message: `Socket event ${event}`,
    context: {
      event,
      status: outcome.ok ? "success" : "failed",
      code: outcome.code,
      duration_ms: outcome.durationMs
    }
  });

  if (outcome.ok) stats.recordIntentProcessed(outcome.durationMs);
  else stats.recordIntentFailed();
}

/** Wrap a socket handler to measure duration and emit whitelist logs. */
export function withSocketLogging<TPayload, TAck>(
  logger: Logger,
  stats: StatsCollector,
  service: ServiceName,
  socket: Socket,
  event: string,
  handler: (
    payload: TPayload,
    ack?: (r: TAck) => void
  ) => void | Promise<void>
): (payload: TPayload, ack?: (r: TAck) => void) => void {
  return (payload: TPayload, ack?: (r: TAck) => void) => {
    const started = Date.now();
    const wrappedAck = ack
      ? (result: TAck) => {
          const res = result as { ok?: boolean; error?: { code?: string } };
          const sessionId =
            (payload as { sessionId?: string })?.sessionId ??
            (socket.data.sessionId as string | undefined);
          logSocketEvent(logger, stats, service, socket, event, {
            ok: res?.ok !== false,
            code: res?.error?.code,
            sessionId,
            durationMs: Date.now() - started
          });
          ack(result);
        }
      : undefined;

    void Promise.resolve(handler(payload, wrappedAck)).catch((err) => {
      const sessionId =
        (payload as { sessionId?: string })?.sessionId ??
        (socket.data.sessionId as string | undefined);
      logger.error({
        correlationId: socket.data.correlationId,
        userId: socket.data.userId,
        sessionId,
        protocol: "socket",
        message: `Socket handler ${event} threw`,
        context: {
          event,
          status: "failed",
          duration_ms: Date.now() - started
        },
        error: err instanceof Error ? err.message : String(err)
      });
      stats.recordIntentFailed();
      if (ack) {
        ack({ ok: false, error: { code: "INTERNAL" } } as TAck);
      }
    });
  };
}
