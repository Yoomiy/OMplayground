import { describe, expect, test } from "bun:test"
import { beltMarkers } from "../src/shared/belt-markers"
import { box, deck } from "../src/shared/course-builders"
import { COURSES, getCourse } from "../src/shared/course-catalog"
import { createNpcRacers, rewindNpcAfterRespawn } from "../src/shared/npc"
import { createRunner, stepRunner } from "../src/shared/player"
import { markerFits, routeMarkers } from "../src/shared/route-markers"
import { asCheckpointIndex, NEUTRAL_INPUT, vec3 } from "../src/shared/types"
import { createWorldSnapshot } from "../src/shared/world"

test("rotated ground probes agree with actual collision, including the empty mirrored footprint", () => {
  for (const yaw of [0.6, -0.6, 1.2, -1.2]) {
    const course = {
      ...getCourse("sunrise-scramble"),
      obstacles: [],
      platforms: [
        {
          ...deck("probe", "path", "#fff", -0.7, 0.7, -5, 5),
          box: box(vec3(0, -0.35, 0), vec3(0.7, 0.35, 5), yaw),
        },
      ],
    }
    const world = createWorldSnapshot(course, 0)
    for (const along of [-4, -2, 2, 4]) {
      const x = Math.sin(yaw) * along,
        z = Math.cos(yaw) * along
      expect(world.supportHeightAt(x, z, 1)).toBe(0)
      expect(world.resolve(vec3(x, 0.4, z), vec3(x, 0.4, z), vec3(0, -1, 0), 0.45).grounded).toBe(
        true,
      )
      expect(world.supportHeightAt(-x, z, 1)).toBeNull()
    }
  }
})

describe("paint stays on the walking surface", () => {
  for (const course of COURSES)
    test(course.id, () => {
      const markers = routeMarkers(course)
      if (course.navigation !== undefined) {
        expect(markers.length).toBeGreaterThan(0)
        expect(markers.length).toBeLessThan(course.platforms.length)
      }
      for (const marker of markers)
        expect(course.platforms.some((p) => markerFits(marker, p.box))).toBe(true)
      for (const belt of course.obstacles) {
        if (belt.kind !== "conveyor") continue
        for (const time of [0, 0.13, 0.5, 1.7, 4, 7.3, 12])
          for (const marker of beltMarkers(belt, time))
            expect(markerFits({ ...marker, width: 1.2 * marker.scale }, belt.box)).toBe(true)
      }
    })
})

test("crossing bridges provide separate supported heights and standing clearance", () => {
  const world = createWorldSnapshot(getCourse("cloudline-fork"), 0)
  expect(world.supportHeightAt(0, 28, 0.45)).toBe(0)
  expect(world.supportHeightAt(0, 28, 3.5)).toBeCloseTo(3.4)
  const result = world.resolve(vec3(0, 0.45, 28), vec3(0, 0.4, 28), vec3(0, -1, 8), 0.45)
  expect(result.position.y).toBeCloseTo(0.45)
  expect(result.velocity.z).toBe(8)
})

test("backtracking roads rewind to their checkpoint's exact waypoint", () => {
  const course = getCourse("canopy-switch"),
    npc = createNpcRacers(course, 7, 1)[0]
  if (npc === undefined) throw new Error("Missing pilot")
  const sim = createRunner(course.checkpoints[1]?.respawn ?? course.spawn, 0)
  sim.checkpoint = asCheckpointIndex(1)
  npc.waypointIndex = 99
  rewindNpcAfterRespawn(npc, sim, course)
  expect(npc.waypointIndex).toBe(course.routes?.[0]?.checkpointWaypoints?.[1] ?? -1)
  const route = course.routes?.[0]?.waypoints ?? []
  expect(
    route.slice(npc.waypointIndex + 1).some((p, i, rest) => i > 0 && p.z < (rest[i - 1]?.z ?? p.z)),
  ).toBe(true)
})

describe("marked gate escapes use ordinary jump and late dive inputs", () => {
  for (const course of COURSES)
    for (const [index, cut] of (course.shortcuts ?? []).entries())
      for (const phase of [0, 1.7, 3.5, 6.25])
        test(`${course.id} cut ${index} phase ${phase}`, () => {
          const dx = cut.to.x - cut.from.x,
            dz = cut.to.z - cut.from.z,
            length = Math.hypot(dx, dz)
          const yaw = Math.atan2(dx, dz)
          const spawn = vec3(
            cut.from.x - (dx / length) * 1.2,
            cut.from.y + 0.45,
            cut.from.z - (dz / length) * 1.2,
          )
          const sim = createRunner(spawn, yaw)
          sim.velocity.x = (dx / length) * 8.2
          sim.velocity.z = (dz / length) * 8.2
          let jumped = false,
            dived = false,
            landed = false,
            fallen = false
          for (let tick = 0; tick < 120; tick++) {
            const along =
              ((sim.position.x - cut.from.x) * dx) / length +
              ((sim.position.z - cut.from.z) * dz) / length
            const events = stepRunner(
              sim,
              {
                forward: along > length + 0.4 ? 0 : 1,
                strafe: 0,
                cameraYaw: yaw,
                jumpPressed: tick === 9,
                jumpHeld: true,
                divePressed: cut.dive && tick === 39,
              },
              createWorldSnapshot(course, phase + tick / 60),
              1 / 60,
              spawn,
            )
            jumped ||= events.some((e) => e.kind === "jump")
            dived ||= events.some((e) => e.kind === "dive")
            fallen ||= events.some((e) => e.kind === "respawn")
            if (jumped && sim.grounded && along >= length - 0.6) {
              landed = true
              break
            }
          }
          expect(jumped).toBe(true)
          expect(dived).toBe(cut.dive)
          expect(fallen).toBe(false)
          expect(landed).toBe(true)
        })
})

test("the dock elevator carries a standing runner toward its connected high pier", () => {
  const course = getCourse("harbor-hoppers")
  const lift = course.obstacles.find((o) => o.kind === "mover" && o.to.y > o.from.y + 3)
  if (lift?.kind !== "mover") throw new Error("Missing lift")
  const spawn = vec3(lift.from.x, lift.from.y + lift.halfExtents.y + 0.45, lift.from.z)
  const sim = createRunner(spawn, 0)
  for (let tick = 0; tick < 30; tick++)
    stepRunner(sim, NEUTRAL_INPUT, createWorldSnapshot(course, tick / 60), 1 / 60, spawn)
  expect(sim.position.y - spawn.y).toBeGreaterThan(1)
  expect(Math.abs(sim.position.x - spawn.x)).toBeLessThan(0.6)
  expect(createWorldSnapshot(course, 0).supportHeightAt(-11, spawn.z, 4)).toBeCloseTo(3.4)
})
