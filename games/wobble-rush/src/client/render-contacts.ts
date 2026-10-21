/** Presentation constraints only: these positions never feed back into race physics. */
import { RUNNER } from "../shared/constants"
import { CROWD } from "../shared/crowd"
import type { MutVec3, Vec3 } from "../shared/types"

export type RenderBody = {
  readonly id: string
  readonly position: MutVec3
  readonly reference: Vec3
  readonly active: boolean
  readonly previous?: Vec3
}

/** Repair visible contact without feeding correction offsets back into simulation. */
export function constrainRenderContacts(bodies: readonly RenderBody[]): void {
  const active = bodies.filter((body) => body.active)
  const diameter = RUNNER.radius * 2
  for (let pass = 0; pass < CROWD.solverPasses; pass++) {
    let changed = false
    for (let i = 0; i < active.length; i++) {
      const a = active[i]
      if (!a) continue
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j]
        if (!b) continue
        const dy = b.position.y - a.position.y
        if (Math.abs(dy) >= diameter || Math.abs(b.reference.y - a.reference.y) >= diameter)
          continue
        const dx = b.reference.x - a.reference.x
        const dz = b.reference.z - a.reference.z
        const length = Math.hypot(dx, dz)
        // Respawn piles are an authoritative discontinuity, not a presentation collision.
        if (length < 1e-6) continue
        const shownX = b.position.x - a.position.x
        const shownZ = b.position.z - a.position.z
        const shownLength = Math.hypot(shownX, shownZ)
        const separation = Math.min(
          length,
          Math.sqrt(diameter * diameter - dy * dy) - CROWD.separationSlop,
        )
        let nx = shownLength > 1e-6 ? shownX / shownLength : dx / length
        let nz = shownLength > 1e-6 ? shownZ / shownLength : dz / length
        let crossing = false
        // Check the segment between displayed poses too: a fast correction can
        // cross a rival entirely, leaving separated endpoints on the wrong sides.
        if (a.previous && b.previous && Math.abs(b.previous.y - a.previous.y) < diameter) {
          const px = b.previous.x - a.previous.x,
            pz = b.previous.z - a.previous.z
          const mx = shownX - px,
            mz = shownZ - pz
          const motionSq = mx * mx + mz * mz
          const closest =
            motionSq > 1e-9 ? Math.max(0, Math.min(1, -(px * mx + pz * mz) / motionSq)) : 0
          const cx = px + mx * closest,
            cz = pz + mz * closest
          if (closest > 0 && Math.hypot(cx, cz) < separation - 1e-6) {
            const dot = px * mx + pz * mz
            const discriminant =
              dot * dot - motionSq * (px * px + pz * pz - separation * separation)
            const at = Math.max(0, (-dot - Math.sqrt(Math.max(0, discriminant))) / motionSq)
            const hx = px + mx * at,
              hz = pz + mz * at
            const length = Math.hypot(hx, hz)
            if (length > 1e-6) {
              nx = hx / length
              nz = hz / length
              crossing = true
            }
          }
        }
        if (shownLength >= separation && !crossing) continue
        const shown = shownX * nx + shownZ * nz
        const correction = separation - shown
        if (correction <= 1e-6) continue
        // Remove the offending display offsets toward their valid world positions;
        // do not push a correctly placed rival away to hide somebody else's error.
        const offsetA = Math.max(
          0,
          (a.position.x - a.reference.x) * nx + (a.position.z - a.reference.z) * nz,
        )
        const offsetB = Math.max(
          0,
          -((b.position.x - b.reference.x) * nx + (b.position.z - b.reference.z) * nz),
        )
        const total = offsetA + offsetB
        const canRemoveOffsets = !!a.previous && !!b.previous && total >= correction - 1e-6
        const pushA = canRemoveOffsets ? (correction * offsetA) / total : correction * 0.5
        const pushB = canRemoveOffsets ? (correction * offsetB) / total : correction * 0.5
        a.position.x -= nx * pushA
        a.position.z -= nz * pushA
        b.position.x += nx * pushB
        b.position.z += nz * pushB
        changed = true
      }
    }
    if (!changed) return
  }
  // A dense pack can exhaust the bounded solve. Its valid shared-world positions
  // are preferable to inventing an unbounded visual displacement.
  for (const body of active) Object.assign(body.position, body.reference)
}
