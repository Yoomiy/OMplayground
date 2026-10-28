"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const observability_1 = require("@playground/observability");
const config_1 = require("./config");
const service_1 = require("./service");
const logger = (0, observability_1.createLogger)("classroom-server");
async function main() {
    if (process.versions.node !== "24.21.0")
        throw new Error("Classroom service requires Node 24.21.0");
    const config = (0, config_1.readClassroomConfig)();
    const supabaseAdmin = (0, supabase_js_1.createClient)(config.supabaseUrl, config.signingSecret, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const service = (0, service_1.createClassroomService)({ config, supabaseAdmin, logger });
    (0, observability_1.installProcessLifecycle)({
        logger,
        timeoutMs: 60_000,
        shutdown: () => service.close(),
    });
    try {
        const address = await service.listen();
        logger.info({
            message: "Classroom service listening",
            protocol: "http",
            context: { event: "SERVICE_LISTENING", port: address.port },
        });
    }
    catch (error) {
        await service.close();
        throw error;
    }
}
void main().catch((error) => {
    logger.fatal({
        message: "Classroom service startup failed",
        context: { event: "CLASSROOM_SERVICE_STARTUP_FAILED" },
        err: (0, observability_1.logError)(error),
    });
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map