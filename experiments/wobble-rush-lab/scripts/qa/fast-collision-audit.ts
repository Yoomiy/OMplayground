/** Authored obstacle-motion audit; collision response regressions live in fast-collision.test.ts. */
import assert from "node:assert/strict"
import { sphereVsBox } from "../../src/shared/collision"
import { RUNNER } from "../../src/shared/constants"
import { COURSES, playableCourse } from "../../src/shared/course-catalog"
import { gateBoxAt, moverVelocityAt, sweeperArmAt } from "../../src/shared/obstacles"

let maxTip = 0,
  maxCarry = 0,
  maxGate = 0
const misses: {
  course: string
  seed: number | null
  id: string
  t: number
  f: number
  speed: number
}[] = []
let samples = 0
for (const c of COURSES)
  for (const seed of [null, 7, 42, 99, 424242])
    for (const o of playableCourse(c.id, seed).obstacles) {
      if (o.kind === "mover")
        for (let t = 0; t < 10; t += 1 / 60) {
          const v = moverVelocityAt(o, t)
          maxCarry = Math.max(maxCarry, Math.hypot(v.x, v.y, v.z) / 60)
        }
      if (o.kind === "gate")
        for (let t = 0; t < 10; t += 1 / 60) {
          const a = gateBoxAt(o, t),
            b = gateBoxAt(o, t + 1 / 60)
          maxGate = Math.max(maxGate, Math.abs(b.center.y - a.center.y))
        }
      if (o.kind !== "sweeper") continue
      const tip = o.centered ? o.armLength / 2 : o.armLength
      maxTip = Math.max(
        maxTip,
        (((tip * Math.abs(o.angularVelocityDeg) * Math.PI) / 180) *
          (1 + (o.surge?.strength ?? 0))) /
          60,
      )
      for (let t = 0; t < 10; t += 1 / 60) {
        const a = sweeperArmAt(o, t),
          b = sweeperArmAt(o, t + 1 / 60),
          m = sweeperArmAt(o, t + 1 / 120)
        for (const f of [0.5, 0.8, 0.99])
          for (const speed of [
            0,
            -RUNNER.runSpeed - RUNNER.diveSpeed,
            RUNNER.runSpeed + RUNNER.diveSpeed,
          ]) {
            const r = tip * f,
              p = {
                x: o.pivot.x + Math.cos(m.yaw) * r,
                y: o.pivot.y,
                z: o.pivot.z - Math.sin(m.yaw) * r,
              }
            const nx = Math.sin(m.yaw),
              nz = Math.cos(m.yaw),
              step = speed / 120
            const before = { x: p.x - nx * step, y: p.y, z: p.z - nz * step },
              after = { x: p.x + nx * step, y: p.y, z: p.z + nz * step }
            samples++
            if (
              !sphereVsBox(before, RUNNER.radius, a).hit &&
              !sphereVsBox(after, RUNNER.radius, b).hit &&
              sphereVsBox(p, RUNNER.radius, m).hit
            )
              misses.push({ course: c.id, seed, id: o.id, t, f, speed })
          }
      }
    }
console.log(
  JSON.stringify({
    maxTipMetersPerTick: maxTip,
    maxCarryMetersPerTick: maxCarry,
    maxGateMetersPerTick: maxGate,
    samples,
    sweeperPassThroughSamples: misses.length,
    examples: misses.slice(0, 3),
  }),
)

assert.equal(
  misses.length,
  0,
  "An authored bar can pass completely through a legal-speed runner between ticks",
)
