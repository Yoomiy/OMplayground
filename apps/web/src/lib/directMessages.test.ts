import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/utils/telemetry", () => ({ reportTelemetry: vi.fn() }));
import { dmRpc, validateInboxPayload } from "./directMessages";
import { supabase } from "./supabase";
import { FeatureRequestError } from "./featureRecovery";

const partner = { id: "other", full_name: "Teacher", role: "teacher", can_send: true };
const message = {
  from_display_name: "Teacher",
  id: "message",
  from_kid_id: "other",
  to_kid_id: "me",
  content: "Hello",
  is_read: false,
  created_at: "2026-11-07T00:00:00Z",
};
const thread = { partnerId: "other", partner, lastMessage: message, unreadCount: 1 };

describe("message response validation", () => {
  it("accepts legacy administration messages and empty histories", () => {
    expect(() =>
      validateInboxPayload("get_private_thread", { partner, messages: [] }),
    ).not.toThrow();
    expect(() =>
      validateInboxPayload("list_private_threads", {
        unread_total: 1,
        threads: [{ ...thread, lastMessage: { ...message, from_kid_id: null } }],
      }),
    ).not.toThrow();
  });
  it("rejects fields used by rendering and sorting before they enter React state", () => {
    for (const badThread of [
      { ...thread, partner: null },
      { ...thread, lastMessage: { ...message, created_at: 12 } },
      { ...thread, unreadCount: -1 },
    ]) {
      expect(() =>
        validateInboxPayload("list_private_threads", { unread_total: 1, threads: [badThread] }),
      ).toThrow(FeatureRequestError);
    }
    expect(() => validateInboxPayload("get_private_thread", { partner, messages: null })).toThrow(
      FeatureRequestError,
    );
  });
  it("classifies a missing migration as unavailable with a user-facing error", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "missing function" },
    } as never);
    await expect(dmRpc("list_private_threads")).rejects.toMatchObject({ unavailable: true });
  });
  it("validates successful RPC data instead of trusting a generic cast", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { threads: [{}], unread_total: 1 },
      error: null,
    } as never);
    await expect(dmRpc("list_private_threads")).rejects.toBeInstanceOf(FeatureRequestError);
  });
  it("turns rejected network requests into recoverable errors without exposing transport details", async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error("private transport detail"));
    await expect(dmRpc("list_private_threads")).rejects.toMatchObject({
      name: "FeatureRequestError",
      unavailable: false,
      message: "לא ניתן לעדכן הודעות כרגע. אפשר לנסות שוב",
    });
  });
});
