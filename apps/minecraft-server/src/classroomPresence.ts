import type { Logger } from "pino";
import { classroomAdmissionIps, classroomVisitEvidence } from "@playground/observability";
import type { ClassroomLiveAttendance } from "./livekitService";

type VisitEvidence = ReturnType<typeof classroomVisitEvidence>;
type Presence = { version: number; visits: Map<string, VisitEvidence> };

/** Transition-only fallback evidence; a board socket disconnect is not a class departure. */
export class ClassroomPresenceObserver {
  private version = 0;
  private rooms = new Map<string, Presence>();
  private departed = new Set<string>();

  constructor(private readonly logger: Pick<Logger, "info">) {}

  beginObservation(): number { return ++this.version; }

  isCurrent(roomCode: string, version: number): boolean {
    return this.rooms.get(roomCode)?.version === version;
  }

  private visitKey(roomSid: string, participantSid: string): string {
    return `${roomSid}:${participantSid}`;
  }

  private log(roomCode: string, event: "CLASSROOM_PARTICIPANT_JOINED" | "CLASSROOM_PARTICIPANT_LEFT",
    evidence: VisitEvidence, observedAt: string, occurredAt = observedAt) {
    this.logger.info({
      protocol: "webrtc", roomCode, message: "Classroom presence transition observed",
      context: {
        ...evidence, ...classroomAdmissionIps.lookup(roomCode, evidence.admissionId, evidence.participantIdentity),
        event, status: "success", evidenceSource: "reconciliation",
        observedAt, occurredAt, timeAccuracy: event.endsWith("LEFT") ? "detection_time" : "livekit_join_time",
        reason: event.endsWith("LEFT") ? "absent_from_livekit_snapshot" : "present_in_livekit_snapshot"
      }
    });
  }

  /** Also covers departures recovered from existing open visits after a process restart. */
  recordDeparture(roomCode: string, roomSid: string, participantSid: string, observedAt: string,
    evidence: VisitEvidence = classroomVisitEvidence({ room: { sid: roomSid }, participant: { sid: participantSid } })) {
    const key = this.visitKey(roomSid, participantSid);
    if (this.departed.has(key)) return;
    this.departed.add(key);
    // Bound retry/restart-recovery deduplication; never retain IPs or names here.
    if (this.departed.size > 5_000) this.departed.delete(this.departed.values().next().value!);
    this.log(roomCode, "CLASSROOM_PARTICIPANT_LEFT", evidence, observedAt);
  }

  observe(snapshots: Map<string, ClassroomLiveAttendance | null>, version: number,
    observedAt = new Date().toISOString()) {
    for (const [roomCode, live] of snapshots) {
      const previous = this.rooms.get(roomCode);
      if (previous && previous.version > version) continue; // Ignore an older concurrent request.
      const visits = new Map<string, VisitEvidence>();
      for (const participant of live?.participants ?? []) {
        const key = this.visitKey(live!.roomSid, participant.sid);
        const evidence = classroomVisitEvidence({ room: { sid: live!.roomSid }, participant });
        classroomAdmissionIps.lookup(roomCode, evidence.admissionId, evidence.participantIdentity);
        visits.set(key, evidence);
        if (!previous?.visits.has(key)) {
          this.departed.delete(key);
          this.log(roomCode, "CLASSROOM_PARTICIPANT_JOINED", evidence, observedAt, participant.joinedAt);
        }
      }
      for (const [key, evidence] of previous?.visits ?? []) {
        if (!visits.has(key)) this.recordDeparture(roomCode, evidence.roomSid!, evidence.participantSid!, observedAt, evidence);
      }
      this.rooms.set(roomCode, { version, visits });
    }
    // Keep active rooms, but bound empty-room version tombstones.
    if (this.rooms.size > 1_000) {
      for (const [roomCode, presence] of this.rooms) {
        if (!presence.visits.size) this.rooms.delete(roomCode);
        if (this.rooms.size <= 1_000) break;
      }
    }
  }
}
