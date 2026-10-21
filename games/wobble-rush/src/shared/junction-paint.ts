import type { BoxCollider, Platform } from "./types"

export type PaintPoint = { readonly x: number; readonly z: number }
export type JunctionPaint = { readonly top: number; readonly polygon: readonly PaintPoint[] }

function footprint(box: BoxCollider): PaintPoint[] {
  const c = Math.cos(box.yaw),
    s = Math.sin(box.yaw),
    hx = box.halfExtents.x,
    hz = box.halfExtents.z
  return [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ].map(([x = 0, z = 0]) => ({
    x: box.center.x + c * x + s * z,
    z: box.center.z - s * x + c * z,
  }))
}

/** Convex intersection of the actual walking footprints, including rotated paths. */
export function intersectFootprints(a: BoxCollider, b: BoxCollider): readonly PaintPoint[] {
  let polygon = footprint(a)
  const clip = footprint(b)
  for (let edge = 0; edge < 4; edge++) {
    const p = clip[edge],
      q = clip[(edge + 1) % 4]
    if (p === undefined || q === undefined) throw new Error("Invalid footprint")
    const distance = (v: PaintPoint) => (q.x - p.x) * (v.z - p.z) - (q.z - p.z) * (v.x - p.x)
    const output: PaintPoint[] = []
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i],
        previous = polygon[(i + polygon.length - 1) % polygon.length]
      if (current === undefined || previous === undefined) continue
      const d = distance(current),
        before = distance(previous)
      if (d >= 0 !== before >= 0) {
        const t = before / (before - d)
        output.push({
          x: previous.x + (current.x - previous.x) * t,
          z: previous.z + (current.z - previous.z) * t,
        })
      }
      if (d >= 0) output.push(current)
    }
    polygon = output
    if (polygon.length === 0) break
  }
  return polygon
}

export function junctionPaint(platforms: readonly Platform[]): readonly JunctionPaint[] {
  const result: JunctionPaint[] = []
  for (const [i, a] of platforms.entries())
    for (const b of platforms.slice(i + 1)) {
      if (a.color === b.color || a.kind === "decor" || b.kind === "decor") continue
      const top = a.box.center.y + a.box.halfExtents.y
      if (Math.abs(top - b.box.center.y - b.box.halfExtents.y) > 1e-5) continue
      const polygon = intersectFootprints(a.box, b.box)
      const area =
        Math.abs(
          polygon.reduce((sum, p, index) => {
            const next = polygon[(index + 1) % polygon.length]
            return sum + (next === undefined ? 0 : p.x * next.z - next.x * p.z)
          }, 0),
        ) / 2
      if (area > 0.02) result.push({ top, polygon })
    }
  return result
}
