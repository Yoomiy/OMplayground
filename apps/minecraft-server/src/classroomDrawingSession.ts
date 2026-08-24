export interface ClassroomDrawingOwner {
  id: string;
  room_code: string;
  teacher_id: string | null;
  teacher_name: string;
}

export function classroomDrawingSessionInsert(classroom: ClassroomDrawingOwner, gameId: string) {
  return {
    game_id: gameId,
    classroom_id: classroom.id,
    host_id: classroom.teacher_id,
    host_name: classroom.teacher_name || "לוח כיתה",
    player_ids: [] as string[],
    player_names: [] as string[],
    status: "playing",
    is_open: true,
    invitation_code: `class-draw-${classroom.room_code}`,
    gender: "all"
  };
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}
