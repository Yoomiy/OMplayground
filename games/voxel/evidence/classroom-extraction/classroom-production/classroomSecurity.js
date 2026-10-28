"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classroomAdmissionBodyError = void 0;
exports.classroomAdmissionEvidence = classroomAdmissionEvidence;
exports.classroomAdmissionLogger = classroomAdmissionLogger;
const crypto_1 = require("crypto");
const observability_1 = require("@playground/observability");
function classroomAdmissionEvidence(res) {
    return res.locals.classroomAdmission;
}
/** Body-parser errors can contain raw request text; never send them to logging. */
const classroomAdmissionBodyError = (error, _req, res, next) => {
    const outcomes = {
        "entity.parse.failed": { status: 400, reason: "invalid_json" },
        "entity.too.large": { status: 413, reason: "body_too_large" },
        "encoding.unsupported": { status: 415, reason: "unsupported_encoding" },
        "charset.unsupported": { status: 415, reason: "unsupported_charset" },
        "request.aborted": { status: 400, reason: "request_aborted" },
        "request.size.invalid": { status: 400, reason: "invalid_body_size" },
    };
    const outcome = typeof error?.type === "string" && Object.hasOwn(outcomes, error.type)
        ? outcomes[error.type]
        : undefined;
    const evidence = res.locals.classroomAdmission;
    if (!evidence || !outcome)
        return next(error);
    evidence.reason = outcome.reason;
    if (!res.headersSent && !res.destroyed)
        res.status(outcome.status).json({ error: outcome.reason });
};
exports.classroomAdmissionBodyError = classroomAdmissionBodyError;
/** Mount before CORS, limiting and body parsing so early exits are recorded too. */
function classroomAdmissionLogger(logger, ipSource) {
    return (req, res, next) => {
        if (req.method !== "POST" || !/^\/rtc\/classroom-token\/?$/i.test(req.path))
            return next();
        const evidence = { admissionId: (0, crypto_1.randomUUID)() };
        res.locals.classroomAdmission = evidence;
        const ip = (0, observability_1.readSecurityClientIp)(req, ipSource);
        const accountTokenProvided = Boolean(req.headers.authorization);
        const startedAt = Date.now();
        let recorded = false;
        const record = (aborted) => {
            if (recorded)
                return;
            recorded = true;
            const success = !aborted && evidence.issued && res.statusCode < 400;
            if (success && evidence.roomCode && evidence.identity) {
                observability_1.classroomAdmissionIps.remember(evidence.roomCode, evidence.admissionId, evidence.identity.participantIdentity, ip);
            }
            const reason = aborted
                ? "connection_closed"
                : (evidence.reason ??
                    (success
                        ? "token_issued"
                        : res.statusCode === 429
                            ? "rate_limited"
                            : res.statusCode === 413
                                ? "body_too_large"
                                : res.statusCode === 400
                                    ? "invalid_request"
                                    : res.statusCode === 403
                                        ? "access_denied"
                                        : "request_failed"));
            const event = success
                ? "CLASSROOM_RTC_TOKEN_ISSUED"
                : !aborted && res.statusCode >= 500
                    ? "CLASSROOM_RTC_TOKEN_FAILED"
                    : "CLASSROOM_RTC_TOKEN_DENIED";
            logger[success ? "info" : event.endsWith("FAILED") ? "error" : "warn"]({
                correlationId: (0, observability_1.requestCorrelationId)(req),
                protocol: "http",
                roomCode: evidence.roomCode,
                message: "Classroom admission outcome",
                context: {
                    event,
                    status: success ? "success" : "failed",
                    reason,
                    admissionId: evidence.admissionId,
                    ...ip,
                    ...evidence.identity,
                    accountTokenProvided,
                    httpStatus: aborted ? undefined : res.statusCode,
                    duration_ms: Date.now() - startedAt,
                },
            });
        };
        res.once("finish", () => record(false));
        res.once("close", () => record(!res.writableFinished));
        next();
    };
}
//# sourceMappingURL=classroomSecurity.js.map