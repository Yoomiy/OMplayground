import { expect, test } from "bun:test"
import type { ActionInput, AuthorityFrame } from "../src/shared/action-protocol"
import { decodeActionServerMessage } from "../src/shared/action-protocol"
import { AuthoritativeRace } from "../src/shared/authoritative-race"
import { RUNNER } from "../src/shared/constants"
import { SUNRISE_SCRAMBLE } from "../src/shared/course"
import { createRunner } from "../src/shared/player"
import { RunnerPrediction } from "../src/shared/prediction"
import type { CourseDefinition, PlayerInput, RunnerSim } from "../src/shared/types"
import { asObstacleId, asPlayerId, NEUTRAL_INPUT, vec3 } from "../src/shared/types"

const ids = [asPlayerId("a"), asPlayerId("b")] as const
const floor: CourseDefinition = {
  ...SUNRISE_SCRAMBLE,
  spawn: vec3(0, 0.45, 0),
  spawnYaw: 0,
  platforms: [
    {
      id: asObstacleId("floor"),
      kind: "path",
      color: "white",
      box: { center: vec3(0, -0.5, 0), halfExtents: vec3(100, 0.5, 100), yaw: 0 },
    },
  ],
  obstacles: [],
  checkpoints: [],
  waypoints: [],
  finish: { center: vec3(90, 1, 90), halfExtents: vec3(1, 1, 1), yaw: 0 },
}
const barCourse: CourseDefinition = {
  ...floor,
  obstacles: [
    {
      kind: "sweeper",
      id: asObstacleId("constant-bar"),
      pivot: vec3(0, 0.6, 8),
      armLength: 7,
      centered: true,
      armHalfThickness: 0.2,
      armHalfHeight: 0.25,
      angularVelocityDeg: 100,
      phaseDeg: 40,
      knockbackSpeed: 10,
      knockbackLift: 5,
      color: "red",
    },
  ],
}
const modeInput = (mode: string, index: number, tick: number): PlayerInput => {
  if (mode === "bar") return { ...NEUTRAL_INPUT, forward: 1 }
  if (mode === "crossing") {
    if (tick < (index === 0 ? 70 : 60))
      return { ...NEUTRAL_INPUT, forward: index === 0 ? -1 : 0, strafe: index === 1 ? -1 : 0 }
    if (tick < 140) return NEUTRAL_INPUT
    return { ...NEUTRAL_INPUT, forward: index === 0 ? 1 : 0, strafe: index === 1 ? 1 : 0 }
  }
  if (mode === "shove" && index === 1) return NEUTRAL_INPUT
  const away = tick < 100
  return { ...NEUTRAL_INPUT, strafe: (index === 0 ? 1 : -1) * (away ? 1 : -1) }
}

