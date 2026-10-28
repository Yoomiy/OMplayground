import { describe, expect, it } from "vitest";
import { formatClassroomActivity } from "./classroomActivityTime";

const now = new Date(2026, 7, 24, 15, 0, 0);

describe("formatClassroomActivity", () => {
  it("uses relative labels for activity from today", () => {
    expect(formatClassroomActivity(new Date(2026, 7, 24, 14, 59, 30).toISOString(), now)).toBe("עכשיו");
    expect(formatClassroomActivity(new Date(2026, 7, 24, 14, 58).toISOString(), now)).toBe("לפני 2 דקות");
    expect(formatClassroomActivity(new Date(2026, 7, 24, 13).toISOString(), now)).toBe("לפני שעתיים");
  });

  it("uses a calendar-aware yesterday label and recent-day labels", () => {
    expect(formatClassroomActivity(new Date(2026, 7, 23, 14, 30).toISOString(), now)).toBe("אתמול, 14:30");
    expect(formatClassroomActivity(new Date(2026, 7, 22, 15).toISOString(), now)).toBe("לפני יומיים");
    expect(formatClassroomActivity(new Date(2026, 7, 17, 15).toISOString(), now)).toBe("לפני 7 ימים");
  });

  it("falls back to the full timestamp outside the recent window and for future dates", () => {
    expect(formatClassroomActivity(new Date(2026, 7, 16, 15).toISOString(), now)).toBe("16.08.2026, 15:00");
    expect(formatClassroomActivity(new Date(2026, 7, 25, 15).toISOString(), now)).toBe("25.08.2026, 15:00");
  });

  it("handles missing and invalid timestamps", () => {
    expect(formatClassroomActivity(null, now)).toBe("—");
    expect(formatClassroomActivity("not-a-date", now)).toBe("—");
  });
});
