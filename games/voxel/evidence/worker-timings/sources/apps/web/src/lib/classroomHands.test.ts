import { afterEach, describe, expect, it, vi } from "vitest";
import { receiveClassroomHandMessage, requestClassroomHandStates } from "./classroomHands";

describe("classroom hand synchronization", () => {
  it("hydrates a late joiner with each peer's own state, including lowered hands", () => {
    const existing = new Map([["student", true]]);
    const newcomer = new Map<string, boolean>();
    const reply = vi.fn((message, destination) => {
      expect(destination).toBe("newcomer");
      receiveClassroomHandMessage(newcomer, message, "student", "newcomer", vi.fn());
    });
    receiveClassroomHandMessage(existing, { type: "HAND_STATE_REQUEST" }, "newcomer", "student", reply);
    expect(newcomer.get("student")).toBe(true);
    existing.set("student", false);
    receiveClassroomHandMessage(existing, { type: "HAND_STATE_REQUEST" }, "newcomer", "student", reply);
    expect(newcomer.get("student")).toBe(false);
  });

  it("uses the authenticated sender rather than a claimed target", () => {
    const hands = new Map([["other-student", true]]);
    const message = { type: "HAND_RAISE", handRaised: false, targetIdentity: "other-student" };
    receiveClassroomHandMessage(hands, message, "sender", "teacher", vi.fn());
    expect(hands.get("other-student")).toBe(true);
    expect(hands.get("sender")).toBe(false);
  });

  it("rejects malformed or unattributed messages without changing state or replying", () => {
    const hands = new Map([["student", true]]);
    const reply = vi.fn();
    for (const handRaised of ["false", 0, null, undefined]) {
      expect(receiveClassroomHandMessage(hands, { type: "HAND_RAISE", handRaised }, "student", "teacher", reply)).toBe(false);
    }
    receiveClassroomHandMessage(hands, { type: "HAND_RAISE", handRaised: false }, undefined, "teacher", reply);
    receiveClassroomHandMessage(hands, { type: "HAND_STATE_REQUEST" }, undefined, "teacher", reply);
    expect(hands.get("student")).toBe(true);
    expect(reply).not.toHaveBeenCalled();
  });
});


describe("hand state request timing", () => {
  afterEach(() => vi.useRealTimers());

  it("hydrates after the initial request is missed during joining", async () => {
    vi.useFakeTimers();
    const peer = new Map([["student", true]]);
    const newcomer = new Map<string, boolean>();
    let ready = false;
    const send = vi.fn(async () => {
      if (!ready) return;
      receiveClassroomHandMessage(peer, { type: "HAND_STATE_REQUEST" }, "newcomer", "student", (message) => {
        receiveClassroomHandMessage(newcomer, message, "student", "newcomer", vi.fn());
      });
    });
    requestClassroomHandStates(send, vi.fn());
    expect(newcomer.size).toBe(0);
    ready = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(newcomer.get("student")).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("cancels the retry on leaving and reports a failed send", async () => {
    vi.useFakeTimers();
    const error = new Error("disconnected");
    const send = vi.fn().mockRejectedValue(error);
    const report = vi.fn();
    const cancel = requestClassroomHandStates(send, report);
    cancel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(error);
  });
});
