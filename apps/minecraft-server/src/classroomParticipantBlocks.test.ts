import type { SupabaseClient } from "@supabase/supabase-js";
import {
  blockClassroomParticipant,
  classroomParticipantKeyFromMetadata,
  isClassroomParticipantBlocked
} from "./classroomParticipantBlocks";

describe("classroom participant admission blocks", () => {
  it("uses the stable attendance key issued in LiveKit metadata", () => {
    expect(classroomParticipantKeyFromMetadata(
      { attendanceKey: "user:11111111-1111-4111-8111-111111111111" },
      "ephemeral-identity"
    )).toBe("user:11111111-1111-4111-8111-111111111111");
  });

  it("falls back to an authenticated UUID identity for older participants", () => {
    expect(classroomParticipantKeyFromMetadata(
      {},
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"
    )).toBe("user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("does not claim an unstable guest identity can be blocked", () => {
    expect(classroomParticipantKeyFromMetadata({}, "guest-random")).toBeNull();
  });

  it("persists and checks a classroom-scoped block", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: "block-1" }, error: null });
    const readChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle
    };
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn()
        .mockReturnValueOnce({ upsert })
        .mockReturnValueOnce(readChain)
    } as unknown as SupabaseClient;
    const target = {
      participantKey: "user:kid-a",
      identity: "kid-a",
      displayName: "Kid A"
    };

    await expect(blockClassroomParticipant(supabase, "classroom-1", target)).resolves.toBeUndefined();
    await expect(
      isClassroomParticipantBlocked(supabase, "classroom-1", target.participantKey)
    ).resolves.toBe(true);

    expect(upsert).toHaveBeenCalledWith({
      classroom_id: "classroom-1",
      participant_key: "user:kid-a",
      participant_identity: "kid-a",
      display_name: "Kid A"
    }, { onConflict: "classroom_id,participant_key" });
    expect(readChain.eq).toHaveBeenNthCalledWith(1, "classroom_id", "classroom-1");
    expect(readChain.eq).toHaveBeenNthCalledWith(2, "participant_key", "user:kid-a");
  });
});
