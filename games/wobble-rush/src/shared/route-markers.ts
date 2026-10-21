import type { BoxCollider, CourseDefinition, Vec3 } from "./types"

export const ARROW_VERTICES = [
  [-0.6, -0.4],
  [0, 0.7],
  [0.6, -0.4],
] as const
export type RouteMarker = { readonly position: Vec3; readonly yaw: number; readonly width: number }

export function markerFits(marker: RouteMarker, box: BoxCollider): boolean {
  if (Math.abs(box.center.y + box.halfExtents.y - marker.position.y) > 0.05) return false
  const scale = marker.width / 1.2
  const cos = Math.cos(marker.yaw),
    sin = Math.sin(marker.yaw)
  return ARROW_VERTICES.every(([x, z]) => {
    const dx = marker.position.x + (cos * x + sin * z) * scale - box.center.x
    const dz = marker.position.z + (-sin * x + cos * z) * scale - box.center.z
    const bx = Math.cos(box.yaw) * dx - Math.sin(box.yaw) * dz
    const bz = Math.sin(box.yaw) * dx + Math.cos(box.yaw) * dz
    return Math.abs(bx) <= box.halfExtents.x - 0.12 && Math.abs(bz) <= box.halfExtents.z - 0.12
  })
}

/** Every painted triangle fits one complete slab, including rotated narrow roads. */
export function routeMarkers(course: CourseDefinition): readonly RouteMarker[] {
  return (course.arrows ?? []).flatMap((authored) => {
    let width = authored.width
    for (let attempt = 0; attempt < 12 && width >= 0.25; attempt++, width *= 0.85) {
      const marker = { ...authored, width }
      if (course.platforms.some((p) => markerFits(marker, p.box))) return [marker]
    }
    return []
  })
}
