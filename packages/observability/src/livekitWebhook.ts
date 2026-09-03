import express, { type Express, type Request, type Response } from "express";
import type { Logger } from "pino";
import { WebhookReceiver } from "livekit-server-sdk";
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
    room?: { name?: string; sid?: string };
    participant?: { sid?: string; identity?: string; name?: string; metadata?: string };
  }) => Promise<void>;
}

export interface LiveKitRoomContext {
  roomKind: "voxel-session" | "game-session" | "classroom" | "unknown";
  sessionId?: string;
  roomCode?: string;
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
        context: { status: "failed" },
        err
      });
      res.status(400).json({ error: "invalid_webhook" });
      return;
    }

    const livekitRoom = event.room?.name ?? "";
    const roomContext = liveKitRoomContext(livekitRoom);
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
        err
      });
      // A 5xx allows LiveKit to retry a verified event that failed downstream.
      res.status(500).json({ error: "webhook_processing_failed" });
    }
  }
  );
}
