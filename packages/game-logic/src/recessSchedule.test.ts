import {
  buildEffectiveDaySchedule,
  effectiveRecessEndsAt,
  isWithinEffectiveRecess,
  isWithinPlaygroundRecess,
  playgroundRecessEndsAt,
  type RecessScheduleSnapshot,
} from "./recessSchedule";

describe("class recess schedule resolution", () => {
  const defaultWindows = [{ day_of_week: 0, start_time: "11:55", end_time: "12:15", is_active: true }];
  const duringDefaultRecess = new Date("2026-04-19T09:00:00Z");

  it("uses the default schedule when no class override is enabled", () => {
    expect(isWithinEffectiveRecess(duringDefaultRecess, { defaultWindows })).toBe(true);
    expect(isWithinEffectiveRecess(duringDefaultRecess, {
      defaultWindows,
      classSchedule: { overrideEnabled: false, exceptions: [{ ...defaultWindows[0], mode: "class_time" }] }
    })).toBe(true);
  });

  it("lets class time cancel a default recess and class recess add one", () => {
    expect(isWithinEffectiveRecess(duringDefaultRecess, {
      defaultWindows,
      classSchedule: { overrideEnabled: true, exceptions: [{ ...defaultWindows[0], mode: "class_time" }] }
    })).toBe(false);
    expect(isWithinEffectiveRecess(new Date("2026-04-19T08:30:00Z"), {
      defaultWindows,
      classSchedule: { overrideEnabled: true, exceptions: [{ day_of_week: 0, start_time: "11:20", end_time: "11:40", is_active: true, mode: "recess" }] }
    })).toBe(true);
  });

  it("builds the effective day preview with exception precedence", () => {
    const segments = buildEffectiveDaySchedule(0, {
      defaultWindows,
      classSchedule: { overrideEnabled: true, exceptions: [{ day_of_week: 0, start_time: "12:05", end_time: "12:15", is_active: true, mode: "class_time" }] }
    });
    expect(segments).toContainEqual({ start_time: "11:55", end_time: "12:05", mode: "recess" });
    expect(segments).toContainEqual({ start_time: "12:05", end_time: "24:00", mode: "class_time" });
  });
});

describe("scheduled recess closing", () => {
  it("cuts off play one minute before the effective end of recess", () => {
    const snapshot: RecessScheduleSnapshot = {
      defaultWindows: [
        { day_of_week: 0, start_time: "11:55", end_time: "12:05", is_active: true },
        { day_of_week: 0, start_time: "12:05", end_time: "12:20", is_active: true },
      ],
      classSchedule: {
        overrideEnabled: true,
        exceptions: [
          { day_of_week: 0, start_time: "12:10", end_time: "12:15", is_active: true, mode: "class_time" },
        ],
      },
    };
    const beforeCutoff = new Date("2026-04-19T09:08:59.999Z");
    const cutoff = new Date("2026-04-19T09:09:00Z");
    expect(isWithinPlaygroundRecess(new Date("2026-04-19T09:04:00Z"), snapshot)).toBe(true);
    expect(isWithinPlaygroundRecess(beforeCutoff, snapshot)).toBe(true);
    expect(playgroundRecessEndsAt(beforeCutoff, snapshot)).toBe(cutoff.getTime());
    expect(isWithinPlaygroundRecess(cutoff, snapshot)).toBe(false);
    expect(isWithinEffectiveRecess(cutoff, snapshot)).toBe(true);
    expect(isWithinPlaygroundRecess(new Date("2026-04-19T09:15:00Z"), snapshot)).toBe(true);
  });

  it("finds the actual closing boundary, including class-time overrides", () => {
    const defaults = [{ day_of_week: 0, start_time: "11:55", end_time: "12:15", is_active: true }];
    const now = new Date("2026-04-19T09:00:00Z");
    expect(effectiveRecessEndsAt(now, { defaultWindows: defaults })).toBe(Date.parse("2026-04-19T09:15:00Z"));
    expect(effectiveRecessEndsAt(now, { defaultWindows: defaults, classSchedule: { overrideEnabled: true, exceptions: [{ day_of_week: 0, start_time: "12:05", end_time: "13:00", mode: "class_time", is_active: true }] } })).toBe(Date.parse("2026-04-19T09:05:00Z"));
  });
  it("does not close at boundaries between consecutive recess windows", () => {
    const windows = [
      { day_of_week: 0, start_time: "11:55", end_time: "12:05", is_active: true },
      { day_of_week: 0, start_time: "12:05", end_time: "12:20", is_active: true },
    ];
    expect(effectiveRecessEndsAt(new Date("2026-04-19T09:00:00Z"), { defaultWindows: windows })).toBe(Date.parse("2026-04-19T09:20:00Z"));
    expect(effectiveRecessEndsAt(new Date("2026-04-19T09:20:00Z"), { defaultWindows: windows })).toBeNull();
  });
  it("uses real instants through the repeated Jerusalem clock hour", () => {
    expect(effectiveRecessEndsAt(new Date("2026-10-24T22:50:00Z"), { defaultWindows: [{ day_of_week: 0, start_time: "01:00", end_time: "02:00", is_active: true }] })).toBe(Date.parse("2026-10-25T00:00:00Z"));
  });
});
