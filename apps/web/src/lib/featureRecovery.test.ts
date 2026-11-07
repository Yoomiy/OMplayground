import { afterEach, describe, expect, it, vi } from "vitest";
import { backendUnavailable, FeatureRequestError, FeatureRetryGate } from "./featureRecovery";
import { parseInvitations } from "./challengePayload";

describe("feature recovery", () => {
  afterEach(() => vi.useRealTimers());

  it("pauses unavailable RPCs until an explicit retry, even after a long wait", () => {
    vi.useFakeTimers();
    const gate = new FeatureRetryGate();
    gate.fail(new FeatureRequestError("unavailable", true));
    vi.advanceTimersByTime(60 * 60_000);
    expect(gate.allows()).toBe(false);
    expect(gate.allows(true)).toBe(true);
    expect(gate.allows()).toBe(true);
  });

  it("backs off transient failures and clears backoff after recovery", () => {
    vi.useFakeTimers();
    const gate = new FeatureRetryGate();
    gate.fail(new Error("offline"));
    expect(gate.allows()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(gate.allows()).toBe(true);
    gate.fail(new Error("offline"));
    vi.advanceTimersByTime(5000);
    expect(gate.allows()).toBe(false);
    gate.success();
    expect(gate.allows()).toBe(true);
  });

  it("distinguishes incompatible schemas from permission and network errors", () => {
    for (const code of ["PGRST202", "42883", "42P01", "42703", "PGRST204", "PGRST205"])
      expect(backendUnavailable({ code })).toBe(true);
    for (const error of [{ code: "42501" }, { code: "23505" }, new Error("offline"), null])
      expect(backendUnavailable(error)).toBe(false);
  });

  it("accepts an empty invitation list but rejects malformed successful responses before rendering", () => {
    expect(parseInvitations([])).toEqual([]);
    for (const payload of [null, {}, { error: "missing function" }, [null], [{ id: "bad" }]]) {
      expect(() => parseInvitations(payload)).toThrow(FeatureRequestError);
    }
  });
  it("keeps valid accepted and withdrawn invitations readable after their countdown ends", () => {
    const row = {
      id: "challenge",
      from_kid_id: "me",
      to_kid_id: "other",
      session_id: "room",
      game_id: "chess",
      partner_role: "kid",
      partner_name: "Friend",
      game_name: "Chess",
      status: "accepted",
      created_at: "2026-11-01T00:00:00Z",
      expires_at: "2026-11-01T00:05:00Z",
      self_busy: false,
      partner_busy: false,
      self_in_session: false,
      partner_in_session: false,
      can_cancel: false,
      session_status: "waiting",
    };
    const withdrawn = { ...row, status: "expired", withdrawn: true, session_status: "completed" };
    expect(parseInvitations([row, withdrawn])).toEqual([row, withdrawn]);
  });
});
