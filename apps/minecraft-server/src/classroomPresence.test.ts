import { ClassroomPresenceObserver } from "./classroomPresence";
import type { ClassroomLiveAttendance } from "./livekitService";
import { classroomAdmissionIps } from "@playground/observability";

const admissionId = "11111111-1111-4111-8111-111111111111";
function live(roomSid = "RM_1", participantSid = "PA_1"): ClassroomLiveAttendance {
  return {
    roomSid, startedAt: "2026-10-16T08:00:00.000Z",
    participants: [{ sid: participantSid, identity: "guest-abc", name: "Private Name",
      metadata: JSON.stringify({ admissionId, attendanceKey: "guest:ROOM:key", token: "private-token", clientIp: "192.0.2.1" }),
      joinedAt: "2026-10-16T08:01:00.000Z" }]
  };
}

function setup() {
  const logger = { info: jest.fn() };
  const observer = new ClassroomPresenceObserver(logger);
  const observe = (snapshot: ClassroomLiveAttendance | null) => observer.observe(
    new Map([["ROOM", snapshot]]), observer.beginObservation(), "2026-10-16T08:02:00.000Z"
  );
  return { logger, observer, observe };
}

describe("classroom presence fallback", () => {
  it("logs joins and leaves once per transition, retaining admission linkage without content or IPs", () => {
    const { logger, observe } = setup();
    observe(live());
    observe(live());
    observe({ ...live(), participants: [] });
    observe({ ...live(), participants: [] });
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info.mock.calls[1][0]).toMatchObject({ roomCode: "ROOM", context: {
      event: "CLASSROOM_PARTICIPANT_LEFT", evidenceSource: "reconciliation", admissionId,
      participantKey: "guest:ROOM:key", participantIdentity: "guest-abc", roomSid: "RM_1", participantSid: "PA_1",
      occurredAt: "2026-10-16T08:02:00.000Z", timeAccuracy: "detection_time"
    } });
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/Private Name|private-token|192\.0\.2/);
  });

  it("logs the last person's departure when the room disappears", () => {
    const { logger, observe } = setup();
    observe(live());
    observe(null);
    observe(null);
    expect(logger.info.mock.calls.map(([entry]) => entry.context.event))
      .toEqual(["CLASSROOM_PARTICIPANT_JOINED", "CLASSROOM_PARTICIPANT_LEFT"]);
  });

  it("repeats the admission IP on the polling departure without reading IPs from metadata", () => {
    const { logger, observe } = setup();
    const cachedAdmissionId = "33333333-3333-4333-8333-333333333333";
    classroomAdmissionIps.remember("ROOM", cachedAdmissionId, "guest-abc", {
      clientIp: "198.51.100.11", ipSource: "railway", ipStatus: "available"
    });
    const snapshot = live();
    snapshot.participants[0].metadata = JSON.stringify({ admissionId: cachedAdmissionId, clientIp: "203.0.113.99" });
    observe(snapshot);
    observe(null);
    expect(logger.info.mock.calls[1][0].context).toMatchObject({
      event: "CLASSROOM_PARTICIPANT_LEFT", clientIp: "198.51.100.11", ipObservation: "admission"
    });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("203.0.113.99");
  });

  it("does not infer a departure from failed LiveKit reads", () => {
    const { logger, observer, observe } = setup();
    observe(live());
    observer.observe(new Map(), observer.beginObservation());
    observe(live());
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("distinguishes reconnects and room replacement by connection SIDs", () => {
    const { logger, observe } = setup();
    observe(live());
    observe(live("RM_1", "PA_2"));
    observe(live("RM_2", "PA_3"));
    expect(logger.info.mock.calls.filter(([entry]) => entry.context.event.endsWith("LEFT"))
      .map(([entry]) => entry.context.participantSid)).toEqual(["PA_1", "PA_2"]);
  });

  it("ignores a stale concurrent observation instead of fabricating a leave", () => {
    const { logger, observer } = setup();
    const older = observer.beginObservation();
    const newer = observer.beginObservation();
    observer.observe(new Map([["ROOM", live()]]), newer);
    observer.observe(new Map([["ROOM", null]]), older);
    expect(observer.isCurrent("ROOM", older)).toBe(false);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("deduplicates recovered open visits against departures already observed in memory", () => {
    const { logger, observer, observe } = setup();
    observe(live());
    observe(null);
    observer.recordDeparture("ROOM", "RM_1", "PA_1", new Date().toISOString());
    observer.recordDeparture("ROOM", "RM_old", "PA_old", new Date().toISOString());
    observer.recordDeparture("ROOM", "RM_old", "PA_old", new Date().toISOString());
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info.mock.calls[2][0].context).toMatchObject({
      event: "CLASSROOM_PARTICIPANT_LEFT", participantSid: "PA_old", admissionLink: "unavailable"
    });
  });
});
