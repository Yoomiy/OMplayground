import { describe, expect, it } from "vitest";
import {
  classroomDrawingRoomCode,
  isClassroomDrawingSession
} from "./drawingSessionScope";

describe("drawing session scope", () => {
  it("recognizes classroom infrastructure sessions", () => {
    expect(isClassroomDrawingSession("class-draw-ROOM42")).toBe(true);
    expect(classroomDrawingRoomCode("class-draw-ROOM42")).toBe("ROOM42");
  });

  it("does not classify ordinary invitations or an empty suffix as classroom boards", () => {
    expect(isClassroomDrawingSession("invite-123")).toBe(false);
    expect(isClassroomDrawingSession("class-draw-")).toBe(false);
    expect(classroomDrawingRoomCode(null)).toBeNull();
  });
});
