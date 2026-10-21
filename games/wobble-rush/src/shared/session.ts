import { COURSE_PACK_VERSION, COURSES, getCourse } from "./course-catalog"
import { hashString, mulberry32 } from "./rng"
import type { RaceResult, RoomState } from "./room-types"
import type { PlayerId } from "./types"

export type RaceSelection = { courseId: string; mode: "race" | "cup"; remix: boolean }
export type CupStanding = {
  id: PlayerId
  name: string
  points: number
  finishes: number
  totalMs: number
}
export type RoomSession = RaceSelection & {
  contentVersion: string
  round: number
  playlist: string[]
  standings: CupStanding[]
  complete: boolean
  startsAtMs: number | null
}
export const ROUND_LIMIT_MS = 180_000
export const DEFAULT_SELECTION: RaceSelection = {
  courseId: COURSES[0]?.id ?? "sunrise-scramble",
  mode: "race",
  remix: false,
}

export function createSession(
  seed: number,
  selection: RaceSelection = DEFAULT_SELECTION,
): RoomSession {
  getCourse(selection.courseId)
  const rng = mulberry32((seed ^ hashString(selection.courseId)) >>> 0)
  const rest = COURSES.filter((c) => c.id !== selection.courseId).map((c) => c.id)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = rest[i]
    const b = rest[j]
    if (a !== undefined && b !== undefined) {
      rest[i] = b
      rest[j] = a
    }
  }
  return {
    courseId: selection.courseId,
    mode: selection.mode,
    remix: selection.remix,
    contentVersion: COURSE_PACK_VERSION,
    round: 0,
    playlist:
      selection.mode === "cup" ? [selection.courseId, ...rest.slice(0, 2)] : [selection.courseId],
    standings: [],
    complete: false,
    startsAtMs: null,
  }
}

export const sessionForRoom = (room: RoomState): RoomSession =>
  room.session ?? createSession(room.seed)

export function scoreRound(session: RoomSession, results: readonly RaceResult[]): RoomSession {
  if (session.mode !== "cup") return { ...session, complete: true }
  const standings = session.standings.map((row) => ({ ...row }))
  for (const result of results) {
    let row = standings.find((r) => r.id === result.id)
    if (row === undefined) {
      row = { id: result.id, name: result.name, points: 0, finishes: 0, totalMs: 0 }
      standings.push(row)
    }
    if (result.timeMs !== null) {
      const place = results.filter(
        (r) => r.timeMs !== null && r.timeMs < (result.timeMs ?? 0),
      ).length
      row.points += [10, 8, 6, 5, 4, 3, 2, 1][place] ?? 1
      row.finishes++
      row.totalMs += result.timeMs
    }
  }
  standings.sort(
    (a, b) =>
      b.points - a.points ||
      b.finishes - a.finishes ||
      a.totalMs - b.totalMs ||
      a.id.localeCompare(b.id),
  )
  return { ...session, standings, complete: session.round === session.playlist.length - 1 }
}

export function nextSession(session: RoomSession, seed: number): RoomSession {
  if (session.mode !== "cup" || session.complete)
    return createSession(seed, { ...session, courseId: session.playlist[0] ?? session.courseId })
  const round = session.round + 1
  return {
    ...session,
    round,
    courseId: session.playlist[round] ?? session.courseId,
    startsAtMs: null,
  }
}
