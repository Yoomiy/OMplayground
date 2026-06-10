import express, { type Express, type Request, type Response } from "express";
import type { Logger } from "pino";
import { WebhookReceiver } from "livekit-server-sdk";
import type { StatsCollector } from "./statsCollector";

export interface LiveKitWebhookOptions {
  logger: Logger;
  stats: StatsCollector;
  apiKey: string;
  apiSecret: string;
}

function sessionIdFromRoomName(roomName: string): string | undefined {
  const prefix = "voxel-session-";
  if (!roomName.startsWith(prefix)) return undefined;
  return roomName.slice(prefix.length);
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
    try {
      const authHeader = req.get("Authorization") ?? "";
      const body =
        typeof req.body === "string"
          ? req.body
          : Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : JSON.stringify(req.body ?? {});
      const event = await receiver.receive(body, authHeader);
      const livekitRoom = event.room?.name ?? "";
      const sessionId = livekitRoom
        ? sessionIdFromRoomName(livekitRoom)
        : undefined;
      const isDev = process.env.NODE_ENV !== "production";

      switch (event.event) {
        case "room_started":
          options.logger.info({
            protocol: "livekit-webhook",
            sessionId,
            message: "LiveKit room started",
            context: { event: event.event, livekitRoom, status: "success" }
          });
          break;
        case "room_finished":
          options.logger.info({
            protocol: "livekit-webhook",
            sessionId,
            message: "LiveKit room finished",
            context: { event: event.event, livekitRoom, status: "success" }
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
                trackKind: "audio",
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
              context: { event: event.event, livekitRoom, status: "success" }
            });
          }
          break;
      }

      res.json({ ok: true });
    } catch (err) {
      options.logger.warn({
        protocol: "livekit-webhook",
        message: "LiveKit webhook verification failed",
        context: { status: "failed" },
        error: err instanceof Error ? err.message : String(err)
      });
      res.status(400).json({ error: "invalid_webhook" });
    }
  }
  );
}
