import { describe, expect, test } from "bun:test"
import { RUNNER } from "../src/shared/constants"
import { COURSES } from "../src/shared/course-catalog"
import { sweeperAngleAt, sweeperArmAt } from "../src/shared/obstacles"
import { createRunner, stepRunner } from "../src/shared/player"
import { vec3 } from "../src/shared/types"
import { createWorldSnapshot } from "../src/shared/world"

// Use ordinary held-jump inputs, gravity, collision and acceleration. Each marked
// crossing must work uphill AND downhill, without dive, movers or checkpoint resets.
describe("branch transfers", () => {
  for (const course of COURSES)
    for (const [index, transfer] of (course.transfers ?? []).entries()) {
      for (const reverse of [false, true])
        for (const phase of [0, 1.7, 3.5, 6.25])
          test(`${course.id} transfer ${index} ${reverse ? "return" : "outbound"} phase ${phase}`, () => {
            const from = reverse ? transfer.to : transfer.from,
              to = reverse ? transfer.from : transfer.to
            const dx = to.x - from.x,
              dz = to.z - from.z,
              length = Math.hypot(dx, dz)
            const dir = vec3(dx / length, 0, dz / length)
            const spawn = vec3(from.x - dir.x * 1.2, from.y + RUNNER.radius, from.z - dir.z * 1.2)
            const sim = createRunner(spawn, Math.atan2(dx, dz))
            sim.velocity.x = dir.x * RUNNER.runSpeed
            sim.velocity.z = dir.z * RUNNER.runSpeed
            let landed = false,
              jumped = false,
              fallen = false
            for (let tick = 0; tick < 90; tick++) {
              const events = stepRunner(
                sim,
                {
                  forward: 1,
                  strafe: 0,
                  cameraYaw: Math.atan2(dx, dz),
                  jumpPressed: tick === 9,
                  jumpHeld: true,
                  divePressed: false,
                },
                createWorldSnapshot(course, phase + tick / 60),
                1 / 60,
                spawn,
              )
              jumped ||= events.some((e) => e.kind === "jump")
              fallen ||= events.some((e) => e.kind === "respawn")
              const along = (sim.position.x - from.x) * dir.x + (sim.position.z - from.z) * dir.z
              if (
                jumped &&
                sim.grounded &&
                along >= length - 0.3 &&
                sim.position.y >= to.y + RUNNER.radius - 0.1
              ) {
                landed = true
                break
              }
            }
            expect(jumped).toBe(true)
            expect(fallen).toBe(false)
            expect(landed).toBe(true)
          })
    }
})

test("surging bars accelerate smoothly and retain deterministic reverse rotation", () => {
  const bar = COURSES.flatMap((c) => c.obstacles).find(
    (o) => o.kind === "sweeper" && o.surge !== undefined,
  )
  if (bar?.kind !== "sweeper" || bar.surge === undefined) throw new Error("Missing surging bar")
  const speed = (t: number) => (sweeperAngleAt(bar, t + 0.0001) - sweeperAngleAt(bar, t)) / 0.0001
  expect(speed(bar.surge.periodSec / 2) / speed(0)).toBeCloseTo(1 + bar.surge.strength, 3)
  expect(
    sweeperAngleAt({ ...bar, angularVelocityDeg: -bar.angularVelocityDeg, phaseDeg: 0 }, 3),
  ).toBeCloseTo(-sweeperAngleAt({ ...bar, phaseDeg: 0 }, 3))
  expect(sweeperAngleAt(bar, 7)).toBe(sweeperAngleAt(bar, 7))
})

test("rotating arms sweep the full width of their host deck", () => {
  for (const course of COURSES)
    for (const obstacle of course.obstacles) {
      if (obstacle.kind !== "sweeper") continue
      let widest = 0
      for (const platform of course.platforms) {
        const b = platform.box,
          c = Math.cos(b.yaw),
          s = Math.sin(b.yaw)
        if (Math.abs(b.center.y + b.halfExtents.y - (obstacle.pivot.y - 0.9)) > 0.2) continue
        if (course.navigation !== undefined) {
          const dx = obstacle.pivot.x - b.center.x,
            dz = obstacle.pivot.z - b.center.z
          const localX = c * dx - s * dz,
            localZ = s * dx + c * dz
          // Winding roads use local +Z for travel. Global X can run along an
          // entire hairpin; coverage must be measured across the road instead.
          if (Math.abs(localX) <= b.halfExtents.x && Math.abs(localZ) <= b.halfExtents.z)
            widest = Math.max(widest, b.halfExtents.x + Math.abs(localX))
          continue
        }
        // Intersect the rotated deck with the transverse line through the pivot.
        let lo = -Infinity,
          hi = Infinity
        for (const [a, offset, half] of [
          [c, -c * b.center.x - s * (obstacle.pivot.z - b.center.z), b.halfExtents.x],
          [s, -s * b.center.x + c * (obstacle.pivot.z - b.center.z), b.halfExtents.z],
        ]) {
          if (a === undefined || offset === undefined || half === undefined)
            throw new Error("Invalid box")
          if (Math.abs(a) < 1e-9) {
            if (Math.abs(offset) > half) {
              lo = Infinity
              hi = -Infinity
            }
            continue
          }
          const p = (-half - offset) / a,
            q = (half - offset) / a
          lo = Math.max(lo, Math.min(p, q))
          hi = Math.min(hi, Math.max(p, q))
        }
        if (lo <= obstacle.pivot.x && hi >= obstacle.pivot.x)
          widest = Math.max(widest, obstacle.pivot.x - lo, hi - obstacle.pivot.x)
      }
      if (obstacle.centered)
        for (const time of [0, 0.5, 2])
          expect(sweeperArmAt(obstacle, time).center).toEqual(obstacle.pivot)
      expect(widest, `${course.id}/${obstacle.id} has a host deck`).toBeGreaterThan(0)
      expect(
        obstacle.centered ? obstacle.armLength / 2 : obstacle.armLength,
        `${course.id}/${obstacle.id} covers both edges`,
      ).toBeGreaterThanOrEqual(widest + 0.2)
    }
})
