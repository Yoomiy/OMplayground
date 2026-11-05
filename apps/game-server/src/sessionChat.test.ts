import { persistSessionChat } from "./sessionChat";

describe("chat request identity", () => {
  const row = {
    id: "request",
    session_id: "room",
    sender_id: "kid",
    sender_name: "Kid",
    message: "hello",
    is_system: false as const,
  };
  function fixture(existing: unknown, error: unknown = null) {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const upsert = jest
      .fn()
      .mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [], error }),
      });
    const select = jest
      .fn()
      .mockReturnValue({
        eq: jest
          .fn()
          .mockReturnValue({
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: existing, error: null }),
          }),
      });
    const client = {
      from: jest.fn().mockReturnValue({ insert, upsert, select }),
    };
    return {
      client: client as unknown as Parameters<typeof persistSessionChat>[0],
      insert,
      upsert,
      select,
    };
  }
  it("acknowledges a replay only for the same actor, room and body without updating its original row", async () => {
    const f = fixture({ ...row, is_deleted: true });
    expect((await persistSessionChat(f.client, row)).error).toBeNull();
    expect(f.upsert).toHaveBeenCalledWith(row, {
      onConflict: "id",
      ignoreDuplicates: true,
    });
    for (const mismatch of [
      { sender_id: "other" },
      { session_id: "other" },
      { message: "changed" },
      { is_system: true },
    ]) {
      const f = fixture({ ...row, ...mismatch });
      expect((await persistSessionChat(f.client, row)).error).toMatchObject({
        code: "CHAT_CONFLICT",
      });
    }
  });
  it("propagates persistence failures and preserves older clients without message IDs", async () => {
    const failure = { code: "unavailable" };
    const f = fixture(null, failure);
    expect((await persistSessionChat(f.client, row)).error).toBe(failure);
    expect(f.select).not.toHaveBeenCalled();
    const { id: _id, ...legacy } = row;
    expect((await persistSessionChat(f.client, legacy)).error).toBeNull();
    expect(f.insert).toHaveBeenCalledWith(legacy);
  });
});
