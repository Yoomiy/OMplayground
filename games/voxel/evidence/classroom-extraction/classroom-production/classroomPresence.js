"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassroomPresenceObserver = void 0;
const observability_1 = require("@playground/observability");
/** Transition-only fallback evidence; a board socket disconnect is not a class departure. */
class ClassroomPresenceObserver {
    logger;
    version = 0;
    rooms = new Map();
    departed = new Set();
    constructor(logger) {
        this.logger = logger;
    }
    beginObservation() {
        return ++this.version;
    }
    isCurrent(roomCode, version) {
        return this.rooms.get(roomCode)?.version === version;
    }
    visitKey(roomSid, participantSid) {
        return `${roomSid}:${participantSid}`;
    }
    log(roomCode, event, evidence, observedAt, occurredAt = observedAt) {
        this.logger.info({
            protocol: "webrtc",
            roomCode,
            message: "Classroom presence transition observed",
            context: {
                ...evidence,
                ...observability_1.classroomAdmissionIps.lookup(roomCode, evidence.admissionId, evidence.participantIdentity),
                event,
                status: "success",
                evidenceSource: "reconciliation",
                observedAt,
                occurredAt,
                timeAccuracy: event.endsWith("LEFT")
                    ? "detection_time"
                    : "livekit_join_time",
                reason: event.endsWith("LEFT")
                    ? "absent_from_livekit_snapshot"
                    : "present_in_livekit_snapshot",
            },
        });
    }
    /** Also covers departures recovered from existing open visits after a process restart. */
    recordDeparture(roomCode, roomSid, participantSid, observedAt, evidence = (0, observability_1.classroomVisitEvidence)({
        room: { sid: roomSid },
        participant: { sid: participantSid },
    })) {
        const key = this.visitKey(roomSid, participantSid);
        if (this.departed.has(key))
            return;
        this.departed.add(key);
        // Bound retry/restart-recovery deduplication; never retain IPs or names here.
        if (this.departed.size > 5_000)
            this.departed.delete(this.departed.values().next().value);
        this.log(roomCode, "CLASSROOM_PARTICIPANT_LEFT", evidence, observedAt);
    }
    observe(snapshots, version, observedAt = new Date().toISOString()) {
        for (const [roomCode, live] of snapshots) {
            const previous = this.rooms.get(roomCode);
            if (previous && previous.version > version)
                continue; // Ignore an older concurrent request.
            const visits = new Map();
            for (const participant of live?.participants ?? []) {
                const key = this.visitKey(live.roomSid, participant.sid);
                const evidence = (0, observability_1.classroomVisitEvidence)({
                    room: { sid: live.roomSid },
                    participant,
                });
                observability_1.classroomAdmissionIps.lookup(roomCode, evidence.admissionId, evidence.participantIdentity);
                visits.set(key, evidence);
                if (!previous?.visits.has(key)) {
                    this.departed.delete(key);
                    this.log(roomCode, "CLASSROOM_PARTICIPANT_JOINED", evidence, observedAt, participant.joinedAt);
                }
            }
            for (const [key, evidence] of previous?.visits ?? []) {
                if (!visits.has(key))
                    this.recordDeparture(roomCode, evidence.roomSid, evidence.participantSid, observedAt, evidence);
            }
            this.rooms.set(roomCode, { version, visits });
        }
        // Keep active rooms, but bound empty-room version tombstones.
        if (this.rooms.size > 1_000) {
            for (const [roomCode, presence] of this.rooms) {
                if (!presence.visits.size)
                    this.rooms.delete(roomCode);
                if (this.rooms.size <= 1_000)
                    break;
            }
        }
    }
}
exports.ClassroomPresenceObserver = ClassroomPresenceObserver;
//# sourceMappingURL=classroomPresence.js.map