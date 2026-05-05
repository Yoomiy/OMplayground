import { isWithinRecess } from "./recess";

describe("isWithinRecess (Israel clock) — voxel server", () => {
  it("fails closed when no active schedules are loaded", () => {
    const d = new Date("2026-04-16T12:00:00Z");
    expect(isWithinRecess(d, [])).toBe(false);
  });

  it("allows kid when current time is inside an active schedule window", () => {
    const schedules = Array.from({ length: 7 }, (_, day_of_week) => ({
      day_of_week,
      start_time: "00:00",
      end_time: "23:59",
      is_active: true
    }));
    const d = new Date("2026-04-16T12:00:00Z");
    expect(isWithinRecess(d, schedules)).toBe(true);
  });
});
