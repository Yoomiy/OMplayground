"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installProcessLifecycle = installProcessLifecycle;
const error_1 = require("./error");
function installProcessLifecycle(options) {
    const timeoutMs = options.timeoutMs ?? 10_000;
    let shuttingDown = false;
    const shutdown = (signal, exitCode) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        options.logger.info({
            message: "Service shutdown started",
            context: { event: "SERVICE_SHUTDOWN_STARTED", signal, status: "started" }
        });
        const hardStop = setTimeout(() => {
            options.logger.fatal({
                message: "Service shutdown timed out",
                context: { event: "SERVICE_SHUTDOWN_TIMEOUT", signal, timeout_ms: timeoutMs, status: "failed" }
            });
            process.exit(1);
        }, timeoutMs);
        hardStop.unref();
        void options.shutdown(signal).then(() => {
            clearTimeout(hardStop);
            options.logger.info({
                message: "Service shutdown completed",
                context: { event: "SERVICE_SHUTDOWN_COMPLETED", signal, status: "success" }
            });
            process.exit(exitCode);
        }, (err) => {
            clearTimeout(hardStop);
            options.logger.fatal({
                message: "Service shutdown failed",
                context: { event: "SERVICE_SHUTDOWN_FAILED", signal, status: "failed" },
                err: (0, error_1.logError)(err)
            });
            process.exit(1);
        });
    };
    const onSigterm = () => shutdown("SIGTERM", 0);
    const onSigint = () => shutdown("SIGINT", 0);
    const onUnhandledRejection = (reason) => {
        options.logger.fatal({
            message: "Unhandled promise rejection",
            context: { event: "UNHANDLED_REJECTION", status: "failed" },
            err: (0, error_1.logError)(reason)
        });
        shutdown("unhandledRejection", 1);
    };
    const onUncaughtExceptionMonitor = (err, origin) => {
        // Observation only: Node retains its normal fatal uncaught-exception behavior.
        options.logger.fatal({
            message: "Uncaught exception",
            context: { event: "UNCAUGHT_EXCEPTION", origin, status: "failed" },
            err
        });
    };
    process.once("SIGTERM", onSigterm);
    process.once("SIGINT", onSigint);
    process.once("unhandledRejection", onUnhandledRejection);
    process.on("uncaughtExceptionMonitor", onUncaughtExceptionMonitor);
    return () => {
        process.off("SIGTERM", onSigterm);
        process.off("SIGINT", onSigint);
        process.off("unhandledRejection", onUnhandledRejection);
        process.off("uncaughtExceptionMonitor", onUncaughtExceptionMonitor);
    };
}
//# sourceMappingURL=processLifecycle.js.map