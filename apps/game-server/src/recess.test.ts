import { isWithinRecess } from "./recess";

describe("recessMiddleware (Israel clock)", () => {
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

  it("rejects kid outside schedule windows when no row matches", () => {
    const schedules = [
      {
        day_of_week: 0,
        start_time: "10:00",
        end_time: "10:01",
        is_active: true
      }
    ];
    const d = new Date("2026-04-16T12:00:00Z");
    expect(isWithinRecess(d, schedules)).toBe(false);
  });
});
