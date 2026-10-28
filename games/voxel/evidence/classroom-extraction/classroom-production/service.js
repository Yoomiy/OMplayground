"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClassroomService = createClassroomService;
const node_http_1 = __importDefault(require("node:http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
const observability_1 = require("@playground/observability");
const classroomSecurity_1 = require("./classroomSecurity");
const classroomAttendance_1 = require("./classroomAttendance");
const livekitService_1 = require("./livekitService");
const routes_1 = require("./routes");
/** HTTP/RTC only. Importing this module creates no listener, timer or game world. */
function createClassroomService(options) {
    const { config, supabaseAdmin } = options;
    const logger = options.logger ?? (0, observability_1.createLogger)("classroom-server");
    const stats = new observability_1.StatsCollector("classroom-server");
    const app = (0, express_1.default)();
    const server = node_http_1.default.createServer(app);
    let closing = false, started = false, backendReady = false;
    let closePromise;
    let listenPromise;
    const timers = new Set();
    const pending = new Set();
    const running = new Set();
    app.set("trust proxy", 1);
    app.use((0, observability_1.correlationMiddleware)());
    app.use((0, classroomSecurity_1.classroomAdmissionLogger)(logger, config.ipSource));
    logger[config.ipSource === "unavailable" ? "warn" : "info"]({
        protocol: "internal",
        message: "Classroom security IP source configured",
        context: {
            event: "CLASSROOM_SECURITY_IP_CONFIGURED",
            ipSource: config.ipSource,
        },
    });
    app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
    app.use((0, cors_1.default)({
        origin: config.corsOrigin.split(",").map((value) => value.trim()),
        credentials: true,
    }));
    app.use((0, observability_1.createHttpLogger)(logger));
    app.get("/health", (_req, res) => {
        res.json({ ok: true, service: "playground-classroom-server" });
    });
    app.get("/ready", (_req, res) => {
        const ready = backendReady && !closing;
        res.status(ready ? 200 : 503).json({ ok: ready });
    });
    app.use((_req, res, next) => {
        if (closing) {
            res.status(503).json({ error: "service_draining" });
            return;
        }
        next();
    });
    app.use((0, express_rate_limit_1.default)({
        windowMs: 60_000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
    }));
    (0, observability_1.mountLiveKitWebhook)(app, {
        logger,
        stats,
        apiKey: config.livekitApiKey,
        apiSecret: config.livekitApiSecret,
        onVerifiedEvent: (event) => (0, classroomAttendance_1.recordClassroomAttendanceWebhook)(supabaseAdmin, event),
    });
    // LiveKit verifies the untouched raw bytes; JSON parsing must follow its route.
    app.use(express_1.default.json());
    app.use(classroomSecurity_1.classroomAdmissionBodyError);
    const jobs = (0, routes_1.mountClassroomRoutes)(app, {
        supabaseAdmin,
        logger,
        corsOrigin: config.corsOrigin,
        signingSecret: config.signingSecret,
        documentConverterUrl: config.documentConverterUrl,
        documentConverterSecret: config.documentConverterSecret,
    });
    (0, observability_1.initObservability)(app, null, {
        service: "classroom-server",
        supabaseAdmin,
        logger,
        stats,
        skipCorrelation: true,
        skipHttpLogger: true,
        listRooms: () => [],
        voiceStats: livekitService_1.classroomVoiceStats,
    });
    function run(name, job) {
        if (closing || running.has(name))
            return;
        running.add(name);
        const task = Promise.resolve()
            .then(job)
            .catch((error) => {
            logger.error({
                message: "Classroom background task failed",
                context: { event: "CLASSROOM_BACKGROUND_TASK_FAILED", task: name },
                err: (0, observability_1.logError)(error),
            });
        })
            .finally(() => {
            running.delete(name);
            pending.delete(task);
        });
        pending.add(task);
    }
    function repeat(name, period, job) {
        const timer = setInterval(() => run(name, job), period);
        timer.unref();
        timers.add(timer);
    }
    const media = new livekit_server_sdk_1.RoomServiceClient(config.livekitUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:"), config.livekitApiKey, config.livekitApiSecret, { requestTimeout: 5 });
    async function verifyBackends() {
        // Read-only connectivity and base-schema checks, never provision a room.
        const result = await Promise.allSettled([
            supabaseAdmin
                .from("classroom_sessions")
                .select("id,room_code,status,settings")
                .limit(1)
                .abortSignal(AbortSignal.timeout(5000))
                .retry(false)
                .then((value) => {
                if (value.error)
                    throw new Error("Classroom database readiness failed");
            }),
            media.listRooms().catch(() => {
                throw new Error("Classroom media readiness failed");
            }),
        ]);
        backendReady = result.every((value) => value.status === "fulfilled");
        for (const value of result)
            if (value.status === "rejected")
                throw value.reason;
    }
    return {
        app,
        server,
        async listen() {
            if (closing || started)
                throw new Error("Classroom listener already started or closed");
            started = true;
            listenPromise = (async () => {
                await verifyBackends();
                if (closing)
                    throw new Error("Classroom listener closed during startup");
                await new Promise((resolve, reject) => {
                    const failed = (error) => {
                        server.off("listening", listening);
                        reject(error);
                    };
                    const listening = () => {
                        server.off("error", failed);
                        resolve();
                    };
                    server.once("error", failed);
                    server.once("listening", listening);
                    server.listen(config.port, config.host);
                });
            })();
            await listenPromise;
            if (closing)
                throw new Error("Classroom listener closed during startup");
            if (options.background !== false) {
                repeat("attendance", 30_000, jobs.reconcile);
                repeat("cleanup", 6 * 3600_000, jobs.cleanup);
                repeat("readiness", 30_000, verifyBackends);
                run("attendance", jobs.reconcile);
            }
            return server.address();
        },
        close() {
            if (closePromise)
                return closePromise;
            closing = true;
            for (const timer of timers)
                clearInterval(timer);
            timers.clear();
            closePromise = (async () => {
                await listenPromise?.catch(() => { });
                if (server.listening)
                    await new Promise((resolve, reject) => {
                        server.close((error) => (error ? reject(error) : resolve()));
                        server.closeIdleConnections();
                    });
                await Promise.all([...pending]);
            })();
            return closePromise;
        },
    };
}
//# sourceMappingURL=service.js.map