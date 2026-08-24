import type { SupabaseClient } from "@supabase/supabase-js";
import { RoomServiceClient } from "livekit-server-sdk";
import {
  evictClassroomParticipants,
  generateClassroomToken,
  getClassroomParticipantBlockTarget,
  getClassroomsLiveAttendance,
  generateLiveKitToken,
  LiveKitTokenError
} from "./livekitService";

function buildSupabaseMock(handlers: {
  userId?: string;
  profile?: Record<string, unknown> | null;
  session?: Record<string, unknown> | null;
}) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn()
  };

  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: handlers.userId ? { user: { id: handlers.userId } } : null,
        error: handlers.userId ? null : { message: "bad token" }
      })
    },
    from: jest.fn((table: string) => {
      if (table === "kid_profiles") {
        chain.maybeSingle.mockResolvedValue({
          data: handlers.profile ?? null,
          error: null
        });
      }
      if (table === "game_sessions") {
        chain.maybeSingle.mockResolvedValue({
          data: handlers.session ?? null,
          error: null
        });
      }
      return chain;
    })
  };

  return supabase as unknown as SupabaseClient;
}

describe("generateLiveKitToken roster gate", () => {
  const prevEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...prevEnv,
      LIVEKIT_URL: "wss://lk.example.com",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret"
    };
  });

  afterEach(() => {
    process.env = prevEnv;
    jest.restoreAllMocks();
  });

  it("denies voice token when kid is not in session roster (active session)", async () => {
    const supabaseAdmin = buildSupabaseMock({
      userId: "kid-a",
      profile: {
        full_name: "Kid A",
        is_active: true,
        gender: "boy",
        role: "kid"
      },
      session: {
        gender: "boy",
        player_ids: ["kid-b"],
        status: "playing"
      }
    });

    await expect(
      generateLiveKitToken({
        supabaseAdmin,
        accessToken: "token",
        sessionId: "sess-1"
      })
    ).rejects.toMatchObject<Partial<LiveKitTokenError>>({
      reason: "roster_block"
    });
  });

  it("denies voice token when kid is not in roster on paused session", async () => {
    const supabaseAdmin = buildSupabaseMock({
      userId: "kid-a",
      profile: {
        full_name: "Kid A",
        is_active: true,
        gender: "boy",
        role: "kid"
      },
      session: {
        gender: "boy",
        player_ids: ["kid-b"],
        status: "paused"
      }
    });

    await expect(
      generateLiveKitToken({
        supabaseAdmin,
        accessToken: "token",
        sessionId: "sess-1"
      })
    ).rejects.toMatchObject({ reason: "roster_block" });
  });

  it("denies a new classroom token after that participant was kicked", async () => {
    const classroomChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: "classroom-1",
          room_code: "room-123",
          teacher_id: "teacher-1",
          teacher_name: "Teacher",
          status: "active",
          settings: {}
        },
        error: null
      })
    };
    const blockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: "block-1" }, error: null })
    };
    const supabase = {
      from: jest.fn((table: string) => (
        table === "classroom_participant_blocks" ? blockChain : classroomChain
      ))
    } as unknown as SupabaseClient;

    await expect(generateClassroomToken({
      supabaseAdmin: supabase,
      roomCode: "room-123",
      displayName: "Student",
      guestAttendanceKey: "guest:room-123:11111111-1111-4111-8111-111111111111"
    })).rejects.toMatchObject({ reason: "classroom_blocked" });
  });

  it("actively removes every attendee and revokes each active classroom token", async () => {
    const listParticipants = jest
      .spyOn(RoomServiceClient.prototype, "listParticipants")
      .mockResolvedValue([
        { identity: "teacher" },
        { identity: "student-a" },
        { identity: "student-b" }
      ] as never);
    const removeParticipant = jest
      .spyOn(RoomServiceClient.prototype, "removeParticipant")
      .mockResolvedValue({} as never);

    await expect(evictClassroomParticipants("room-123")).resolves.toBe(3);

    expect(listParticipants).toHaveBeenCalledWith("classroom-room-123");
    expect(removeParticipant).toHaveBeenCalledTimes(3);
    expect(removeParticipant).toHaveBeenCalledWith(
      "classroom-room-123",
      "student-a",
      expect.objectContaining({ revokeTokenTs: expect.any(BigInt) })
    );
  });

  it("reads the durable participant key before kicking a student", async () => {
    jest.spyOn(RoomServiceClient.prototype, "getParticipant").mockResolvedValue({
      identity: "student-a",
      name: "Student A",
      metadata: JSON.stringify({
        attendanceKey: "guest:room-123:11111111-1111-4111-8111-111111111111",
        isHost: false
      })
    } as never);

    await expect(
      getClassroomParticipantBlockTarget("room-123", "student-a")
    ).resolves.toEqual({
      participantKey: "guest:room-123:11111111-1111-4111-8111-111111111111",
      identity: "student-a",
      displayName: "Student A"
    });
  });

  it("refuses to put a classroom host on the kick block list", async () => {
    jest.spyOn(RoomServiceClient.prototype, "getParticipant").mockResolvedValue({
      identity: "teacher-a",
      name: "Teacher A",
      metadata: JSON.stringify({ attendanceKey: "user:teacher-a", isHost: true })
    } as never);

    await expect(
      getClassroomParticipantBlockTarget("room-123", "teacher-a")
    ).rejects.toThrow("cannot_block_classroom_host");
  });

  it("lists LiveKit rooms once and fetches participants only for rooms that exist", async () => {
    const listRooms = jest.spyOn(RoomServiceClient.prototype, "listRooms").mockResolvedValue([{
      name: "classroom-live-room",
      sid: "RM_live",
      creationTime: BigInt(1_700_000_000),
      creationTimeMs: BigInt(1_700_000_000_000)
    }] as never);
    const listParticipants = jest.spyOn(RoomServiceClient.prototype, "listParticipants").mockResolvedValue([{
      sid: "PA_student",
      identity: "student",
      name: "Student",
      metadata: "{}",
      joinedAt: BigInt(1_700_000_010),
      joinedAtMs: BigInt(1_700_000_010_000)
    }] as never);

    const snapshots = await getClassroomsLiveAttendance(["live-room", "empty-room"]);

    expect(listRooms).toHaveBeenCalledTimes(1);
    expect(listParticipants).toHaveBeenCalledTimes(1);
    expect(snapshots.get("live-room")).toMatchObject({ roomSid: "RM_live" });
    expect(snapshots.get("empty-room")).toBeNull();
  });
});
