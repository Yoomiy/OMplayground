import { expect, test } from "bun:test"
import { RUNNER } from "../src/shared/constants"
import { deck } from "../src/shared/course-builders"
import { getCourse, playableCourse } from "../src/shared/course-catalog"
import {
  createNpcRacers,
  npcInput,
  rewindNpcAfterRespawn,
  updateNpcProgress,
} from "../src/shared/npc"
import { moverBoxAt, moverVelocityAt } from "../src/shared/obstacles"
import { createRunner, stepRunner } from "../src/shared/player"
import { asObstacleId, type MoverSpec, NEUTRAL_INPUT, vec3 } from "../src/shared/types"
import { createWorldSnapshot } from "../src/shared/world"

const asymmetric: MoverSpec = {
  kind: "mover",
  id: asObstacleId("test-shuttle"),
  from: vec3(0, 0, 0),
  to: vec3(0, 0, 12),
  halfExtents: vec3(2, 0.35, 2),
  travelSec: 3,
  returnTravelSec: 1,
  dwellSec: 0.5,
  phaseSec: 0,
  color: "#fff",
}

test("asymmetric movers have a three-times-faster return and continuous endpoint dwells", () => {
  expect(moverBoxAt(asymmetric, 3).center.z).toBe(12)
  expect(moverBoxAt(asymmetric, 3.49).center.z).toBe(12)
  expect(moverBoxAt(asymmetric, 4).center.z).toBe(6)
  expect(moverBoxAt(asymmetric, 4.5).center.z).toBe(0)
  expect(moverBoxAt(asymmetric, 5).center.z).toBe(0)
  expect(Math.abs(moverVelocityAt(asymmetric, 4).z)).toBeCloseTo(
    moverVelocityAt(asymmetric, 1.5).z * 3,
  )
  for (const time of [0, 0.5, 1.5, 2.9, 3, 3.5, 3.6, 4, 4.5, 5, 5.5]) {
    const a = moverBoxAt(asymmetric, time - 1e-5).center.z
    const b = moverBoxAt(asymmetric, time + 1e-5).center.z
    expect((b - a) / 2e-5).toBeCloseTo(moverVelocityAt(asymmetric, time).z, 2)
    expect(moverBoxAt(asymmetric, time - 5).center.z).toBeCloseTo(
      moverBoxAt(asymmetric, time).center.z,
    )
  }
})

test("ferries and lifts retain their pre-misunderstanding travel and boarding rhythm", () => {
  const shuttle = getCourse("sky-transfer").obstacles.find(
    (o) => o.kind === "mover" && o.from.x !== o.to.x,
  )
  if (shuttle?.kind !== "mover") throw new Error("Missing shuttle")
  expect(shuttle.travelSec).toBeCloseTo(7 * 0.7)
  expect(shuttle.returnTravelSec).toBeUndefined()
  const lift = getCourse("lift-lock").obstacles[0]
  if (lift?.kind !== "mover") throw new Error("Missing lift")
  expect(lift.travelSec).toBeCloseTo(3.4 * 0.7)
  expect(lift.dwellSec).toBeCloseTo(1.7 * 0.65)
})

test("each essential elevator carries a stationary runner above normal jump height", () => {
  for (const id of ["lift-lock", "sky-transfer"]) {
    const course = getCourse(id)
    for (const lift of course.obstacles.filter(
      (o) => o.kind === "mover" && o.to.y - o.from.y > 5,
    )) {
      if (lift.kind !== "mover") continue
      const spawn = vec3(lift.from.x, lift.from.y + lift.halfExtents.y + RUNNER.radius, lift.from.z)
      const sim = createRunner(spawn, 0)
      let maxY = sim.position.y
      for (let tick = 0; tick < 180; tick++) {
        stepRunner(
          sim,
          NEUTRAL_INPUT,
          createWorldSnapshot(course, tick / 60 - lift.phaseSec),
          1 / 60,
          spawn,
        )
        maxY = Math.max(maxY, sim.position.y)
      }
      expect(maxY - spawn.y).toBeGreaterThan(5)
      // No static landing secretly occupies the lower lift shaft.
      const withoutLift = { ...course, obstacles: course.obstacles.filter((o) => o.id !== lift.id) }
      expect(
        createWorldSnapshot(withoutLift, 0).supportHeightAt(spawn.x, spawn.z, spawn.y),
      ).toBeNull()
    }
  }
})

test("Spiral's ground route boards the elevator before reaching the first checkpoint", () => {
  for (const remix of [false, true]) {
    const course = playableCourse("spiral-summit", remix ? 42 : null)
    const lift = course.obstacles.find((o) => o.kind === "mover")
    if (lift?.kind !== "mover") throw new Error("Missing Spiral elevator")
    const withoutLift = { ...course, obstacles: course.obstacles.filter((o) => o.id !== lift.id) }
    const staticWorld = createWorldSnapshot(withoutLift, 0)
    // The old direct ground exit and the shaft must both be actual void.
    expect(staticWorld.supportHeightAt(-7.5, 58, 0.45)).toBeNull()
    expect(staticWorld.supportHeightAt(lift.from.x, lift.from.z, 0.45)).toBeNull()
    const npc = createNpcRacers(course, 42, 1)[0]
    if (!npc) throw new Error("Missing ground-route racer")
    const sim = createRunner(course.spawn, course.spawnYaw)
    let boardedLow = false
    let rodeHigh = false
    for (let tick = 0; tick < 60 * 60 && sim.checkpoint < 1; tick++) {
      const time = tick / 60
      const world = createWorldSnapshot(course, time)
      const events = stepRunner(
        sim,
        npcInput(npc, sim, course, world, time),
        world,
        1 / 60,
        course.spawn,
      )
      if (events.some((e) => e.kind === "respawn")) rewindNpcAfterRespawn(npc, sim, course)
      updateNpcProgress(npc, sim, course, 1 / 60)
      const box = moverBoxAt(lift, time)
      const feet = sim.position.y - RUNNER.radius
      const aboard =
        sim.grounded &&
        Math.abs(feet - box.center.y - box.halfExtents.y) < 0.1 &&
        Math.abs(sim.position.x - box.center.x) < box.halfExtents.x &&
        Math.abs(sim.position.z - box.center.z) < box.halfExtents.z
      if (aboard && feet < 1) boardedLow = true
      if (aboard && feet > 3.5) rodeHigh = true
    }
    expect(boardedLow).toBe(true)
    expect(rodeHigh).toBe(true)
    expect(Number(sim.checkpoint)).toBe(1)
  }
})

test("a ferry keeps carrying its rider while crossing a coplanar causeway", () => {
  const base = getCourse("pendulum-pier")
  const mover = base.obstacles.find((o) => o.kind === "mover")
  if (mover?.kind !== "mover") throw new Error("Missing ferry")
  const time = mover.travelSec / 2 - mover.phaseSec
  const box = moverBoxAt(mover, time)
  const position = vec3(
    box.center.x,
    box.center.y + box.halfExtents.y + RUNNER.radius,
    box.center.z,
  )
  const course = {
    ...base,
    platforms: [deck("crossing-dock", "path", "#fff", -1, 1, box.center.z - 8, box.center.z + 8)],
  }
  const contact = createWorldSnapshot(course, time).resolve(
    position,
    vec3(position.x, position.y - 0.01, position.z),
    vec3(0, -1, 0),
    RUNNER.radius,
  )
  expect(contact.grounded).toBe(true)
  expect(contact.carry).toEqual(moverVelocityAt(mover, time))
  expect(contact.carry.x).toBeGreaterThan(4)
})
