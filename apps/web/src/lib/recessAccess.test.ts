import { describe, expect, it } from "vitest";
import {
  isKidAllowedByRecess,
  accessAfterCheck,
  type PlaygroundAccessResult,
} from "./recessAccess";

describe("isKidAllowedByRecess", () => {
  it("fails closed when no active schedules are loaded", () => {
    expect(isKidAllowedByRecess([], new Date("2026-04-19T09:00:00Z"))).toBe(
      false,
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
            is_active: true,
          },
        ],
        new Date("2026-04-19T09:00:00Z"),
      ),
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
            is_active: true,
          },
        ],
        new Date("2026-04-19T09:00:00Z"),
      ),
    ).toBe(false);
  });
});

it("retains known access during a temporary failure without extending recess", () => {
  const allowed: PlaygroundAccessResult = {
    allowed: true,
    role: "kid",
    expiresAt: 2000,
  };
  const unavailable: PlaygroundAccessResult = {
    allowed: false,
    reason: "profile_error",
    message: "Temporary failure",
  };
  expect(accessAfterCheck(allowed, unavailable, 1500)).toEqual(allowed);
  expect(accessAfterCheck(allowed, unavailable, 2000)).toMatchObject({
    allowed: false,
    reason: "outside_recess",
  });
  expect(accessAfterCheck(null, unavailable, 1500)).toEqual(unavailable);
});
it("confirmed denials replace earlier access and an outage cannot undo a denial", () => {
  const allowed: PlaygroundAccessResult = {
    allowed: true,
    role: "kid",
    expiresAt: 2000,
  };
  const denied: PlaygroundAccessResult = {
    allowed: false,
    role: "kid",
    reason: "outside_recess",
    message: "Closed",
  };
  const unavailable: PlaygroundAccessResult = {
    allowed: false,
    reason: "schedule_error",
    message: "Unavailable",
  };
  expect(accessAfterCheck(allowed, denied, 1000)).toEqual(denied);
  expect(accessAfterCheck(denied, unavailable, 1000)).toEqual(denied);
});
