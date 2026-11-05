import { afterEach, beforeEach, expect, it, vi } from "vitest";

const createElement = vi.fn();
beforeEach(() => {
  vi.resetModules();
  createElement.mockReset().mockReturnValue({ getContext: () => null });
  vi.stubGlobal("document", { createElement });
  vi.stubGlobal("navigator", {
    platform: "Linux", vendor: "", userAgent: "Chrome/130.0.1",
    languages: ["he", "en"], hardwareConcurrency: 8, maxTouchPoints: 0,
  });
  vi.stubGlobal("screen", { width: 1920, height: 1080, colorDepth: 24 });
});
afterEach(() => vi.unstubAllGlobals());

it("computes browser signals once and scopes hashes to each room", async () => {
  const { classroomGuestFingerprint } = await import("./classroomGuestFingerprint");
  const one = await classroomGuestFingerprint("one");
  expect(one).toMatch(/^v1:[a-f0-9]{64}$/);
  expect(await classroomGuestFingerprint("one")).toBe(one);
  expect(await classroomGuestFingerprint("two")).not.toBe(one);
  expect(createElement).toHaveBeenCalledTimes(1);
});

it("is reproducible after a reload without cookies or local storage", async () => {
  const first = await (await import("./classroomGuestFingerprint")).classroomGuestFingerprint("one");
  vi.resetModules();
  expect(await (await import("./classroomGuestFingerprint")).classroomGuestFingerprint("one")).toBe(first);
});

it("tolerates restricted canvas access", async () => {
  createElement.mockImplementation(() => { throw new Error("canvas blocked"); });
  const { classroomGuestFingerprint } = await import("./classroomGuestFingerprint");
  expect(await classroomGuestFingerprint("one")).toMatch(/^v1:[a-f0-9]{64}$/);
});

it("silently returns no fingerprint if hashing fails", async () => {
  vi.stubGlobal("crypto", { subtle: { digest: vi.fn().mockRejectedValue(new Error("unavailable")) } });
  const { classroomGuestFingerprint } = await import("./classroomGuestFingerprint");
  expect(await classroomGuestFingerprint("one")).toBeUndefined();
});

it("silently returns no fingerprint if room hashing fails", async () => {
  vi.stubGlobal("crypto", { subtle: { digest: vi.fn()
    .mockResolvedValueOnce(new Uint8Array(32).buffer)
    .mockRejectedValueOnce(new Error("unavailable")) } });
  const { classroomGuestFingerprint } = await import("./classroomGuestFingerprint");
  expect(await classroomGuestFingerprint("one")).toBeUndefined();
});
