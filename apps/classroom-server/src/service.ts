import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { RoomServiceClient } from "livekit-server-sdk";
import {
  correlationMiddleware,
  createHttpLogger,
  createLogger,
  StatsCollector,
  initObservability,
  logError,
  mountLiveKitWebhook,
} from "@playground/observability";
import {
  classroomAdmissionLogger,
  classroomAdmissionBodyError,
} from "./classroomSecurity";
import { recordClassroomAttendanceWebhook } from "./classroomAttendance";
import { classroomVoiceStats } from "./livekitService";
import { mountClassroomRoutes } from "./routes";
import type { ClassroomConfig } from "./config";

/** HTTP/RTC only. Importing this module creates no listener, timer or game world. */
export function createClassroomService(options: {
  config: ClassroomConfig;
  supabaseAdmin: SupabaseClient;
  logger?: Logger;
  background?: boolean;
}) {
  const { config, supabaseAdmin } = options;
  const logger = options.logger ?? createLogger("classroom-server");
  const stats = new StatsCollector("classroom-server");
  const app = express();
  const server = http.createServer(app);
  let closing = false,
    started = false,
    backendReady = false;
  let closePromise: Promise<void> | undefined;
  let listenPromise: Promise<void> | undefined;
  const timers = new Set<ReturnType<typeof setInterval>>();
  const pending = new Set<Promise<void>>();
  const running = new Set<string>();

  app.set("trust proxy", 1);
  app.use(correlationMiddleware());
  app.use(classroomAdmissionLogger(logger, config.ipSource));
  logger[config.ipSource === "unavailable" ? "warn" : "info"]({
    protocol: "internal",
    message: "Classroom security IP source configured",
    context: {
      event: "CLASSROOM_SECURITY_IP_CONFIGURED",
      ipSource: config.ipSource,
    },
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: config.corsOrigin.split(",").map((value) => value.trim()),
      credentials: true,
    }),
  );
  app.use(createHttpLogger(logger));
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
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  mountLiveKitWebhook(app, {
    logger,
    stats,
    apiKey: config.livekitApiKey,
    apiSecret: config.livekitApiSecret,
    onVerifiedEvent: (event) =>
      recordClassroomAttendanceWebhook(supabaseAdmin, event),
  });
  // LiveKit verifies the untouched raw bytes; JSON parsing must follow its route.
  app.use(express.json());
  app.use(classroomAdmissionBodyError);
  const jobs = mountClassroomRoutes(app, {
    supabaseAdmin,
    logger,
    corsOrigin: config.corsOrigin,
    signingSecret: config.signingSecret,
    documentConverterUrl: config.documentConverterUrl,
    documentConverterSecret: config.documentConverterSecret,
  });
  initObservability(app, null, {
    service: "classroom-server",
    supabaseAdmin,
    logger,
    stats,
    skipCorrelation: true,
    skipHttpLogger: true,
    listRooms: () => [],
    voiceStats: classroomVoiceStats,
  });

  function run(name: string, job: () => Promise<void>) {
    if (closing || running.has(name)) return;
    running.add(name);
    const task = Promise.resolve()
      .then(job)
      .catch((error) => {
        logger.error({
          message: "Classroom background task failed",
          context: { event: "CLASSROOM_BACKGROUND_TASK_FAILED", task: name },
          err: logError(error),
        });
      })
      .finally(() => {
        running.delete(name);
        pending.delete(task);
      });
    pending.add(task);
  }
  function repeat(name: string, period: number, job: () => Promise<void>) {
    const timer = setInterval(() => run(name, job), period);
    timer.unref();
    timers.add(timer);
  }
  const media = new RoomServiceClient(
    config.livekitUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:"),
    config.livekitApiKey,
    config.livekitApiSecret,
    { requestTimeout: 5 },
  );
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
      if (value.status === "rejected") throw value.reason;
  }

  return {
    app,
    server,
    async listen(): Promise<AddressInfo> {
      if (closing || started)
        throw new Error("Classroom listener already started or closed");
      started = true;
      listenPromise = (async () => {
        await verifyBackends();
        if (closing)
          throw new Error("Classroom listener closed during startup");
        await new Promise<void>((resolve, reject) => {
          const failed = (error: Error) => {
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
      if (closing) throw new Error("Classroom listener closed during startup");
      if (options.background !== false) {
        repeat("attendance", 30_000, jobs.reconcile);
        repeat("cleanup", 6 * 3600_000, jobs.cleanup);
        repeat("readiness", 30_000, verifyBackends);
        run("attendance", jobs.reconcile);
      }
      return server.address() as AddressInfo;
    },
    close(): Promise<void> {
      if (closePromise) return closePromise;
      closing = true;
      for (const timer of timers) clearInterval(timer);
      timers.clear();
      closePromise = (async () => {
        await listenPromise?.catch(() => {});
        if (server.listening)
          await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeIdleConnections();
          });
        await Promise.all([...pending]);
      })();
      return closePromise;
    },
  };
}
