/** Personal-best bookkeeping and the solo results table. */

import type { RaceResult } from "../shared/room"
import type { PlayerId } from "../shared/types"
import { asPlayerId } from "../shared/types"
import { isolate } from "./hebrew"
import { formatTime } from "./ui"

const BEST_TIME_KEY = "wobble-rush-3d:best"

export type BestOutcome = { readonly note: string; readonly isBest: boolean }

export function recordBest(raceMs: number, storage: Storage, courseKey?: string): BestOutcome {
  const key = courseKey === undefined ? BEST_TIME_KEY : `${BEST_TIME_KEY}:${courseKey}`
  const stored = storage.getItem(key)
  const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10)
  const previous = Number.isNaN(parsed) ? null : parsed
  const isBest = previous === null || raceMs < previous
  if (isBest) storage.setItem(key, String(Math.round(raceMs)))

  if (previous === null) return { note: "התוצאה הראשונה נשמרה. עכשיו אפשר לשפר!", isBest }
  if (isBest)
    return { note: `שיא אישי חדש! שיפור של ${isolate(formatTime(previous - raceMs))}.`, isBest }
  return { note: `השיא האישי: ${isolate(formatTime(previous))}.`, isBest }
}

export type FinisherRow = {
  readonly id: PlayerId
  readonly name: string
  readonly timeMs: number | null
}

/** Sorts finishers by time, with unfinished racers last. */
export function rankFinishers(rows: readonly FinisherRow[]): readonly RaceResult[] {
  return [...rows]
    .sort((a, b) => (a.timeMs ?? Number.POSITIVE_INFINITY) - (b.timeMs ?? Number.POSITIVE_INFINITY))
    .map((row, index) => ({ id: row.id, name: row.name, timeMs: row.timeMs, place: index + 1 }))
}

export const localFinisherId = (index: number): PlayerId => asPlayerId(`local-${index}`)
