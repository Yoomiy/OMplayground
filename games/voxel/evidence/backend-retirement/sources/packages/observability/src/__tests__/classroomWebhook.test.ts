import express from "express";
import request from "supertest";
import type { Logger } from "pino";
import { WebhookReceiver } from "livekit-server-sdk";
import { mountLiveKitWebhook, classroomVisitEvidence } from "../livekitWebhook";
import { StatsCollector } from "../statsCollector";
import { classroomAdmissionIps } from "../classroomAdmissionIp";

const admissionId = "11111111-1111-4111-8111-111111111111";
const event = {
  id: "event-1", event: "participant_joined", createdAt: 1_700_000_000,
  room: { name: "classroom-ROOM", sid: "RM_1" },
  participant: {
    sid: "PA_1", identity: "guest-abc", name: "Private Name",
    metadata: JSON.stringify({ admissionId, attendanceKey: "guest:ROOM:abc", token: "secret-token", clientIp: "203.0.113.7" })
  }
};

describe("classroom connection evidence", () => {
  it("selects only connection identifiers and tolerates legacy or malformed metadata", () => {
    expect(classroomVisitEvidence(event)).toMatchObject({ admissionId, participantSid: "PA_1", admissionLink: "available" });
    for (const metadata of ["{", "null", "[]", JSON.stringify({ admissionId: "not-an-id" })]) {
      expect(classroomVisitEvidence({ participant: { metadata } })).toMatchObject({ admissionLink: "unavailable" });
    }
    expect(JSON.stringify(classroomVisitEvidence(event))).not.toMatch(/Private Name|secret-token|203\.0\.113/);
  });

  it("keeps verified evidence when persistence fails and identifies repeated webhook deliveries", async () => {
    jest.spyOn(WebhookReceiver.prototype, "receive").mockResolvedValue(event as never);
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const onVerifiedEvent = jest.fn().mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValue(undefined);
    const app = express();
    mountLiveKitWebhook(app, { logger: logger as unknown as Logger, stats: new StatsCollector("classroom-server"),
      apiKey: "key", apiSecret: "secret", onVerifiedEvent });
    await request(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(500);
    await request(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(200);
    expect(logger.info).toHaveBeenCalledTimes(2);
    for (const [entry] of logger.info.mock.calls) {
      expect(entry.userId).toBeUndefined();
      expect(entry.context).toMatchObject({ event: "CLASSROOM_PARTICIPANT_JOINED", admissionId, webhookEventId: "event-1", participantSid: "PA_1" });
    }
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/Private Name|secret-token|203\.0\.113/);
  });

  it("records no connection evidence for an unverified webhook", async () => {
    jest.spyOn(WebhookReceiver.prototype, "receive").mockRejectedValue(new Error("bad signature"));
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const app = express();
    const onVerifiedEvent = jest.fn();
    mountLiveKitWebhook(app, { logger: logger as unknown as Logger, stats: new StatsCollector("classroom-server"),
      apiKey: "key", apiSecret: "secret", onVerifiedEvent });
    await request(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(400);
    expect(logger.info).not.toHaveBeenCalled();
    expect(onVerifiedEvent).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0].context.event).toBe("LIVEKIT_WEBHOOK_VERIFICATION_FAILED");
  });

  it("logs a verified class departure separately from a board socket disconnect", async () => {
    const cachedAdmissionId = "22222222-2222-4222-8222-222222222222";
    classroomAdmissionIps.remember("ROOM", cachedAdmissionId, "guest-abc", {
      clientIp: "198.51.100.10", ipSource: "railway", ipStatus: "available"
    });
    jest.spyOn(WebhookReceiver.prototype, "receive").mockResolvedValue({ ...event, event: "participant_left",
      participant: { ...event.participant, metadata: JSON.stringify({ admissionId: cachedAdmissionId }) }
    } as never);
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const app = express();
    mountLiveKitWebhook(app, { logger: logger as unknown as Logger, stats: new StatsCollector("classroom-server"),
      apiKey: "key", apiSecret: "secret" });
    await request(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(200);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0].context).toMatchObject({
      event: "CLASSROOM_PARTICIPANT_LEFT", evidenceSource: "webhook", participantSid: "PA_1", admissionId: cachedAdmissionId,
      clientIp: "198.51.100.10", ipObservation: "admission", ipStatus: "available"
    });
  });
});
