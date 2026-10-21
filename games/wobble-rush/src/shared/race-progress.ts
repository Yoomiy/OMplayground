/** HUD estimate only: checkpoint order first, then distance along the current section. */
import type { CourseDefinition, RunnerSim, Vec3 } from "./types"

type Segment = { a: Vec3; b: Vec3; start: number; length: number }
type Path = { segments: Segment[]; length: number }
export type ProgressRacer = {
  id: string
  sim: Pick<RunnerSim, "position" | "checkpoint">
  finishedMs: number | null
}
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

export class RaceProgress {
  private readonly sections: Path[][]
  constructor(course: CourseDefinition) {
    const routes = course.routes?.length ? course.routes : [{ waypoints: course.waypoints }]
    this.sections = course.checkpoints.map((checkpoint, section) =>
      routes.map((route) => {
        const points = route.waypoints
        const indices: number[] = []
        let lower = 0
        for (const cp of course.checkpoints) {
          const exact =
            "checkpointWaypoints" in route ? route.checkpointWaypoints?.[cp.index] : undefined
          let nearest = lower,
            best = Infinity
          for (let i = lower; i < points.length; i++) {
            const point = points[i]
            if (!point) continue
            const d = distance(point, cp.respawn)
            if (d < best) {
              best = d
              nearest = i
            }
          }
          lower = exact ?? nearest
          indices.push(lower)
        }
        const from = indices[section] ?? 0,
          to = indices[section + 1] ?? points.length - 1
        const selected = points.slice(from, to + 1)
        if (selected.length < 2)
          selected.push(
            checkpoint.respawn,
            course.checkpoints[section + 1]?.respawn ?? course.finish.center,
          )
        let length = 0
        const segments: Segment[] = []
        for (let i = 1; i < selected.length; i++) {
          const a = selected[i - 1],
            b = selected[i]
          if (!a || !b) continue
          const size = distance(a, b)
          if (size < 1e-9) continue
          segments.push({ a, b, start: length, length: size })
          length += size
        }
        return { segments, length }
      }),
    )
  }

  score(sim: ProgressRacer["sim"]): number {
    const section = Math.max(0, sim.checkpoint),
      paths = this.sections[section]
    if (!paths) return section
    let nearest = Infinity,
      fraction = 0
    for (const path of paths)
      for (const segment of path.segments) {
        const { a, b } = segment,
          dx = b.x - a.x,
          dy = b.y - a.y,
          dz = b.z - a.z
        const t = Math.max(
          0,
          Math.min(
            1,
            ((sim.position.x - a.x) * dx +
              (sim.position.y - a.y) * dy +
              (sim.position.z - a.z) * dz) /
              segment.length ** 2,
          ),
        )
        const d = distance(sim.position, { x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t })
        const progress = (segment.start + segment.length * t) / path.length
        // At self-crossings/branch joins prefer earlier progress; the next
        // validated checkpoint resolves the ambiguity. Height separates decks.
        if (d < nearest - 1e-6 || (Math.abs(d - nearest) < 1e-6 && progress < fraction)) {
          nearest = d
          fraction = progress
        }
      }
    return section + Math.min(0.999999, fraction)
  }

  place(selfId: string, racers: readonly ProgressRacer[]): string {
    const self = racers.find((racer) => racer.id === selfId)
    if (!self || racers.length < 2) return ""
    const selfScore = this.score(self.sim)
    const ahead = racers.filter(
      (other) =>
        other.id !== selfId &&
        (other.finishedMs !== null
          ? self.finishedMs === null || other.finishedMs < self.finishedMs
          : self.finishedMs === null && this.score(other.sim) > selfScore + 1e-6),
    ).length
    return `${ahead + 1} / ${racers.length}`
  }
}
