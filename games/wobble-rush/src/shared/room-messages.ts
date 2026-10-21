/**
 * Server-message builders for the room state machine: roster, phase, error,
 * and final accepted race results.
 */

import type { ServerMessage } from "./protocol"
import type { RaceResult, RoomPlayer, RoomState } from "./room-types"
import { sessionForRoom } from "./session"

export function rosterMessage(state: RoomState): ServerMessage {
  return { type: "roster", snapshot: state }
}

export function phaseMessage(state: RoomState, nowMs: number): ServerMessage {
  return {
    type: "phase",
    phase: state.phase,
    serverNowMs: nowMs,
    phaseEndsAtMs: state.phaseEndsAtMs,
    seed: state.seed,
    session: sessionForRoom(state),
  }
}

export function errorMessage(code: string, message: string): ServerMessage {
  return { type: "error", code, message }
}

export function buildResults(players: readonly RoomPlayer[]): readonly RaceResult[] {
  const sorted = [...players].sort((a, b) => {
    if (a.finishedMs === null) return b.finishedMs === null ? 0 : 1
    if (b.finishedMs === null) return -1
    return a.finishedMs - b.finishedMs
  })
  return sorted.map((p, index) => ({
    id: p.id,
    name: p.name,
    timeMs: p.finishedMs,
    place: index + 1,
  }))
}
