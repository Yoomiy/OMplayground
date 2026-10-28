import express from "express";
import { EventEmitter } from "events";
import request from "supertest";
import type { Logger } from "pino";
import {
  classroomAdmissionIps,
  correlationMiddleware,
} from "@playground/observability";
import {
  classroomAdmissionEvidence,
  classroomAdmissionLogger,
  classroomAdmissionBodyError,
} from "./classroomSecurity";

function setup() {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const app = express();
  app.use(correlationMiddleware());
  app.use(classroomAdmissionLogger(logger as unknown as Logger, "railway"));
  // Simulate the real order: limiter then body parser then route.
  app.use((req, res, next) => {
    if (req.headers["x-test-limit"]) return void res.sendStatus(429);
    next();
  });
  app.use(express.json({ limit: 512 }));
  app.use(classroomAdmissionBodyError);
  app.post("/rtc/classroom-token", (req, res) => {
    const evidence = classroomAdmissionEvidence(res);
    evidence.roomCode = "ROOM";
    evidence.identity = {
      participantIdentity: "guest-abc",
      participantKey: "guest:ROOM:browser-key",
      authenticationMethod: "guest",
      accountTokenOutcome: "unverified",
      role: "student",
      isHost: false,
    };
    if (req.body.blocked) {
      evidence.reason = "classroom_blocked";
      return void res.sendStatus(403);
    }
    if (req.body.unavailable) {
      evidence.reason = "server_config";
      return void res.sendStatus(503);
    }
    evidence.issued = true;
    res.json({ token: "secret-response-token" });
  });
  app.post("/other", (_req, res) => res.sendStatus(200));
  app.use(
    (
      error: { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.sendStatus(error.status ?? 500);
    },
  );
  return { app, logger };
}

describe("classroom admission evidence", () => {
  it("records one outcome per admission, with identities, without credentials or content", async () => {
    const { app, logger } = setup();
    await request(app)
      .post("/rtc/classroom-token")
      .set("x-real-ip", "203.0.113.7")
      .set("authorization", "Bearer secret-account-token")
      .set("x-correlation-id", "c-classroom")
      .send({
        displayName: "Private Name",
        presenterToken: "secret-capability",
      })
      .expect(200);
    expect(logger.info).toHaveBeenCalledTimes(1);
    const entry = logger.info.mock.calls[0][0];
    expect(entry).toMatchObject({
      correlationId: "c-classroom",
      roomCode: "ROOM",
      context: {
        event: "CLASSROOM_RTC_TOKEN_ISSUED",
        clientIp: "203.0.113.7",
        authenticationMethod: "guest",
        accountTokenOutcome: "unverified",
        accountTokenProvided: true,
      },
    });
    expect(entry.context.admissionId).toMatch(/^[a-f0-9-]{36}$/);
    expect(
      classroomAdmissionIps.lookup(
        "ROOM",
        entry.context.admissionId,
        "guest-abc",
      ),
    ).toMatchObject({
      clientIp: "203.0.113.7",
      ipObservation: "admission",
    });
    expect(entry.context.accountId).toBeUndefined();
    expect(JSON.stringify(entry)).not.toMatch(/secret-|Private Name/);
  });

  it("preserves the denied guest key so re-entry attempts can be investigated", async () => {
    const { app, logger } = setup();
    await request(app)
      .post("/rtc/classroom-token")
      .send({ blocked: true })
      .expect(403);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0].context).toMatchObject({
      event: "CLASSROOM_RTC_TOKEN_DENIED",
      reason: "classroom_blocked",
      participantKey: "guest:ROOM:browser-key",
      ipStatus: "unavailable",
    });
  });

  it("covers rate limiting and malformed JSON before route execution", async () => {
    const { app, logger } = setup();
    await request(app)
      .post("/rtc/classroom-token")
      .set("x-test-limit", "yes")
      .expect(429);
    await request(app)
      .post("/rtc/classroom-token")
      .set("content-type", "application/json")
      .send("{")
      .expect(400);
    await request(app)
      .post("/rtc/classroom-token")
      .send({ oversized: "x".repeat(1024) })
      .expect(413);
    expect(
      logger.warn.mock.calls.map(([entry]) => entry.context.reason),
    ).toEqual(["rate_limited", "invalid_json", "body_too_large"]);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("classifies infrastructure failures as errors rather than ordinary denied entry", async () => {
    const { app, logger } = setup();
    await request(app)
      .post("/rtc/classroom-token/")
      .send({ unavailable: true })
      .expect(503);
    expect(logger.error.mock.calls[0][0].context).toMatchObject({
      event: "CLASSROOM_RTC_TOKEN_FAILED",
      reason: "server_config",
      httpStatus: 503,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("records a closed connection once without claiming a response was delivered", () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const res = Object.assign(new EventEmitter(), {
      locals: {},
      statusCode: 200,
      writableFinished: false,
    });
    const req = {
      method: "POST",
      path: "/rtc/classroom-token",
      headers: {},
      socket: {},
    };
    classroomAdmissionLogger(logger as unknown as Logger, "unavailable")(
      req as express.Request,
      res as unknown as express.Response,
      jest.fn(),
    );
    res.emit("close");
    res.emit("close");
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0].context).toMatchObject({
      reason: "connection_closed",
      httpStatus: undefined,
    });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("keeps other routes out and assigns separate admission IDs to siblings sharing an IP", async () => {
    const { app, logger } = setup();
    await request(app).post("/other").send({}).expect(200);
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post("/rtc/classroom-token")
        .set("x-real-ip", "203.0.113.7")
        .send({})
        .expect(200);
    }
    expect(logger.info).toHaveBeenCalledTimes(2);
    const entries = logger.info.mock.calls.map(([entry]) => entry.context);
    expect(entries[0].clientIp).toEqual(entries[1].clientIp);
    expect(entries[0].admissionId).not.toEqual(entries[1].admissionId);
  });
});
