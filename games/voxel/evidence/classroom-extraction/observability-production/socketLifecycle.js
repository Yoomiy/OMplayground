"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldLogSocketEvent = shouldLogSocketEvent;
exports.installSocketExceptionGuard = installSocketExceptionGuard;
exports.logSocketEvent = logSocketEvent;
exports.withSocketLogging = withSocketLogging;
const error_1 = require("./error");
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
function shouldLogSocketEvent(service, event) {
    return (service === "minecraft-server" ? MINECRAFT_SERVER_EVENTS : GAME_SERVER_EVENTS).has(event);
}
function installSocketExceptionGuard(logger, stats, socket, hotEvents = new Set()) {
    const originalOn = socket.on.bind(socket);
    socket.on = (event, listener) => {
        if (hotEvents.has(event))
            return originalOn(event, listener);
        return originalOn(event, async (...args) => {
            const started = Date.now();
            const ack = typeof args[args.length - 1] === "function" ? args[args.length - 1] : undefined;
            try {
                await listener(...args);
            }
            catch (err) {
                const sessionId = args[0]?.sessionId ?? socket.data.sessionId;
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
                    }
                    catch {
                        // The peer disconnected before the failure acknowledgement.
                    }
                }
            }
        });
    };
}
function logSocketEvent(logger, stats, service, socket, event, outcome) {
    if (!shouldLogSocketEvent(service, event))
        return;
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
    if (outcome.ok)
        stats.recordSocketEventProcessed(outcome.durationMs);
    else
        stats.recordSocketEventFailed();
}
/** Wrap a socket handler to measure duration and emit whitelist logs. */
function withSocketLogging(logger, stats, service, socket, event, handler) {
    return (payload, ack) => {
        const started = Date.now();
        const wrappedAck = ack
            ? (result) => {
                const res = result;
                const sessionId = payload?.sessionId ??
                    socket.data.sessionId;
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
            const sessionId = payload?.sessionId ??
                socket.data.sessionId;
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
                err: (0, error_1.logError)(err)
            });
            stats.recordSocketEventFailed();
            if (ack) {
                ack({ ok: false, error: { code: "INTERNAL" } });
            }
        });
    };
}
//# sourceMappingURL=socketLifecycle.js.map