import type { Socket } from "socket.io";
import type { Logger } from "pino";
import type { StatsCollector } from "./statsCollector";
import type { ServiceName } from "./logger";
export interface SocketEventOutcome {
    ok: boolean;
    code?: string;
    sessionId?: string;
    durationMs: number;
}
export declare function shouldLogSocketEvent(service: ServiceName, event: string): boolean;
export declare function installSocketExceptionGuard(logger: Logger, stats: StatsCollector, socket: Socket, hotEvents?: ReadonlySet<string>): void;
export declare function logSocketEvent(logger: Logger, stats: StatsCollector, service: ServiceName, socket: Socket, event: string, outcome: SocketEventOutcome): void;
/** Wrap a socket handler to measure duration and emit whitelist logs. */
export declare function withSocketLogging<TPayload, TAck>(logger: Logger, stats: StatsCollector, service: ServiceName, socket: Socket, event: string, handler: (payload: TPayload, ack?: (r: TAck) => void) => void | Promise<void>): (payload: TPayload, ack?: (r: TAck) => void) => void;
//# sourceMappingURL=socketLifecycle.d.ts.map