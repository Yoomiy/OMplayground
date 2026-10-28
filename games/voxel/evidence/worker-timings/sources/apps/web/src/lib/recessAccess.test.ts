import { describe, expect, it } from "vitest";
import { isKidAllowedByRecess } from "./recessAccess";

describe("isKidAllowedByRecess", () => {
  it("fails closed when no active schedules are loaded", () => {
    expect(isKidAllowedByRecess([], new Date("2026-04-19T09:00:00Z"))).toBe(
      false
    );
  });

  it("allows kids inside a matching Jerusalem recess window", () => {
    expect(
      isKidAllowedByRecess(
        [
          {
            day_of_week: 0,
            start_time: "11:55",
            end_time: "12:05",
            is_active: true
          }
        ],
        new Date("2026-04-19T09:00:00Z")
      )
    ).toBe(true);
  });

  it("denies kids outside active recess windows", () => {
    expect(
      isKidAllowedByRecess(
        [
          {
            day_of_week: 0,
            start_time: "10:00",
            end_time: "10:15",
            is_active: true
          }
        ],
        new Date("2026-04-19T09:00:00Z")
      )
    ).toBe(false);
  });
});
