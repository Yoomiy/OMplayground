export interface PlatformMember {
  userId: string
  name: string
  colorIndex: number
  connected: boolean
  loaded: boolean
  pending: boolean
  /** An expired initial-lobby reservation may be reclaimed before the race starts. */
  lobbyRejoin?: boolean
}
export interface WobbleView {
  version: 1
  sessionId: string
  selfUserId: string
  actorId: string | null
  hostUserId: string
  observer: boolean
  pending: boolean
  /** Rostered player host: configure, start and advance races. Staff observation grants none. */
  canControl: boolean
  /** Staff moderation also permits pause/resume/end independently of race control. */
  canModerate: boolean
  paused: boolean
  saved: boolean
  ended: boolean
  phase: "lobby" | "countdown" | "racing" | "finished"
  courseId: string
  mode: "race" | "cup"
  remix: boolean
  round: number
  complete: boolean
  playlist: string[]
  players: PlatformMember[]
  observers: { userId: string; name: string; role: "teacher" | "admin" }[]
  results: { id: string; name: string; timeMs: number | null; place: number }[]
  standings: { id: string; name: string; points: number; finishes: number; totalMs: number }[]
  winnerText: string
  rematch: { requestedBy: string; accepted: string[]; refused: string[] } | null
}

export type WobbleControl =
  | {
      action:
        | "loaded"
        | "start"
        | "next"
        | "pause"
        | "resume"
        | "end"
        | "rematch"
        | "accept-rematch"
        | "decline-rematch"
    }
  | { action: "color"; colorIndex: number }
  | { action: "remove"; userId: string }
  | { action: "configure"; courseId: string; mode: "race" | "cup"; remix: boolean }

/** The iframe and the app use the same bounded, dependency-free view check. */
export function isWobbleView(value: unknown, sessionId: string): value is WobbleView {
  if (!value || typeof value !== "object") return false
  const view = value as WobbleView
  const id = (value: unknown): value is string =>
    typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
  const name = (value: unknown): value is string => typeof value === "string" && value.length <= 80
  return (
    view.version === 1 &&
    typeof view.winnerText === "string" &&
    view.winnerText.length <= 1024 &&
    view.sessionId === sessionId &&
    id(view.selfUserId) &&
    id(view.hostUserId) &&
    (view.actorId === null || id(view.actorId)) &&
    [
      "observer",
      "pending",
      "canControl",
      "canModerate",
      "paused",
      "saved",
      "ended",
      "complete",
      "remix",
    ].every((key) => typeof view[key as keyof WobbleView] === "boolean") &&
    ["lobby", "countdown", "racing", "finished"].includes(view.phase) &&
    ["race", "cup"].includes(view.mode) &&
    typeof view.courseId === "string" &&
    view.courseId.length <= 64 &&
    Number.isInteger(view.round) &&
    view.round >= 0 &&
    view.round <= 2 &&
    Array.isArray(view.playlist) &&
    view.playlist.length >= 1 &&
    view.playlist.length <= 3 &&
    view.playlist.every((course) => typeof course === "string" && course.length <= 64) &&
    Array.isArray(view.players) &&
    view.players.length <= 8 &&
    view.players.every(
      (player) =>
        player &&
        id(player.userId) &&
        name(player.name) &&
        Number.isInteger(player.colorIndex) &&
        player.colorIndex >= 0 &&
        player.colorIndex < 8 &&
        typeof player.connected === "boolean" &&
        typeof player.loaded === "boolean" &&
        typeof player.pending === "boolean",
    ) &&
    new Set(view.players.map((player) => player.userId)).size === view.players.length &&
    Array.isArray(view.observers) &&
    view.observers.length <= 8 &&
    view.observers.every(
      (player) =>
        player &&
        id(player.userId) &&
        name(player.name) &&
        ["teacher", "admin"].includes(player.role),
    ) &&
    Array.isArray(view.results) &&
    view.results.length <= 8 &&
    view.results.every(
      (row) =>
        row &&
        id(row.id) &&
        name(row.name) &&
        Number.isInteger(row.place) &&
        row.place > 0 &&
        row.place <= 8 &&
        (row.timeMs === null ||
          (Number.isFinite(row.timeMs) && row.timeMs >= 0 && row.timeMs <= 180_000)),
    ) &&
    Array.isArray(view.standings) &&
    view.standings.length <= 24 &&
    view.standings.every(
      (row) =>
        row &&
        id(row.id) &&
        name(row.name) &&
        Number.isInteger(row.points) &&
        row.points >= 0 &&
        Number.isInteger(row.finishes) &&
        row.finishes >= 0 &&
        Number.isFinite(row.totalMs) &&
        row.totalMs >= 0,
    ) &&
    (view.rematch === null ||
      (view.rematch &&
        id(view.rematch.requestedBy) &&
        Array.isArray(view.rematch.accepted) &&
        view.rematch.accepted.length <= 8 &&
        view.rematch.accepted.every(id) &&
        Array.isArray(view.rematch.refused) &&
        view.rematch.refused.length <= 8 &&
        view.rematch.refused.every(id)))
  )
}
