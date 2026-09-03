import type { Socket } from "socket.io";
import type { Logger } from "pino";
import type { StatsCollector } from "./statsCollector";
import type { ServiceName } from "./logger";
import { logError } from "./error";

const GAME_SERVER_EVENTS = new Set([
  "JOIN_ROOM",
  "LEAVE_ROOM",
  "INTENT",
  "VOICE_TOKEN",
  "PAUSE_GAME",
  "RESUME_GAME",
  "STOP_GAME",
  "REMATCH",
  "REMATCH_RESPONSE",
  "SPECTATE",
  "CLASSROOM_WHITEBOARD_POLICY_REFRESH"
]);
const MINECRAFT_SERVER_EVENTS = new Set([
  "JOIN_ROOM",
  "LEAVE_ROOM",
  "PAUSE_GAME",
  "RESUME_GAME",
  "STOP_GAME",
  "SET_GAME_MODE",
  "SWITCH_TEACHER",
  "MUTE_ALL"
]);

export interface SocketEventOutcome {
  ok: boolean;
  code?: string;
  sessionId?: string;
  durationMs: number;
}

export function shouldLogSocketEvent(service: ServiceName, event: string): boolean {
  return (service === "minecraft-server" ? MINECRAFT_SERVER_EVENTS : GAME_SERVER_EVENTS).has(event);
}

export function installSocketExceptionGuard(
  logger: Logger,
  stats: StatsCollector,
  socket: Socket,
  hotEvents: ReadonlySet<string> = new Set()
): void {
  const originalOn = socket.on.bind(socket);
  socket.on = (event: string, listener: (...args: any[]) => void | Promise<void>) => {
    if (hotEvents.has(event)) return originalOn(event, listener);
    return originalOn(event, async (...args: any[]) => {
      const started = Date.now();
      const ack = typeof args[args.length - 1] === "function" ? args[args.length - 1] : undefined;
      try {
        await listener(...args);
      } catch (err) {
        const sessionId = (args[0] as { sessionId?: string })?.sessionId ?? (socket.data.sessionId as string | undefined);
        logger.error({
          correlationId: socket.data.correlationId,
          userId: socket.data.userId,
          sessionId,
          protocol: "socket",
          message: `Socket handler ${event} threw`,
          context: { event, status: "failed", duration_ms: Date.now() - started },
          err
        });
        stats.recordSocketEventFailed();
        if (ack) {
          try {
            ack({ ok: false, error: { code: "INTERNAL", message: "Internal server error" } });
          } catch {
            // The peer disconnected before the failure acknowledgement.
          }
        }
      }
    });
  };
}

export function logSocketEvent(
  logger: Logger,
  stats: StatsCollector,
  service: ServiceName,
  socket: Socket,
  event: string,
  outcome: SocketEventOutcome
): void {
  if (!shouldLogSocketEvent(service, event)) return;

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

  if (outcome.ok) stats.recordSocketEventProcessed(outcome.durationMs);
  else stats.recordSocketEventFailed();
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
        err: logError(err)
      });
      stats.recordSocketEventFailed();
      if (ack) {
        ack({ ok: false, error: { code: "INTERNAL" } } as TAck);
      }
    });
  };
}
