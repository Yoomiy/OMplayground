import type { Request, RequestHandler } from "express";
import type { Server, Socket } from "socket.io";
import type { Logger } from "pino";
export declare function newCorrelationId(): string;
export declare function readCorrelationId(req: Request): string;
export declare function correlationMiddleware(): RequestHandler;
export interface HttpLoggerOptions {
    /** Suppress only successful access logs for known high-frequency request paths. */
    suppressSuccessfulRequest?: (path: string) => boolean;
}
export declare function createHttpLogger(logger: Logger, options?: HttpLoggerOptions): RequestHandler;
export declare function requestCorrelationId(req: Request): string | undefined;
export declare function attachSocketCorrelation(io: Server): void;
/** Log after auth middleware has set socket.data.userId. */
export declare function logSocketAuthenticated(logger: Logger, socket: Socket): void;
export declare function logSocketDisconnect(logger: Logger, socket: Socket, reason: string, userId?: string): void;
//# sourceMappingURL=correlation.d.ts.map