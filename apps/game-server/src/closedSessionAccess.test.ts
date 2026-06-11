import { canJoinClosedSession } from "./closedSessionAccess";

function makeSupabase(challengeRow: { id: string } | null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: challengeRow, error: null });
  const eq3 = jest.fn().mockReturnValue({ maybeSingle });
  const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
  const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
  const select = jest.fn().mockReturnValue({ eq: eq1 });
  const from = jest.fn().mockReturnValue({ select });
  return {
    supabase: { from } as unknown as Parameters<typeof canJoinClosedSession>[0]["supabase"],
    from,
    select,
    eq1,
    eq2,
    eq3,
    maybeSingle
  };
}

describe("canJoinClosedSession", () => {
  it("allows join when invitation code matches the session", async () => {
    const m = makeSupabase(null);
    const ok = await canJoinClosedSession({
      supabase: m.supabase,
      sessionId: "sess-1",
      userId: "kid-2",
      sessionInvitationCode: "abc123",
      invitationCode: "abc123"
    });
    expect(ok).toBe(true);
    expect(m.from).not.toHaveBeenCalled();
  });

  it("allows join when user has an accepted challenge for the session", async () => {
    const m = makeSupabase({ id: "ch-1" });
    const ok = await canJoinClosedSession({
      supabase: m.supabase,
      sessionId: "sess-1",
      userId: "kid-2",
      sessionInvitationCode: "abc123"
    });
    expect(ok).toBe(true);
    expect(m.from).toHaveBeenCalledWith("game_challenges");
    expect(m.eq1).toHaveBeenCalledWith("session_id", "sess-1");
    expect(m.eq2).toHaveBeenCalledWith("to_kid_id", "kid-2");
    expect(m.eq3).toHaveBeenCalledWith("status", "accepted");
  });

  it("denies join without a matching invite or accepted challenge", async () => {
    const m = makeSupabase(null);
    const ok = await canJoinClosedSession({
      supabase: m.supabase,
      sessionId: "sess-1",
      userId: "kid-2",
      sessionInvitationCode: "abc123",
      invitationCode: "wrong"
    });
    expect(ok).toBe(false);
  });
});
