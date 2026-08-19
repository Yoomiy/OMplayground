export const CLASSROOM_DRAWING_INVITATION_PREFIX = "class-draw-";

export function classroomDrawingRoomCode(invitationCode: unknown): string | null {
  if (
    typeof invitationCode !== "string" ||
    !invitationCode.startsWith(CLASSROOM_DRAWING_INVITATION_PREFIX)
  ) {
    return null;
  }
  const roomCode = invitationCode.slice(CLASSROOM_DRAWING_INVITATION_PREFIX.length);
  return roomCode || null;
}

export function isClassroomDrawingSession(invitationCode: unknown): boolean {
  return classroomDrawingRoomCode(invitationCode) !== null;
}
