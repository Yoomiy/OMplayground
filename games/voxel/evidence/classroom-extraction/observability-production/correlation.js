"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.newCorrelationId = newCorrelationId;
exports.readCorrelationId = readCorrelationId;
exports.correlationMiddleware = correlationMiddleware;
exports.createHttpLogger = createHttpLogger;
exports.requestCorrelationId = requestCorrelationId;
exports.attachSocketCorrelation = attachSocketCorrelation;
exports.logSocketAuthenticated = logSocketAuthenticated;
exports.logSocketDisconnect = logSocketDisconnect;
const crypto_1 = require("crypto");
const pino_http_1 = __importDefault(require("pino-http"));
const CORRELATION_HEADER = "x-correlation-id";
const MAX_CORRELATION_ID_LENGTH = 128;
function newCorrelationId() {
    return `c-${(0, crypto_1.randomUUID)()}`;
}
function readCorrelationId(req) {
    const fromHeader = req.headers[CORRELATION_HEADER];
    if (typeof fromHeader === "string" &&
        fromHeader.trim() &&
        fromHeader.trim().length <= MAX_CORRELATION_ID_LENGTH &&
        /^[a-zA-Z0-9._:-]+$/.test(fromHeader.trim())) {
        return fromHeader.trim();
    }
    return newCorrelationId();
}
function correlationMiddleware() {
    return (req, res, next) => {
        const correlationId = readCorrelationId(req);
        req.correlationId = correlationId;
        res.setHeader(CORRELATION_HEADER, correlationId);
        next();
    };
}
function createHttpLogger(logger, options = {}) {
    const isProduction = process.env.NODE_ENV === "production";
    return (0, pino_http_1.default)({
        logger,
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500)
                return "error";
            if (res.statusCode >= 400)
                return "warn";
            const path = _req.url?.split("?")[0] ?? "";
            if (options.suppressSuccessfulRequest?.(path))
                return "silent";
            if (isProduction) {
                if (path === "/health" || path === "/ready")
                    return "silent";
            }
            return "info";
        },
        customProps: (req) => ({
            correlationId: req.correlationId,
            protocol: "http"
        }),
        serializers: {
            req: (req) => ({
                method: req.method,
                url: req.url?.split("?")[0]
            }),
            res: (res) => ({
                statusCode: res.statusCode
            })
        }
    });
}
function requestCorrelationId(req) {
    return req.correlationId;
}
function attachSocketCorrelation(io) {
    io.use((socket, next) => {
        const fromAuth = socket.handshake.auth
            .correlationId;
        const fromHeader = socket.handshake.headers[CORRELATION_HEADER];
        const candidate = (typeof fromAuth === "string" && fromAuth.trim()) ||
            (typeof fromHeader === "string" && fromHeader.trim());
        const correlationId = candidate && candidate.length <= MAX_CORRELATION_ID_LENGTH && /^[a-zA-Z0-9._:-]+$/.test(candidate)
            ? candidate
            : newCorrelationId();
        socket.data.correlationId = correlationId;
        next();
    });
}
/** Log after auth middleware has set socket.data.userId. */
function logSocketAuthenticated(logger, socket) {
    logger.info({
        correlationId: socket.data.correlationId,
        userId: socket.data.userId,
        protocol: "socket",
        message: "Socket connected",
        context: {
            event: "CONNECTION",
            socketId: socket.id,
            status: "success"
        }
    });
}
function logSocketDisconnect(logger, socket, reason, userId) {
    logger.info({
        correlationId: socket.data.correlationId,
        userId,
        sessionId: socket.data.sessionId,
        protocol: "socket",
        message: "Socket disconnected",
        context: {
            event: "DISCONNECT",
            socketId: socket.id,
            reason,
            status: "success"
        }
    });
}
//# sourceMappingURL=correlation.js.map