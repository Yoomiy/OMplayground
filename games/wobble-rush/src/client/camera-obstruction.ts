import type { BoxCollider, Vec3 } from "../shared/types"

/** Nearest obstruction along the focus-to-camera segment, including lens clearance. */
export function clearCameraFraction(from: Vec3, to: Vec3, boxes: readonly BoxCollider[]): number {
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
  if (length < 1e-6) return 1
  let best = 1
  const minY = Math.min(from.y, to.y),
    maxY = Math.max(from.y, to.y)
  const minX = Math.min(from.x, to.x),
    maxX = Math.max(from.x, to.x)
  const minZ = Math.min(from.z, to.z),
    maxZ = Math.max(from.z, to.z)
  for (const box of boxes) {
    if (
      box.center.y + box.halfExtents.y + 0.18 < minY ||
      box.center.y - box.halfExtents.y - 0.18 > maxY
    )
      continue
    const c = Math.cos(box.yaw),
      s = Math.sin(box.yaw)
    const hx = Math.abs(c) * box.halfExtents.x + Math.abs(s) * box.halfExtents.z + 0.26
    const hz = Math.abs(s) * box.halfExtents.x + Math.abs(c) * box.halfExtents.z + 0.26
    if (
      box.center.x + hx < minX ||
      box.center.x - hx > maxX ||
      box.center.z + hz < minZ ||
      box.center.z - hz > maxZ
    )
      continue
    const dx = from.x - box.center.x,
      dz = from.z - box.center.z
    const vx = to.x - from.x,
      vz = to.z - from.z
    const origins = [c * dx - s * dz, from.y - box.center.y, s * dx + c * dz]
    const directions = [c * vx - s * vz, to.y - from.y, s * vx + c * vz]
    const halves = [box.halfExtents.x + 0.18, box.halfExtents.y + 0.18, box.halfExtents.z + 0.18]
    let enter = 0,
      exit = 1
    for (let axis = 0; axis < 3; axis++) {
      const origin = origins[axis] ?? 0,
        direction = directions[axis] ?? 0,
        half = halves[axis] ?? 0
      if (Math.abs(direction) < 1e-9) {
        if (Math.abs(origin) > half) {
          enter = 2
          break
        }
      } else {
        const a = (-half - origin) / direction,
          b = (half - origin) / direction
        enter = Math.max(enter, Math.min(a, b))
        exit = Math.min(exit, Math.max(a, b))
      }
    }
    // An embedded focus cannot be fixed by placing the camera inside that box.
    if (enter > 0 && enter <= exit && enter < best) best = Math.max(0, enter - 0.2 / length)
  }
  return best
}
