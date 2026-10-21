/**
 * Race-phase room reducers: authoritative finish times, post-race restart,
 * countdown transitions and membership expiry.
 */

import { NET } from "./constants"
import { completeIfDone, withCompletion } from "./room-completion"
import { errorMessage, phaseMessage, rosterMessage } from "./room-messages"
import type { Reduction, RoomAction, RoomEffect, RoomState } from "./room-types"
import { nextSession, ROUND_LIMIT_MS, sessionForRoom } from "./session"
import { assertNever } from "./types"

export function reduceFinish(
  state: RoomState,
  action: Extract<RoomAction, { kind: "finish" }>,
  nowMs: number,
): Reduction {
  if (state.phase !== "racing") {
    return { state, effects: [] }
  }
  const target = state.players.find((p) => p.id === action.id)
  if (target === undefined || target.finishedMs !== null) {
    return { state, effects: [] }
  }
  if (!Number.isFinite(action.timeMs) || action.timeMs < 0) {
    return {
      state,
      effects: [
        {
          kind: "send",
          to: action.id,
          message: errorMessage("invalid_finish", "Finish time must be a non-negative number"),
        },
      ],
    }
  }
  // A finisher may stop sending inputs, so refresh lastSeenMs here or
  // the idle sweep would evict it while it waits for the rest of the pack.
  const next: RoomState = {
    ...state,
    players: state.players.map((p) =>
      p.id === action.id ? { ...p, finishedMs: action.timeMs, lastSeenMs: nowMs } : p,
    ),
  }
  return withCompletion(next, [])
}

export function reduceRestart(
  state: RoomState,
  action: Extract<RoomAction, { kind: "restart" }>,
  nowMs: number,
): Reduction {
  if (state.phase !== "finished") {
    return { state, effects: [] }
  }
  // Only a racer in this room may reopen it — an unjoined socket must not be
  // able to wipe someone else's results.
  if (!state.players.some((p) => p.id === action.id)) {
    return { state, effects: [] }
  }
  const seed = (state.seed + 0x9e3779b9) >>> 0
  const next: RoomState = {
    ...state,
    seed,
    phase: "lobby",
    phaseEndsAtMs: null,
    session: nextSession(sessionForRoom(state), seed),
    players: state.players.map((p) => ({
      ...p,
      ready: false,
      finishedMs: null,
      state: null,
      lastSeenMs: nowMs,
    })),
  }
  // The phase broadcast is what pulls the other clients off the finish screen;
  // a roster alone leaves them stranded there.
  return {
    state: next,
    effects: [
      { kind: "broadcast", message: phaseMessage(next, nowMs) },
      { kind: "broadcast", message: rosterMessage(next) },
    ],
  }
}

export function reduceTick(state: RoomState, nowMs: number): Reduction {
  switch (state.phase) {
    case "countdown": {
      if (state.phaseEndsAtMs === null || nowMs < state.phaseEndsAtMs) {
        return { state, effects: [] }
      }
      const next: RoomState = { ...state, phase: "racing", phaseEndsAtMs: null }
      return { state: next, effects: [{ kind: "broadcast", message: phaseMessage(next, nowMs) }] }
    }
    case "racing": {
      const startsAt = sessionForRoom(state).startsAtMs
      if (startsAt !== null && nowMs - startsAt >= ROUND_LIMIT_MS)
        return completeIfDone(state, true)
      const timeoutMs = NET.timeoutSec * 1000
      const stale = state.players.filter(
        (p) => p.finishedMs === null && nowMs - p.lastSeenMs > timeoutMs,
      )
      const effects: RoomEffect[] = []
      let next = state
      if (stale.length > 0) {
        const staleIds = new Set(stale.map((p) => p.id))
        next = { ...next, players: next.players.filter((p) => !staleIds.has(p.id)) }
        // Roster goes out BEFORE the disconnects so a closing socket never
        // receives a frame after its close handshake.
        effects.push({ kind: "broadcast", message: rosterMessage(next) })
        for (const p of stale) {
          effects.push({ kind: "disconnect", id: p.id, reason: "timed out" })
        }
      }
      return withCompletion(next, effects)
    }
    case "lobby":
    case "finished":
      return { state, effects: [] }
    default:
      return assertNever(state.phase, "reduceTick")
  }
}
