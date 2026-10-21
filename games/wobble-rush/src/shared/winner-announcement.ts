import { isolate } from "./hebrew"
import type { RaceResult } from "./room-types"
import type { RoomSession } from "./session"

/** Use accepted results and all official cup tie-breaks, never display order/id. */
export function winnerAnnouncement(results: readonly RaceResult[], session?: RoomSession): string {
  if (session?.mode === "cup" && session.complete) {
    const first = session.standings[0]
    if (first === undefined || first.finishes === 0) return "הגביע הסתיים ללא מסיימים."
    const leaders = session.standings.filter(
      (row) =>
        row.points === first.points &&
        row.finishes === first.finishes &&
        row.totalMs === first.totalMs,
    )
    return leaders.length === 1
      ? `הזוכה בגביע: ${isolate(first.name)}!`
      : `זכייה משותפת בגביע: ${leaders.map((row) => isolate(row.name)).join(" ו־")}!`
  }
  const times = results.flatMap((result) => (result.timeMs === null ? [] : [result.timeMs]))
  if (times.length === 0) return "אין מסיימים במרוץ הזה."
  const best = Math.min(...times)
  const winners = results.filter((result) => result.timeMs === best).map((result) => result.name)
  const noun = session?.mode === "cup" ? "בסיבוב" : "במרוץ"
  return winners.length === 1
    ? `הזוכה ${noun}: ${isolate(winners[0] ?? "")}!`
    : `תיקו במקום הראשון: ${winners.map(isolate).join(" ו־")}!`
}
