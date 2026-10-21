import type { ConveyorSpec, Vec3 } from "./types"
import { vec3 } from "./types"

/** Belt paint follows the actual surface velocity in the belt's local space. */
export function beltMarkers(
  spec: ConveyorSpec,
  timeSec: number,
): readonly {
  readonly position: Vec3
  readonly yaw: number
  readonly scale: number
}[] {
  const cos = Math.cos(spec.box.yaw),
    sin = Math.sin(spec.box.yaw)
  const localX = cos * spec.velocity.x - sin * spec.velocity.z
  const localZ = sin * spec.velocity.x + cos * spec.velocity.z
  const alongX = Math.abs(localX) > Math.abs(localZ)
  const longHalf = alongX ? spec.box.halfExtents.x : spec.box.halfExtents.z
  const crossHalf = alongX ? spec.box.halfExtents.z : spec.box.halfExtents.x
  const scale = Math.min(1, crossHalf / 1.9, longHalf / 1.2)
  const half = Math.max(0.1, longHalf - 0.7 * scale - 0.18)
  const speed = alongX ? localX : localZ
  return Array.from({ length: 12 }, (_, index) => {
    const travel =
      (((((Math.floor(index / 3) * half) / 2 + timeSec * speed) % (2 * half)) + 2 * half) %
        (2 * half)) -
      half
    const lane = ((index % 3) - 1) * crossHalf * 0.5
    const x = alongX ? travel : lane,
      z = alongX ? lane : travel
    return {
      position: vec3(
        spec.box.center.x + cos * x + sin * z,
        spec.box.center.y + spec.box.halfExtents.y,
        spec.box.center.z - sin * x + cos * z,
      ),
      yaw: Math.atan2(spec.velocity.x, spec.velocity.z),
      scale,
    }
  })
}
