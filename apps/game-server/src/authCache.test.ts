import { getCachedAuth } from "./authCache";

describe("game server authentication", () => {
  it("does not accept a self-declared guest identity", async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token")
    });
    const supabase = { auth: { getUser } } as never;

    await expect(
      getCachedAuth(supabase, "guest:anyone:Student")
    ).rejects.toThrow("UNAUTHORIZED");
    expect(getUser).toHaveBeenCalledWith("guest:anyone:Student");
  });
});
