"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logHttpFailure = logHttpFailure;
exports.observeBackgroundTask = observeBackgroundTask;
const error_1 = require("./error");
const correlation_1 = require("./correlation");
function logHttpFailure(logger, req, err, event, context = {}, level = "error") {
    logger[level]({
        correlationId: (0, correlation_1.requestCorrelationId)(req),
        protocol: "http",
        message: event,
        context: { event, status: "failed", ...context },
        err: (0, error_1.logError)(err)
    });
}
function observeBackgroundTask(logger, task, event, context = {}) {
    void task.catch((err) => {
        logger.error({
            protocol: "background",
            message: event,
            context: { event, status: "failed", ...context },
            err: (0, error_1.logError)(err)
        });
    });
}
//# sourceMappingURL=operational.js.map