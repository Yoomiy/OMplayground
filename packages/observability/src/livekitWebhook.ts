import express, { type Express, type Request, type Response } from "express";
import type { Logger } from "pino";
import { WebhookReceiver } from "livekit-server-sdk";
import type { StatsCollector } from "./statsCollector";
import { logError } from "./error";
import { classroomAdmissionIps } from "./classroomAdmissionIp";

export interface LiveKitWebhookOptions {
  logger: Logger;
  stats: StatsCollector;
  apiKey: string;
  apiSecret: string;
  onVerifiedEvent?: (event: {
    id?: string;
    event?: string;
    createdAt?: number | bigint | string;
    room?: { name?: string; sid?: string };
    participant?: { sid?: string; identity?: string; name?: string; metadata?: string };
  }) => Promise<void>;
}

export interface LiveKitRoomContext {
  roomKind: "voxel-session" | "game-session" | "classroom" | "unknown";
  sessionId?: string;
  roomCode?: string;
}

/** Select bounded identifiers only; never spread participant metadata into logs. */
export function classroomVisitEvidence(event: {
  id?: string;
  createdAt?: number | bigint | string;
  room?: { sid?: string };
  participant?: { sid?: string; identity?: string; metadata?: string };
}) {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(event.participant?.metadata ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed;
  } catch { /* Legacy participants may have no valid metadata. */ }
  const admissionId = typeof metadata.admissionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(metadata.admissionId)
      ? metadata.admissionId : undefined;
  const participantKey = typeof metadata.attendanceKey === "string" && metadata.attendanceKey.length <= 256
    ? metadata.attendanceKey : undefined;
  const seconds = Number(event.createdAt);
  return {
    webhookEventId: event.id,
    occurredAt: Number.isFinite(seconds) && seconds > 0 && seconds < 8_640_000_000_000
      ? new Date(seconds * 1000).toISOString() : undefined,
    roomSid: event.room?.sid,
    participantSid: event.participant?.sid,
    participantIdentity: event.participant?.identity,
    participantKey,
    admissionId,
    admissionLink: admissionId ? "available" : "unavailable"
  };
}

export function liveKitRoomContext(roomName: string): LiveKitRoomContext {
  for (const [prefix, roomKind] of [
    ["voxel-session-", "voxel-session"],
    ["game-session-", "game-session"]
  ] as const) {
    if (roomName.startsWith(prefix)) {
      const sessionId = roomName.slice(prefix.length);
      return { roomKind, ...(sessionId ? { sessionId } : {}) };
    }
  }
  const classroomPrefix = "classroom-";
  if (roomName.startsWith(classroomPrefix)) {
    const roomCode = roomName.slice(classroomPrefix.length);
    return { roomKind: "classroom", ...(roomCode ? { roomCode } : {}) };
  }
  return { roomKind: "unknown" };
}

export function mountLiveKitWebhook(
  app: Express,
  options: LiveKitWebhookOptions
): void {
  const receiver = new WebhookReceiver(options.apiKey, options.apiSecret);

  app.post(
    "/webhooks/livekit",
    express.raw({ type: "application/webhook+json" }),
    async (req: Request, res: Response) => {
    let event: Awaited<ReturnType<WebhookReceiver["receive"]>>;
    try {
      const authHeader = req.get("Authorization") ?? "";
      const body =
        typeof req.body === "string"
          ? req.body
          : Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : JSON.stringify(req.body ?? {});
      event = await receiver.receive(body, authHeader);
    } catch (err) {
      options.logger.warn({
        protocol: "livekit-webhook",
        message: "LiveKit webhook verification failed",
        context: { event: "LIVEKIT_WEBHOOK_VERIFICATION_FAILED", status: "failed" },
        err: logError(err)
      });
      res.status(400).json({ error: "invalid_webhook" });
      return;
    }

    const livekitRoom = event.room?.name ?? "";
    const roomContext = liveKitRoomContext(livekitRoom);
    // Record verified connection evidence even if attendance persistence fails.
    // Retries remain distinguishable by webhookEventId and participantSid.
    if (roomContext.roomKind === "classroom" &&
        (event.event === "participant_joined" || event.event === "participant_left")) {
      const evidence = classroomVisitEvidence(event);
      options.logger.info({
        protocol: "livekit-webhook",
        roomCode: roomContext.roomCode,
        message: "Classroom participant connection event",
        context: {
          event: event.event === "participant_joined" ? "CLASSROOM_PARTICIPANT_JOINED" : "CLASSROOM_PARTICIPANT_LEFT",
          status: "success", evidenceSource: "webhook", livekitRoom, ...evidence,
          ...classroomAdmissionIps.lookup(roomContext.roomCode!, evidence.admissionId, evidence.participantIdentity)
        }
      });
    }
    try {
      await options.onVerifiedEvent?.(event);
      const { sessionId, roomCode, roomKind } = roomContext;
      const isDev = process.env.NODE_ENV !== "production";

      switch (event.event) {
        case "room_started":
          options.logger.info({
            protocol: "livekit-webhook",
            sessionId,
            message: "LiveKit room started",
            context: { event: event.event, livekitRoom, roomCode, roomKind, status: "success" }
          });
          break;
        case "room_finished":
          options.logger.info({
            protocol: "livekit-webhook",
            sessionId,
            message: "LiveKit room finished",
            context: { event: event.event, livekitRoom, roomCode, roomKind, status: "success" }
          });
          break;
        case "participant_joined":
          options.stats.adjustVoiceParticipants(1);
          if (roomKind === "classroom") break;
          options.logger.info({
            protocol: "livekit-webhook",
            sessionId,
            userId: event.participant?.identity,
            message: "LiveKit participant joined",
            context: {
              event: event.event,
              livekitRoom,
              roomCode,
              roomKind,
              participantIdentity: event.participant?.identity,
              status: "success"
            }
          });
          break;
        case "participant_left":
          options.stats.adjustVoiceParticipants(-1);
          if (roomKind === "classroom") break;
          options.logger.info({
            protocol: "livekit-webhook",
            sessionId,
            userId: event.participant?.identity,
            message: "LiveKit participant left",
            context: {
              event: event.event,
              livekitRoom,
              roomCode,
              roomKind,
              participantIdentity: event.participant?.identity,
              status: "success"
            }
          });
          break;
        case "track_published":
        case "track_unpublished":
          if (isDev) {
            options.logger.debug({
              protocol: "livekit-webhook",
              sessionId,
              message: `LiveKit ${event.event}`,
              context: {
                event: event.event,
                livekitRoom,
                roomCode,
                roomKind,
                trackKind: event.track?.type,
                status: "success"
              }
            });
          }
          break;
        default:
          if (event.event.startsWith("egress_")) {
            options.logger.info({
              protocol: "livekit-webhook",
              sessionId,
              message: `LiveKit ${event.event}`,
              context: { event: event.event, livekitRoom, roomCode, roomKind, status: "success" }
            });
          }
          break;
      }

      res.json({ ok: true });
    } catch (err) {
      options.logger.error({
        protocol: "livekit-webhook",
        sessionId: roomContext.sessionId,
        message: "LiveKit webhook processing failed",
        context: {
          event: event.event,
          livekitRoom,
          roomCode: roomContext.roomCode,
          roomKind: roomContext.roomKind,
          status: "failed"
        },
        err: logError(err)
      });
      // A 5xx allows LiveKit to retry a verified event that failed downstream.
      res.status(500).json({ error: "webhook_processing_failed" });
    }
  }
  );
}
