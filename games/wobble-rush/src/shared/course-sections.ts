/** Reusable authored sections include colliders, route hints and safe exits. */
import { box, bumper, checkpointBox, deck, sweeper } from "./course-builders"
import type {
  Checkpoint,
  CourseDefinition,
  CourseTheme,
  ObstacleSpec,
  Platform,
  Vec3,
} from "./types"
import { asCheckpointIndex, asObstacleId, vec3 } from "./types"

export type SectionKind =
  | "sweepers"
  | "hops"
  | "slalom"
  | "ribbon"
  | "gates"
  | "belts"
  | "steps"
  | "crossers"
const LABELS: Record<SectionKind, string> = {
  sweepers: "Jump the spinning bars",
  hops: "Jump island to island",
  slalom: "Find a line through the bumpers",
  ribbon: "Keep your balance on the bends",
  gates: "Wait for green, then run",
  belts: "Ride the arrows; jump against the belt",
  steps: "Climb to the next lookout",
  crossers: "Pick a gap between the moving blocks",
}

export function assembleCourse(
  id: string,
  name: string,
  description: string,
  difficulty: "Easy" | "Medium" | "Tricky",
  theme: CourseTheme,
  sections: readonly SectionKind[],
): CourseDefinition {
  const platforms: Platform[] = []
  const obstacles: ObstacleSpec[] = []
  const checkpoints: Checkpoint[] = []
  const waypoints: Vec3[] = [vec3(0, 0, 2)]
  platforms.push(deck(`${id}-start`, "start", theme.accent, -7, 7, -10, 6))
  const checkpoint = (index: number, z: number, top: number, label: string) => {
    checkpoints.push({
      index: asCheckpointIndex(index),
      id: asObstacleId(`${id}-cp-${index}`),
      respawn: vec3(0, top + 1.1, z),
      trigger: checkpointBox(-6, 6, z - 2, z + 2, top),
      label,
    })
  }
  checkpoint(0, -4, 0, LABELS[sections[0] ?? "sweepers"])
  let z = 6
  let top = 0
  sections.forEach((kind, index) => {
    const prefix = `${id}-${index}-${kind}`
    const slab = (
      suffix: string,
      x0: number,
      x1: number,
      a: number,
      b: number,
      height = top,
      color = theme.deck,
    ) =>
      platforms.push(
        deck(
          `${prefix}-${suffix}`,
          kind === "ribbon" ? "bridge" : "path",
          color,
          x0,
          x1,
          z + a,
          z + b,
          height,
        ),
      )
    const point = (x: number, offset: number, height = top) =>
      waypoints.push(vec3(x, height, z + offset))
    let length = 28
    if (kind === "hops") {
      const spans = [
        [0, 6, 0],
        [8.2, 13.2, 1.2],
        [15.4, 20.4, -1.2],
        [22.6, 28, 0],
      ]
      spans.forEach(([a = 0, b = 0, x = 0], part) => {
        slab(`island-${part}`, x - 3.4, x + 3.4, a, b, top, part % 2 ? theme.accent : theme.deck)
        point(x, (a + b) / 2)
      })
      for (const [part, center] of [7.1, 14.3, 21.5].entries()) {
        obstacles.push({
          kind: "mover",
          id: asObstacleId(`${prefix}-ferry-${part}`),
          from: vec3(-5.5, top - 0.35, z + center),
          to: vec3(5.5, top - 0.35, z + center),
          halfExtents: vec3(1.5, 0.35, 0.9),
          travelSec: 2.2,
          dwellSec: 0.5,
          phaseSec: part * 1.4,
          color: theme.rest,
        })
      }
    } else if (kind === "ribbon") {
      const route = [vec3(0, top, 0), vec3(-3.3, top, 8), vec3(3.3, top, 18), vec3(0, top, 28)]
      for (let part = 0; part < route.length - 1; part++) {
        const a = route[part]
        const b = route[part + 1]
        if (a === undefined || b === undefined) continue
        const dx = b.x - a.x
        const dz = b.z - a.z
        platforms.push({
          id: asObstacleId(`${prefix}-plank-${part}`),
          kind: "bridge",
          color: theme.accent,
          box: box(
            vec3((a.x + b.x) / 2, top - 0.35, z + (a.z + b.z) / 2),
            vec3(1.8, 0.35, Math.hypot(dx, dz) / 2 + 0.6),
            Math.atan2(dx, dz),
          ),
        })
        point(b.x, b.z)
      }
      obstacles.push({
        ...sweeper(`${prefix}-bar`, vec3(-3, top + 0.9, z + 8), 2.6, 50, 100, 3),
        color: theme.rest,
      })
    } else if (kind === "steps") {
      length = 24
      slab("entry", -5, 5, 0, 6)
      point(0, 4)
      for (let stair = 0; stair < 8; stair++) {
        slab(
          `stair-${stair}`,
          -4,
          4,
          6 + stair * 1.5,
          7.5 + stair * 1.5,
          top + (stair + 1) * 0.15,
          stair % 2 ? theme.deck : theme.accent,
        )
        if (stair % 2 === 1) point(0, 7 + stair * 1.5, top + (stair + 1) * 0.15)
      }
      top += 1.2
      slab("lookout", -5.5, 5.5, 18, length)
      point(0, 22)
    } else {
      length = kind === "belts" || kind === "slalom" ? 30 : 28
      slab("deck", -6, 6, 0, length)
      if (kind === "sweepers") {
        for (const [part, offset] of [9, 20].entries())
          obstacles.push({
            ...sweeper(
              `${prefix}-bar-${part}`,
              vec3(0, top + 0.9, z + offset),
              6.5,
              part % 2 ? -90 : 78,
              part * 120,
              5,
            ),
            color: theme.accent,
          })
        point(0, 8)
        point(0, 19)
      } else if (kind === "slalom") {
        for (const [part, offset] of [6, 14, 22].entries()) {
          const x = part % 2 ? 2 : -2
          obstacles.push({
            ...bumper(`${prefix}-dome-${part}`, x, z + offset, 1.3),
            center: vec3(x, top + 0.32, z + offset),
            color: theme.accent,
          })
          obstacles.push({
            ...bumper(`${prefix}-edge-${part}`, -x * 2, z + offset + 3, 0.8),
            center: vec3(-x * 2, top + 0.32, z + offset + 3),
            color: theme.rest,
          })
          point(-x, offset)
        }
      } else if (kind === "belts") {
        for (const [part, offset] of [4, 13, 22].entries()) {
          obstacles.push({
            kind: "conveyor",
            id: asObstacleId(`${prefix}-belt-${part}`),
            box: box(vec3(0, top - 0.12, z + offset + 2), vec3(5.6, 0.2, 3)),
            velocity: part === 0 ? vec3(0, 0, 3.2) : part === 1 ? vec3(2, 0, 0) : vec3(0, 0, -2.5),
            color: part % 2 ? theme.accent : theme.rest,
          })
          point(0, offset + 2)
        }
      } else if (kind === "gates") {
        for (const [part, offset] of [8, 20].entries()) {
          obstacles.push({
            kind: "gate",
            id: asObstacleId(`${prefix}-gate-${part}`),
            box: box(vec3(0, top + 1.5, z + offset), vec3(5.8, 1.5, 0.3)),
            lift: 4.2,
            periodSec: 6,
            openSec: 3.2,
            phaseSec: part * 2.1,
            color: theme.accent,
          })
          point(0, offset + 3)
        }
      } else if (kind === "crossers") {
        for (const [part, offset] of [9, 20].entries()) {
          obstacles.push({
            kind: "mover",
            id: asObstacleId(`${prefix}-block-${part}`),
            from: vec3(-4, top + 0.45, z + offset),
            to: vec3(4, top + 0.45, z + offset),
            halfExtents: vec3(1.2, 0.4, 0.7),
            travelSec: 1.75,
            dwellSec: 0.45,
            phaseSec: part * 1.2,
            color: theme.accent,
          })
          point(part % 2 ? -3 : 3, offset)
        }
      }
      point(0, length - 2)
    }
    z += length
    platforms.push(deck(`${prefix}-rest`, "path", theme.rest, -6, 6, z, z + 6, top))
    checkpoint(
      index + 1,
      z + 3,
      top,
      index + 1 < sections.length
        ? LABELS[sections[index + 1] ?? kind]
        : "Sprint through the finish arch",
    )
    waypoints.push(vec3(0, top, z + 3))
    z += 6
  })
  platforms.push(deck(`${id}-finish`, "finish", theme.accent, -6, 6, z, z + 12, top))
  waypoints.push(vec3(0, top, z + 8))
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
    waypoints,
    finish: box(vec3(0, top + 2, z + 8), vec3(4.6, 2.5, 0.6)),
    killY: -9,
  }
}
