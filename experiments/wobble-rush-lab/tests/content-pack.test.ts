import { describe, expect, test } from "bun:test"
import { RaceClock } from "../src/client/race-clock"
import { COURSES, playableCourse } from "../src/shared/course-catalog"
import { gateBoxAt, gateOpenAt } from "../src/shared/obstacles"
import { createRunner, stepRunner } from "../src/shared/player"
import { decodeServerMessage, encodeServerMessage } from "../src/shared/protocol"
import { reduceRoom } from "../src/shared/room"
import { ROUND_LIMIT_MS, sessionForRoom } from "../src/shared/session"
import { NEUTRAL_INPUT, vec3 } from "../src/shared/types"
import { createWorldSnapshot } from "../src/shared/world"
import { lobbyWithTwo, P1, P2, T0 } from "./support/room-fixtures"

describe("course pack", () => {
  test("remixes are reproducible and preserve traversable geometry", () => {
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(23)
    for (const course of COURSES) {
      const remix = playableCourse(course.id, 123)
      expect(remix).toEqual(playableCourse(course.id, 123))
      expect(remix.platforms).toEqual(course.platforms)
      expect(remix.checkpoints).toEqual(course.checkpoints)
      expect(remix.waypoints).toEqual(course.waypoints)
      expect(remix.obstacles).not.toEqual(playableCourse(course.id, 456).obstacles)
    }
  })

  test("a conveyor carries a standing runner while ordinary ground stays still", () => {
    const course = playableCourse("clockwork-crossing")
    const belt = course.obstacles.find((o) => o.kind === "conveyor")
    if (belt?.kind !== "conveyor") throw new Error("missing conveyor")
    const spawn = vec3(
      belt.box.center.x,
      belt.box.center.y + belt.box.halfExtents.y + 0.5,
      belt.box.center.z,
    )
    const sim = createRunner(spawn, 0)
    for (let i = 0; i < 60; i++)
      stepRunner(sim, NEUTRAL_INPUT, createWorldSnapshot(course, i / 60), 1 / 60, spawn)
    expect(sim.position.z - spawn.z).toBeGreaterThan(2)
    expect(sim.velocity.z).toBeCloseTo(0)
    expect(sim.grounded).toBe(true)
  })

  test("a timed gate actually blocks the route until it lifts", () => {
    const course = playableCourse("clockwork-crossing")
    const gate = course.obstacles.find((o) => o.kind === "gate")
    if (gate?.kind !== "gate") throw new Error("missing gate")
    const openTime = 1 - gate.phaseSec
    const shutTime = gate.openSec + 0.5 - gate.phaseSec
    expect(gateOpenAt(gate, openTime)).toBe(1)
    expect(gateOpenAt(gate, shutTime)).toBe(0)
    expect(gateBoxAt(gate, openTime).center.y - gateBoxAt(gate, shutTime).center.y).toBe(gate.lift)
    const desired = vec3(gate.box.center.x, 0.5, gate.box.center.z)
    const closed = createWorldSnapshot(course, shutTime).resolve(
      desired,
      desired,
      vec3(0, 0, 8),
      0.5,
    )
    const opened = createWorldSnapshot(course, openTime).resolve(
      desired,
      desired,
      vec3(0, 0, 8),
      0.5,
    )
    expect(Math.abs(closed.position.z - desired.z)).toBeGreaterThan(0.5)
    expect(opened.position.z).toBe(desired.z)
  })
})

