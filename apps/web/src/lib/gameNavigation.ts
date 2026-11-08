export type RoomPhase = "none" | "solo" | "classroom" | "waiting" | "playing" | "paused" | "completed" | "unknown";
export type EntryDecision = "enter" | "confirm" | "defer" | "retry" | "already-here" | "unavailable";

/** Local activities have no multiplayer room status to look up. */
export function gameActivityForPath(pathname: string): { sessionId?: string; phase: RoomPhase } {
  if (/^\/play(?:\/|$)/.test(pathname))
    return { sessionId: pathname.split("/")[2] || undefined, phase: "unknown" };
  if (/^\/solo(?:\/|$)/.test(pathname)) return { phase: "solo" };
  if (/^\/classroom(?:\/|$)/.test(pathname)) return { phase: "classroom" };
  return { phase: "none" };
}

export function roomPhaseFromResponse(data: unknown): RoomPhase {
  if (data === null) return "completed";
  if (typeof data !== "object" || !data || !("status" in data)) return "unknown";
  const status = data.status;
  return status === "waiting" || status === "playing" || status === "paused" || status === "completed"
    ? status
    : "unknown";
}
export function challengeEntryDecision(
  current: RoomPhase,
  currentId: string | undefined,
  targetId: string,
  targetPhase?: string,
  intent: "enter" | "accept" = "enter",
): EntryDecision {
  if (targetPhase === "completed") return "unavailable";
  if (currentId === targetId) return "already-here";
  if (current === "completed" || current === "paused" || current === "none") return "enter";
  if (current === "waiting" || current === "solo") return "confirm";
  if (current === "playing" && intent === "accept") return "confirm";
  if (current === "unknown") return "retry";
  return "defer";
}
