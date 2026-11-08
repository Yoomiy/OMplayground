import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/utils/telemetry", () => ({ reportCaughtError: vi.fn() }));
import { supabase } from "./supabase";
import { reportCaughtError } from "@/utils/telemetry";
import { resolveChallenges, respondChallenge } from "./challengeApi";

describe("challenge operations", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reports Supabase cancellation errors to the game server with operation, ID and database reason", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "game_sessions_authoritative_field" },
    } as never);
    await expect(respondChallenge("challenge", "cancel")).rejects.toThrow("לא ניתן");
    expect(reportCaughtError).toHaveBeenCalledWith(
      "Game challenge operation failed",
      expect.anything(),
      expect.objectContaining({
        operation: "cancel",
        challengeId: "challenge",
        code: "P0001",
        reason: "game_sessions_authoritative_field",
      }),
      "game-server",
      "warn",
    );
  });
  it("reports rejected transports and keeps the failure local", async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error("offline"));
    await expect(respondChallenge("challenge", "decline")).rejects.toThrow("לא ניתן");
    expect(reportCaughtError).toHaveBeenCalled();
  });
  it("uses one snapshot RPC for clear all and does not request anything for an empty list", async () => {
    await resolveChallenges([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 2, error: null } as never);
    await resolveChallenges(["one", "two"]);
    expect(supabase.rpc).toHaveBeenCalledWith("resolve_game_challenges", { p_ids: ["one", "two"] });
  });
});
