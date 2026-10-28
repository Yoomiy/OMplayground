"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObservabilityContext = createObservabilityContext;
exports.initObservability = initObservability;
const logger_1 = require("./logger");
const error_1 = require("./error");
const correlation_1 = require("./correlation");
const statsCollector_1 = require("./statsCollector");
const adminAuth_1 = require("./adminAuth");
const telemetryIngest_1 = require("./telemetryIngest");
const livekitWebhook_1 = require("./livekitWebhook");
function createObservabilityContext(service) {
    process.env.SERVICE_NAME = service;
    return {
        logger: (0, logger_1.createLogger)(service),
        stats: new statsCollector_1.StatsCollector(service),
    };
}
function initObservability(app, io, options) {
    const logger = options.logger ?? (0, logger_1.createLogger)(options.service);
    const stats = options.stats ?? new statsCollector_1.StatsCollector(options.service);
    process.env.SERVICE_NAME = options.service;
    if (!options.skipCorrelation) {
        app.use((0, correlation_1.correlationMiddleware)());
    }
    if (options.livekitWebhook) {
        (0, livekitWebhook_1.mountLiveKitWebhook)(app, {
            logger,
            stats,
            apiKey: options.livekitWebhook.apiKey,
            apiSecret: options.livekitWebhook.apiSecret,
        });
    }
    if (!options.skipHttpLogger) {
        app.use((0, correlation_1.createHttpLogger)(logger));
    }
    (0, telemetryIngest_1.mountTelemetryRoutes)(app, { logger, supabaseAdmin: options.supabaseAdmin });
    app.get("/api/admin/stats", (0, adminAuth_1.requireAdmin)({ supabaseAdmin: options.supabaseAdmin }), async (_req, res) => {
        if (options.onAdminStatsQuery) {
            try {
                await options.onAdminStatsQuery();
            }
            catch (err) {
                logger.error({
                    message: "onAdminStatsQuery failed",
                    err: (0, error_1.logError)(err),
                });
            }
        }
        const voice = options.voiceStats ? await options.voiceStats() : undefined;
        res.json(stats.snapshot(options.listRooms, voice));
    });
    if (io) {
        (0, correlation_1.attachSocketCorrelation)(io);
        io.on("connection", (socket) => {
            stats.onConnection();
            socket.on("disconnect", (reason) => {
                stats.onDisconnect();
                (0, correlation_1.logSocketDisconnect)(logger, socket, reason, socket.data.userId);
            });
        });
    }
    return { logger, stats };
}
//# sourceMappingURL=serverSetup.js.map