import { randomUUID } from "crypto";
import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import type { Logger } from "pino";
import { classroomAdmissionIps, readSecurityClientIp, requestCorrelationId, type ClientIpSource } from "@playground/observability";

export interface ClassroomSecurityIdentity {
  accountId?: string;
  participantIdentity: string;
  participantKey: string;
  authenticationMethod: "account" | "guest" | "delegate";
  accountTokenOutcome: "absent" | "accepted" | "unverified";
  role: string;
  isHost: boolean;
}

interface AdmissionEvidence {
  admissionId: string;
  roomCode?: string;
  reason?: string;
  issued?: boolean;
  identity?: ClassroomSecurityIdentity;
}

export function classroomAdmissionEvidence(res: Response): AdmissionEvidence {
  return res.locals.classroomAdmission;
}

/** Body-parser errors can contain raw request text; never send them to logging. */
export const classroomAdmissionBodyError: ErrorRequestHandler = (error, _req, res, next) => {
  const outcomes: Record<string, { status: number; reason: string }> = {
    "entity.parse.failed": { status: 400, reason: "invalid_json" },
    "entity.too.large": { status: 413, reason: "body_too_large" },
    "encoding.unsupported": { status: 415, reason: "unsupported_encoding" },
    "charset.unsupported": { status: 415, reason: "unsupported_charset" },
    "request.aborted": { status: 400, reason: "request_aborted" },
    "request.size.invalid": { status: 400, reason: "invalid_body_size" }
  };
  const outcome = typeof error?.type === "string" && Object.hasOwn(outcomes, error.type)
    ? outcomes[error.type] : undefined;
  const evidence = res.locals.classroomAdmission as AdmissionEvidence | undefined;
  if (!evidence || !outcome) return next(error);
  evidence.reason = outcome.reason;
  if (!res.headersSent && !res.destroyed) res.status(outcome.status).json({ error: outcome.reason });
};

/** Mount before CORS, limiting and body parsing so early exits are recorded too. */
export function classroomAdmissionLogger(logger: Logger, ipSource: ClientIpSource): RequestHandler {
  return (req, res, next) => {
    if (req.method !== "POST" || !/^\/rtc\/classroom-token\/?$/i.test(req.path)) return next();
    const evidence: AdmissionEvidence = { admissionId: randomUUID() };
    res.locals.classroomAdmission = evidence;
    const ip = readSecurityClientIp(req, ipSource);
    const accountTokenProvided = Boolean(req.headers.authorization);
    const startedAt = Date.now();
    let recorded = false;
    const record = (aborted: boolean) => {
      if (recorded) return;
      recorded = true;
      const success = !aborted && evidence.issued && res.statusCode < 400;
      if (success && evidence.roomCode && evidence.identity) {
        classroomAdmissionIps.remember(evidence.roomCode, evidence.admissionId, evidence.identity.participantIdentity, ip);
      }
      const reason = aborted ? "connection_closed" : evidence.reason ?? (
        success ? "token_issued" : res.statusCode === 429 ? "rate_limited"
          : res.statusCode === 413 ? "body_too_large" : res.statusCode === 400 ? "invalid_request"
            : res.statusCode === 403 ? "access_denied" : "request_failed"
      );
      const event = success ? "CLASSROOM_RTC_TOKEN_ISSUED"
        : !aborted && res.statusCode >= 500 ? "CLASSROOM_RTC_TOKEN_FAILED" : "CLASSROOM_RTC_TOKEN_DENIED";
      logger[success ? "info" : event.endsWith("FAILED") ? "error" : "warn"]({
        correlationId: requestCorrelationId(req),
        protocol: "http",
        roomCode: evidence.roomCode,
        message: "Classroom admission outcome",
        context: {
          event, status: success ? "success" : "failed", reason,
          admissionId: evidence.admissionId, ...ip, ...evidence.identity,
          accountTokenProvided,
          httpStatus: aborted ? undefined : res.statusCode,
          duration_ms: Date.now() - startedAt
        }
      });
    };
    res.once("finish", () => record(false));
    res.once("close", () => record(!res.writableFinished));
    next();
  };
}
