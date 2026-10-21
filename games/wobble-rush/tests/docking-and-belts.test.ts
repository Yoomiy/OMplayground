import { expect, test } from "bun:test"
import { RUNNER } from "../src/shared/constants"
import { box, deck } from "../src/shared/course-builders"
import { COURSES, getCourse, tuneConveyor } from "../src/shared/course-catalog"
import { moverEnvelope, sweptMoverIntersects } from "../src/shared/mover-clearance"
import { gateOpenAt } from "../src/shared/obstacles"
import { createRunner, stepRunner } from "../src/shared/player"
import {
  asObstacleId,
  type ConveyorSpec,
  type MoverSpec,
  NEUTRAL_INPUT,
  vec3,
} from "../src/shared/types"
import { createWorldSnapshot } from "../src/shared/world"

test("sideways/reverse conveyors triple their strength and exceed running speed even in remix", () => {
  const belt: ConveyorSpec = {
    kind: "conveyor",
    id: asObstacleId("test-belt"),
    box: box(vec3(0, -0.1, 0), vec3(5, 0.15, 5)),
    velocity: vec3(0, 0, -2.5),
    color: "#fff",
  }
  for (const velocity of [vec3(0, 0, -2.5), vec3(2, 0, 0), vec3(-2, 0, 0)]) {
    const tuned = tuneConveyor({ ...belt, velocity })
    expect(Math.hypot(tuned.velocity.x, tuned.velocity.z)).toBeGreaterThanOrEqual(
      Math.hypot(velocity.x, velocity.z) * 3,
    )
    expect(Math.hypot(tuned.velocity.x, tuned.velocity.z) * 0.9).toBeGreaterThan(RUNNER.runSpeed)
  }
  expect(tuneConveyor({ ...belt, velocity: vec3(0, 0, 4) }).velocity).toEqual(vec3(0, 0, 4))
  // A diagonal road boost is forward in its own frame, not a sideways hazard.
  expect(
    tuneConveyor({ ...belt, box: { ...belt.box, yaw: Math.PI / 2 }, velocity: vec3(4, 0, 0) })
      .velocity,
  ).toEqual(vec3(4, 0, 0))
})

test("a running player must jump off counterflow rather than overpower it", () => {
  const belt: ConveyorSpec = tuneConveyor({
    kind: "conveyor",
    id: asObstacleId("reverse"),
    box: box(vec3(0, -0.1, 0), vec3(3, 0.15, 10)),
    velocity: vec3(0, 0, -3),
    color: "#fff",
  })
  const course = {
    ...getCourse("sunrise-scramble"),
    platforms: [deck("floor", "path", "#fff", -4, 4, -20, 20)],
    obstacles: [belt],
  }
  const spawn = vec3(0, 0.5, 0),
    run = createRunner(spawn, 0),
    jump = createRunner(spawn, 0)
  run.velocity.z = RUNNER.runSpeed
  jump.velocity.z = RUNNER.runSpeed
  for (let tick = 0; tick < 30; tick++) {
    const world = createWorldSnapshot(course, tick / 60)
    stepRunner(run, { ...NEUTRAL_INPUT, forward: 1 }, world, 1 / 60, spawn)
    stepRunner(
      jump,
      { ...NEUTRAL_INPUT, forward: 1, jumpPressed: tick === 2, jumpHeld: true },
      world,
      1 / 60,
      spawn,
    )
  }
  expect(run.position.z).toBeLessThan(0)
  expect(jump.position.z - run.position.z).toBeGreaterThan(2)
})

test("all moving tiles clear decks and their visual skirts throughout the complete travel segment", () => {
  let count = 0
  for (const course of COURSES) {
    const movers = course.obstacles.filter((o): o is MoverSpec => o.kind === "mover")
    for (const mover of movers) {
      count++
      for (const platform of course.platforms) {
        const skirt = {
          ...platform.box,
          center: { ...platform.box.center, y: platform.box.center.y - 0.325 },
          halfExtents: { ...platform.box.halfExtents, y: platform.box.halfExtents.y + 0.325 },
        }
        expect(
          sweptMoverIntersects(mover, skirt),
          `${course.id}: ${mover.id} crosses ${platform.id}`,
        ).toBe(false)
      }
      for (const other of movers)
        if (other !== mover)
          expect(
            sweptMoverIntersects(mover, moverEnvelope(other)),
            `${mover.id} crosses ${other.id}'s track`,
          ).toBe(false)
    }
  }
  expect(count).toBe(30)
})

test("the shared Pendulum shutter blocks every supported column after the branches reunite", () => {
  const course = getCourse("pendulum-pier"),
    gate = course.obstacles.find((o) => o.kind === "gate")
  if (gate?.kind !== "gate") throw new Error("Missing shutter")
  const closed = gate.openSec + 0.5 - gate.phaseSec,
    open = 1 - gate.phaseSec
  expect(gateOpenAt(gate, closed)).toBe(0)
  expect(gateOpenAt(gate, open)).toBe(1)
  let columns = 0
  for (let x = -20; x <= 20; x += 0.25) {
    const world = createWorldSnapshot(course, closed),
      top = world.supportHeightAt(x, gate.box.center.z, 0.5)
    if (top === null) continue
    columns++
    const p = vec3(x, top + RUNNER.radius, gate.box.center.z)
    expect(
      Math.abs(world.resolve(p, p, vec3(0, 0, 8), RUNNER.radius).position.z - p.z),
      `unblocked lane x=${x}`,
    ).toBeGreaterThan(0.1)
    expect(
      createWorldSnapshot(course, open).resolve(p, p, vec3(0, 0, 8), RUNNER.radius).position.z,
    ).toBe(p.z)
  }
  expect(columns).toBeGreaterThan(18)
})

test("continuous clearance catches an intersection between clear endpoints and separates height levels", () => {
  const mover: MoverSpec = {
    kind: "mover",
    id: asObstacleId("crossing"),
    from: vec3(-5, 0, 0),
    to: vec3(5, 0, 0),
    halfExtents: vec3(0.3, 0.3, 0.3),
    travelSec: 0.2,
    dwellSec: 0.1,
    phaseSec: 0,
    color: "#fff",
  }
  const thin = box(vec3(0, 0, 0), vec3(0.2, 0.5, 2), 0.7)
  expect(sweptMoverIntersects(mover, thin)).toBe(true)
  expect(sweptMoverIntersects({ ...mover, to: mover.from }, thin)).toBe(false)
  expect(sweptMoverIntersects({ ...mover, from: mover.to }, thin)).toBe(false)
  expect(sweptMoverIntersects(mover, { ...thin, center: vec3(0, 3.4, 0) })).toBe(false)
  expect(sweptMoverIntersects({ ...mover, from: vec3(-5, 0, 4), to: vec3(5, 0, 4) }, thin)).toBe(
    false,
  )
})
