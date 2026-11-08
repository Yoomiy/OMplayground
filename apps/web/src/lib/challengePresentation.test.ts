import { describe, expect, it } from "vitest";
import {
  challengeCountdown,
  challengePresentation,
  type Invitation,
} from "./challengePresentation";
const invitation: Invitation = {
  id: "invite",
  from_kid_id: "me",
  to_kid_id: "noam",
  session_id: "second-room",
  game_id: "chess",
  status: "accepted",
  created_at: "2026-11-07T00:00:00Z",
  expires_at: "2026-11-07T00:02:00Z",
  partner_name: "נועם",
  partner_role: "kid",
  game_name: "שחמט",
  self_busy: false,
  partner_busy: false,
  self_in_session: false,
  partner_in_session: false,
  can_cancel: true,
};
describe("invitation perspective", () => {
  it("tells the challenger they are the missing player when a second child accepts", () => {
    const state = challengePresentation(
      { ...invitation, self_busy: true, partner_in_session: true },
      "me",
      "first-room",
    );
    expect(state.selfBusy).toBe(true);
    expect(state.detail).toContain("מחכה לכם");
    expect(state.detail).toContain("אתם במשחק אחר");
    expect(state.detail).not.toContain("השחקן השני");
  });
  it("says that I am already here when waiting for the invitee", () => {
    expect(
      challengePresentation({ ...invitation, self_in_session: true }, "me", "second-room").detail,
    ).toContain("אתם כבר בחדר");
  });
  it("describes the invitee being busy independently from my presence", () => {
    expect(
      challengePresentation(
        { ...invitation, self_in_session: true, partner_busy: true },
        "me",
        "second-room",
      ).detail,
    ).toContain("נועם במשחק אחר");
  });
  it("works from the invited child perspective", () => {
    expect(
      challengePresentation(
        { ...invitation, from_kid_id: "noam", to_kid_id: "me", partner_in_session: true },
        "me",
      ).detail,
    ).toContain("נועם כבר בחדר");
  });
  it("keeps an accepted invite actionable for a recipient who moved to another game", () => {
    const state = challengePresentation({
      ...invitation, from_kid_id: "noam", to_kid_id: "me",
      self_busy: true, partner_in_session: true,
    }, "me", "another-room");
    expect(state.badge).toBe("מחכים לכם בחדר");
    expect(state.detail).toContain("מחכה לכם");
    expect(state.detail).not.toContain("צאו ממנו");
  });
  it("does not call me in the room after navigation away, even while server presence lags", () => {
    const stale = { ...invitation, self_in_session: true };
    expect(challengePresentation(stale, "me").selfHere).toBe(false);
    expect(challengePresentation(stale, "me").badge).not.toBe("אתם בחדר");
    expect(challengePresentation(stale, "me", "another-room").selfBusy).toBe(true);
  });
  it("ticks every second and clamps at zero", () => {
    const expiry = "2026-11-07T00:02:00Z";
    expect(challengeCountdown(expiry, Date.parse(expiry) - 61000)).toBe("1:01");
    expect(challengeCountdown(expiry, Date.parse(expiry) - 60000)).toBe("1:00");
    expect(challengeCountdown(expiry, Date.parse(expiry) + 1000)).toBe("0:00");
  });
});
