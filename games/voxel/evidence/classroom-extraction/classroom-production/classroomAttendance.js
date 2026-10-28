"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordClassroomAttendanceWebhook = recordClassroomAttendanceWebhook;
exports.classroomGuestAttendanceKey = classroomGuestAttendanceKey;
exports.summarizeAttendanceVisits = summarizeAttendanceVisits;
exports.reconcileClassroomAttendance = reconcileClassroomAttendance;
exports.finalizeClassroomAttendance = finalizeClassroomAttendance;
const crypto_1 = __importDefault(require("crypto"));
const livekitService_1 = require("./livekitService");
const observability_1 = require("@playground/observability");
const classroomPresence_1 = require("./classroomPresence");
const presence = new classroomPresence_1.ClassroomPresenceObserver((0, observability_1.createLogger)("classroom-server"));
const CLASSROOM_ROOM_PREFIX = "classroom-";
function occurredAt(createdAt) {
    const raw = typeof createdAt === "bigint" ? Number(createdAt) : Number(createdAt);
    return Number.isFinite(raw) && raw > 0
        ? new Date(raw * 1000).toISOString()
        : new Date().toISOString();
}
function parseMetadata(value) {
    if (!value)
        return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
/** Persist verified LiveKit lifecycle events. The database RPC makes retries idempotent. */
async function recordClassroomAttendanceWebhook(supabaseAdmin, event) {
    if (!event.id ||
        !event.event ||
        ![
            "room_started",
            "room_finished",
            "participant_joined",
            "participant_left",
        ].includes(event.event))
        return;
    const roomName = event.room?.name ?? "";
    if (!roomName.startsWith(CLASSROOM_ROOM_PREFIX) || !event.room?.sid)
        return;
    const { error } = await supabaseAdmin.rpc("record_classroom_attendance_event", {
        p_event_id: event.id,
        p_event_type: event.event,
        p_room_code: roomName.slice(CLASSROOM_ROOM_PREFIX.length),
        p_room_sid: event.room.sid,
        p_participant_sid: event.participant?.sid ?? null,
        p_participant_identity: event.participant?.identity ?? null,
        p_participant_name: event.participant?.name ?? null,
        p_participant_metadata: parseMetadata(event.participant?.metadata),
        p_occurred_at: occurredAt(event.createdAt),
    });
    if (error)
        throw error;
}
function classroomGuestAttendanceKey(roomCode, key) {
    if (typeof key !== "string")
        return null;
    const normalized = key.trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)
        ? `guest:${roomCode}:${normalized.toLowerCase()}`
        : null;
}
function summarizeAttendanceVisits(visits, snapshotAt) {
    const snapshotAtMs = new Date(snapshotAt).getTime();
    const currentVisit = [...visits].reverse().find((visit) => !visit.left_at) ?? null;
    const totalSeconds = visits.reduce((sum, visit) => {
        const joinedAt = new Date(visit.joined_at).getTime();
        const leftAt = visit.left_at
            ? new Date(visit.left_at).getTime()
            : snapshotAtMs;
        if (!Number.isFinite(joinedAt) || !Number.isFinite(leftAt))
            return sum;
        return sum + Math.max(0, Math.floor((leftAt - joinedAt) / 1000));
    }, 0);
    return {
        connectedNow: Boolean(currentVisit),
        currentVisitStartedAt: currentVisit?.joined_at ?? null,
        totalSeconds,
    };
}
function deterministicEventId(seed) {
    const bytes = crypto_1.default
        .createHash("sha256")
        .update(seed)
        .digest()
        .subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function persistAttendanceEvent(supabaseAdmin, input) {
    const { error } = await supabaseAdmin.rpc("record_classroom_attendance_event", {
        p_event_id: deterministicEventId(`${input.eventType}:${input.roomSid}:${input.participantSid ?? "room"}`),
        p_event_type: input.eventType,
        p_room_code: input.roomCode,
        p_room_sid: input.roomSid,
        p_participant_sid: input.participantSid ?? null,
        p_participant_identity: input.participantIdentity ?? null,
        p_participant_name: input.participantName ?? null,
        p_participant_metadata: input.participantMetadata ?? {},
        p_occurred_at: input.occurredAt,
    });
    if (error)
        throw error;
}
/**
 * Reconciles attendance directly from LiveKit's room service. Webhooks remain
 * useful for low-latency updates, but this prevents a missing webhook delivery
 * from leaving the attendance tables permanently empty.
 */
async function reconcileClassroomAttendance(supabaseAdmin, classrooms, observer = presence) {
    if (!classrooms.length)
        return new Map();
    const observation = observer.beginObservation();
    const liveByRoomCode = await (0, livekitService_1.getClassroomsLiveAttendance)(classrooms.map((classroom) => classroom.room_code));
    // Log observed transitions even when the attendance database is unavailable.
    // Missing map entries are failed reads, not evidence that a participant left.
    observer.observe(liveByRoomCode, observation);
    const snapshots = classrooms
        .filter((classroom) => liveByRoomCode.has(classroom.room_code) &&
        observer.isCurrent(classroom.room_code, observation))
        .map((classroom) => ({
        classroom,
        live: liveByRoomCode.get(classroom.room_code) ?? null,
    }));
    const classroomIds = classrooms.map((classroom) => classroom.id);
    const { data: openMeetings, error: meetingsError } = await supabaseAdmin
        .from("classroom_meetings")
        .select("id, classroom_id, livekit_room_sid")
        .in("classroom_id", classroomIds)
        .is("ended_at", null);
    if (meetingsError)
        throw meetingsError;
    const meetingIds = (openMeetings ?? []).map((meeting) => meeting.id);
    const { data: openVisits, error: visitsError } = meetingIds.length
        ? await supabaseAdmin
            .from("classroom_participant_visits")
            .select("meeting_id, livekit_participant_sid")
            .in("meeting_id", meetingIds)
            .is("left_at", null)
        : { data: [], error: null };
    if (visitsError)
        throw visitsError;
    const meetingsByClassroom = new Map();
    for (const meeting of openMeetings ?? []) {
        meetingsByClassroom.set(meeting.classroom_id, [
            ...(meetingsByClassroom.get(meeting.classroom_id) ?? []),
            meeting,
        ]);
    }
    const visitsByMeeting = new Map();
    for (const visit of openVisits ?? []) {
        visitsByMeeting.set(visit.meeting_id, [
            ...(visitsByMeeting.get(visit.meeting_id) ?? []),
            visit.livekit_participant_sid,
        ]);
    }
    for (const { classroom, live } of snapshots) {
        const occurredAt = new Date().toISOString();
        const priorMeetings = meetingsByClassroom.get(classroom.id) ?? [];
        if (!live) {
            for (const meeting of priorMeetings) {
                for (const participantSid of visitsByMeeting.get(meeting.id) ?? []) {
                    observer.recordDeparture(classroom.room_code, meeting.livekit_room_sid, participantSid, occurredAt);
                }
                await persistAttendanceEvent(supabaseAdmin, {
                    eventType: "room_finished",
                    roomCode: classroom.room_code,
                    roomSid: meeting.livekit_room_sid,
                    occurredAt,
                });
            }
            continue;
        }
        await persistAttendanceEvent(supabaseAdmin, {
            eventType: "room_started",
            roomCode: classroom.room_code,
            roomSid: live.roomSid,
            occurredAt: live.startedAt,
        });
        const liveSids = new Set(live.participants.map((participant) => participant.sid));
        for (const meeting of priorMeetings) {
            if (meeting.livekit_room_sid !== live.roomSid) {
                for (const participantSid of visitsByMeeting.get(meeting.id) ?? []) {
                    observer.recordDeparture(classroom.room_code, meeting.livekit_room_sid, participantSid, occurredAt);
                }
                await persistAttendanceEvent(supabaseAdmin, {
                    eventType: "room_finished",
                    roomCode: classroom.room_code,
                    roomSid: meeting.livekit_room_sid,
                    occurredAt,
                });
                continue;
            }
            for (const participantSid of visitsByMeeting.get(meeting.id) ?? []) {
                if (!liveSids.has(participantSid)) {
                    observer.recordDeparture(classroom.room_code, live.roomSid, participantSid, occurredAt);
                    await persistAttendanceEvent(supabaseAdmin, {
                        eventType: "participant_left",
                        roomCode: classroom.room_code,
                        roomSid: live.roomSid,
                        participantSid,
                        occurredAt,
                    });
                }
            }
        }
        for (const participant of live.participants) {
            await persistAttendanceEvent(supabaseAdmin, {
                eventType: "participant_joined",
                roomCode: classroom.room_code,
                roomSid: live.roomSid,
                participantSid: participant.sid,
                participantIdentity: participant.identity,
                participantName: participant.name,
                participantMetadata: parseMetadata(participant.metadata),
                occurredAt: participant.joinedAt,
            });
        }
    }
    return liveByRoomCode;
}
/** Close every still-open LiveKit meeting recorded for a classroom. */
async function finalizeClassroomAttendance(supabaseAdmin, classroom, occurredAt = new Date().toISOString()) {
    const { data: openMeetings, error } = await supabaseAdmin
        .from("classroom_meetings")
        .select("livekit_room_sid")
        .eq("classroom_id", classroom.id)
        .is("ended_at", null);
    if (error)
        throw error;
    for (const meeting of openMeetings ?? []) {
        await persistAttendanceEvent(supabaseAdmin, {
            eventType: "room_finished",
            roomCode: classroom.room_code,
            roomSid: meeting.livekit_room_sid,
            occurredAt,
        });
    }
}
//# sourceMappingURL=classroomAttendance.js.map