describe("shared course selection and cup", () => {
  test("only the host configures, and course changes reset both ready checks", () => {
    let state = lobbyWithTwo()
    const selection = { courseId: "sky-hop", mode: "cup" as const, remix: true }
    expect(reduceRoom(state, { kind: "configure", id: P2, ...selection }, T0).state).toEqual(state)
    state = reduceRoom(state, { kind: "ready", id: P1, ready: true }, T0).state
    state = reduceRoom(state, { kind: "configure", id: P1, ...selection }, T0).state
    expect(state.players.every((p) => !p.ready)).toBe(true)
    const session = sessionForRoom(state)
    expect(new Set(session.playlist).size).toBe(3)
    expect(session.playlist[0]).toBe("sky-hop")
    expect(decodeServerMessage(encodeServerMessage({ type: "roster", snapshot: state }))).toEqual({
      type: "roster",
      snapshot: state,
    })
  })

  test("three rounds accumulate points once, keep a shared route, and reset after the final", () => {
    let state = reduceRoom(
      lobbyWithTwo(),
      { kind: "configure", id: P1, courseId: "clockwork-crossing", mode: "cup", remix: true },
      T0,
    ).state
    const playlist = sessionForRoom(state).playlist
    for (let round = 0; round < 3; round++) {
      const now = T0 + round * 20_000
      const expectedCourse = playlist[round]
      if (expectedCourse === undefined) throw new Error("missing cup course")
      expect(sessionForRoom(state).courseId).toBe(expectedCourse)
      state = reduceRoom(state, { kind: "ready", id: P1, ready: true }, now).state
      state = reduceRoom(state, { kind: "ready", id: P2, ready: true }, now).state
      state = reduceRoom(state, { kind: "tick" }, now + 3000).state
      state = reduceRoom(state, { kind: "finish", id: P1, timeMs: 8000 }, now + 11000).state
      const result = reduceRoom(state, { kind: "finish", id: P2, timeMs: 9000 }, now + 12000)
      state = result.state
      expect(state.phase).toBe("finished")
      expect(sessionForRoom(state).standings.map((row) => row.points)).toEqual([
        10 * (round + 1),
        8 * (round + 1),
      ])
      expect(reduceRoom(state, { kind: "finish", id: P2, timeMs: 1 }, now + 12001).state).toEqual(
        state,
      )
      expect(sessionForRoom(state).complete).toBe(round === 2)
      state = reduceRoom(state, { kind: "restart", id: P1 }, now + 13000).state
      expect(
        state.players.every((p) => !p.ready && p.state === null && p.finishedMs === null),
      ).toBe(true)
      expect(sessionForRoom(state).playlist).toEqual(
        round === 2 ? sessionForRoom(state).playlist : playlist,
      )
    }
    expect(sessionForRoom(state).round).toBe(0)
    expect(sessionForRoom(state).standings).toEqual([])
  })

  test("a round deadline records an unfinished racer with zero points", () => {
    let state = reduceRoom(
      lobbyWithTwo(),
      { kind: "configure", id: P1, courseId: "sky-hop", mode: "cup", remix: false },
      T0,
    ).state
    state = reduceRoom(state, { kind: "ready", id: P1, ready: true }, T0).state
    state = reduceRoom(state, { kind: "ready", id: P2, ready: true }, T0).state
    state = reduceRoom(state, { kind: "tick" }, T0 + 3000).state
    state = reduceRoom(state, { kind: "finish", id: P1, timeMs: 12000 }, T0 + 15000).state
    const done = reduceRoom(state, { kind: "tick" }, T0 + 3000 + ROUND_LIMIT_MS)
    expect(done.state.phase).toBe("finished")
    expect(sessionForRoom(done.state).standings.map((row) => row.points)).toEqual([10, 0])
    const effect = done.effects.find((e) => e.kind === "broadcast" && e.message.type === "results")
    expect(
      effect?.kind === "broadcast" &&
        effect.message.type === "results" &&
        effect.message.results[1]?.timeMs,
    ).toBeNull()
  })
})

test("network gates and stopwatch keep server time when rendering drops simulation steps", () => {
  let monoMs = 1000
  const clock = new RaceClock(() => monoMs)
  clock.beginCountdown(3)
  clock.syncNetworkWorld(T0, T0 + 3000, 3)
  monoMs += 3000
  clock.tick(1 / 60, false)
  expect(clock.worldTimeSec).toBe(3)
  clock.startRacing()
  monoMs += 5000
  clock.tick(1 / 60, false)
  expect(clock.worldTimeSec).toBe(8)
  expect(clock.raceMs).toBe(5000)
  clock.finish()
  monoMs += 2000
  clock.tick(1 / 60, false)
  expect(clock.raceMs).toBe(5000)
  expect(clock.worldTimeSec).toBe(10)
})
