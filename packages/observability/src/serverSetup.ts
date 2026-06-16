import type { Express } from "express";
import type { Server } from "socket.io";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createLogger, type ServiceName } from "./logger";
import {
  correlationMiddleware,
  createHttpLogger,
  attachSocketCorrelation,
  logSocketDisconnect
} from "./correlation";
import { StatsCollector } from "./statsCollector";
import { requireAdmin } from "./adminAuth";
import { mountTelemetryRoutes } from "./telemetryIngest";
import { mountLiveKitWebhook } from "./livekitWebhook";

export interface ObservabilityContext {
  logger: Logger;
  stats: StatsCollector;
}

export function createObservabilityContext(
  service: ServiceName
): ObservabilityContext {
  process.env.SERVICE_NAME = service;
  return {
    logger: createLogger(service),
    stats: new StatsCollector(service)
  };
}

export function initObservability(
  app: Express,
  io: Server,
  options: {
    service: ServiceName;
    supabaseAdmin: SupabaseClient | null;
    listRooms: () => Array<{
      sessionId: string;
      gameType: string;
      playerCount: number;
    }>;
    voiceStats?: () => Promise<
      import("./statsCollector").VoiceStats | undefined
    >;
    onAdminStatsQuery?: () => Promise<void>;
    logger?: Logger;
    stats?: StatsCollector;
    skipCorrelation?: boolean;
    livekitWebhook?: { apiKey: string; apiSecret: string };
  }
): ObservabilityContext {
  const logger = options.logger ?? createLogger(options.service);
  const stats = options.stats ?? new StatsCollector(options.service);
  process.env.SERVICE_NAME = options.service;

  if (!options.skipCorrelation) {
    app.use(correlationMiddleware());
  }
  if (options.livekitWebhook) {
    mountLiveKitWebhook(app, {
      logger,
      stats,
      apiKey: options.livekitWebhook.apiKey,
      apiSecret: options.livekitWebhook.apiSecret
    });
  }
  app.use(createHttpLogger(logger));
  mountTelemetryRoutes(app, { logger, supabaseAdmin: options.supabaseAdmin });

  app.get(
    "/api/admin/stats",
    requireAdmin({ supabaseAdmin: options.supabaseAdmin }),
    async (_req, res) => {
      if (options.onAdminStatsQuery) {
        try {
          await options.onAdminStatsQuery();
        } catch (err) {
          logger.error({
            message: "onAdminStatsQuery failed",
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      const voice = options.voiceStats
        ? await options.voiceStats()
        : undefined;
      res.json(stats.snapshot(options.listRooms, voice));
    }
  );

  attachSocketCorrelation(io);

  io.on("connection", (socket) => {
    stats.onConnection();

    socket.on("disconnect", (reason) => {
      stats.onDisconnect();
      logSocketDisconnect(
        logger,
        socket,
        reason,
        socket.data.userId as string | undefined
      );
    });
  });

  return { logger, stats };
}
