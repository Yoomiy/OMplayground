import { buildEffectiveDaySchedule, isWithinEffectiveRecess } from "./recessSchedule";

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
