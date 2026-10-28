import { type Express } from "express";
import type { Logger } from "pino";
import type { SupabaseClient } from "@supabase/supabase-js";
export interface ClientTelemetryEntry {
    timestamp?: string;
    level?: string;
    correlationId?: string;
    route?: string;
    sessionId?: string;
    message?: string;
    context?: Record<string, unknown>;
    stack?: string;
}
export interface TelemetryIngestOptions {
    logger: Logger;
    supabaseAdmin: SupabaseClient | null;
}
export declare function redactSensitive(value: unknown, depth?: number): unknown;
export declare function mountTelemetryRoutes(app: Express, options: TelemetryIngestOptions): void;
//# sourceMappingURL=telemetryIngest.d.ts.map