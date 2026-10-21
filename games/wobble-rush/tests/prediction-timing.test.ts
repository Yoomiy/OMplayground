import { expect, test } from "bun:test"
import type { ActionInput, AuthorityFrame } from "../src/shared/action-protocol"
import { AuthoritativeRace } from "../src/shared/authoritative-race"
import { SUNRISE_SCRAMBLE } from "../src/shared/course"
import { createRunner } from "../src/shared/player"
import { MAX_PREDICTION_LEAD_TICKS, RunnerPrediction } from "../src/shared/prediction"
import type { CourseDefinition, PlayerInput } from "../src/shared/types"
import { asObstacleId, asPlayerId, NEUTRAL_INPUT, vec3 } from "../src/shared/types"

const id = asPlayerId("timing")
const course: CourseDefinition = {
  ...SUNRISE_SCRAMBLE,
  spawn: vec3(0, 0.45, 0),
  spawnYaw: 0,
  obstacles: [],
  platforms: [
    {
      id: asObstacleId("floor"),
      kind: "path",
      color: "white",
      box: { center: vec3(0, -0.5, 0), halfExtents: vec3(100, 0.5, 100), yaw: 0 },
    },
  ],
  checkpoints: [],
  finish: { center: vec3(0, 1, 90), halfExtents: vec3(1, 1, 1), yaw: 0 },
}
const setup = () => {
  const race = new AuthoritativeRace(
    "timing",
    course,
    [{ id, name: "Timing", colorIndex: 0 }],
    7,
    0,
  )
  const sim = createRunner(course.spawn, 0)
  let now = 0
  const prediction = new RunnerPrediction(() => now)
  const reconcile = (frame = race.frame("racing", now), delay = 0) => {
    const actor = frame.actors[0]
    if (!actor) throw new Error("Missing actor")
    return prediction.reconcile(sim, frame, actor, course, delay)
  }
  reconcile()
  const advance = (input: PlayerInput = NEUTRAL_INPUT, respawn = false) => {
    const next = prediction.advance(sim, input, respawn, course)
    if (!next) throw new Error("Missing prediction")
    return next.message
  }
  return {
    race,
    sim,
    prediction,
    reconcile,
    advance,
    time: (ms: number) => {
      now = ms
    },
  }
}

// Ordered delivery models a WebSocket/TCP path, including jitter and packet bunching.
for (const [up, down, jitter] of [
  [1, 1, 0],
  [3, 3, 0],
  [6, 6, 0],
  [9, 9, 0],
  [6, 2, 3],
  [2, 6, 3],
  [9, 3, 3],
] as const) {
  test(`jump, release, dive and steering stay exact at ${up}/${down} ticks delay + ${jitter} jitter`, () => {
    const s = setup(),
      outbound: { at: number; message: ActionInput }[] = [],
      inbound: { at: number; frame: AuthorityFrame }[] = []
    // Calibrate before play, as a real client does during the three-second countdown.
    s.reconcile(s.race.frame("countdown", 0), (up + down + jitter * 2) / 120)
    s.reconcile(s.race.frame("racing", 0), (up + down + jitter * 2) / 120)
    let lastUp = 0,
      lastDown = 0,
      maxCorrection = 0,
      comparisons = 0
    for (let n = 0; n < 900; n++) {
      s.time((n * 1000) / 60)
      const phase = n % 90
      const input = {
        ...NEUTRAL_INPUT,
        forward: n % 240 < 120 ? 1 : -1,
        strafe: n % 180 < 90 ? 0.4 : -0.4,
        cameraYaw: 0.2,
        jumpPressed: phase === 30,
        jumpHeld: phase >= 30 && phase < (n % 180 < 90 ? 35 : 50),
        divePressed: phase === 55 && n % 180 < 90,
      }
      const message = s.advance(input)
      lastUp = Math.max(lastUp, n + up + ((n * 7) % (jitter + 1)))
      outbound.push({ at: lastUp, message })
      while (outbound[0] && outbound[0].at <= n) {
        const next = outbound.shift()
        if (next) s.race.enqueue(id, next.message)
      }
      s.race.step()
      if (n % 3 === 0) {
        lastDown = Math.max(lastDown, n + down + ((n * 5) % (jitter + 1)))
        inbound.push({ at: lastDown, frame: s.race.frame("racing", (n * 1000) / 60) })
      }
      while (inbound[0] && inbound[0].at <= n) {
        const next = inbound.shift()
        if (!next) throw new Error("Missing frame")
        const before = { ...s.sim.position }
        const tick = s.prediction.tick
        s.reconcile(next.frame, (up + down + jitter * 2) / 120)
        // No invented physics time on ordinary corrections.
        expect(s.prediction.tick).toBe(tick)
        maxCorrection = Math.max(
          maxCorrection,
          Math.hypot(
            before.x - s.sim.position.x,
            before.y - s.sim.position.y,
            before.z - s.sim.position.z,
          ),
        )
        comparisons++
      }
    }
    expect(comparisons).toBeGreaterThan(290)
    expect(maxCorrection).toBeLessThan(1e-8)
    expect(s.prediction.historyCount).toBeLessThanOrEqual(MAX_PREDICTION_LEAD_TICKS)
  })
}

