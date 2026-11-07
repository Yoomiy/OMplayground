export type RoomPhase = "none" | "waiting" | "playing" | "paused" | "completed" | "unknown";
export type EntryDecision = "enter" | "confirm" | "defer" | "already-here" | "unavailable";
export function challengeEntryDecision(
  current: RoomPhase,
  currentId: string | undefined,
  targetId: string,
  targetPhase?: string,
): EntryDecision {
  if (targetPhase === "completed") return "unavailable";
  if (currentId === targetId) return "already-here";
  if (current === "completed" || current === "paused" || current === "none") return "enter";
  if (current === "waiting") return "confirm";
  return "defer";
}
