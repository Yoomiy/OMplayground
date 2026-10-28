"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveKitTokenError = void 0;
exports.classroomVoiceStats = classroomVoiceStats;
exports.classroomParticipantPublishSources = classroomParticipantPublishSources;
exports.classroomPublishSourcesForRole = classroomPublishSourcesForRole;
exports.deleteLiveKitRoom = deleteLiveKitRoom;
exports.evictClassroomParticipants = evictClassroomParticipants;
exports.classroomDelegateCandidate = classroomDelegateCandidate;
exports.promoteClassroomParticipant = promoteClassroomParticipant;
exports.demoteClassroomDelegateParticipant = demoteClassroomDelegateParticipant;
exports.sendClassroomDelegateEnrollment = sendClassroomDelegateEnrollment;
exports.broadcastClassroomData = broadcastClassroomData;
exports.sendClassroomDataToParticipant = sendClassroomDataToParticipant;
exports.listClassroomParticipants = listClassroomParticipants;
exports.getClassroomsLiveAttendance = getClassroomsLiveAttendance;
exports.getClassroomLiveAttendance = getClassroomLiveAttendance;
exports.removeClassroomParticipant = removeClassroomParticipant;
exports.getClassroomParticipantBlockTarget = getClassroomParticipantBlockTarget;
exports.setClassroomWhiteboardPermission = setClassroomWhiteboardPermission;
exports.syncClassroomParticipantPermissions = syncClassroomParticipantPermissions;
exports.syncClassroomPresenterPermissions = syncClassroomPresenterPermissions;
exports.generateClassroomToken = generateClassroomToken;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const schoolIdentity_1 = require("./schoolIdentity");
const observability_1 = require("@playground/observability");
const classroomParticipantBlocks_1 = require("./classroomParticipantBlocks");
const logger = (0, observability_1.createLogger)("classroom-server");
function getRoomServiceClient() {
    const host = process.env.LIVEKIT_URL?.trim();
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    if (!host || !apiKey || !apiSecret)
        return null;
    const httpHost = host.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
    return new livekit_server_sdk_1.RoomServiceClient(httpHost, apiKey, apiSecret);
}
function classroomLiveKitRoom(roomCode) {
    return `classroom-${roomCode}`;
}
/** Report only classroom media; game rooms can share this SFU project. */
async function classroomVoiceStats() {
    const client = getRoomServiceClient();
    if (!client)
        return undefined;
    try {
        const rooms = (await client.listRooms()).filter((room) => room.name.startsWith("classroom-"));
        return {
            activeRooms: rooms.length,
            totalParticipants: rooms.reduce((sum, room) => sum + room.numParticipants, 0),
        };
    }
    catch {
        return undefined;
    }
}
const HOST_PUBLISH_SOURCES = [livekit_server_sdk_1.TrackSource.MICROPHONE, livekit_server_sdk_1.TrackSource.CAMERA];
function classroomParticipantPublishSources(settings) {
    const sources = [];
    if (settings.allowStudentMic !== false)
        sources.push(livekit_server_sdk_1.TrackSource.MICROPHONE);
    if (settings.allowStudentCam !== false)
        sources.push(livekit_server_sdk_1.TrackSource.CAMERA);
    return sources;
}
function addPresenterPublishSources(sources, isPresenter) {
    const next = [...sources];
    if (isPresenter)
        next.push(livekit_server_sdk_1.TrackSource.SCREEN_SHARE, livekit_server_sdk_1.TrackSource.SCREEN_SHARE_AUDIO);
    return next;
}
function classroomPublishSourcesForRole(settings, isHost, isPresenter) {
    return addPresenterPublishSources(isHost
        ? HOST_PUBLISH_SOURCES
        : classroomParticipantPublishSources(settings), isPresenter);
}
async function classroomWhiteboardAllowed(supabaseAdmin, classroomId, participantKey, baseline) {
    const { data, error } = await supabaseAdmin
        .from("classroom_whiteboard_permissions")
        .select("allowed")
        .eq("classroom_id", classroomId)
        .eq("participant_key", participantKey)
        .maybeSingle();
    if (error)
        throw error;
    return typeof data?.allowed === "boolean" ? data.allowed : baseline;
}
async function deleteLiveKitRoom(roomCode) {
    try {
        const roomService = getRoomServiceClient();
        if (!roomService)
            return false;
        await roomService.deleteRoom(classroomLiveKitRoom(roomCode));
        return true;
    }
    catch (err) {
        logger.warn({
            protocol: "webrtc",
            err: (0, observability_1.logError)(err),
            message: "LiveKit classroom room cleanup failed",
            context: { event: "CLASSROOM_LIVEKIT_ROOM_CLEANUP_FAILED", roomCode },
        });
        return false;
    }
}
/**
 * Disconnect every current classroom attendee and revoke their tokens before
 * deleting the room. Deleting a room drops the current connection, but does
 * not invalidate a token that could otherwise be used to reconnect while it
 * is still valid.
 */
