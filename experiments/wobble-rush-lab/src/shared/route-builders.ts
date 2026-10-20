/** Winding roads are authored in world coordinates, never inferred from +Z. */
import { box, checkpointBox, deck, sweeper } from "./course-builders"
import type {
  Checkpoint,
  CourseDefinition,
  CourseTheme,
  ObstacleSpec,
  Platform,
  Vec3,
} from "./types"
import { asCheckpointIndex, asObstacleId, vec3 } from "./types"

export type Point = readonly [number, number, number]
export type Road = {
  readonly points: readonly Point[]
  readonly width?: number
  readonly gaps?: readonly number[]
  readonly omitLandings?: readonly number[]
  readonly rides?: readonly {
    readonly exitIndex: number
    readonly moverHazardIndex: number
    readonly gateHazardIndex?: number
  }[]
}
export type Stage = {
  readonly roads: readonly Road[]
  /** Optional connected piers and shortcuts, independent of the bot race roads. */
  readonly spurs?: readonly Road[]
  readonly hint: string
  readonly hazards?: readonly Hazard[]
  readonly cuts?: readonly { readonly from: Point; readonly to: Point; readonly dive?: boolean }[]
}
export type Hazard =
  | { readonly kind: "bar"; readonly at: Point; readonly width: number; readonly speed?: number }
  | {
      readonly kind: "gate"
      readonly at: Point
      readonly width: number
      readonly yaw?: number
      readonly phase?: number
      readonly periodSec?: number
      readonly openSec?: number
    }
  | {
      readonly kind: "belt"
      readonly from: Point
      readonly to: Point
      readonly width: number
      readonly speed: number
      readonly sideSpeed?: number
    }
  | {
      readonly kind: "ferry"
      readonly from: Point
      readonly to: Point
      readonly size?: number
      readonly halfDepth?: number
      readonly halfHeight?: number
      readonly travelSec?: number
      readonly dwellSec?: number
      readonly phaseSec?: number
    }

const point = (p: Point, z: number): Vec3 => vec3(p[0], p[1], p[2] + z)

