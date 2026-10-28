import type { Request } from "express";
import type { Logger } from "pino";
export declare function logHttpFailure(logger: Logger, req: Request, err: unknown, event: string, context?: Record<string, unknown>, level?: "warn" | "error"): void;
export declare function observeBackgroundTask(logger: Logger, task: Promise<unknown>, event: string, context?: Record<string, unknown>): void;
//# sourceMappingURL=operational.d.ts.map