for (const profile of [
  [3, 3, 3, 3, 0],
  [6, 2, 2, 6, 2],
] as const) {
  for (const mode of ["head-on", "crossing", "shove", "bar"]) {
    test(`${mode}: two clients share contact ticks under ${profile.join("/")} delay/jitter`, () => {
      const course = mode === "bar" ? barCourse : floor
      const race = new AuthoritativeRace(
        "contacts",
        course,
        ids.map((id) => ({ id, name: id, colorIndex: 0 })),
        7,
        0,
      )
      let nowMs = 0
      const clients = ids.map((id, index) => ({
        id,
        prediction: new RunnerPrediction(() => nowMs),
        sim: createRunner(course.spawn, 0),
        up: index === 0 ? profile[0] : profile[2],
        down: index === 0 ? profile[1] : profile[3],
        outbound: [] as { at: number; input: ActionInput }[],
        inbound: [] as { at: number; frame: AuthorityFrame }[],
        lastUp: 0,
        lastDown: 0,
        lastSent: -100,
        lastInput: "",
        predictedContacts: new Set<number>(),
        records: [] as { tick: number; actors: { id: string; sim: RunnerSim }[] }[],
        corrections: [] as number[],
      }))
      const truth = new Map<number, AuthorityFrame>()
      const contactTicks = new Set<number>()
      let barHits = 0
      for (const client of clients) {
        const frame = race.frame("racing", 0),
          actor = frame.actors.find((actor) => actor.id === client.id)
        if (!actor) throw new Error("Missing actor")
        client.prediction.reconcile(
          client.sim,
          frame,
          actor,
          course,
          (client.up + client.down + profile[4] * 2) / 120,
        )
      }
      for (let n = 0; n < 550; n++) {
        nowMs = (n * 1000) / 60
        for (const [index, client] of clients.entries()) {
          const input = modeInput(mode, index, client.prediction.tick + 1)
          const result = client.prediction.advance(client.sim, input, false, course)
          if (!result) throw new Error("Prediction missing")
          for (const bump of result.bumps)
            if (bump.speed > 1) client.predictedContacts.add(client.prediction.tick)
          // Match the real transport's sparse held refresh and immediate changes.
          if (n - client.lastSent >= 6 || JSON.stringify(input) !== client.lastInput) {
            client.lastSent = n
            client.lastInput = JSON.stringify(input)
            client.lastUp = Math.max(client.lastUp, n + client.up + (n % (profile[4] + 1)))
            client.outbound.push({ at: client.lastUp, input: result.message })
          }
          if (client.prediction.tick >= 160)
            client.records.push({
              tick: client.prediction.tick,
              actors: client.prediction.predictedActors.map((actor) => ({
                id: actor.id,
                sim: structuredClone(actor.sim),
              })),
            })
          while (client.outbound[0] && client.outbound[0].at <= n) {
            const packet = client.outbound.shift()
            if (packet) race.enqueue(client.id, packet.input)
          }
        }
        const events = race.step()
        if (events.bumps.length) contactTicks.add(race.tick)
        for (const list of events.events.values())
          barHits += list.filter((event) => event.kind === "hit").length
        const frame = race.frame("racing", nowMs)
        truth.set(race.tick, frame)
        for (const client of clients) {
          if (n % 3 === 0) {
            client.lastDown = Math.max(
              client.lastDown,
              n + client.down + ((n * 7) % (profile[4] + 1)),
            )
            client.inbound.push({ at: client.lastDown, frame })
          }
          while (client.inbound[0] && client.inbound[0].at <= n) {
            const packet = client.inbound.shift()
            if (!packet) throw new Error("Missing frame")
            const actor = packet.frame.actors.find((actor) => actor.id === client.id)
            if (!actor) throw new Error("Missing actor")
            const before = { ...client.sim.position }
            client.prediction.reconcile(
              client.sim,
              packet.frame,
              actor,
              course,
              (client.up + client.down + profile[4] * 2) / 120,
            )
            if (n > 150)
              client.corrections.push(
                Math.hypot(
                  before.x - client.sim.position.x,
                  before.y - client.sim.position.y,
                  before.z - client.sim.position.z,
                ),
              )
          }
        }
      }
      for (const client of clients) {
        let comparisons = 0,
          maxError = 0
        for (const record of client.records) {
          const frame = truth.get(record.tick)
          if (!frame) continue
          for (const predicted of record.actors) {
            const actor = frame.actors.find((actor) => actor.id === predicted.id)
            if (!actor) throw new Error("Missing authority")
            maxError = Math.max(
              maxError,
              Math.hypot(
                predicted.sim.position.x - actor.sim.position.x,
                predicted.sim.position.y - actor.sim.position.y,
                predicted.sim.position.z - actor.sim.position.z,
              ),
            )
            comparisons++
          }
          const [a, b] = record.actors
          if (a && b)
            expect(
              Math.hypot(
                a.sim.position.x - b.sim.position.x,
                a.sim.position.y - b.sim.position.y,
                a.sim.position.z - b.sim.position.z,
              ),
            ).toBeGreaterThan(RUNNER.radius * 2 - 0.005)
        }
        expect(comparisons).toBeGreaterThan(700)
        expect(maxError).toBeLessThan(1e-7)
        expect(Math.max(...client.corrections)).toBeLessThan(1e-7)
        if (mode !== "bar") {
          expect(client.predictedContacts.size).toBeGreaterThan(0)
          expect([...client.predictedContacts].some((tick) => contactTicks.has(tick))).toBe(true)
        }
      }
      if (mode === "bar") expect(barHits).toBeGreaterThan(0)
    })
  }
}

