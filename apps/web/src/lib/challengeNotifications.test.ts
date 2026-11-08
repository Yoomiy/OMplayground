import { describe, expect, it } from "vitest";
import {
  becameAvailable,
  challengeAvailability,
  challengeUpdateMessage,
} from "./challengeNotifications";
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
  it("also reminds the invitee when the roles reverse, but not an outsider", () => {
    expect(becameAvailable(invite, { busy: true }, "other")).toBe(true);
    expect(becameAvailable(invite, { busy: true }, "outsider")).toBe(false);
  });
  it("does not remind someone already in the room or about a pending invitation", () => {
    expect(becameAvailable(invite, { busy: true }, "me", "waiting-room")).toBe(false);
    // Stale server membership after leaving this route must not suppress the reminder.
    expect(becameAvailable({ ...invite, self_in_session: true }, { busy: true }, "me")).toBe(true);
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

describe("significant invitation updates", () => {
  it("announces incoming invitations and remote acceptance, but not unchanged snapshots", () => {
    const incoming = {
      ...invite,
      from_kid_id: "other",
      to_kid_id: "me",
      status: "pending" as const,
    };
    expect(challengeUpdateMessage(incoming, undefined, "me")).toContain("הזמין");
    expect(challengeUpdateMessage(incoming, incoming, "me")).toBeNull();
    expect(challengeUpdateMessage(invite, { ...invite, status: "pending" }, "me")).toContain(
      "אישר",
    );
  });
  it("distinguishes a declined invitation from one fulfilled by entering together", () => {
    expect(
      challengeUpdateMessage(
        { ...invite, status: "declined", withdrawn_by: "other" },
        invite,
        "me",
      ),
    ).toContain("ויתר");
    expect(
      challengeUpdateMessage({ ...invite, fulfilled_at: "2026-11-08T00:00:00Z" }, invite, "me"),
    ).toBeNull();
  });
  it("does not replay the actor's own withdrawal, and explains expiration", () => {
    expect(
      challengeUpdateMessage({ ...invite, status: "expired", withdrawn_by: "me" }, invite, "me"),
    ).toBeNull();
    expect(
      challengeUpdateMessage(
        { ...invite, status: "expired" },
        invite,
        "me",
        Date.parse(invite.expires_at) + 1,
      ),
    ).toContain("פג התוקף");
  });
});
