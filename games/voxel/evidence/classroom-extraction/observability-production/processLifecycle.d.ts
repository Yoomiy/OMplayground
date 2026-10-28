import type { Logger } from "pino";
export interface ProcessLifecycleOptions {
    logger: Logger;
    shutdown: (signal: NodeJS.Signals | "unhandledRejection") => Promise<void>;
    timeoutMs?: number;
}
export declare function installProcessLifecycle(options: ProcessLifecycleOptions): () => void;
//# sourceMappingURL=processLifecycle.d.ts.map