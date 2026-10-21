/** Exact swept-box overlap: easing changes timing, not the straight travel segment. */
import type { BoxCollider, MoverSpec } from "./types"

export function sweptMoverIntersects(mover: MoverSpec, box: BoxCollider): boolean {
  const c = Math.cos(box.yaw),
    s = Math.sin(box.yaw)
  let enter = 0,
    exit = 1
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [c, 0, -s],
    [s, 0, c],
  ] as const
  for (const [x, y, z] of axes) {
    const start =
      (mover.from.x - box.center.x) * x +
      (mover.from.y - box.center.y) * y +
      (mover.from.z - box.center.z) * z
    const delta =
      (mover.to.x - mover.from.x) * x +
      (mover.to.y - mover.from.y) * y +
      (mover.to.z - mover.from.z) * z
    const radius =
      Math.abs(x) * mover.halfExtents.x +
      Math.abs(y) * mover.halfExtents.y +
      Math.abs(z) * mover.halfExtents.z +
      Math.abs(x * c - z * s) * box.halfExtents.x +
      Math.abs(y) * box.halfExtents.y +
      Math.abs(x * s + z * c) * box.halfExtents.z -
      1e-5
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(start) >= radius) return false
    } else {
      const a = (-radius - start) / delta,
        b = (radius - start) / delta
      enter = Math.max(enter, Math.min(a, b))
      exit = Math.min(exit, Math.max(a, b))
      if (enter >= exit) return false
    }
  }
  return enter < exit
}

/** Conservative envelope, useful to prove different ferry tracks cannot collide. */
export function moverEnvelope(mover: MoverSpec): BoxCollider {
  return {
    center: {
      x: (mover.from.x + mover.to.x) / 2,
      y: (mover.from.y + mover.to.y) / 2,
      z: (mover.from.z + mover.to.z) / 2,
    },
    halfExtents: {
      x: Math.abs(mover.to.x - mover.from.x) / 2 + mover.halfExtents.x,
      y: Math.abs(mover.to.y - mover.from.y) / 2 + mover.halfExtents.y,
      z: Math.abs(mover.to.z - mover.from.z) / 2 + mover.halfExtents.z,
    },
    yaw: 0,
  }
}
