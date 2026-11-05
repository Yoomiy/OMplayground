import type { SupabaseClient } from "@supabase/supabase-js";
import {
  blockClassroomParticipant,
  classroomParticipantKeyFromMetadata,
  isClassroomParticipantBlocked,
  ClassroomGuestFingerprintBans,
} from "./classroomParticipantBlocks";

describe("classroom participant admission blocks", () => {
  it("uses the stable attendance key issued in LiveKit metadata", () => {
    expect(
      classroomParticipantKeyFromMetadata(
        { attendanceKey: "user:11111111-1111-4111-8111-111111111111" },
        "ephemeral-identity",
      ),
    ).toBe("user:11111111-1111-4111-8111-111111111111");
  });

  it("falls back to an authenticated UUID identity for older participants", () => {
    expect(
      classroomParticipantKeyFromMetadata(
        {},
        "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      ),
    ).toBe("user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("does not claim an unstable guest identity can be blocked", () => {
    expect(classroomParticipantKeyFromMetadata({}, "guest-random")).toBeNull();
  });

  it("persists and checks a classroom-scoped block", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: "block-1" }, error: null });
    const readChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle,
    };
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce({ upsert })
        .mockReturnValueOnce(readChain),
    } as unknown as SupabaseClient;
    const target = {
      participantKey: "user:kid-a",
      identity: "kid-a",
      displayName: "Kid A",
    };

    await expect(
      blockClassroomParticipant(supabase, "classroom-1", target),
    ).resolves.toBeUndefined();
    await expect(
      isClassroomParticipantBlocked(
        supabase,
        "classroom-1",
        target.participantKey,
      ),
    ).resolves.toBe(true);

    expect(upsert).toHaveBeenCalledWith(
      {
        classroom_id: "classroom-1",
        participant_key: "user:kid-a",
        participant_identity: "kid-a",
        display_name: "Kid A",
      },
      { onConflict: "classroom_id,participant_key" },
    );
    expect(readChain.eq).toHaveBeenNthCalledWith(
      1,
      "classroom_id",
      "classroom-1",
    );
    expect(readChain.eq).toHaveBeenNthCalledWith(
      2,
      "participant_key",
      "user:kid-a",
    );
  });
});

describe("guest fingerprint bans", () => {
  const fingerprint = `v1:${"a".repeat(64)}`;
  function fixture() {
    const read = jest.fn().mockResolvedValue({ data: [], error: null });
    const chain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), like: read };
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const client = { from: jest.fn(() => ({ ...chain, upsert })) } as unknown as SupabaseClient;
    return { read, chain, upsert, client, cache: new ClassroomGuestFingerprintBans(client) };
  }

  it("coalesces concurrent loads and caches empty rooms", async () => {
    const f = fixture();
    const sets = await Promise.all([f.cache.forRoom("room"), f.cache.forRoom("room")]);
    expect(sets[0].size).toBe(0);
    expect(sets[0]).toBe(sets[1]);
    await f.cache.forRoom("room");
    expect(f.read).toHaveBeenCalledTimes(1);
  });

  it("scopes bans to a room and refreshes immediately after invalidation", async () => {
    const f = fixture();
    await f.cache.forRoom("one");
    f.read.mockResolvedValueOnce({ data: [{ participant_key: `guest-fingerprint:${fingerprint}` }], error: null });
    f.cache.invalidate("one");
    expect((await f.cache.forRoom("one")).has(fingerprint)).toBe(true);
    expect((await f.cache.forRoom("two")).has(fingerprint)).toBe(false);
    expect(f.chain.eq).toHaveBeenCalledWith("classroom_id", "two");
  });

  it("refreshes after 30 seconds and never caches failed reads", async () => {
    const f = fixture();
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    try {
      await f.cache.forRoom("room");
      now.mockReturnValue(31_001);
      f.read.mockResolvedValueOnce({ data: null, error: new Error("offline") });
      await expect(f.cache.forRoom("room")).rejects.toThrow("offline");
      await f.cache.forRoom("room");
      expect(f.read).toHaveBeenCalledTimes(3);
    } finally { now.mockRestore(); }
  });

  it("saves the fingerprint only on a guest ban, alongside the existing identity block", async () => {
    const f = fixture();
    const guest = { participantKey: "guest:room:uuid", identity: "guest-1", displayName: "Guest", guestFingerprint: fingerprint };
    await blockClassroomParticipant(f.client, "room", guest);
    expect(f.upsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ classroom_id: "room", participant_key: guest.participantKey }),
      expect.objectContaining({ classroom_id: "room", participant_key: `guest-fingerprint:${fingerprint}` }),
    ]);
    await blockClassroomParticipant(f.client, "room", { ...guest, participantKey: "user:kid" });
    expect(Array.isArray(f.upsert.mock.calls[1][0])).toBe(false);
  });
});
