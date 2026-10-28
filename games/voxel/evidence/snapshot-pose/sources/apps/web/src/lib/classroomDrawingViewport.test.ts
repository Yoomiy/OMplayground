import { describe, expect, it } from "vitest";
import { classroomDrawingViewportRole } from "./classroomDrawingViewport";

describe("classroom drawing viewport role", () => {
  it("lets only the presenting host publish", () => {
    expect(classroomDrawingViewportRole({
      isHost: true,
      canUseWhiteboard: true,
      localIdentity: "teacher-1",
      presenterIdentity: "teacher-1"
    })).toBe("publish");
  });

  it("keeps a non-presenting cohost independent", () => {
    expect(classroomDrawingViewportRole({
      isHost: true,
      canUseWhiteboard: true,
      localIdentity: "teacher-2",
      presenterIdentity: "teacher-1"
    })).toBe("independent");
  });

  it("keeps a read-only participant following", () => {
    expect(classroomDrawingViewportRole({
      isHost: false,
      canUseWhiteboard: false,
      localIdentity: "student-1",
      presenterIdentity: "teacher-1"
    })).toBe("follow");
  });

  it("keeps a read-only participant locked when no presenter is assigned", () => {
    expect(classroomDrawingViewportRole({
      isHost: false,
      canUseWhiteboard: false,
      localIdentity: "student-1",
      presenterIdentity: null
    })).toBe("follow");
  });

  it("does not let a non-host presenter publish", () => {
    expect(classroomDrawingViewportRole({
      isHost: false,
      canUseWhiteboard: true,
      localIdentity: "student-1",
      presenterIdentity: "student-1"
    })).toBe("independent");
  });
});
