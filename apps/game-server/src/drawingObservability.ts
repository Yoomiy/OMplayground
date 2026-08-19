import type { Room } from "./room";

export interface DrawingLogContext {
  component: "drawing-board";
  boardMode: "game" | "classroom";
  operation: string;
  classroomId?: string;
  roomCode?: string;
}

export function drawingLogContext(
  room: Pick<Room<unknown>, "drawingContext">,
  operation: string
): DrawingLogContext {
  const context = room.drawingContext;
  if (context?.boardMode === "classroom") {
    return {
      component: "drawing-board",
      boardMode: "classroom",
      operation,
      classroomId: context.classroomId,
      roomCode: context.roomCode
    };
  }
  return { component: "drawing-board", boardMode: "game", operation };
}

export function drawingSyncPhase(reason: string | undefined): "initial_sync" | "recovery_sync" {
  return reason === "join" || reason === "teacher-spectator-join"
    ? "initial_sync"
    : "recovery_sync";
}