async function evictClassroomParticipants(roomCode) {
    try {
        const roomService = getRoomServiceClient();
        if (!roomService)
            return 0;
        const roomName = classroomLiveKitRoom(roomCode);
        const participants = await roomService.listParticipants(roomName);
        if (participants.length === 0)
            return 0;
        const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000));
        const results = await Promise.allSettled(participants.map((participant) => roomService.removeParticipant(roomName, participant.identity, {
            revokeTokenTs,
        })));
        const evictedCount = results.filter((result) => result.status === "fulfilled").length;
        const failedCount = results.length - evictedCount;
        if (failedCount > 0) {
            logger.warn({
                protocol: "webrtc",
                message: "Some classroom participants could not be evicted",
                context: {
                    event: "CLASSROOM_PARTICIPANT_EVICTION_PARTIAL_FAILURE",
                    roomCode,
                    evictedCount,
                    failedCount,
                },
            });
        }
        return evictedCount;
    }
    catch (err) {
        logger.warn({
            protocol: "webrtc",
            err: (0, observability_1.logError)(err),
            message: "LiveKit classroom participant eviction failed",
            context: { event: "CLASSROOM_PARTICIPANT_EVICTION_FAILED", roomCode },
        });
        return 0;
    }
}
async function classroomDelegateCandidate(roomCode, participantIdentity) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const roomName = classroomLiveKitRoom(roomCode);
    const participant = await roomService.getParticipant(roomName, participantIdentity);
    let metadata = {};
    try {
        metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    }
    catch {
        metadata = {};
    }
    const participantKey = (0, classroomParticipantBlocks_1.classroomParticipantKeyFromMetadata)(metadata, participant.identity);
    if (!participantKey)
        throw new LiveKitTokenError("session_not_found", "Classroom participant identity is unavailable.");
    return {
        displayName: participant.name || participantIdentity,
        participantKey,
    };
}
async function promoteClassroomParticipant(roomCode, participantIdentity, delegateId) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const roomName = classroomLiveKitRoom(roomCode);
    const participant = await roomService.getParticipant(roomName, participantIdentity);
    let metadata = {};
    try {
        metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    }
    catch {
        metadata = {};
    }
    const isPresenter = metadata.isPresenter === true;
    await roomService.updateParticipant(roomName, participantIdentity, {
        metadata: JSON.stringify({
            ...metadata,
            isHost: true,
            classroomHostKind: "delegate",
            classroomDelegateId: delegateId,
        }),
        permission: {
            canSubscribe: true,
            canPublish: true,
            canPublishData: true,
            canPublishSources: addPresenterPublishSources(HOST_PUBLISH_SOURCES, isPresenter),
            canUpdateMetadata: false,
        },
    });
}
async function demoteClassroomDelegateParticipant(roomCode, delegateId, settings) {
    const roomService = getRoomServiceClient();
    if (!roomService)
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    const roomName = classroomLiveKitRoom(roomCode);
    const participants = await roomService.listParticipants(roomName);
    const target = participants.find((participant) => {
        if (participant.identity === `delegate:${delegateId}`)
            return true;
        try {
            return (JSON.parse(participant.metadata || "{}").classroomDelegateId ===
                delegateId);
        }
        catch {
            return false;
        }
    });
    if (!target)
        return false;
    let metadata = {};
    try {
        metadata = target.metadata ? JSON.parse(target.metadata) : {};
    }
    catch { }
    const { classroomHostKind: _hostKind, classroomDelegateId: _delegateId, ...ordinaryMetadata } = metadata;
    const isPresenter = metadata.isPresenter === true;
    await roomService.updateParticipant(roomName, target.identity, {
        metadata: JSON.stringify({ ...ordinaryMetadata, isHost: false }),
        permission: {
            canSubscribe: true,
            canPublish: true,
            canPublishData: true,
            canPublishSources: classroomPublishSourcesForRole(settings, false, isPresenter),
            canUpdateMetadata: false,
        },
    });
    return true;
}
async function sendClassroomDelegateEnrollment(roomCode, participantIdentity, enrollmentCode) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const payload = new TextEncoder().encode(JSON.stringify({
        type: "CLASSROOM_DELEGATE_ENROLLMENT",
        roomCode,
        enrollmentCode,
    }));
    await roomService.sendData(classroomLiveKitRoom(roomCode), payload, livekit_server_sdk_1.DataPacket_Kind.RELIABLE, {
        destinationIdentities: [participantIdentity],
        topic: "classroom-delegate-enrollment",
    });
}
async function broadcastClassroomData(roomCode, message) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    await roomService.sendData(classroomLiveKitRoom(roomCode), new TextEncoder().encode(JSON.stringify(message)), livekit_server_sdk_1.DataPacket_Kind.RELIABLE, { topic: "classroom-presentation" });
}
async function sendClassroomDataToParticipant(roomCode, participantIdentity, message) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    await roomService.sendData(classroomLiveKitRoom(roomCode), new TextEncoder().encode(JSON.stringify(message)), livekit_server_sdk_1.DataPacket_Kind.RELIABLE, {
        destinationIdentities: [participantIdentity],
        topic: "classroom-presentation",
    });
}
async function listClassroomParticipants(roomCode) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const participants = await roomService.listParticipants(classroomLiveKitRoom(roomCode));
    return participants.map((participant) => {
        let metadata = {};
        try {
            metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
        }
        catch { }
        return {
            identity: participant.identity,
            name: participant.name || participant.identity,
            isHost: metadata.isHost === true,
            attendanceRole: typeof metadata.attendanceRole === "string"
                ? metadata.attendanceRole
                : "participant",
        };
    });
}
function liveKitTimestamp(milliseconds, seconds) {
    const millisecondsValue = Number(milliseconds);
    if (Number.isFinite(millisecondsValue) && millisecondsValue > 0)
        return new Date(millisecondsValue).toISOString();
    const secondsValue = Number(seconds);
    if (Number.isFinite(secondsValue) && secondsValue > 0)
        return new Date(secondsValue * 1000).toISOString();
    return new Date().toISOString();
}
/**
 * A missing map entry means LiveKit could not read that existing room and the
 * caller must leave its stored attendance untouched. A null entry means the
 * room was definitively absent.
 */
