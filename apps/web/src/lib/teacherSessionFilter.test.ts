import { describe, expect, it } from "vitest";
import { matchesTeacherStatusFilter } from "./teacherSessionFilter";

describe("matchesTeacherStatusFilter", () => {
  it("all passes any status", () => {
    expect(matchesTeacherStatusFilter("playing", "all")).toBe(true);
    expect(matchesTeacherStatusFilter("completed", "all")).toBe(true);
    expect(matchesTeacherStatusFilter("nonsense", "all")).toBe(true);
  });

  it("matches exact session status", () => {
    expect(matchesTeacherStatusFilter("playing", "playing")).toBe(true);
    expect(matchesTeacherStatusFilter("waiting", "playing")).toBe(false);
    expect(matchesTeacherStatusFilter("paused", "paused")).toBe(true);
    expect(matchesTeacherStatusFilter("completed", "completed")).toBe(true);
  });
});
