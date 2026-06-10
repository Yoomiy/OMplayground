import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import type { Logger } from "pino";
import pinoHttp from "pino-http";

const CORRELATION_HEADER = "x-correlation-id";

export function newCorrelationId(): string {
  return `c-${uuidv4()}`;
}

export function readCorrelationId(req: Request): string {
  const fromHeader = req.headers[CORRELATION_HEADER];
  if (typeof fromHeader === "string" && fromHeader.trim()) {
    return fromHeader.trim();
  }
  return newCorrelationId();
}

export function correlationMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = readCorrelationId(req);
    (req as Request & { correlationId: string }).correlationId = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);
    next();
  };
}

export function createHttpLogger(logger: Logger): RequestHandler {
  const isProduction = process.env.NODE_ENV === "production";
  return pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      if (isProduction) {
        const path = _req.url?.split("?")[0] ?? "";
        if (path === "/health" || path === "/ready") return "silent";
      }
      return "info";
    },
    customProps: (req) => ({
      correlationId: (req as Request & { correlationId?: string }).correlationId,
      protocol: "http"
    }),
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url
      }),
      res: (res) => ({
        statusCode: res.statusCode
      })
    }
  });
}

export function attachSocketCorrelation(io: Server): void {
  io.use((socket, next) => {
    const fromAuth = (socket.handshake.auth as { correlationId?: string })
      .correlationId;
    const fromHeader = socket.handshake.headers[CORRELATION_HEADER];
    const correlationId =
      (typeof fromAuth === "string" && fromAuth.trim()) ||
      (typeof fromHeader === "string" && fromHeader.trim()) ||
      newCorrelationId();
    socket.data.correlationId = correlationId;
    next();
  });
}

/** Log after auth middleware has set socket.data.userId. */
export function logSocketAuthenticated(logger: Logger, socket: Socket): void {
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

export function logSocketDisconnect(
  logger: Logger,
  socket: Socket,
  reason: string,
  userId?: string
): void {
  logger.info({
    correlationId: socket.data.correlationId,
    userId,
    sessionId: socket.data.sessionId as string | undefined,
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
