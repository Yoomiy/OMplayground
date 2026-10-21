import { expect, test } from "bun:test"
import { FIXED_STEP_SEC, RUNNER } from "../src/shared/constants"
import { createRunner, stepRunnerMotion } from "../src/shared/player"
import { asObstacleId, type CourseDefinition, NEUTRAL_INPUT, vec3 } from "../src/shared/types"
import { createWorldSnapshot } from "../src/shared/world"
import { course } from "./support/world-fixtures"

const wall = {
  id: asObstacleId("thin-wall"),
  kind: "decor" as const,
  color: "white",
  box: { center: vec3(0, 1, 0), halfExtents: vec3(0.04, 2, 10), yaw: 0 },
}
const thin: CourseDefinition = { ...course, platforms: [wall], obstacles: [] }

test("a dive hitting a thin barrier stays on the approach side instead of popping through its centre", () => {
  const sim = createRunner(vec3(-0.5, 1, 0), Math.PI / 2)
  sim.velocity.x = RUNNER.runSpeed
  stepRunnerMotion(
    sim,
    { ...NEUTRAL_INPUT, forward: 1, cameraYaw: Math.PI / 2, divePressed: true },
    createWorldSnapshot(thin, 0),
    FIXED_STEP_SEC,
    thin.spawn,
  )
  expect(sim.position.x).toBeLessThanOrEqual(-0.04 - RUNNER.radius + 1e-9)
  expect(sim.velocity.x).toBeLessThanOrEqual(1e-9)
})

test("an entire thin surface cannot be skipped by fast motion or a long collision query", () => {
  const world = createWorldSnapshot(thin, 0)
  const contact = world.resolve(vec3(-2, 1, 0), vec3(2, 1, 1), vec3(21, 0, 5), RUNNER.radius)
  expect(contact.position.x).toBeLessThanOrEqual(-0.04 - RUNNER.radius + 1e-9)
  expect(contact.position.z).toBeCloseTo(1)
  expect(contact.velocity.z).toBe(5)
})

test("conveyor carry is collision-checked once, without adding a second belt displacement", () => {
  const belt = {
    kind: "conveyor" as const,
    id: asObstacleId("belt"),
    box: { center: vec3(-2, -0.2, 0), halfExtents: vec3(3, 0.2, 10), yaw: 0 },
    velocity: vec3(12, 0, 0),
    color: "blue",
  }
  const c = { ...thin, obstacles: [belt] }
  const sim = createRunner(vec3(-0.5, RUNNER.radius, 0), 0)
  stepRunnerMotion(sim, NEUTRAL_INPUT, createWorldSnapshot(c, 0), FIXED_STEP_SEC, c.spawn)
  expect(sim.position.x).toBeLessThanOrEqual(-0.04 - RUNNER.radius + 1e-9)
  const free = createRunner(vec3(-2, RUNNER.radius, 0), 0)
  stepRunnerMotion(free, NEUTRAL_INPUT, createWorldSnapshot(c, 0), FIXED_STEP_SEC, c.spawn)
  expect(free.position.x).toBeCloseTo(-2 + 12 * FIXED_STEP_SEC)
})

test("terminal-speed falls land on the top of thin decks", () => {
  const c = {
    ...thin,
    platforms: [
      { ...wall, box: { center: vec3(0, -0.05, 0), halfExtents: vec3(10, 0.05, 10), yaw: 0 } },
    ],
  }
  const sim = createRunner(vec3(0, 0.46, 0), 0)
  sim.velocity.y = -RUNNER.maxFallSpeed
  stepRunnerMotion(sim, NEUTRAL_INPUT, createWorldSnapshot(c, 0), FIXED_STEP_SEC, c.spawn)
  expect(sim.position.y).toBeCloseTo(RUNNER.radius)
  expect(sim.grounded).toBe(true)
  expect(sim.velocity.y).toBe(0)
})

test("checking carry must not cancel a descending elevator's movement against itself", () => {
  const elevator = {
    kind: "mover" as const,
    id: asObstacleId("lift"),
    from: vec3(0, 4, 0),
    to: vec3(0, 0, 0),
    halfExtents: vec3(2, 0.2, 2),
    travelSec: 2,
    dwellSec: 0.2,
    phaseSec: 0,
    color: "blue",
  }
  const c = { ...thin, platforms: [], obstacles: [elevator] },
    time = 1
  const world = createWorldSnapshot(c, time)
  const sim = createRunner(vec3(0, 2 + 0.2 + RUNNER.radius, 0), 0)
  const before = sim.position.y
  stepRunnerMotion(sim, NEUTRAL_INPUT, world, FIXED_STEP_SEC, c.spawn)
  expect(sim.carry.y).toBeLessThan(0)
  expect(sim.position.y).toBeCloseTo(before + sim.carry.y * FIXED_STEP_SEC)
})

test("a closing gate ejects a waiting runner sideways instead of crushing it through the deck", () => {
  const gate = {
    kind: "gate" as const,
    id: asObstacleId("shutter"),
    box: { center: vec3(0, 1.5, 0), halfExtents: vec3(3, 1.5, 0.25), yaw: 0 },
    lift: 4.6,
    periodSec: 5.4,
    openSec: 2.7,
    phaseSec: 0,
    color: "blue",
  }
  const c = {
    ...thin,
    platforms: [
      { ...wall, box: { center: vec3(0, -0.1, 0), halfExtents: vec3(10, 0.1, 10), yaw: 0 } },
    ],
    obstacles: [gate],
  }
  const sim = createRunner(vec3(0, RUNNER.radius, -0.05), 0)
  for (let tick = 135; tick < 170; tick++) {
    const events = stepRunnerMotion(
      sim,
      NEUTRAL_INPUT,
      createWorldSnapshot(c, tick * FIXED_STEP_SEC),
      FIXED_STEP_SEC,
      c.spawn,
    )
    expect(events.some((event) => event.kind === "respawn")).toBe(false)
    expect(sim.position.y).toBeGreaterThanOrEqual(RUNNER.radius - 1e-8)
  }
  expect(Math.abs(sim.position.z)).toBeGreaterThanOrEqual(0.25 + RUNNER.radius - 1e-8)
})
