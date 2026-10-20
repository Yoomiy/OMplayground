/** Continuous travel-volume audit, not snapshots that can miss fast crossings. */
import { COURSES } from "../../src/shared/course-catalog"
import { moverEnvelope, sweptMoverIntersects } from "../../src/shared/mover-clearance"
import type { MoverSpec } from "../../src/shared/types"

let checked = 0
const violations: string[] = []
for (const course of COURSES) {
  const movers = course.obstacles.filter((o): o is MoverSpec => o.kind === "mover")
  for (const mover of movers) {
    checked++
    for (const platform of course.platforms) {
      const box = {
        ...platform.box,
        center: { ...platform.box.center, y: platform.box.center.y - 0.325 },
        halfExtents: { ...platform.box.halfExtents, y: platform.box.halfExtents.y + 0.325 },
      }
      if (sweptMoverIntersects(mover, box))
        violations.push(`${course.id}: ${mover.id} crosses ${platform.id}`)
    }
    for (const other of movers)
      if (other !== mover && sweptMoverIntersects(mover, moverEnvelope(other)))
        violations.push(`${mover.id} crosses ${other.id}'s track`)
  }
}
console.log(JSON.stringify({ checked, violations }))
if (violations.length > 0) process.exit(1)
