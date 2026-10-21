/**
 * Race-completion transition: when every remaining racer has a finish time,
 * close the race and broadcast the results.
 */

import { buildResults } from "./room-messages"
import type { Reduction, RoomEffect, RoomState } from "./room-types"
import { scoreRound, sessionForRoom } from "./session"

/**
 * When every remaining racer has a finish time, close the race and broadcast
 * the results. Returns the input untouched otherwise.
 */
export function completeIfDone(state: RoomState, timedOut = false): Reduction {
  if (state.phase !== "racing") return { state, effects: [] }
  if (state.players.length === 0) return { state, effects: [] }
  if (!timedOut && !state.players.every((p) => p.finishedMs !== null)) return { state, effects: [] }
  const results = buildResults(state.players)
  const next: RoomState = {
    ...state,
    phase: "finished",
    session: scoreRound(sessionForRoom(state), results),
  }
  return {
    state: next,
    effects: [{ kind: "broadcast", message: { type: "results", results, session: next.session } }],
  }
}

/** Append a completion transition (if any) onto an in-progress reduction. */
export function withCompletion(state: RoomState, effects: RoomEffect[]): Reduction {
  const completion = completeIfDone(state)
  return { state: completion.state, effects: [...effects, ...completion.effects] }
}
