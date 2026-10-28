"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLogLevelLabel = formatLogLevelLabel;
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
// Railway recognizes textual severity labels, while Pino's default numeric
// levels are displayed there as info regardless of their actual severity.
function formatLogLevelLabel(label) {
    return { level: label };
}
function createLogger(service) {
    const isProduction = process.env.NODE_ENV === "production";
    return (0, pino_1.default)({
        level: process.env.LOG_LEVEL || "info",
        base: { service, environment: process.env.NODE_ENV || "development" },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
        formatters: {
            level: formatLogLevelLabel,
        },
        redact: {
            paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "*.authorization",
                "*.cookie",
                "*.password",
                "*.token",
                "*.accessToken",
                "*.access_token",
                "*.presenterToken",
                "*.ticket",
                "*.accessTokenHash",
                "context.*.password",
                "context.*.token",
                "context.*.accessToken",
                "context.*.access_token",
                "context.*.presenterToken",
                "context.*.ticket",
                "body.password",
                "body.token",
                "context.token",
                "context.accessToken",
                "context.presenterToken",
                "context.ticket",
                "context.accessTokenHash",
            ],
            censor: "[REDACTED]",
        },
        ...(!isProduction
            ? {
                transport: {
                    target: "pino-pretty",
                    options: { colorize: true, ignore: "pid,hostname" },
                },
            }
            : {}),
    });
}
//# sourceMappingURL=logger.js.map