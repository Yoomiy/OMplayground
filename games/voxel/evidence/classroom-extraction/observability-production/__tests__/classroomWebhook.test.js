"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
const livekitWebhook_1 = require("../livekitWebhook");
const statsCollector_1 = require("../statsCollector");
const classroomAdmissionIp_1 = require("../classroomAdmissionIp");
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
        expect((0, livekitWebhook_1.classroomVisitEvidence)(event)).toMatchObject({ admissionId, participantSid: "PA_1", admissionLink: "available" });
        for (const metadata of ["{", "null", "[]", JSON.stringify({ admissionId: "not-an-id" })]) {
            expect((0, livekitWebhook_1.classroomVisitEvidence)({ participant: { metadata } })).toMatchObject({ admissionLink: "unavailable" });
        }
        expect(JSON.stringify((0, livekitWebhook_1.classroomVisitEvidence)(event))).not.toMatch(/Private Name|secret-token|203\.0\.113/);
    });
    it("keeps verified evidence when persistence fails and identifies repeated webhook deliveries", async () => {
        jest.spyOn(livekit_server_sdk_1.WebhookReceiver.prototype, "receive").mockResolvedValue(event);
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const onVerifiedEvent = jest.fn().mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValue(undefined);
        const app = (0, express_1.default)();
        (0, livekitWebhook_1.mountLiveKitWebhook)(app, { logger: logger, stats: new statsCollector_1.StatsCollector("minecraft-server"),
            apiKey: "key", apiSecret: "secret", onVerifiedEvent });
        await (0, supertest_1.default)(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(500);
        await (0, supertest_1.default)(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(200);
        expect(logger.info).toHaveBeenCalledTimes(2);
        for (const [entry] of logger.info.mock.calls) {
            expect(entry.userId).toBeUndefined();
            expect(entry.context).toMatchObject({ event: "CLASSROOM_PARTICIPANT_JOINED", admissionId, webhookEventId: "event-1", participantSid: "PA_1" });
        }
        expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/Private Name|secret-token|203\.0\.113/);
    });
    it("records no connection evidence for an unverified webhook", async () => {
        jest.spyOn(livekit_server_sdk_1.WebhookReceiver.prototype, "receive").mockRejectedValue(new Error("bad signature"));
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const app = (0, express_1.default)();
        const onVerifiedEvent = jest.fn();
        (0, livekitWebhook_1.mountLiveKitWebhook)(app, { logger: logger, stats: new statsCollector_1.StatsCollector("minecraft-server"),
            apiKey: "key", apiSecret: "secret", onVerifiedEvent });
        await (0, supertest_1.default)(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(400);
        expect(logger.info).not.toHaveBeenCalled();
        expect(onVerifiedEvent).not.toHaveBeenCalled();
        expect(logger.warn.mock.calls[0][0].context.event).toBe("LIVEKIT_WEBHOOK_VERIFICATION_FAILED");
    });
    it("logs a verified class departure separately from a board socket disconnect", async () => {
        const cachedAdmissionId = "22222222-2222-4222-8222-222222222222";
        classroomAdmissionIp_1.classroomAdmissionIps.remember("ROOM", cachedAdmissionId, "guest-abc", {
            clientIp: "198.51.100.10", ipSource: "railway", ipStatus: "available"
        });
        jest.spyOn(livekit_server_sdk_1.WebhookReceiver.prototype, "receive").mockResolvedValue({ ...event, event: "participant_left",
            participant: { ...event.participant, metadata: JSON.stringify({ admissionId: cachedAdmissionId }) }
        });
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const app = (0, express_1.default)();
        (0, livekitWebhook_1.mountLiveKitWebhook)(app, { logger: logger, stats: new statsCollector_1.StatsCollector("minecraft-server"),
            apiKey: "key", apiSecret: "secret" });
        await (0, supertest_1.default)(app).post("/webhooks/livekit").set("content-type", "application/webhook+json").send("{}").expect(200);
        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info.mock.calls[0][0].context).toMatchObject({
            event: "CLASSROOM_PARTICIPANT_LEFT", evidenceSource: "webhook", participantSid: "PA_1", admissionId: cachedAdmissionId,
            clientIp: "198.51.100.10", ipObservation: "admission", ipStatus: "available"
        });
    });
});
//# sourceMappingURL=classroomWebhook.test.js.map