test("future controls retain the exact short jump/release sequence when delivered in a burst", () => {
  const race = new AuthoritativeRace(
    "timing",
    course,
    [{ id, name: "Timing", colorIndex: 0 }],
    7,
    0,
  )
  const reference = new AuthoritativeRace(
    "timing",
    course,
    [{ id, name: "Timing", colorIndex: 0 }],
    7,
    0,
  )
  const inputs = [10, 11, 12, 13, 14].map((tick, seq) => ({
    type: "input" as const,
    raceId: "timing",
    seq: seq + 1,
    tick,
    respawn: false,
    input: { ...NEUTRAL_INPUT, jumpPressed: tick === 10, jumpHeld: tick < 12 },
  }))
  for (const message of inputs) race.enqueue(id, message)
  for (let tick = 1; tick <= 40; tick++) {
    for (const message of inputs) if (message.tick === tick) reference.enqueue(id, message)
    race.step()
    reference.step()
    expect(race.frame("racing", 0).actors.map(({ plannedInputs: _, ...actor }) => actor)).toEqual(
      reference.frame("racing", 0).actors.map(({ plannedInputs: _, ...actor }) => actor),
    )
  }
})

test("late controls coalesce once, impossible future controls cannot advance the host", () => {
  const s = setup()
  for (let i = 0; i < 30; i++) s.race.step()
  for (let seq = 1; seq <= 240; seq++)
    s.race.enqueue(id, {
      type: "input",
      raceId: "timing",
      seq,
      tick: 1,
      respawn: false,
      input: { ...NEUTRAL_INPUT, jumpPressed: seq === 1 },
    })
  expect(
    s.race.enqueue(id, {
      type: "input",
      raceId: "timing",
      seq: 241,
      tick: 10000,
      respawn: false,
      input: NEUTRAL_INPUT,
    }),
  ).toBe(false)
  s.race.step()
  const frame = s.race.frame("racing", 0)
  expect(frame.tick).toBe(31)
  expect(frame.actors[0]?.ack).toBe(240)
  expect(frame.actors[0]?.sim.velocity.y).toBeGreaterThan(0)
  s.reconcile(frame)
  expect(s.prediction.pendingCount).toBe(0)
  const before = structuredClone(s.sim)
  expect(s.reconcile({ ...frame, tick: 1 })).toBeNull()
  expect(s.sim).toEqual(before)
})

test("missing snapshots freeze within a bounded history, then rebase without a reconnect", () => {
  const s = setup()
  for (let seq = 0; seq < 300; seq++) s.advance({ ...NEUTRAL_INPUT, forward: 1 })
  expect(s.prediction.pendingCount).toBe(300)
  expect(s.prediction.historyCount).toBeLessThanOrEqual(MAX_PREDICTION_LEAD_TICKS)
  expect(s.prediction.frozen).toBe(true)
  const before = structuredClone(s.sim)
  s.advance()
  expect(s.sim).toEqual(before)
  for (let i = 0; i < 90; i++) s.race.step()
  s.time(1500)
  s.reconcile()
  expect(s.prediction.frozen).toBe(false)
  expect(s.prediction.tick).toBeGreaterThan(s.race.tick)
  expect(s.prediction.historyCount).toBe(0)
})

test("server truth repairs tampered prediction and an authoritative respawn starts a new presentation epoch", () => {
  const s = setup()
  for (let n = 0; n < 80; n++) {
    s.race.enqueue(id, s.advance({ ...NEUTRAL_INPUT, forward: 1 }, n === 40))
    s.race.step()
    s.reconcile()
    if (n === 46) expect(s.prediction.lastReconcile.respawned).toBe(true)
  }
  s.sim.position.z = 10000
  s.reconcile()
  expect(s.sim.position.z).toBeLessThan(20)
})

test("obstacle presentation shares local interpolation and cannot outrun frozen physics", () => {
  const s = setup()
  s.time(100)
  s.advance()
  expect(s.prediction.renderAt(100)).toBeCloseTo(3 + (s.prediction.tick - 1) / 60)
  expect(s.prediction.renderAt(96)).toBeCloseTo(3 + (s.prediction.tick - 1) / 60 - 0.004)
  s.time(140)
  expect(s.prediction.renderAt(100 + 1000 / 120)).toBeCloseTo(3 + (s.prediction.tick - 0.5) / 60)
  s.time(100 + 1000 / 120)
  expect(s.prediction.renderAt(100 + 1000 / 120)).toBeCloseTo(3 + (s.prediction.tick - 0.5) / 60)
  for (let seq = 0; seq < 80; seq++) s.advance()
  expect(s.prediction.frozen).toBe(true)
  s.time(5000)
  expect(s.prediction.renderAt(5000)).toBeCloseTo(3 + s.prediction.tick / 60)
  s.time(10000)
  expect(s.prediction.renderAt(10000)).toBeCloseTo(3 + s.prediction.tick / 60)
})
