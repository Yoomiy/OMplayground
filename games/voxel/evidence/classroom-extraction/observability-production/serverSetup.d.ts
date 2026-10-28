import type { Express } from "express";
import type { Server } from "socket.io";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { type ServiceName } from "./logger";
import { StatsCollector } from "./statsCollector";
export interface ObservabilityContext {
    logger: Logger;
    stats: StatsCollector;
}
export declare function createObservabilityContext(service: ServiceName): ObservabilityContext;
export declare function initObservability(app: Express, io: Server | null, options: {
    service: ServiceName;
    supabaseAdmin: SupabaseClient | null;
    listRooms: () => Array<{
        sessionId: string;
        gameType: string;
        playerCount: number;
    }>;
    voiceStats?: () => Promise<import("./statsCollector").VoiceStats | undefined>;
    onAdminStatsQuery?: () => Promise<void>;
    logger?: Logger;
    stats?: StatsCollector;
    skipCorrelation?: boolean;
    skipHttpLogger?: boolean;
    livekitWebhook?: {
        apiKey: string;
        apiSecret: string;
    };
}): ObservabilityContext;
//# sourceMappingURL=serverSetup.d.ts.map