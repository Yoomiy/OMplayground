import { describe, expect, test } from "bun:test"
import { NET } from "../src/shared/constants"
import { reduceRoom } from "../src/shared/room"
import { findDisconnect, findSend, P1, P2, P3, racingState } from "./support/room-fixtures"

describe("a finished racer is not treated as idle", () => {
  test("finishing keeps the player alive past the idle timeout", () => {
    const { state, raceStartMs } = racingState()
    const finished = reduceRoom(
      state,
      { kind: "finish", id: P1, timeMs: 30_000 },
      raceStartMs + 30_000,
    ).state

    // P1 waits for the pack while P2 remains active.
    const muchLater = raceStartMs + 30_000 + NET.timeoutSec * 1000 + 5_000
    const active = {
      ...finished,
      players: finished.players.map((p) => (p.id === P2 ? { ...p, lastSeenMs: muchLater - 1 } : p)),
    }
    const after = reduceRoom(active, { kind: "tick" }, muchLater)

    expect(after.state.players.some((p) => p.id === P1)).toBe(true)
    expect(findDisconnect(after.effects, P1)).toBeNull()
  })
})

describe("joining is only allowed while the room is open", () => {
  test("a join during a race is rejected instead of wedging the room", () => {
    const { state, raceStartMs } = racingState()
    const { state: after, effects } = reduceRoom(
      state,
      { kind: "join", id: P3, name: "Late", colorIndex: 3 },
      raceStartMs + 5_000,
    )

    expect(after.players.some((p) => p.id === P3)).toBe(false)
    const error = findSend(effects, P3)
    expect(error).not.toBeNull()
    if (error === null || error.type !== "error") throw new Error("expected an error message")
    expect(error.code).toBe("race_in_progress")
    expect(findDisconnect(effects, P3)).not.toBeNull()
  })
})

describe("restart is a member action", () => {
  test("a socket that never joined cannot reset a finished room", () => {
    const { state, raceStartMs } = racingState()
    const first = reduceRoom(
      state,
      { kind: "finish", id: P1, timeMs: 30_000 },
      raceStartMs + 30_000,
    ).state
    const finished = reduceRoom(
      first,
      { kind: "finish", id: P2, timeMs: 40_000 },
      raceStartMs + 40_000,
    ).state
    expect(finished.phase).toBe("finished")

    const outsider = reduceRoom(finished, { kind: "restart", id: P3 }, raceStartMs + 50_000)
    expect(outsider.state.phase).toBe("finished")
    expect(outsider.effects).toHaveLength(0)

    const member = reduceRoom(finished, { kind: "restart", id: P1 }, raceStartMs + 50_000)
    expect(member.state.phase).toBe("lobby")
  })
})
