/** Matches `public.game_session_status` in the database. */
export type GameSessionStatus =
  | "waiting"
  | "playing"
  | "paused"
  | "completed";

export type TeacherSessionStatusFilter = "all" | GameSessionStatus;

export function matchesTeacherStatusFilter(
  status: string,
  filter: TeacherSessionStatusFilter
): boolean {
  if (filter === "all") return true;
  return status === filter;
}
