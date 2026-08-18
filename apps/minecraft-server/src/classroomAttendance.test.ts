jest.mock("./livekitService", () => ({ getClassroomsLiveAttendance: jest.fn() }));

import {
  classroomGuestAttendanceKey,
  finalizeClassroomAttendance,
  reconcileClassroomAttendance,
  recordClassroomAttendanceWebhook,
  summarizeAttendanceVisits
} from "./classroomAttendance";
import { getClassroomsLiveAttendance } from "./livekitService";

describe("classroom attendance webhook", () => {
  it("sends classroom lifecycle events to the idempotent database RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    await recordClassroomAttendanceWebhook({ rpc } as any, {
      id: "d1111111-1111-4111-8111-111111111111",
      event: "room_finished",
      createdAt: 1_700_000_000,
      room: { name: "classroom-class-demo", sid: "RM_demo" },
      participant: { sid: "PA_demo", identity: "guest-demo", name: "דני" }
    });
    expect(rpc).toHaveBeenCalledWith("record_classroom_attendance_event", expect.objectContaining({
      p_event_type: "room_finished", p_room_code: "class-demo", p_room_sid: "RM_demo", p_participant_sid: "PA_demo"
    }));
  });

  it("persists verified participant lifecycle events with their LiveKit metadata", async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    await recordClassroomAttendanceWebhook({ rpc } as any, {
      id: "d2222222-2222-4222-8222-222222222222",
      event: "participant_joined",
      room: { name: "classroom-class-demo", sid: "RM_demo" },
      participant: { sid: "PA_demo", identity: "guest-demo", name: "דני", metadata: JSON.stringify({ attendanceKey: "guest:class-demo:abc", attendanceRole: "participant" }) }
    });
    expect(rpc).toHaveBeenCalledWith("record_classroom_attendance_event", expect.objectContaining({
      p_event_type: "participant_joined", p_participant_sid: "PA_demo", p_participant_metadata: { attendanceKey: "guest:class-demo:abc", attendanceRole: "participant" }
    }));
  });

  it("ignores non-classroom events and validates browser guest keys", async () => {
    const rpc = jest.fn();
    await recordClassroomAttendanceWebhook({ rpc } as any, {
      id: "d1111111-1111-4111-8111-111111111111", event: "participant_joined", room: { name: "voxel-session-x", sid: "RM_x" }
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(classroomGuestAttendanceKey("class-demo", "b1111111-1111-4111-8111-111111111111"))
      .toBe("guest:class-demo:b1111111-1111-4111-8111-111111111111");
    expect(classroomGuestAttendanceKey("class-demo", "not-a-uuid")).toBeNull();
  });

  it("backfills the current LiveKit room when webhook delivery is unavailable", async () => {
    (getClassroomsLiveAttendance as jest.Mock).mockResolvedValue(new Map([["class-demo", {
      roomSid: "RM_demo",
      startedAt: "2026-08-18T14:59:00.000Z",
      participants: [{
        sid: "PA_demo", identity: "guest-demo", name: "דני",
        metadata: JSON.stringify({ attendanceKey: "guest:class-demo:abc", attendanceRole: "participant" }),
        joinedAt: "2026-08-18T15:00:00.000Z"
      }]
    }]]));
    const meetingsQuery: any = {
      select: jest.fn(), in: jest.fn(), is: jest.fn().mockResolvedValue({ data: [], error: null })
    };
    meetingsQuery.select.mockReturnValue(meetingsQuery);
    meetingsQuery.in.mockReturnValue(meetingsQuery);
    const rpc = jest.fn().mockResolvedValue({ error: null });
    await reconcileClassroomAttendance({ from: jest.fn().mockReturnValue(meetingsQuery), rpc } as any, [
      { id: "classroom-id", room_code: "class-demo" }
    ]);
    expect(rpc).toHaveBeenCalledWith("record_classroom_attendance_event", expect.objectContaining({ p_event_type: "room_started", p_room_sid: "RM_demo" }));
    expect(rpc).toHaveBeenCalledWith("record_classroom_attendance_event", expect.objectContaining({
      p_event_type: "participant_joined", p_participant_sid: "PA_demo", p_occurred_at: "2026-08-18T15:00:00.000Z"
    }));
  });

  it("adds separate visits without counting the disconnected gap twice", () => {
    expect(summarizeAttendanceVisits([
      { joined_at: "2026-08-18T15:00:00.000Z", left_at: "2026-08-18T15:00:10.000Z" },
      { joined_at: "2026-08-18T15:01:00.000Z", left_at: null }
    ], "2026-08-18T15:01:10.000Z")).toEqual({
      connectedNow: true,
      currentVisitStartedAt: "2026-08-18T15:01:00.000Z",
      totalSeconds: 20
    });
  });

  it("explicitly closes every open meeting when a classroom is ended", async () => {
    const query: any = {
      select: jest.fn(), eq: jest.fn(), is: jest.fn().mockResolvedValue({
        data: [{ livekit_room_sid: "RM_first" }, { livekit_room_sid: "RM_second" }], error: null
      })
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const rpc = jest.fn().mockResolvedValue({ error: null });
    await finalizeClassroomAttendance({ from: jest.fn().mockReturnValue(query), rpc } as any, {
      id: "classroom-id", room_code: "class-demo"
    }, "2026-08-18T15:05:00.000Z");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("record_classroom_attendance_event", expect.objectContaining({
      p_event_type: "room_finished", p_room_code: "class-demo", p_occurred_at: "2026-08-18T15:05:00.000Z"
    }));
  });
});