test("NPC decisions, moving obstacles and crowd contacts replay from authoritative brain state", () => {
  const race = new AuthoritativeRace(
    "npcs",
    SUNRISE_SCRAMBLE,
    [{ id: ids[0], name: "Human", colorIndex: 0 }],
    7,
    2,
  )
  const prediction = new RunnerPrediction(() => 0),
    sim = createRunner(SUNRISE_SCRAMBLE.spawn, 0)
  let comparisons = 0
  for (let cycle = 0; cycle < 70; cycle++) {
    const frame = race.frame("racing", 0),
      self = frame.actors.find((actor) => actor.id === ids[0])
    if (!self) throw new Error("Missing actor")
    prediction.clear()
    prediction.reconcile(sim, frame, self, SUNRISE_SCRAMBLE, 0.15)
    while (race.tick < prediction.tick) race.step()
    const actual = race.frame("racing", 0)
    for (const actor of prediction.predictedActors) {
      const authority = actual.actors.find((other) => other.id === actor.id)
      if (authority === undefined) throw new Error("Missing authority")
      expect(actor.sim).toEqual(authority.sim)
      expect(actor.brain).toEqual(authority.brain)
      expect(actor.respawnSeq).toBe(authority.respawnSeq)
      comparisons++
    }
  }
  expect(comparisons).toBe(210)
})

test("replicated future controls preserve a remote jump/release/dive without guessing their edges", () => {
  const race = new AuthoritativeRace(
    "edges",
    floor,
    ids.map((id) => ({ id, name: id, colorIndex: 0 })),
    7,
    0,
  )
  for (const command of [
    { seq: 1, tick: 4, input: { ...NEUTRAL_INPUT, forward: 1, jumpPressed: true, jumpHeld: true } },
    { seq: 2, tick: 8, input: { ...NEUTRAL_INPUT, forward: 1 } },
    { seq: 3, tick: 12, input: { ...NEUTRAL_INPUT, forward: 1, divePressed: true } },
  ])
    race.enqueue(ids[1], { ...command, type: "input", raceId: race.raceId, respawn: false })
  const frame = race.frame("racing", 0)
  const decoded = decodeActionServerMessage(JSON.stringify(frame))
  if (decoded.type !== "frame") throw new Error("Missing decoded frame")
  expect(decoded.actors[1]?.plannedInputs).toHaveLength(3)
  const self = decoded.actors.find((actor) => actor.id === ids[0])
  if (!self) throw new Error("Missing actor")
  const prediction = new RunnerPrediction(() => 0),
    sim = createRunner(floor.spawn, 0)
  prediction.reconcile(sim, decoded, self, floor, 0.15)
  while (race.tick < prediction.tick) race.step()
  const truth = race.frame("racing", 0)
  for (const actor of prediction.predictedActors) {
    const actual = truth.actors.find((other) => other.id === actor.id)
    if (!actual) throw new Error("Missing actor")
    expect(actor.sim).toEqual(actual.sim)
    expect(actor.ack).toBe(actual.ack)
  }
  expect(prediction.predictedActors[1]?.sim.position.z).not.toBe(decoded.actors[1]?.sim.position.z)
})

test("a snapshot outage freezes every predicted actor and the obstacle clock at the same bound", () => {
  let now = 0
  const race = new AuthoritativeRace(
    "outage",
    SUNRISE_SCRAMBLE,
    [{ id: ids[0], name: "Human", colorIndex: 0 }],
    7,
  )
  const frame = race.frame("racing", 0),
    self = frame.actors[0]
  if (!self) throw new Error("Missing actor")
  const prediction = new RunnerPrediction(() => now),
    sim = createRunner(SUNRISE_SCRAMBLE.spawn, 0)
  prediction.reconcile(sim, frame, self, SUNRISE_SCRAMBLE)
  while (!prediction.frozen) {
    now += 1000 / 60
    prediction.advance(sim, { ...NEUTRAL_INPUT, forward: 1 }, false, SUNRISE_SCRAMBLE, now)
  }
  now += 100
  const actors = structuredClone(prediction.predictedActors),
    clock = prediction.renderAt(now)
  for (let i = 0; i < 180; i++) {
    now += 1000 / 60
    prediction.advance(sim, { ...NEUTRAL_INPUT, forward: 1 }, false, SUNRISE_SCRAMBLE, now)
    expect(prediction.predictedActors).toEqual(actors)
    expect(prediction.renderAt(now)).toBe(clock)
  }
  expect(prediction.tick).toBe(48)
})
