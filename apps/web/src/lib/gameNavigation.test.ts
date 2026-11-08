import { describe, it, expect } from "vitest";
import { challengeEntryDecision, gameActivityForPath, roomPhaseFromResponse } from "./gameNavigation";
describe("accepted invitation entry", () => {
  it.each(["completed", "paused", "none"] as const)("enters from %s", (phase) =>
    expect(challengeEntryDecision(phase, "old", "target", "waiting")).toBe("enter"),
  );
  it("asks before leaving a pending room", () =>
    expect(challengeEntryDecision("waiting", "old", "target", "waiting")).toBe("confirm"));
  it.each(["playing", "classroom"] as const)("never automatically interrupts %s", (phase) =>
    expect(challengeEntryDecision(phase, "old", "target", "waiting", "automatic")).toBe("defer"),
  );
  it("asks before explicitly leaving a solo game", () => {
    expect(gameActivityForPath("/solo/chess-solo")).toEqual({ phase: "solo" });
    expect(challengeEntryDecision("solo", undefined, "target", "waiting")).toBe("confirm");
  });
  it("allows retrying an unverified room without authorizing departure", () => {
    expect(challengeEntryDecision("unknown", "old", "target", "waiting")).toBe("retry");
  });
  it("manual acceptance and return entry can leave an active game after confirmation", () => {
    expect(challengeEntryDecision("playing", "old", "target", "waiting", "manual")).toBe("confirm");
    expect(challengeEntryDecision("playing", "old", "target", "waiting", "automatic")).toBe("defer");
    expect(challengeEntryDecision("unknown", "old", "target", "waiting", "manual")).toBe("retry");
    expect(challengeEntryDecision("classroom", undefined, "target", "waiting", "manual")).toBe("defer");
  });
  it("does not redirect back into the room already shown", () =>
    expect(challengeEntryDecision("waiting", "target", "target", "waiting")).toBe("already-here"));
  it("does not enter a completed target", () =>
    expect(challengeEntryDecision("completed", "old", "target", "completed")).toBe("unavailable"));
  it("can enter an accepted room already playing or paused", () => {
    expect(challengeEntryDecision("none", undefined, "target", "playing")).toBe("enter");
    expect(challengeEntryDecision("none", undefined, "target", "paused")).toBe("enter");
  });
});

describe("navigation activity classification", () => {
  it("keeps classroom work separate from room inspection", () => {
    expect(gameActivityForPath("/classroom/class-code")).toEqual({ phase: "classroom" });
    expect(gameActivityForPath("/classroom-ended")).toEqual({ phase: "classroom" });
  });
  it("only inspects multiplayer room routes", () => {
    expect(gameActivityForPath("/play/room-id")).toEqual({ sessionId: "room-id", phase: "unknown" });
    expect(gameActivityForPath("/home")).toEqual({ phase: "none" });
    expect(gameActivityForPath("/solo-history")).toEqual({ phase: "none" });
    expect(gameActivityForPath("/play/")).toEqual({ sessionId: undefined, phase: "unknown" });
  });
  it.each(["waiting", "playing", "paused", "completed"] as const)("recognizes %s", (status) => {
    expect(roomPhaseFromResponse({ status })).toBe(status);
  });
  it("distinguishes a successful deleted-room lookup from malformed data", () => {
    expect(roomPhaseFromResponse(null)).toBe("completed");
    for (const data of [undefined, {}, { status: "stopping" }, { status: null }])
      expect(roomPhaseFromResponse(data)).toBe("unknown");
  });
});