async function getClassroomsLiveAttendance(roomCodes) {
    const roomService = getRoomServiceClient();
    if (!roomService)
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    const uniqueCodes = [...new Set(roomCodes)];
    const roomCodeByName = new Map(uniqueCodes.map((roomCode) => [classroomLiveKitRoom(roomCode), roomCode]));
    const result = new Map(uniqueCodes.map((roomCode) => [roomCode, null]));
    const rooms = await roomService.listRooms([...roomCodeByName.keys()]);
    for (let offset = 0; offset < rooms.length; offset += 8) {
        await Promise.all(rooms.slice(offset, offset + 8).map(async (room) => {
            const roomCode = roomCodeByName.get(room.name);
            if (!roomCode)
                return;
            try {
                const participants = await roomService.listParticipants(room.name);
                result.set(roomCode, {
                    roomSid: room.sid,
                    startedAt: liveKitTimestamp(room.creationTimeMs, room.creationTime),
                    participants: participants.map((participant) => ({
                        sid: participant.sid,
                        identity: participant.identity,
                        name: participant.name || participant.identity,
                        metadata: participant.metadata,
                        joinedAt: liveKitTimestamp(participant.joinedAtMs, participant.joinedAt),
                    })),
                });
            }
            catch (err) {
                result.delete(roomCode);
                logger.warn({
                    protocol: "webrtc",
                    err: (0, observability_1.logError)(err),
                    message: "LiveKit classroom attendance snapshot failed",
                    context: {
                        event: "CLASSROOM_ATTENDANCE_SNAPSHOT_FAILED",
                        roomCode,
                    },
                });
            }
        }));
    }
    return result;
}
async function getClassroomLiveAttendance(roomCode) {
    const snapshots = await getClassroomsLiveAttendance([roomCode]);
    if (!snapshots.has(roomCode))
        throw new Error("LiveKit classroom snapshot unavailable");
    return snapshots.get(roomCode) ?? null;
}
async function removeClassroomParticipant(roomCode, participantIdentity) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    await roomService.removeParticipant(classroomLiveKitRoom(roomCode), participantIdentity, {
        revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
    });
}
async function getClassroomParticipantBlockTarget(roomCode, participantIdentity) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const participant = await roomService.getParticipant(classroomLiveKitRoom(roomCode), participantIdentity);
    let metadata = {};
    try {
        metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    }
    catch {
        metadata = {};
    }
    if (metadata.isHost === true) {
        throw new Error("cannot_block_classroom_host");
    }
    const participantKey = (0, classroomParticipantBlocks_1.classroomParticipantKeyFromMetadata)(metadata, participant.identity);
    if (!participantKey) {
        throw new Error("participant_admission_key_missing");
    }
    return {
        participantKey,
        identity: participant.identity,
        displayName: participant.name || participant.identity,
    };
}
async function setClassroomWhiteboardPermission(supabaseAdmin, classroom, participantIdentity, allowed) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const roomName = classroomLiveKitRoom(classroom.room_code);
    const participant = await roomService.getParticipant(roomName, participantIdentity);
    let metadata = {};
    try {
        metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    }
    catch { }
    if (metadata.isHost === true)
        throw new Error("cannot_restrict_classroom_host");
    const participantKey = (0, classroomParticipantBlocks_1.classroomParticipantKeyFromMetadata)(metadata, participant.identity);
    if (!participantKey)
        throw new Error("participant_permission_key_missing");
    const { error } = await supabaseAdmin
        .from("classroom_whiteboard_permissions")
        .upsert({
        classroom_id: classroom.id,
        participant_key: participantKey,
        participant_identity: participant.identity,
        display_name: participant.name || participant.identity,
        allowed,
        updated_at: new Date().toISOString(),
    }, { onConflict: "classroom_id,participant_key" });
    if (error)
        throw error;
    await roomService.updateParticipant(roomName, participant.identity, {
        metadata: JSON.stringify({ ...metadata, canDrawWhiteboard: allowed }),
    });
    await broadcastClassroomData(classroom.room_code, {
        type: "WHITEBOARD_PERMISSION_CHANGED",
        targetIdentity: participant.identity,
        allowed,
    });
    return { participantKey, identity: participant.identity, allowed };
}
async function syncClassroomParticipantPermissions(roomCode, settings, supabaseAdmin, classroomId) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const roomName = classroomLiveKitRoom(roomCode);
    const participants = await roomService.listParticipants(roomName);
    const participantRows = participants.map((participant) => {
        let metadata = {};
        try {
            metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
        }
        catch { }
        return {
            participant,
            metadata,
            participantKey: (0, classroomParticipantBlocks_1.classroomParticipantKeyFromMetadata)(metadata, participant.identity),
        };
    });
    const overrideByKey = new Map();
    const participantKeys = participantRows.flatMap(({ participantKey }) => participantKey ? [participantKey] : []);
    if (supabaseAdmin && classroomId && participantKeys.length > 0) {
        const { data, error } = await supabaseAdmin
            .from("classroom_whiteboard_permissions")
            .select("participant_key, allowed")
            .eq("classroom_id", classroomId)
            .in("participant_key", participantKeys);
        if (error)
            throw error;
        for (const row of data ?? [])
            overrideByKey.set(String(row.participant_key), row.allowed === true);
    }
    const baseline = settings.allowWhiteboardDraw === true;
    await Promise.all(participantRows.map(async ({ participant, metadata, participantKey }) => {
        if (metadata.isHost === true)
            return;
        const isPresenter = metadata.isPresenter === true;
        const sources = classroomPublishSourcesForRole(settings, false, isPresenter);
        const canDrawWhiteboard = participantKey && overrideByKey.has(participantKey)
            ? overrideByKey.get(participantKey) === true
            : baseline;
        await roomService.updateParticipant(roomName, participant.identity, {
            metadata: JSON.stringify({ ...metadata, canDrawWhiteboard }),
            permission: {
                canSubscribe: true,
                canPublish: true,
                canPublishData: true,
                canPublishSources: sources,
                canUpdateMetadata: false,
            },
        });
    }));
}
async function syncClassroomPresenterPermissions(roomCode, settings, previousIdentity, presenterIdentity) {
    const roomService = getRoomServiceClient();
    if (!roomService) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const updateIdentity = async (identity) => {
        let participant;
        try {
            participant = await roomService.getParticipant(classroomLiveKitRoom(roomCode), identity);
        }
        catch {
            return;
        }
        let metadata = {};
        try {
            metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
        }
        catch { }
        const isHost = metadata.isHost === true;
        const isPresenter = identity === presenterIdentity;
        const sources = classroomPublishSourcesForRole(settings, isHost, isPresenter);
        await roomService.updateParticipant(classroomLiveKitRoom(roomCode), identity, {
            metadata: JSON.stringify({ ...metadata, isPresenter }),
            permission: {
                canSubscribe: true,
                canPublish: true,
                canPublishData: true,
                canPublishSources: sources,
                canUpdateMetadata: false,
            },
        });
    };
    // Revoke the old presenter's screen source before granting it to the next
    // presenter so there is never a server-authorized overlap window.
    if (previousIdentity && previousIdentity !== presenterIdentity)
        await updateIdentity(previousIdentity);
    if (presenterIdentity)
        await updateIdentity(presenterIdentity);
}
class LiveKitTokenError extends Error {
    reason;
    constructor(reason, message) {
        super(message);
        this.reason = reason;
    }
}
exports.LiveKitTokenError = LiveKitTokenError;
async function generateClassroomToken(args) {
    const { supabaseAdmin, roomCode, displayName, accessToken, spectateMode, delegate, presenterIdentityOverride, guestAttendanceKey, } = args;
    const serverUrl = process.env.LIVEKIT_URL?.trim() ?? "";
    const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
    if (!serverUrl || !apiKey || !apiSecret) {
        throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
    }
    const { data: classroom, error: classroomError } = await supabaseAdmin
        .from("classroom_sessions")
        .select("id, room_code, teacher_id, teacher_name, status, settings")
        .eq("room_code", roomCode)
        .maybeSingle();
    if (classroomError)
        throw classroomError;
    if (!classroom || classroom.status !== "active") {
        throw new LiveKitTokenError("session_completed", "Classroom session not active.");
    }
    let profile = null;
    if (accessToken) {
        try {
            profile = await (0, schoolIdentity_1.getSchoolIdentity)(supabaseAdmin, accessToken);
        }
        catch {
            profile = null;
        }
    }
    const livekitRoom = classroomLiveKitRoom(roomCode);
    const isAdmin = profile?.role === "admin";
    const isTeacher = profile?.role === "teacher" || isAdmin;
    const isCreatorTeacher = profile && classroom.teacher_id === profile.userId;
    const isDelegate = Boolean(delegate);
    const isHost = isTeacher || isCreatorTeacher || isAdmin || isDelegate;
    const role = isDelegate ? "classroom_delegate" : (profile?.role ?? "student");
    const finalDisplayName = (delegate?.displayName ?? profile?.full_name ?? displayName ?? "משתתף")
        .trim()
        .slice(0, 80) || "משתתף";
    const identity = delegate
        ? `delegate:${delegate.id}`
        : (profile?.userId ??
            presenterIdentityOverride ??
            `guest-${Math.random().toString(36).substring(2, 9)}`);
    const settings = classroom.settings && typeof classroom.settings === "object"
        ? classroom.settings
        : {};
    const isPresenter = settings.presentationPresenterIdentity === identity;
    const isHidden = isAdmin && spectateMode === "invisible";
    const attendanceKey = delegate
        ? `delegate:${delegate.id}`
        : profile?.userId
            ? `user:${profile.userId}`
            : (guestAttendanceKey ?? `guest:${roomCode}:${identity}`);
    const attendanceRole = isHidden
        ? "hidden"
        : isCreatorTeacher
            ? "host"
            : isDelegate || isTeacher
                ? "cohost"
                : "participant";
    args.onSecurityIdentity?.({
        accountId: profile?.userId,
        participantIdentity: identity,
        participantKey: attendanceKey,
        authenticationMethod: isDelegate
            ? "delegate"
            : profile
                ? "account"
                : "guest",
        accountTokenOutcome: accessToken
            ? profile
                ? "accepted"
                : "unverified"
            : "absent",
        role,
        isHost,
    });
    if (!isHost) {
        let isBlocked;
        try {
            isBlocked = await (0, classroomParticipantBlocks_1.isClassroomParticipantBlocked)(supabaseAdmin, classroom.id, attendanceKey);
        }
        catch (error) {
            logger.error({
                protocol: "http",
                message: "Classroom participant admission check failed",
                context: {
                    event: "CLASSROOM_PARTICIPANT_BLOCK_CHECK_FAILED",
                    roomCode,
                },
                err: (0, observability_1.logError)(error),
            });
            throw new LiveKitTokenError("server_config", "לא ניתן לבדוק כרגע את הרשאת הכניסה לכיתה.");
        }
        if (isBlocked) {
            throw new LiveKitTokenError("classroom_blocked", "הוצאת מהכיתה ולא ניתן להצטרף אליה שוב.");
        }
    }
    const publishSources = isHidden
        ? []
        : classroomPublishSourcesForRole(settings, isHost, isPresenter);
    const canDrawWhiteboard = isHost ||
        (await classroomWhiteboardAllowed(supabaseAdmin, classroom.id, attendanceKey, settings.allowWhiteboardDraw === true));
    const at = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
        identity,
        name: finalDisplayName,
        ttl: "4h",
        metadata: JSON.stringify({
            role,
            isHost,
            isPresenter,
            hidden: isHidden,
            spectateMode: spectateMode ?? "none",
            attendanceKey,
            attendanceRole,
            admissionId: args.admissionId,
            classroomHostKind: isDelegate ? "delegate" : isHost ? "staff" : undefined,
            classroomDelegateId: delegate?.id,
            canDrawWhiteboard,
        }),
    });
    at.addGrant({
        roomJoin: true,
        room: livekitRoom,
        canPublish: !isHidden,
        canPublishSources: publishSources,
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: isHost,
        hidden: isHidden,
    });
    const token = await at.toJwt();
    return {
        token,
        serverUrl,
        livekitRoom,
        userId: identity,
        isHost,
        role,
        isDelegate,
        canPublishMicrophone: publishSources.includes(livekit_server_sdk_1.TrackSource.MICROPHONE),
        canPublishCamera: publishSources.includes(livekit_server_sdk_1.TrackSource.CAMERA),
        canPublishScreenShare: publishSources.includes(livekit_server_sdk_1.TrackSource.SCREEN_SHARE),
        canDrawWhiteboard,
        attendanceKey,
        attendanceRole,
        displayName: finalDisplayName,
        isHidden,
    };
}
//# sourceMappingURL=livekitService.js.map