export function windingCourse(
  id: string,
  name: string,
  description: string,
  difficulty: "Easy" | "Medium" | "Tricky",
  theme: CourseTheme,
  stages: readonly Stage[],
): CourseDefinition {
  const platforms: Platform[] = [deck(`${id}-start`, "start", theme.rest, -7, 7, -10, 6)]
  const obstacles: ObstacleSpec[] = []
  const checkpoints: Checkpoint[] = []
  const arrows: NonNullable<CourseDefinition["arrows"]>[number][] = []
  const shortcuts: NonNullable<CourseDefinition["shortcuts"]>[number][] = []
  const routes = [0, 1, 2].map((index) => ({
    name: ["Scenic road", "Skill road", "Mixed road"][index] ?? "Road",
    waypoints: [vec3(0, 0, -4)],
    checkpointWaypoints: [0],
    rides: [] as {
      waypointIndex: number
      moverId: ReturnType<typeof asObstacleId>
      gateId?: ReturnType<typeof asObstacleId>
      wait: Vec3
    }[],
  }))
  let z = 4
  checkpoints.push({
    index: asCheckpointIndex(0),
    id: asObstacleId(`${id}-cp0`),
    respawn: vec3(0, 1.1, -4),
    trigger: checkpointBox(-7, 7, -8, 2),
    label: stages[0]?.hint ?? "Choose your route",
  })
  for (const [stageIndex, stage] of stages.entries()) {
    const prefix = `${id}-${stageIndex}`
    const roadPaths: Vec3[][] = []
    for (const [roadIndex, road] of [...stage.roads, ...(stage.spurs ?? [])].entries()) {
      const width = road.width ?? 4.6
      const color = roadIndex === 0 ? theme.deck : roadIndex === 1 ? theme.accent : theme.rest
      const points = road.points.map((p) => point(p, z))
      roadPaths.push(points)
      for (const [index, b] of points.entries()) {
        const a = points[index - 1]
        if (a === undefined) continue
        const dx = b.x - a.x,
          dz = b.z - a.z
        const length = Math.hypot(dx, dz)
        const yaw = Math.atan2(dx, dz)
        if (road.gaps?.includes(index)) continue
        // Small shallow stair risers climb several metres without invisible ramps.
        const steps = Math.max(1, Math.ceil(Math.abs(b.y - a.y) / 0.08))
        const pad = Math.min(
          length * 0.3,
          ((width / 2) * (Math.abs(dx) + Math.abs(dz))) / length + 0.2,
        )
        for (let step = 0; step < steps; step++) {
          const t = (step + 0.5) / steps
          const rise = Math.max(
            0,
            Math.min(1, ((length * (step + 1)) / steps - pad) / (length - 2 * pad)),
          )
          const top = a.y + (b.y - a.y) * rise
          platforms.push({
            id: asObstacleId(`${prefix}-road${roadIndex}-leg${index}-${step}`),
            kind: steps > 1 ? "ramp" : width < 3.5 ? "bridge" : "path",
            color,
            box: box(
              vec3(a.x + dx * t, top - 0.35, a.z + dz * t),
              vec3(width / 2, 0.35, length / steps / 2 + 0.12),
              yaw,
            ),
          })
        }
      }
      for (const [index, p] of points.entries()) {
        const before = points[index - 1],
          after = points[index + 1]
        // Small landing squares join sharp bends; none span an authored jump gap.
        if (!road.omitLandings?.includes(index))
          platforms.push(
            deck(
              `${prefix}-road${roadIndex}-landing${index}`,
              "path",
              color,
              p.x - width / 2,
              p.x + width / 2,
              p.z - width / 2,
              p.z + width / 2,
              p.y,
            ),
          )
        if (after === undefined) continue
        const yaw = Math.atan2(after.x - p.x, after.z - p.z)
        const turn =
          before === undefined
            ? Math.PI
            : Math.abs(
                Math.atan2(
                  Math.sin(yaw - Math.atan2(p.x - before.x, p.z - before.z)),
                  Math.cos(yaw - Math.atan2(p.x - before.x, p.z - before.z)),
                ),
              )
        // Arrows explain a decision or an unexpected turn, not every metre of road.
        if ((index === 1 || turn > 0.9 || road.gaps?.includes(index + 1)) && index > 0)
          arrows.push({ position: p, yaw, width: Math.min(1.2, width * 0.32) })
      }
    }
    for (const [index, hazard] of (stage.hazards ?? []).entries()) {
      const hazardId = `${prefix}-${hazard.kind}${index}`
      if (hazard.kind === "bar") {
        const at = point(hazard.at, z)
        obstacles.push({
          ...sweeper(
            hazardId,
            vec3(at.x, at.y + 0.9, at.z),
            hazard.width / 2 + 0.5,
            hazard.speed ?? 105,
            index * 81,
            5,
          ),
          surge: { periodSec: 6.5, strength: 0.65 },
          color: theme.rest,
        })
      } else if (hazard.kind === "gate") {
        const at = point(hazard.at, z)
        obstacles.push({
          kind: "gate",
          id: asObstacleId(hazardId),
          box: box(
            vec3(at.x, at.y + 1.5, at.z),
            vec3(hazard.width / 2, 1.5, 0.25),
            hazard.yaw ?? 0,
          ),
          lift: 4.6,
          periodSec: hazard.periodSec ?? 5.4,
          openSec: hazard.openSec ?? 2.7,
          phaseSec: hazard.phase ?? index * 1.1,
          color: theme.rest,
        })
      } else if (hazard.kind === "belt") {
        const a = point(hazard.from, z),
          b = point(hazard.to, z)
        const dx = b.x - a.x,
          dz = b.z - a.z,
          length = Math.hypot(dx, dz)
        obstacles.push({
          kind: "conveyor",
          id: asObstacleId(hazardId),
          box: box(
            vec3((a.x + b.x) / 2, a.y - 0.1, (a.z + b.z) / 2),
            vec3(hazard.width / 2, 0.15, length / 2),
            Math.atan2(dx, dz),
          ),
          velocity: vec3(
            (dx / length) * hazard.speed + (dz / length) * (hazard.sideSpeed ?? 0),
            0,
            (dz / length) * hazard.speed - (dx / length) * (hazard.sideSpeed ?? 0),
          ),
          color: theme.rest,
        })
      } else {
        const a = point(hazard.from, z),
          b = point(hazard.to, z),
          size = hazard.size ?? 1.6,
          halfHeight = hazard.halfHeight ?? 0.35
        obstacles.push({
          kind: "mover",
          id: asObstacleId(hazardId),
          from: vec3(a.x, a.y - halfHeight, a.z),
          to: vec3(b.x, b.y - halfHeight, b.z),
          halfExtents: vec3(size, halfHeight, hazard.halfDepth ?? size),
          travelSec: hazard.travelSec ?? 1.2,
          dwellSec: hazard.dwellSec ?? 0.3,
          phaseSec: hazard.phaseSec ?? index * 0.6,
          color: theme.rest,
        })
      }
    }
    for (const cut of stage.cuts ?? []) {
      const from = point(cut.from, z),
        to = point(cut.to, z)
      shortcuts.push({ from, to, dive: cut.dive ?? false })
      const yaw = Math.atan2(to.x - from.x, to.z - from.z)
      // Put the marker behind takeoff, fully on its landing pad.
      arrows.push({
        position: vec3(from.x - Math.sin(yaw) * 0.7, from.y, from.z - Math.cos(yaw) * 0.7),
        yaw,
        width: 0.85,
      })
    }
    const end = stage.roads[0]?.points.at(-1)
    if (end === undefined) throw new Error("A stage needs a finish plaza")
    const endPoint = point(end, z)
    platforms.push(
      deck(
        `${prefix}-rest`,
        "path",
        theme.rest,
        endPoint.x - 6,
        endPoint.x + 6,
        endPoint.z - 2.5,
        endPoint.z + 3.5,
        endPoint.y,
      ),
    )
    for (const [index, route] of routes.entries()) {
      const chosen =
        index === 2
          ? stage.roads.length > 2
            ? 2
            : stageIndex % stage.roads.length
          : index % stage.roads.length
      const skip = stageIndex === 0 ? 0 : 1
      const offset = route.waypoints.length - skip
      route.waypoints.push(...(roadPaths[chosen] ?? []).slice(skip))
      for (const ride of stage.roads[chosen]?.rides ?? []) {
        const wait = roadPaths[chosen]?.[ride.exitIndex - 2]
        if (wait === undefined) throw new Error("A ride needs a boarding dock")
        route.rides.push({
          waypointIndex: offset + ride.exitIndex,
          moverId: asObstacleId(`${prefix}-ferry${ride.moverHazardIndex}`),
          ...(ride.gateHazardIndex === undefined
            ? {}
            : {
                gateId: asObstacleId(`${prefix}-gate${ride.gateHazardIndex}`),
              }),
          wait,
        })
      }
      route.checkpointWaypoints.push(route.waypoints.length - 1)
    }
    checkpoints.push({
      index: asCheckpointIndex(stageIndex + 1),
      id: asObstacleId(`${prefix}-cp`),
      respawn: vec3(endPoint.x, endPoint.y + 1.1, endPoint.z),
      trigger: checkpointBox(
        endPoint.x - 6,
        endPoint.x + 6,
        endPoint.z - 1.5,
        endPoint.z + 1.5,
        endPoint.y,
      ),
      label: stages[stageIndex + 1]?.hint ?? "Pick your finish line",
    })
    z += end[2]
  }
  platforms.push(deck(`${id}-finish`, "finish", theme.rest, -7, 7, z, z + 12))
  for (const route of routes) route.waypoints.push(vec3(0, 0, z + 8))
  return {
    id,
    name,
    description,
    difficulty,
    theme,
    spawn: vec3(0, 1.1, -4),
    spawnYaw: 0,
    platforms,
    obstacles,
    checkpoints,
    finish: box(vec3(0, 2, z + 8), vec3(6, 2.5, 0.6)),
    killY: -12,
    waypoints: routes[0]?.waypoints ?? [],
    routes,
    arrows,
    shortcuts,
    navigation: { waypointRadius: 0.8, wobbleAmplitude: 0.06 },
  }
}
