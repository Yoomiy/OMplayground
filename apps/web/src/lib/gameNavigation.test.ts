import { describe, it, expect } from "vitest";
import { challengeEntryDecision } from "./gameNavigation";
describe("accepted invitation entry", () => {
  it.each(["completed", "paused", "none"] as const)("enters from %s", (phase) =>
    expect(challengeEntryDecision(phase, "old", "target", "waiting")).toBe("enter"),
  );
  it("asks before leaving a pending room", () =>
    expect(challengeEntryDecision("waiting", "old", "target", "waiting")).toBe("confirm"));
  it.each(["playing", "unknown"] as const)("never interrupts %s", (phase) =>
    expect(challengeEntryDecision(phase, "old", "target", "waiting")).toBe("defer"),
  );
  it("does not redirect back into the room already shown", () =>
    expect(challengeEntryDecision("waiting", "target", "target", "waiting")).toBe("already-here"));
  it("does not enter a completed target", () =>
    expect(challengeEntryDecision("completed", "old", "target", "completed")).toBe("unavailable"));
  it("can enter an accepted room already playing or paused", () => {
    expect(challengeEntryDecision("none", undefined, "target", "playing")).toBe("enter");
    expect(challengeEntryDecision("none", undefined, "target", "paused")).toBe("enter");
  });
});
