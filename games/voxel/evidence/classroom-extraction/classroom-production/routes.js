"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountClassroomRoutes = mountClassroomRoutes;
const observability_1 = require("@playground/observability");
const classroomSecurity_1 = require("./classroomSecurity");
const schoolIdentity_1 = require("./schoolIdentity");
const livekitService_1 = require("./livekitService");
const classroomAttendance_1 = require("./classroomAttendance");
const classroomParticipantBlocks_1 = require("./classroomParticipantBlocks");
const classroomPresentation_1 = require("./classroomPresentation");
const classroomPresenterAssignment_1 = require("./classroomPresenterAssignment");
const classroomDelegates_1 = require("./classroomDelegates");
const classroomBoardToken_1 = require("./classroomBoardToken");
const classroomDrawingSession_1 = require("./classroomDrawingSession");
function mountClassroomRoutes(app, options) {
    const { supabaseAdmin, logger } = options;
    const CORS_ORIGIN = options.corsOrigin, SUPABASE_SECRET_KEY = options.signingSecret;
    const DOCUMENT_CONVERTER_URL = options.documentConverterUrl;
    const DOCUMENT_CONVERTER_SHARED_SECRET = options.documentConverterSecret;
    let attendanceReconciliationRunning = false;
    async function reconcileActiveClassroomAttendance() {
        if (!supabaseAdmin || attendanceReconciliationRunning)
            return;
        attendanceReconciliationRunning = true;
        try {
            const { data: classrooms, error } = await supabaseAdmin
                .from("classroom_sessions")
                .select("id, room_code")
                .eq("status", "active");
            if (error)
                throw error;
            await (0, classroomAttendance_1.reconcileClassroomAttendance)(supabaseAdmin, classrooms ?? []);
        }
        catch (err) {
            logger.warn({
                protocol: "internal",
                message: "Classroom attendance reconciliation failed",
                context: { event: "CLASSROOM_ATTENDANCE_RECONCILIATION_FAILED" },
                err: (0, observability_1.logError)(err),
            });
        }
        finally {
            attendanceReconciliationRunning = false;
        }
    }
    const CLASSROOM_CLEANUP_MIN_DAYS = 1;
    const CLASSROOM_CLEANUP_MAX_DAYS = 365;
    const CLASSROOM_DELEGATE_ENROLLMENT_MS = 2 * 60_000;
    const CLASSROOM_DELEGATE_SESSION_MS = 365 * 24 * 60 * 60_000;
    async function completeClassroomDrawingSessions(roomCodes) {
        if (!supabaseAdmin || roomCodes.length === 0)
            return;
        const { data: classrooms, error: classroomError } = await supabaseAdmin
            .from("classroom_sessions")
            .select("id")
            .in("room_code", roomCodes);
        if (classroomError)
            throw classroomError;
        const classroomIds = (classrooms ?? []).map((classroom) => classroom.id);
        if (classroomIds.length === 0)
            return;
        const { error } = await supabaseAdmin
            .from("game_sessions")
            .update({
            status: "completed",
            game_state: null,
            connected_player_ids: [],
            connected_player_names: [],
            last_activity: new Date().toISOString(),
        })
            .in("classroom_id", classroomIds)
            .in("status", ["waiting", "playing", "paused"]);
        if (error)
            throw error;
    }
    async function requireClassroomManager(req, res) {
        const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
        if (!accessToken || !supabaseAdmin) {
            res.status(401).json({ error: "unauthorized" });
            return null;
        }
        const actor = await (0, schoolIdentity_1.getSchoolIdentity)(supabaseAdmin, accessToken).catch(() => null);
        if (!actor || (actor.role !== "teacher" && actor.role !== "admin")) {
            res.status(403).json({ error: "forbidden" });
            return null;
        }
        return actor;
    }
    async function requireClassroomAdmin(req, res) {
        const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
        if (!accessToken || !supabaseAdmin) {
            res.status(401).json({ error: "unauthorized" });
            return null;
        }
        const actor = await (0, schoolIdentity_1.getSchoolIdentity)(supabaseAdmin, accessToken).catch(() => null);
        if (!actor || actor.role !== "admin") {
            res.status(403).json({ error: "forbidden" });
            return null;
        }
        return actor;
    }
    function isTrustedBrowserOrigin(req) {
        const origin = req.headers.origin;
        return Boolean(origin &&
            CORS_ORIGIN.split(",")
                .map((value) => value.trim())
                .includes(origin));
    }
    async function requireClassroomAuthority(req, res, classroomId, requiredScope) {
        const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
        if (accessToken && supabaseAdmin) {
            const actor = await (0, schoolIdentity_1.getSchoolIdentity)(supabaseAdmin, accessToken).catch(() => null);
            if (actor?.role === "teacher" || actor?.role === "admin") {
                return {
                    kind: "user",
                    userId: actor.userId,
                    actorKind: actor.role === "admin" ? "admin" : "teacher",
                };
            }
        }
        if (!supabaseAdmin || !isTrustedBrowserOrigin(req)) {
            res.status(401).json({ error: "unauthorized" });
            return null;
        }
        const delegate = await (0, classroomDelegates_1.findClassroomDelegateAuthority)(supabaseAdmin, req, classroomId, requiredScope);
        if (!delegate) {
            res.status(403).json({ error: "forbidden" });
            return null;
        }
        return { kind: "delegate", delegate };
    }
    async function getActiveClassroom(roomCode) {
        if (!supabaseAdmin)
            return null;
        const { data, error } = await supabaseAdmin
            .from("classroom_sessions")
            .select("id, room_code, teacher_id, teacher_name, settings, status")
            .eq("room_code", roomCode)
            .eq("status", "active")
            .maybeSingle();
        if (error)
            throw error;
        return data;
    }
    let drawingGameIdPromise = null;
    async function classroomDrawingGameId() {
        if (!supabaseAdmin)
            throw new Error("server_config");
        if (drawingGameIdPromise)
            return drawingGameIdPromise;
        const pending = (async () => {
            const { data, error } = await supabaseAdmin
                .from("games")
                .select("id")
                .eq("game_url", "drawing")
                .maybeSingle();
            if (error || !data?.id)
                throw error ?? new Error("drawing_game_not_found");
            return String(data.id);
        })();
        drawingGameIdPromise = pending;
        try {
            return await pending;
        }
        catch (error) {
            drawingGameIdPromise = null;
            throw error;
        }
    }
    async function ensureClassroomDrawingSession(classroom) {
        if (!supabaseAdmin)
            throw new Error("server_config");
        const findExisting = async () => {
            const { data, error } = await supabaseAdmin
                .from("game_sessions")
                .select("id")
                .eq("classroom_id", classroom.id)
                .maybeSingle();
            if (error)
                throw error;
            return data?.id ? String(data.id) : null;
        };
        const existing = await findExisting();
        if (existing)
            return existing;
        const gameId = await classroomDrawingGameId();
        const { data: created, error } = await supabaseAdmin
            .from("game_sessions")
            .insert((0, classroomDrawingSession_1.classroomDrawingSessionInsert)(classroom, gameId))
            .select("id")
            .maybeSingle();
        if (created?.id)
            return String(created.id);
        if ((0, classroomDrawingSession_1.isPostgresUniqueViolation)(error)) {
            const raced = await findExisting();
            if (raced)
                return raced;
        }
        throw error ?? new Error("classroom_drawing_session_create_failed");
    }
    function classroomSettings(value) {
        return value && typeof value === "object"
            ? value
            : {};
    }
    function presentationRoomState(settings) {
        const value = classroomSettings(settings);
        const kind = value.presentationMediaKind;
        return {
            presenterIdentity: typeof value.presentationPresenterIdentity === "string"
                ? value.presentationPresenterIdentity
                : null,
            presenterEpoch: Number.isInteger(value.presentationPresenterEpoch)
                ? Number(value.presentationPresenterEpoch)
                : 0,
            visible: value.presentationVisible === true,
            title: typeof value.presentationTitle === "string"
                ? value.presentationTitle
                : null,
            mediaKind: kind === "document" ||
                kind === "image" ||
                kind === "video" ||
                kind === "audio"
                ? kind
                : null,
        };
    }
    function presentationStatePatch(state) {
        return {
            presentationPresenterIdentity: state.presenterIdentity,
            presentationPresenterEpoch: state.presenterEpoch,
            presentationVisible: state.visible,
            presentationTitle: state.title,
            presentationMediaKind: state.mediaKind,
        };
    }
    async function patchClassroomSettings(classroom, patch) {
        if (!supabaseAdmin)
            throw new Error("supabase_not_configured");
        const { data, error } = await supabaseAdmin.rpc("patch_classroom_session_settings", {
            p_session_id: classroom.id,
            p_patch: patch,
        });
        if (error)
            throw error;
        const settings = Array.isArray(data) ? data[0] : data;
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
            throw new Error("classroom_settings_patch_failed");
        }
        classroom.settings = settings;
        return settings;
    }
    async function persistPresentationState(classroom, state) {
        await patchClassroomSettings(classroom, presentationStatePatch(state));
    }
    function authorityIdentity(authority) {
        return authority.kind === "delegate"
            ? `delegate:${authority.delegate.delegateId}`
            : authority.userId;
    }
    async function appendClassroomAudit(req, classroom, authority, action, metadata = {}) {
        if (!supabaseAdmin)
            return;
        const actorId = authority.kind === "user" ? authority.userId : null;
        const actorKind = authority.kind === "user" ? authority.actorKind : "delegate";
        const correlationId = req
            .correlationId;
        const { error } = await supabaseAdmin.rpc("append_audit_log", {
            p_actor_id: actorId ?? null,
            p_actor_kind: actorKind,
            p_action: action,
            p_entity_type: "classroom_session",
            p_entity_id: classroom.id,
            p_metadata: (0, observability_1.auditMetadata)(correlationId, {
                room_code: classroom.room_code,
                ...metadata,
            }),
            p_correlation_id: correlationId ?? null,
        });
        if (error) {
            logger.error({
                correlationId,
                protocol: "internal",
                err: (0, observability_1.logError)(error),
                message: "Classroom audit write failed",
                context: {
                    event: "CLASSROOM_AUDIT_WRITE_FAILED",
                    action,
                    classroomId: classroom.id,
                    roomCode: classroom.room_code,
                },
            });
        }
    }
    function presenterCapabilityFor(roomCode, state) {
        if (!state.presenterIdentity || !SUPABASE_SECRET_KEY)
            return null;
        return (0, classroomPresentation_1.createPresenterCapability)(roomCode, state.presenterIdentity, state.presenterEpoch, SUPABASE_SECRET_KEY);
    }
    function requirePresenterCapability(req, res, classroom) {
        const capability = (0, classroomPresentation_1.readPresenterCapability)(req.body?.presenterToken, SUPABASE_SECRET_KEY);
        const state = presentationRoomState(classroom.settings);
        if (!capability ||
            capability.roomCode !== classroom.room_code ||
            capability.identity !== state.presenterIdentity ||
            capability.epoch !== state.presenterEpoch ||
            Number(req.body?.presenterEpoch) !== state.presenterEpoch) {
            res.status(403).json({ error: "presenter_required" });
            return null;
        }
        return { identity: capability.identity, epoch: capability.epoch };
    }
    async function assignPresenter(classroom, identity, keepVisibility = true, delivery = "synchronize-room") {
        const previous = presentationRoomState(classroom.settings);
        return (0, classroomPresenterAssignment_1.commitPresenterAssignment)(previous, identity, keepVisibility, delivery, {
            persist: (next) => persistPresentationState(classroom, next),
            synchronizePermissions: (prior, next) => (0, livekitService_1.syncClassroomPresenterPermissions)(classroom.room_code, classroomSettings(classroom.settings), prior.presenterIdentity, next.presenterIdentity),
            createCapability: (next) => presenterCapabilityFor(classroom.room_code, next),
            broadcast: (next) => (0, livekitService_1.broadcastClassroomData)(classroom.room_code, {
                type: "PRESENTER_ASSIGNED",
                presenterIdentity: next.presenterIdentity,
                presenterEpoch: next.presenterEpoch,
                visible: next.visible,
            }),
            sendCapability: (targetIdentity, capability, next) => (0, livekitService_1.sendClassroomDataToParticipant)(classroom.room_code, targetIdentity, {
                type: "PRESENTER_CAPABILITY",
                presenterIdentity: targetIdentity,
                presenterEpoch: next.presenterEpoch,
                presenterToken: capability,
            }),
        });
    }
    function setDelegateCookie(res, delegateId, sessionId, secret) {
        res.cookie((0, classroomDelegates_1.delegateCookieName)(delegateId), `${sessionId}.${secret}`, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: CLASSROOM_DELEGATE_SESSION_MS,
        });
    }
    app.post("/rtc/classroom-token", async (req, res) => {
        const evidence = (0, classroomSecurity_1.classroomAdmissionEvidence)(res);
        const correlationId = req
            .correlationId;
        const requestedRoomCode = typeof req.body?.roomCode === "string"
            ? req.body.roomCode.trim().slice(0, 80)
            : undefined;
        evidence.roomCode = requestedRoomCode;
        try {
            const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
            const { roomCode, displayName, spectateMode, presenterToken: reconnectPresenterToken, guestAttendanceKey, } = (req.body ?? {});
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                roomCode.length > 80 ||
                (displayName !== undefined && typeof displayName !== "string")) {
                evidence.reason = "invalid_request";
                res.status(400).json({ error: "missing_room_code" });
                return;
            }
            if (!supabaseAdmin) {
                evidence.reason = "server_config";
                res.status(503).json({ error: "server_config" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode);
            if (!classroom) {
                evidence.reason = "classroom_not_found";
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            let drawingSessionId;
            try {
                drawingSessionId = await ensureClassroomDrawingSession(classroom);
            }
            catch (error) {
                evidence.reason = "classroom_board_unavailable";
                logger.error({
                    correlationId,
                    roomCode,
                    protocol: "http",
                    message: "Classroom drawing session provisioning failed",
                    context: {
                        event: "CLASSROOM_DRAWING_SESSION_PROVISION_FAILED",
                        status: "failed",
                    },
                    err: (0, observability_1.logError)(error),
                });
                res.status(503).json({
                    error: "classroom_board_unavailable",
                    message: "לוח הכיתה אינו זמין כרגע; נסו להתחבר שוב.",
                });
                return;
            }
            const trustedBrowserOrigin = isTrustedBrowserOrigin(req);
            const guestParticipantKey = (0, classroomAttendance_1.classroomGuestAttendanceKey)(roomCode, guestAttendanceKey);
            const delegate = trustedBrowserOrigin
                ? await (0, classroomDelegates_1.findClassroomDelegateAuthority)(supabaseAdmin, req, classroom.id)
                : null;
            if (!delegate && trustedBrowserOrigin && guestParticipantKey) {
                try {
                    const expectedDelegate = await (0, classroomDelegates_1.findActiveClassroomDelegateByParticipantKey)(supabaseAdmin, classroom.id, guestParticipantKey);
                    if (expectedDelegate) {
                        const delegateCookiePresent = (0, classroomDelegates_1.hasClassroomDelegateCookie)(req, expectedDelegate.id);
                        logger.warn({
                            correlationId,
                            roomCode,
                            protocol: "http",
                            message: "Active classroom delegate reconnected without valid delegate authority",
                            context: {
                                event: "CLASSROOM_DELEGATE_RECONNECT_AUTH_MISSING",
                                status: "failed",
                                reason: delegateCookiePresent
                                    ? "delegate_session_invalid"
                                    : "delegate_cookie_missing",
                                delegateCookiePresent,
                            },
                        });
                    }
                }
                catch (diagnosticError) {
                    logger.warn({
                        correlationId,
                        roomCode,
                        protocol: "http",
                        message: "Could not inspect classroom delegate reconnect authority",
                        context: {
                            event: "CLASSROOM_DELEGATE_RECONNECT_DIAGNOSTIC_FAILED",
                            status: "failed",
                        },
                        err: (0, observability_1.logError)(diagnosticError),
                    });
                }
            }
            const reconnectCapability = (0, classroomPresentation_1.readPresenterCapability)(reconnectPresenterToken, SUPABASE_SECRET_KEY);
            const reconnectState = presentationRoomState(classroom.settings);
            const presenterIdentityOverride = reconnectCapability &&
                reconnectCapability.roomCode === classroom.room_code &&
                reconnectCapability.identity === reconnectState.presenterIdentity &&
                reconnectCapability.epoch === reconnectState.presenterEpoch
                ? reconnectCapability.identity
                : undefined;
            let result = await (0, livekitService_1.generateClassroomToken)({
                supabaseAdmin,
                roomCode,
                displayName: displayName ?? "משתתף",
                accessToken,
                spectateMode,
                delegate: delegate
                    ? { id: delegate.delegateId, displayName: delegate.displayName }
                    : null,
                presenterIdentityOverride,
                guestAttendanceKey: guestParticipantKey,
                admissionId: evidence.admissionId,
                onSecurityIdentity: (identity) => {
                    evidence.identity = identity;
                },
            });
            let presentation = presentationRoomState(classroom.settings);
            // The creator is normally first, but any first visible host can bootstrap
            // an empty presenter slot so the classroom always has one viewport source.
            if ((0, classroomPresenterAssignment_1.shouldBootstrapClassroomPresenter)(presentation.presenterIdentity, result.isHost, spectateMode)) {
                // The token is what allows the first participant to create the LiveKit
                // room. Persist bootstrap authority now; the response and Supabase
                // realtime carry this state without calling room-scoped LiveKit APIs.
                presentation = await assignPresenter(classroom, result.userId, false, "persist-only");
                result = await (0, livekitService_1.generateClassroomToken)({
                    supabaseAdmin,
                    roomCode,
                    displayName: displayName ?? "משתתף",
                    accessToken,
                    spectateMode,
                    delegate: delegate
                        ? { id: delegate.delegateId, displayName: delegate.displayName }
                        : null,
                    presenterIdentityOverride: result.userId,
                    guestAttendanceKey: (0, classroomAttendance_1.classroomGuestAttendanceKey)(roomCode, guestAttendanceKey),
                    admissionId: evidence.admissionId,
                    onSecurityIdentity: (identity) => {
                        evidence.identity = identity;
                    },
                });
            }
            const delegateGameToken = delegate
                ? (0, classroomDelegates_1.createClassroomDelegateGameToken)({
                    delegateId: delegate.delegateId,
                    classroomId: classroom.id,
                    roomCode,
                    identity: result.userId,
                }, SUPABASE_SECRET_KEY)
                : undefined;
            const classroomBoardToken = (0, classroomBoardToken_1.createClassroomBoardToken)({
                classroomId: classroom.id,
                roomCode,
                identity: result.userId,
                participantKey: result.attendanceKey,
                displayName: result.displayName,
                role: result.role,
                isHost: result.isHost,
            }, SUPABASE_SECRET_KEY);
            evidence.issued = true;
            res.json({
                token: result.token,
                serverUrl: result.serverUrl,
                livekitRoom: result.livekitRoom,
                userId: result.userId,
                attendanceKey: result.attendanceKey,
                isHost: result.isHost,
                role: result.role,
                isDelegate: result.isDelegate,
                canPublishMicrophone: result.canPublishMicrophone,
                canPublishCamera: result.canPublishCamera,
                canPublishScreenShare: result.canPublishScreenShare,
                canDrawWhiteboard: result.canDrawWhiteboard,
                delegateScopes: delegate?.scopes ?? [],
                delegateGameToken,
                classroomBoardToken,
                classroomSessionId: classroom.id,
                drawingSessionId,
                presenterIdentity: presentation.presenterIdentity,
                presenterEpoch: presentation.presenterEpoch,
                presentationVisible: presentation.visible,
                presentationTitle: presentation.title,
                presentationMediaKind: presentation.mediaKind,
                presenterToken: presentation.presenterIdentity === result.userId
                    ? presenterCapabilityFor(classroom.room_code, presentation)
                    : null,
            });
        }
        catch (err) {
            if (err instanceof livekitService_1.LiveKitTokenError) {
                const reason = err.reason;
                evidence.reason = reason;
                const status = reason === "server_config"
                    ? 503
                    : reason === "classroom_blocked"
                        ? 403
                        : 400;
                res.status(status).json({ error: reason, message: err.message });
                return;
            }
            evidence.reason = "internal_server_error";
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_RTC_TOKEN_INTERNAL_FAILED", requestedRoomCode ? { roomCode: requestedRoomCode } : {});
            res.status(500).json({
                error: "internal_server_error",
                message: "לא ניתן להתחבר לכיתה כרגע. נסו שוב.",
            });
        }
    });
    app.post("/rtc/classroom-end", async (req, res) => {
        try {
            const { roomCode } = req.body || {};
            if (typeof roomCode !== "string" || !roomCode.trim()) {
                res.status(400).json({ error: "missing_room_code" });
                return;
            }
            const actor = await requireClassroomManager(req, res);
            if (!actor || !supabaseAdmin)
                return;
            const normalizedRoomCode = roomCode.trim();
            const { data: classroom, error: classroomError } = await supabaseAdmin
                .from("classroom_sessions")
                .select("id, room_code, settings, status")
                .eq("room_code", normalizedRoomCode)
                .maybeSingle();
            if (classroomError || !classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            const closedAt = new Date().toISOString();
            try {
                await (0, classroomAttendance_1.reconcileClassroomAttendance)(supabaseAdmin, [classroom]);
            }
            catch (attendanceError) {
                logger.warn({
                    protocol: "http",
                    message: "Could not snapshot attendance before classroom close",
                    context: {
                        event: "CLASSROOM_ATTENDANCE_PRE_CLOSE_FAILED",
                        roomCode: normalizedRoomCode,
                    },
                    err: (0, observability_1.logError)(attendanceError),
                });
            }
            const { error: updateError } = await supabaseAdmin
                .from("classroom_sessions")
                .update({
                status: "ended",
                ended_at: closedAt,
                whiteboard_data: null,
                last_activity: closedAt,
            })
                .eq("id", classroom.id);
            if (updateError) {
                throw updateError;
            }
            // LiveKit uses PARTICIPANT_REMOVED for this deliberate class-wide eviction
            // too. Send a reliable server message first so clients preserve the actual
            // cause when their disconnect event arrives.
            try {
                await (0, livekitService_1.broadcastClassroomData)(normalizedRoomCode, {
                    type: "CLASSROOM_ENDED",
                });
                await new Promise((resolve) => setTimeout(resolve, 150));
            }
            catch (broadcastError) {
                logger.warn({
                    protocol: "webrtc",
                    message: "Could not announce classroom closure before eviction",
                    context: {
                        event: "CLASSROOM_END_ANNOUNCEMENT_FAILED",
                        roomCode: normalizedRoomCode,
                    },
                    err: (0, observability_1.logError)(broadcastError),
                });
            }
            await completeClassroomDrawingSessions([normalizedRoomCode]);
            const evictedParticipantCount = await (0, livekitService_1.evictClassroomParticipants)(normalizedRoomCode);
            const livekitDeleted = await (0, livekitService_1.deleteLiveKitRoom)(normalizedRoomCode);
            await (0, classroomAttendance_1.finalizeClassroomAttendance)(supabaseAdmin, classroom, closedAt);
            await appendClassroomAudit(req, classroom, {
                kind: "user",
                userId: actor.userId,
                actorKind: actor.role === "admin" ? "admin" : "teacher",
            }, "classroom_ended", {
                livekit_deleted: livekitDeleted,
                evicted_participant_count: evictedParticipantCount,
            });
            logger.info({
                userId: actor.userId,
                protocol: "http",
                message: "Classroom ended",
                context: {
                    event: "CLASSROOM_ENDED",
                    roomCode: normalizedRoomCode,
                    livekitDeleted,
                    evictedParticipantCount,
                },
            });
            res.json({
                success: true,
                roomCode: normalizedRoomCode,
                livekitDeleted,
                evictedParticipantCount,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_END_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-cleanup", async (req, res) => {
        try {
            const actor = await requireClassroomAdmin(req, res);
            if (!actor || !supabaseAdmin)
                return;
            const requestedDays = Number((req.body || {}).daysOld ?? 7);
            if (!Number.isInteger(requestedDays) ||
                requestedDays < CLASSROOM_CLEANUP_MIN_DAYS ||
                requestedDays > CLASSROOM_CLEANUP_MAX_DAYS) {
                res.status(400).json({ error: "invalid_days_old" });
                return;
            }
            const cutoffDate = new Date(Date.now() - requestedDays * 86400000).toISOString();
            const { data: roomsToClean, error: queryError } = await supabaseAdmin
                .from("classroom_sessions")
                .select("id, room_code")
                .eq("is_persistent", false)
                .eq("status", "active")
                .lt("last_activity", cutoffDate);
            if (queryError)
                throw queryError;
            const staleClassrooms = roomsToClean ?? [];
            try {
                await (0, classroomAttendance_1.reconcileClassroomAttendance)(supabaseAdmin, staleClassrooms);
            }
            catch (attendanceError) {
                logger.warn({
                    protocol: "http",
                    message: "Could not snapshot attendance before classroom cleanup",
                    context: { event: "CLASSROOM_ATTENDANCE_PRE_CLEANUP_FAILED" },
                    err: (0, observability_1.logError)(attendanceError),
                });
            }
            const roomCodes = staleClassrooms.map((room) => room.room_code);
            await completeClassroomDrawingSessions(roomCodes);
            await Promise.all(roomCodes.map((roomCode) => (0, livekitService_1.deleteLiveKitRoom)(roomCode)));
            await Promise.all(staleClassrooms.map((classroom) => (0, classroomAttendance_1.finalizeClassroomAttendance)(supabaseAdmin, classroom)));
            const { data: endedCount, error: cleanupError } = await supabaseAdmin.rpc("cleanup_old_classroom_sessions", { p_days_old: requestedDays });
            if (cleanupError)
                throw cleanupError;
            logger.info({
                userId: actor.userId,
                protocol: "http",
                message: "Classroom cleanup completed",
                context: {
                    event: "CLASSROOM_CLEANUP",
                    endedCount: endedCount ?? 0,
                    requestedDays,
                },
            });
            res.json({ success: true, endedCount: endedCount ?? 0 });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_CLEANUP_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.get("/rtc/admin/classroom-records", async (req, res) => {
        try {
            const actor = await requireClassroomAdmin(req, res);
            if (!actor || !supabaseAdmin)
                return;
            const status = typeof req.query.status === "string" ? req.query.status : "all";
            const search = typeof req.query.search === "string"
                ? req.query.search.trim().toLocaleLowerCase()
                : "";
            const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
            const pageSize = Math.min(100, Math.max(10, Number.parseInt(String(req.query.pageSize ?? "50"), 10) || 50));
            let matchingClassroomIds = null;
            if (search) {
                const { data: matches, error: searchError } = await supabaseAdmin.rpc("find_classroom_record_ids", { p_search: search });
                if (searchError)
                    throw searchError;
                const matchedIds = (matches ?? []).map((match) => match.id);
                if (!matchedIds.length) {
                    res.json({ items: [], page, pageSize, total: 0 });
                    return;
                }
                matchingClassroomIds = matchedIds;
            }
            let query = supabaseAdmin
                .from("classroom_sessions")
                .select("id, title, subject, teacher_name, room_code, status, is_persistent, created_at, ended_at, last_activity", { count: "exact" })
                .order("last_activity", { ascending: false })
                .order("id", { ascending: false })
                .range((page - 1) * pageSize, page * pageSize - 1);
            if (status === "active" || status === "ended")
                query = query.eq("status", status);
            if (matchingClassroomIds)
                query = query.in("id", matchingClassroomIds);
            const { data: classroomRows, error: classroomError, count } = await query;
            if (classroomError)
                throw classroomError;
            const classrooms = classroomRows ?? [];
            let liveAttendanceByRoomCode = new Map();
            try {
                liveAttendanceByRoomCode = await (0, classroomAttendance_1.reconcileClassroomAttendance)(supabaseAdmin, classrooms.filter((classroom) => classroom.status === "active"));
            }
            catch (attendanceError) {
                logger.warn({
                    protocol: "http",
                    message: "Could not refresh live attendance for classroom records",
                    context: { event: "CLASSROOM_ADMIN_LIVE_ATTENDANCE_FAILED" },
                    err: (0, observability_1.logError)(attendanceError),
                });
            }
            const classroomIds = classrooms.map((row) => row.id);
            const { data: meetings, error: meetingsError } = classroomIds.length
                ? await supabaseAdmin
                    .from("classroom_meetings")
                    .select("id, classroom_id, ended_at")
                    .in("classroom_id", classroomIds)
                : { data: [], error: null };
            if (meetingsError)
                throw meetingsError;
            const meetingIds = (meetings ?? []).map((meeting) => meeting.id);
            const { data: participants, error: participantsError } = meetingIds.length
                ? await supabaseAdmin
                    .from("classroom_meeting_participants")
                    .select("meeting_id, participant_key, display_name, roles_held")
                    .in("meeting_id", meetingIds)
                : { data: [], error: null };
            if (participantsError)
                throw participantsError;
            const { data: delegates, error: delegatesError } = classroomIds.length
                ? await supabaseAdmin
                    .from("classroom_host_delegates")
                    .select("classroom_id, display_name, is_active")
                    .in("classroom_id", classroomIds)
                : { data: [], error: null };
            if (delegatesError)
                throw delegatesError;
            const meetingClassroom = new Map((meetings ?? []).map((meeting) => [meeting.id, meeting.classroom_id]));
            const summary = new Map();
            for (const classroom of classrooms)
                summary.set(classroom.id, {
                    sessionCount: 0,
                    participants: new Map(),
                    cohosts: new Set(),
                });
            for (const meeting of meetings ?? []) {
                const item = summary.get(meeting.classroom_id);
                if (item)
                    item.sessionCount += 1;
            }
            for (const participant of participants ?? []) {
                const classroomId = meetingClassroom.get(participant.meeting_id);
                const item = classroomId ? summary.get(classroomId) : undefined;
                if (!item)
                    continue;
                item.participants.set(participant.participant_key, participant.display_name);
                if ((participant.roles_held ?? []).includes("cohost"))
                    item.cohosts.add(participant.display_name);
            }
            for (const delegate of delegates ?? []) {
                if (delegate.is_active)
                    summary
                        .get(delegate.classroom_id)
                        ?.cohosts.add(delegate.display_name);
            }
            const items = classrooms.map((classroom) => {
                const item = summary.get(classroom.id);
                const liveParticipants = (liveAttendanceByRoomCode.get(classroom.room_code)?.participants ?? []).flatMap((participant) => {
                    let metadata = {};
                    try {
                        metadata = participant.metadata
                            ? JSON.parse(participant.metadata)
                            : {};
                    }
                    catch { }
                    const attendanceRole = typeof metadata.attendanceRole === "string"
                        ? metadata.attendanceRole
                        : "participant";
                    return attendanceRole === "hidden" ? [] : [{ attendanceRole }];
                });
                return {
                    ...classroom,
                    sessionCount: item.sessionCount,
                    participantCount: item.participants.size,
                    livePresenceKnown: classroom.status !== "active" ||
                        liveAttendanceByRoomCode.has(classroom.room_code),
                    liveParticipantCount: liveParticipants.length,
                    liveHostConnected: liveParticipants.some((participant) => participant.attendanceRole === "host"),
                    liveCohostCount: liveParticipants.filter((participant) => participant.attendanceRole === "cohost").length,
                    cohosts: [...item.cohosts].sort(),
                };
            });
            res.json({ items, page, pageSize, total: count ?? 0 });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_RECORDS_QUERY_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.get("/rtc/admin/classroom-records/:classroomId", async (req, res) => {
        try {
            const actor = await requireClassroomAdmin(req, res);
            if (!actor || !supabaseAdmin)
                return;
            const { data: classroom, error: classroomError } = await supabaseAdmin
                .from("classroom_sessions")
                .select("id, title, subject, teacher_name, room_code, status, is_persistent, created_at, ended_at, last_activity")
                .eq("id", req.params.classroomId)
                .maybeSingle();
            if (classroomError)
                throw classroomError;
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            let livePresenceKnown = classroom.status !== "active";
            if (classroom.status === "active") {
                try {
                    const liveAttendance = await (0, classroomAttendance_1.reconcileClassroomAttendance)(supabaseAdmin, [classroom]);
                    livePresenceKnown = liveAttendance.has(classroom.room_code);
                }
                catch (attendanceError) {
                    logger.warn({
                        protocol: "http",
                        message: "Could not refresh live attendance for classroom detail",
                        context: {
                            event: "CLASSROOM_ADMIN_DETAIL_LIVE_ATTENDANCE_FAILED",
                            roomCode: classroom.room_code,
                        },
                        err: (0, observability_1.logError)(attendanceError),
                    });
                }
            }
            const { data: meetings, error: meetingsError } = await supabaseAdmin
                .from("classroom_meetings")
                .select("id, started_at, ended_at, close_reason")
                .eq("classroom_id", classroom.id)
                .order("started_at", { ascending: false });
            if (meetingsError)
                throw meetingsError;
            const meetingIds = (meetings ?? []).map((meeting) => meeting.id);
            const { data: participants, error: participantsError } = meetingIds.length
                ? await supabaseAdmin
                    .from("classroom_meeting_participants")
                    .select("id, meeting_id, participant_key, display_name, roles_held, first_joined_at")
                    .in("meeting_id", meetingIds)
                : { data: [], error: null };
            if (participantsError)
                throw participantsError;
            const participantIds = (participants ?? []).map((participant) => participant.id);
            const { data: visits, error: visitsError } = participantIds.length
                ? await supabaseAdmin
                    .from("classroom_participant_visits")
                    .select("id, participant_id, joined_at, left_at")
                    .in("participant_id", participantIds)
                    .order("joined_at", { ascending: true })
                : { data: [], error: null };
            if (visitsError)
                throw visitsError;
            const snapshotAt = new Date().toISOString();
            const visitsByParticipant = new Map();
            for (const visit of visits ?? []) {
                visitsByParticipant.set(visit.participant_id, [
                    ...(visitsByParticipant.get(visit.participant_id) ?? []),
                    visit,
                ]);
            }
            const participantSummaries = (participants ?? []).map((participant) => {
                const participantVisits = visitsByParticipant.get(participant.id) ?? [];
                const attendance = (0, classroomAttendance_1.summarizeAttendanceVisits)(participantVisits, snapshotAt);
                return {
                    ...participant,
                    connected_now: livePresenceKnown && attendance.connectedNow,
                    current_visit_started_at: attendance.currentVisitStartedAt,
                    total_seconds: attendance.totalSeconds,
                };
            });
            const { data: delegates, error: delegatesError } = await supabaseAdmin
                .from("classroom_host_delegates")
                .select("display_name, is_active, created_at, last_used_at")
                .eq("classroom_id", classroom.id)
                .order("created_at", { ascending: true });
            if (delegatesError)
                throw delegatesError;
            res.json({
                classroom,
                meetings: meetings ?? [],
                participants: participantSummaries,
                delegates: delegates ?? [],
                snapshotAt,
                livePresenceKnown,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_RECORD_QUERY_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.delete("/rtc/admin/classroom-records/:classroomId", async (req, res) => {
        try {
            const actor = await requireClassroomAdmin(req, res);
            if (!actor || !supabaseAdmin)
                return;
            const { data: classroom, error: classroomError } = await supabaseAdmin
                .from("classroom_sessions")
                .select("id, room_code, status")
                .eq("id", req.params.classroomId)
                .maybeSingle();
            if (classroomError)
                throw classroomError;
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            if (classroom.status === "active") {
                res
                    .status(409)
                    .json({ error: "close_classroom_before_removing_record" });
                return;
            }
            await completeClassroomDrawingSessions([classroom.room_code]);
            const { error: deleteError } = await supabaseAdmin
                .from("classroom_sessions")
                .delete()
                .eq("id", classroom.id);
            if (deleteError)
                throw deleteError;
            await appendClassroomAudit(req, classroom, { kind: "user", userId: actor.userId, actorKind: "admin" }, "classroom_record_deleted", {});
            res.json({ success: true });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_RECORD_DELETE_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-delegate/activate", async (req, res) => {
        try {
            const { roomCode, enrollmentCode } = req.body || {};
            if (!isTrustedBrowserOrigin(req) ||
                typeof roomCode !== "string" ||
                !roomCode.trim() ||
                typeof enrollmentCode !== "string" ||
                enrollmentCode.length < 32 ||
                !supabaseAdmin) {
                res.status(400).json({ error: "invalid_delegate_enrollment" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            const { data: enrollment, error: enrollmentError } = await supabaseAdmin
                .from("classroom_delegate_enrollments")
                .select("id, delegate_id, expires_at, used_at, revoked_at")
                .eq("code_hash", (0, classroomDelegates_1.secretHash)(enrollmentCode))
                .maybeSingle();
            if (enrollmentError)
                throw enrollmentError;
            if (!enrollment ||
                enrollment.revoked_at ||
                enrollment.used_at ||
                new Date(enrollment.expires_at).getTime() <= Date.now()) {
                res.status(401).json({ error: "delegate_enrollment_expired" });
                return;
            }
            const { data: delegate, error: delegateError } = await supabaseAdmin
                .from("classroom_host_delegates")
                .select("id, classroom_id, display_name, participant_key, scopes, is_active")
                .eq("id", enrollment.delegate_id)
                .eq("classroom_id", classroom.id)
                .maybeSingle();
            if (delegateError)
                throw delegateError;
            if (!delegate?.is_active) {
                res.status(403).json({ error: "delegate_not_active" });
                return;
            }
            const { data: consumed, error: consumeError } = await supabaseAdmin
                .from("classroom_delegate_enrollments")
                .update({ used_at: new Date().toISOString() })
                .eq("id", enrollment.id)
                .is("used_at", null)
                .select("id")
                .maybeSingle();
            if (consumeError)
                throw consumeError;
            if (!consumed) {
                res.status(409).json({ error: "delegate_enrollment_already_used" });
                return;
            }
            const sessionSecret = (0, classroomDelegates_1.newOpaqueSecret)();
            const expiresAt = new Date(Date.now() + CLASSROOM_DELEGATE_SESSION_MS).toISOString();
            const { data: delegateSession, error: sessionError } = await supabaseAdmin
                .from("classroom_delegate_sessions")
                .insert({
                delegate_id: delegate.id,
                token_hash: (0, classroomDelegates_1.secretHash)(sessionSecret),
                expires_at: expiresAt,
            })
                .select("id")
                .single();
            if (sessionError || !delegateSession)
                throw sessionError ?? new Error("session_create_failed");
            setDelegateCookie(res, delegate.id, delegateSession.id, sessionSecret);
            const identity = `delegate:${delegate.id}`;
            res.json({
                success: true,
                delegateScopes: Array.isArray(delegate.scopes) ? delegate.scopes : [],
                delegateGameToken: (0, classroomDelegates_1.createClassroomDelegateGameToken)({
                    delegateId: delegate.id,
                    classroomId: classroom.id,
                    roomCode: classroom.room_code,
                    identity,
                }, SUPABASE_SECRET_KEY),
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_DELEGATE_ACTIVATION_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-settings", async (req, res) => {
        try {
            const { roomCode, settings } = req.body || {};
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                !settings ||
                typeof settings !== "object" ||
                Array.isArray(settings)) {
                res.status(400).json({ error: "invalid_classroom_settings" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            const authority = await requireClassroomAuthority(req, res, classroom.id, "manage_settings");
            if (!authority || !supabaseAdmin)
                return;
            const allowedKeys = [
                "allowStudentChat",
                "allowStudentMic",
                "allowStudentCam",
                "allowWhiteboardDraw",
                "whiteboardVisible",
            ];
            const changed = Object.fromEntries(Object.entries(settings).filter(([key, value]) => allowedKeys.includes(key) && typeof value === "boolean"));
            if (Object.keys(changed).length === 0) {
                res.status(400).json({ error: "no_valid_classroom_settings" });
                return;
            }
            const nextSettings = await patchClassroomSettings(classroom, changed);
            await (0, livekitService_1.syncClassroomParticipantPermissions)(classroom.room_code, nextSettings, supabaseAdmin, classroom.id);
            await appendClassroomAudit(req, classroom, authority, "classroom_settings_changed", { changed_keys: Object.keys(changed) });
            res.json({
                success: true,
                settings: nextSettings,
                delegated: authority.kind === "delegate",
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_SETTINGS_UPDATE_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-whiteboard-permission", async (req, res) => {
        try {
            const { roomCode, targetIdentity, allowed } = req.body || {};
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                typeof targetIdentity !== "string" ||
                !targetIdentity.trim() ||
                typeof allowed !== "boolean") {
                res.status(400).json({ error: "invalid_whiteboard_permission" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom)
                return void res.status(404).json({ error: "classroom_not_found" });
            const authority = await requireClassroomAuthority(req, res, classroom.id, "manage_whiteboard");
            if (!authority || !supabaseAdmin)
                return;
            const updated = await (0, livekitService_1.setClassroomWhiteboardPermission)(supabaseAdmin, classroom, targetIdentity.trim(), allowed);
            await appendClassroomAudit(req, classroom, authority, "classroom_whiteboard_permission_changed", {
                target_identity: updated.identity,
                allowed,
            });
            logger.info({
                correlationId: req
                    .correlationId,
                userId: authorityIdentity(authority) ?? undefined,
                sessionId: classroom.id,
                protocol: "http",
                message: "Classroom whiteboard permission changed",
                context: {
                    event: "CLASSROOM_WHITEBOARD_PERMISSION_CHANGED",
                    status: "success",
                    roomCode: classroom.room_code,
                    allowed,
                },
            });
            res.json({ success: true, targetIdentity: updated.identity, allowed });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_WHITEBOARD_PERMISSION_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-presentation-state", async (req, res) => {
        try {
            const { roomCode, action, title, mediaKind, presenterIdentity } = req.body || {};
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                !["started", "hidden", "stopped"].includes(action) ||
                (action === "started" &&
                    (typeof title !== "string" ||
                        title.length > 100 ||
                        !["document", "image", "video", "audio"].includes(mediaKind) ||
                        typeof presenterIdentity !== "string" ||
                        !presenterIdentity.trim() ||
                        presenterIdentity.length > 256))) {
                res.status(400).json({ error: "invalid_presentation_state" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            const presenter = requirePresenterCapability(req, res, classroom);
            if (!presenter)
                return;
            if (action === "started" &&
                presenterIdentity.trim() !== presenter.identity) {
                res.status(403).json({ error: "presenter_identity_mismatch" });
                return;
            }
            const current = presentationRoomState(classroom.settings);
            const next = {
                ...current,
                visible: action === "started",
                title: action === "started"
                    ? title.trim()
                    : action === "stopped"
                        ? null
                        : current.title,
                mediaKind: action === "started"
                    ? mediaKind
                    : action === "stopped"
                        ? null
                        : current.mediaKind,
            };
            await persistPresentationState(classroom, next);
            await (0, livekitService_1.broadcastClassroomData)(classroom.room_code, {
                type: "PRESENTATION_STATE",
                action,
                title: action === "started" ? title.trim() : undefined,
                mediaKind: action === "started" ? mediaKind : undefined,
                presenterIdentity: next.presenterIdentity,
                presenterEpoch: next.presenterEpoch,
            });
            logger.info({
                userId: presenter.identity,
                protocol: "http",
                message: "Classroom presentation state changed",
                context: {
                    event: "CLASSROOM_PRESENTATION_STATE",
                    roomCode: classroom.room_code,
                    action,
                    mediaKind: action === "started" ? mediaKind : undefined,
                },
            });
            res.json({ success: true, presenterEpoch: next.presenterEpoch });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PRESENTATION_STATE_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-presentation-visibility", async (req, res) => {
        try {
            const { roomCode, visible } = req.body || {};
            if (typeof roomCode !== "string" || typeof visible !== "boolean") {
                res.status(400).json({ error: "invalid_presentation_visibility" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom)
                return void res.status(404).json({ error: "classroom_not_found" });
            const authority = await requireClassroomAuthority(req, res, classroom.id, "control_presentation");
            if (!authority)
                return;
            const current = presentationRoomState(classroom.settings);
            if (visible && !current.presenterIdentity) {
                res.status(409).json({ error: "presenter_unavailable" });
                return;
            }
            const next = { ...current, visible };
            await persistPresentationState(classroom, next);
            await (0, livekitService_1.broadcastClassroomData)(classroom.room_code, {
                type: "PRESENTATION_VISIBILITY",
                visible,
                presenterIdentity: next.presenterIdentity,
                presenterEpoch: next.presenterEpoch,
            });
            await appendClassroomAudit(req, classroom, authority, "classroom_presentation_visibility_changed", { visible });
            res.json({ success: true, visible });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PRESENTATION_VISIBILITY_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-presenter-ready", async (req, res) => {
        try {
            const { roomCode, hasMedia } = req.body || {};
            if (typeof roomCode !== "string" || typeof hasMedia !== "boolean") {
                res.status(400).json({ error: "invalid_presenter_readiness" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom)
                return void res.status(404).json({ error: "classroom_not_found" });
            if (!requirePresenterCapability(req, res, classroom))
                return;
            // A host may intentionally open an empty media board while the presenter
            // prepares a file. Visibility remains host-controlled; readiness only
            // confirms that the presenter's local library has finished loading.
            res.json({ success: true });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PRESENTER_READINESS_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-presenter-transfer", async (req, res) => {
        try {
            const { roomCode, targetIdentity } = req.body || {};
            if (typeof roomCode !== "string" ||
                typeof targetIdentity !== "string" ||
                !targetIdentity.trim()) {
                res.status(400).json({ error: "invalid_presenter_transfer" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom)
                return void res.status(404).json({ error: "classroom_not_found" });
            const authority = await requireClassroomAuthority(req, res, classroom.id, "control_presentation");
            if (!authority)
                return;
            const participants = await (0, livekitService_1.listClassroomParticipants)(classroom.room_code);
            if (!participants.some((participant) => participant.identity === targetIdentity.trim())) {
                res.status(404).json({ error: "participant_not_found" });
                return;
            }
            const next = await assignPresenter(classroom, targetIdentity.trim(), true);
            await appendClassroomAudit(req, classroom, authority, "classroom_presenter_transferred", { target_identity: targetIdentity.trim() });
            res.json({
                success: true,
                presenterIdentity: next.presenterIdentity,
                presenterEpoch: next.presenterEpoch,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PRESENTER_TRANSFER_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-presenter-leave", async (req, res) => {
        try {
            const { roomCode } = req.body || {};
            if (typeof roomCode !== "string")
                return void res.status(400).json({ error: "invalid_presenter_leave" });
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom)
                return void res.status(404).json({ error: "classroom_not_found" });
            const presenter = requirePresenterCapability(req, res, classroom);
            if (!presenter)
                return;
            const participants = await (0, livekitService_1.listClassroomParticipants)(classroom.room_code);
            const fallbackIdentity = (0, classroomPresenterAssignment_1.selectDefaultClassroomPresenter)(participants, classroom.teacher_id ? String(classroom.teacher_id) : null, presenter.identity);
            const next = await assignPresenter(classroom, fallbackIdentity);
            res.json({
                success: true,
                presenterIdentity: next.presenterIdentity,
                presenterEpoch: next.presenterEpoch,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PRESENTER_LEAVE_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-presenter-elect", async (req, res) => {
        try {
            const { roomCode, expectedPresenterIdentity, expectedPresenterEpoch } = req.body || {};
            if (typeof roomCode !== "string" ||
                typeof expectedPresenterIdentity !== "string" ||
                !Number.isInteger(expectedPresenterEpoch)) {
                res.status(400).json({ error: "invalid_presenter_election" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom)
                return void res.status(404).json({ error: "classroom_not_found" });
            const authority = await requireClassroomAuthority(req, res, classroom.id, "control_presentation");
            if (!authority)
                return;
            const current = presentationRoomState(classroom.settings);
            if (current.presenterIdentity !== expectedPresenterIdentity ||
                current.presenterEpoch !== expectedPresenterEpoch) {
                return void res.json({
                    success: true,
                    stale: true,
                    presenterIdentity: current.presenterIdentity,
                    presenterEpoch: current.presenterEpoch,
                });
            }
            const participants = await (0, livekitService_1.listClassroomParticipants)(classroom.room_code);
            if (participants.some((participant) => participant.identity === current.presenterIdentity)) {
                return void res.json({ success: true, reconnected: true });
            }
            const fallbackIdentity = (0, classroomPresenterAssignment_1.selectDefaultClassroomPresenter)(participants, classroom.teacher_id ? String(classroom.teacher_id) : null, current.presenterIdentity);
            const next = await assignPresenter(classroom, fallbackIdentity);
            res.json({
                success: true,
                presenterIdentity: next.presenterIdentity,
                presenterEpoch: next.presenterEpoch,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PRESENTER_ELECTION_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-document-conversion-ticket", async (req, res) => {
        try {
            const { roomCode, fileName, sizeBytes, sourceFormat } = req.body || {};
            if (typeof roomCode !== "string" ||
                typeof fileName !== "string" ||
                !fileName.trim() ||
                fileName.length > 180 ||
                !Number.isInteger(sizeBytes) ||
                sizeBytes < 1 ||
                sizeBytes > 50 * 1024 * 1024 ||
                !["pdf", "ppt", "pptx"].includes(sourceFormat)) {
                res.status(400).json({ error: "invalid_conversion_request" });
                return;
            }
            if (!DOCUMENT_CONVERTER_SHARED_SECRET)
                return void res.status(503).json({ error: "converter_not_configured" });
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom)
                return void res.status(404).json({ error: "classroom_not_found" });
            if (!requirePresenterCapability(req, res, classroom))
                return;
            const ticket = (0, classroomPresentation_1.createDocumentConversionTicket)({
                roomCode: classroom.room_code,
                fileName: fileName.trim(),
                sizeBytes,
                sourceFormat,
                correlationId: req
                    .correlationId,
            }, DOCUMENT_CONVERTER_SHARED_SECRET);
            res.json({
                converterUrl: DOCUMENT_CONVERTER_URL,
                ticket,
                expiresInSeconds: 300,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_CONVERSION_TICKET_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-stage-layout", async (req, res) => {
        try {
            const { roomCode, presentationPercent } = req.body || {};
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                !Number.isInteger(presentationPercent) ||
                presentationPercent < 30 ||
                presentationPercent > 70) {
                res.status(400).json({ error: "invalid_stage_layout" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            const authority = await requireClassroomAuthority(req, res, classroom.id, "manage_whiteboard");
            if (!authority)
                return;
            const nextSettings = await patchClassroomSettings(classroom, {
                presentationPercent,
            });
            await (0, livekitService_1.broadcastClassroomData)(classroom.room_code, {
                type: "STAGE_LAYOUT",
                presentationPercent,
            });
            res.json({ success: true, presentationPercent });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_STAGE_LAYOUT_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-remove-participant", async (req, res) => {
        try {
            const { roomCode, targetIdentity, blockRejoin = false } = req.body || {};
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                typeof targetIdentity !== "string" ||
                !targetIdentity.trim() ||
                targetIdentity.length > 256 ||
                typeof blockRejoin !== "boolean") {
                res.status(400).json({ error: "invalid_remove_request" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            const authority = await requireClassroomAuthority(req, res, classroom.id, "remove_participants");
            if (!authority || !supabaseAdmin)
                return;
            if (blockRejoin) {
                const target = await (0, livekitService_1.getClassroomParticipantBlockTarget)(classroom.room_code, targetIdentity.trim());
                await (0, classroomParticipantBlocks_1.blockClassroomParticipant)(supabaseAdmin, classroom.id, target);
                logger.info({
                    correlationId: req
                        .correlationId,
                    roomCode: classroom.room_code,
                    protocol: "http",
                    message: "Classroom participant re-entry blocked",
                    context: {
                        event: "CLASSROOM_PARTICIPANT_BLOCKED",
                        status: "success",
                        actorIdentity: authorityIdentity(authority),
                        participantIdentity: target.identity,
                        participantKey: target.participantKey,
                    },
                });
            }
            await (0, livekitService_1.removeClassroomParticipant)(classroom.room_code, targetIdentity.trim());
            logger.info({
                correlationId: req
                    .correlationId,
                roomCode: classroom.room_code,
                protocol: "http",
                message: "Classroom participant removed",
                context: {
                    event: "CLASSROOM_PARTICIPANT_REMOVED",
                    status: "success",
                    actorIdentity: authorityIdentity(authority),
                    participantIdentity: targetIdentity.trim(),
                    blockRejoin,
                },
            });
            await appendClassroomAudit(req, classroom, authority, "classroom_participant_removed", {
                target_identity: targetIdentity.trim(),
                block_rejoin: blockRejoin,
            });
            res.json({
                success: true,
                delegated: authority.kind === "delegate",
                blockRejoin,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PARTICIPANT_REMOVE_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-promote", async (req, res) => {
        try {
            const { roomCode, targetIdentity } = req.body || {};
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                typeof targetIdentity !== "string" ||
                !targetIdentity.trim() ||
                targetIdentity.length > 256) {
                res.status(400).json({ error: "invalid_promotion_request" });
                return;
            }
            const normalizedRoomCode = roomCode.trim();
            const classroom = await getActiveClassroom(normalizedRoomCode);
            if (!classroom) {
                res.status(404).json({ error: "classroom_not_found" });
                return;
            }
            const authority = await requireClassroomAuthority(req, res, classroom.id, "manage_delegates");
            if (!authority || !supabaseAdmin)
                return;
            const candidate = await (0, livekitService_1.classroomDelegateCandidate)(normalizedRoomCode, targetIdentity.trim());
            const delegate = await (0, classroomDelegates_1.ensureActiveClassroomDelegate)(supabaseAdmin, {
                classroomId: classroom.id,
                displayName: candidate.displayName.slice(0, 120),
                participantKey: candidate.participantKey,
                scopes: classroomDelegates_1.CLASSROOM_DELEGATE_SCOPES,
                createdBy: authority.kind === "user" ? authority.userId : null,
            });
            const enrollmentCode = (0, classroomDelegates_1.newOpaqueSecret)();
            const enrollmentCodeHash = (0, classroomDelegates_1.secretHash)(enrollmentCode);
            let enrollmentCreated = false;
            try {
                const { error: enrollmentError } = await supabaseAdmin
                    .from("classroom_delegate_enrollments")
                    .insert({
                    delegate_id: delegate.id,
                    code_hash: enrollmentCodeHash,
                    target_livekit_identity: targetIdentity.trim(),
                    expires_at: new Date(Date.now() + CLASSROOM_DELEGATE_ENROLLMENT_MS).toISOString(),
                });
                if (enrollmentError)
                    throw enrollmentError;
                enrollmentCreated = true;
                await (0, livekitService_1.promoteClassroomParticipant)(normalizedRoomCode, targetIdentity.trim(), delegate.id);
                await (0, livekitService_1.sendClassroomDelegateEnrollment)(normalizedRoomCode, targetIdentity.trim(), enrollmentCode);
            }
            catch (promotionError) {
                if (delegate.created) {
                    await supabaseAdmin
                        .from("classroom_host_delegates")
                        .update({ is_active: false })
                        .eq("id", delegate.id);
                }
                if (enrollmentCreated) {
                    await supabaseAdmin
                        .from("classroom_delegate_enrollments")
                        .update({ revoked_at: new Date().toISOString() })
                        .eq("code_hash", enrollmentCodeHash)
                        .is("used_at", null);
                }
                throw promotionError;
            }
            await appendClassroomAudit(req, classroom, authority, "classroom_participant_promoted", { target_identity: targetIdentity.trim() });
            logger.info({
                correlationId: req
                    .correlationId,
                userId: authority.kind === "user"
                    ? authority.userId
                    : authority.delegate.delegateId,
                protocol: "http",
                message: "Classroom participant promoted",
                context: {
                    event: "CLASSROOM_PARTICIPANT_PROMOTED",
                    status: "success",
                    roomCode: normalizedRoomCode,
                    targetIdentity: targetIdentity.trim(),
                    reusedActiveDelegate: !delegate.created,
                },
            });
            res.json({
                success: true,
                delegated: authority.kind === "delegate",
                delegateId: delegate.id,
                reusedActiveDelegate: !delegate.created,
            });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_PARTICIPANT_PROMOTION_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    app.post("/rtc/classroom-cohost/revoke", async (req, res) => {
        try {
            const { roomCode, delegateId } = req.body || {};
            if (typeof roomCode !== "string" ||
                !roomCode.trim() ||
                typeof delegateId !== "string" ||
                !delegateId.trim()) {
                res.status(400).json({ error: "invalid_cohost_revocation" });
                return;
            }
            const classroom = await getActiveClassroom(roomCode.trim());
            if (!classroom || !supabaseAdmin)
                return void res.status(404).json({ error: "classroom_not_found" });
            const authority = await requireClassroomAuthority(req, res, classroom.id, "manage_delegates");
            if (!authority)
                return;
            const { data: delegate, error: delegateError } = await supabaseAdmin
                .from("classroom_host_delegates")
                .select("id")
                .eq("id", delegateId.trim())
                .eq("classroom_id", classroom.id)
                .eq("is_active", true)
                .maybeSingle();
            if (delegateError)
                throw delegateError;
            if (!delegate)
                return void res
                    .status(404)
                    .json({ error: "active_delegate_not_found" });
            const now = new Date().toISOString();
            const { error: deactivateError } = await supabaseAdmin
                .from("classroom_host_delegates")
                .update({ is_active: false })
                .eq("id", delegate.id);
            if (deactivateError)
                throw deactivateError;
            const [{ error: sessionsError }, { error: enrollmentsError }] = await Promise.all([
                supabaseAdmin
                    .from("classroom_delegate_sessions")
                    .update({ revoked_at: now })
                    .eq("delegate_id", delegate.id)
                    .is("revoked_at", null),
                supabaseAdmin
                    .from("classroom_delegate_enrollments")
                    .update({ revoked_at: now })
                    .eq("delegate_id", delegate.id)
                    .is("used_at", null),
            ]);
            if (sessionsError)
                throw sessionsError;
            if (enrollmentsError)
                throw enrollmentsError;
            const demoted = await (0, livekitService_1.demoteClassroomDelegateParticipant)(classroom.room_code, delegate.id, classroomSettings(classroom.settings));
            await (0, livekitService_1.syncClassroomParticipantPermissions)(classroom.room_code, classroomSettings(classroom.settings), supabaseAdmin, classroom.id);
            await (0, livekitService_1.broadcastClassroomData)(classroom.room_code, {
                type: "CLASSROOM_COHOST_REVOKED",
                delegateId: delegate.id,
            });
            await appendClassroomAudit(req, classroom, authority, "classroom_cohost_revoked", { delegate_id: delegate.id });
            res.json({ success: true, delegateId: delegate.id, demoted });
        }
        catch (err) {
            (0, observability_1.logHttpFailure)(logger, req, err, "CLASSROOM_COHOST_REVOCATION_FAILED");
            res.status(500).json({ error: "internal_server_error" });
        }
    });
    async function cleanupStaleClassrooms() {
        if (!supabaseAdmin)
            return;
        try {
            const cutoffDate = new Date(Date.now() - 7 * 86400000).toISOString();
            const { data: roomsToClean, error: roomsQueryError } = await supabaseAdmin
                .from("classroom_sessions")
                .select("id, room_code")
                .eq("is_persistent", false)
                .eq("status", "active")
                .lt("last_activity", cutoffDate);
            if (roomsQueryError)
                throw roomsQueryError;
            const staleClassrooms = roomsToClean ?? [];
            try {
                await (0, classroomAttendance_1.reconcileClassroomAttendance)(supabaseAdmin, staleClassrooms);
            }
            catch (attendanceError) {
                logger.warn({
                    protocol: "internal",
                    message: "Could not snapshot attendance before background classroom cleanup",
                    context: {
                        event: "CLASSROOM_ATTENDANCE_PRE_BACKGROUND_CLEANUP_FAILED",
                    },
                    err: (0, observability_1.logError)(attendanceError),
                });
            }
            const roomCodes = staleClassrooms.map((room) => room.room_code);
            await completeClassroomDrawingSessions(roomCodes);
            await Promise.all(roomCodes.map((roomCode) => (0, livekitService_1.deleteLiveKitRoom)(roomCode)));
            await Promise.all(staleClassrooms.map((classroom) => (0, classroomAttendance_1.finalizeClassroomAttendance)(supabaseAdmin, classroom)));
            const { error } = await supabaseAdmin.rpc("cleanup_old_classroom_sessions", { p_days_old: 7 });
            if (error)
                throw error;
        }
        catch (e) {
            logger.warn({
                protocol: "internal",
                message: "Background classroom cleanup failed",
                err: (0, observability_1.logError)(e),
                context: { event: "CLASSROOM_BACKGROUND_CLEANUP_FAILED" },
            });
        }
    }
    return {
        reconcile: reconcileActiveClassroomAttendance,
        cleanup: cleanupStaleClassrooms,
    };
}
//# sourceMappingURL=routes.js.map