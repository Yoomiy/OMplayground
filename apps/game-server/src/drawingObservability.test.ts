import { drawingLogContext, drawingSyncPhase } from "./drawingObservability";

describe("drawing observability context", () => {
  it("keeps ordinary drawing logs free of classroom identifiers", () => {
    expect(drawingLogContext({ drawingContext: { boardMode: "game" } }, "initial_sync")).toEqual({
      component: "drawing-board",
      boardMode: "game",
      operation: "initial_sync"
    });
  });

  it("includes only safe classroom identifiers", () => {
    expect(drawingLogContext({
      drawingContext: {
        boardMode: "classroom",
        classroomId: "class-uuid",
        roomCode: "ABC123"
      }
    }, "checkpoint_persist")).toEqual({
      component: "drawing-board",
      boardMode: "classroom",
      operation: "checkpoint_persist",
      classroomId: "class-uuid",
      roomCode: "ABC123"
    });
  });

  it("classifies join sync separately from recovery sync", () => {
    expect(drawingSyncPhase("join")).toBe("initial_sync");
    expect(drawingSyncPhase("teacher-spectator-join")).toBe("initial_sync");
    expect(drawingSyncPhase("payload-too-large")).toBe("recovery_sync");
  });
});
