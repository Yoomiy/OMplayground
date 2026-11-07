import { describe, expect, it } from "vitest";
import { becameAvailable, challengeAvailability } from "./challengeNotifications";
import type { Invitation } from "./challengePresentation";
const invite: Invitation = {
  id: "one",
  from_kid_id: "me",
  to_kid_id: "other",
  session_id: "waiting-room",
  game_id: "chess",
  status: "accepted",
  created_at: "2026-11-07T00:00:00Z",
  expires_at: "2026-11-07T00:05:00Z",
  partner_name: "נועם",
  partner_role: "kid",
  game_name: "שחמט",
  partner_busy: false,
  self_busy: false,
  self_in_session: false,
  partner_in_session: true,
  can_cancel: false,
};
describe("available-again invitation reminders", () => {
  it("reminds a previously busy challenger once availability returns", () => {
    expect(
      becameAvailable(invite, { busy: true }, "me", undefined, Date.parse(invite.expires_at)),
    ).toBe(true);
    expect(becameAvailable(invite, { busy: false }, "me")).toBe(false);
  });
  it("does not replay ready invitations on initial load", () =>
    expect(becameAvailable(invite, undefined, "me")).toBe(false));
  it("waits for both the current route and server admission claim to become free", () => {
    expect(becameAvailable(invite, { busy: true }, "me", "other-room")).toBe(false);
    expect(becameAvailable({ ...invite, self_busy: true }, { busy: true }, "me")).toBe(false);
  });
  it("does not remind the recipient, someone already in the room, or about a pending invitation", () => {
    expect(becameAvailable(invite, { busy: true }, "other")).toBe(false);
    expect(becameAvailable(invite, { busy: true }, "me", "waiting-room")).toBe(false);
    expect(becameAvailable({ ...invite, self_in_session: true }, { busy: true }, "me")).toBe(false);
    expect(becameAvailable({ ...invite, status: "pending" }, { busy: true }, "me")).toBe(false);
  });
  it("keeps accepted invitations available beyond the old ready-window timestamp", () => {
    expect(
      becameAvailable(
        { ...invite, partner_in_session: false },
        { busy: true },
        "me",
        undefined,
        Date.parse(invite.expires_at) + 1,
      ),
    ).toBe(true);
    expect(
      becameAvailable(invite, { busy: true }, "me", undefined, Date.parse(invite.expires_at) + 1),
    ).toBe(true);
  });
  it("tracks game routes even before a membership update arrives", () =>
    expect(challengeAvailability(invite, "other-room").busy).toBe(true));
});
