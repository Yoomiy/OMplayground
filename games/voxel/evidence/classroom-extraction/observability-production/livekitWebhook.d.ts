import { type Express } from "express";
import type { Logger } from "pino";
import type { StatsCollector } from "./statsCollector";
export interface LiveKitWebhookOptions {
    logger: Logger;
    stats: StatsCollector;
    apiKey: string;
    apiSecret: string;
    onVerifiedEvent?: (event: {
        id?: string;
        event?: string;
        createdAt?: number | bigint | string;
        room?: {
            name?: string;
            sid?: string;
        };
        participant?: {
            sid?: string;
            identity?: string;
            name?: string;
            metadata?: string;
        };
    }) => Promise<void>;
}
export interface LiveKitRoomContext {
    roomKind: "voxel-session" | "game-session" | "classroom" | "unknown";
    sessionId?: string;
    roomCode?: string;
}
/** Select bounded identifiers only; never spread participant metadata into logs. */
export declare function classroomVisitEvidence(event: {
    id?: string;
    createdAt?: number | bigint | string;
    room?: {
        sid?: string;
    };
    participant?: {
        sid?: string;
        identity?: string;
        metadata?: string;
    };
}): {
    webhookEventId: string | undefined;
    occurredAt: string | undefined;
    roomSid: string | undefined;
    participantSid: string | undefined;
    participantIdentity: string | undefined;
    participantKey: string | undefined;
    admissionId: string | undefined;
    admissionLink: string;
};
export declare function liveKitRoomContext(roomName: string): LiveKitRoomContext;
export declare function mountLiveKitWebhook(app: Express, options: LiveKitWebhookOptions): void;
//# sourceMappingURL=livekitWebhook.d.ts.map