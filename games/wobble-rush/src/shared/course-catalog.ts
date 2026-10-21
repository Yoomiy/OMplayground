/**
 * The course catalog: every course the game can load.
 */

import { RUNNER } from "./constants"
import { CREATIVE_COURSES } from "./creative-courses"
import {
  BUMPER_BOULEVARD,
  CLOCKWORK_CROSSING,
  FESTIVAL_FINALE,
  RIBBON_RIDGE,
  SKY_HOP,
} from "./extra-courses"
import { MECHANISM_COURSES } from "./mechanism-courses"
import { hashString, mulberry32 } from "./rng"
import { SUNRISE_SCRAMBLE } from "./sunrise-scramble"
import { assertNever, type ConveyorSpec, type CourseDefinition } from "./types"

/** Reverse/sideways belts must demand more than simply holding run. */
export function tuneConveyor(belt: ConveyorSpec): ConveyorSpec {
  const c = Math.cos(belt.box.yaw),
    s = Math.sin(belt.box.yaw)
  const localX = c * belt.velocity.x - s * belt.velocity.z
  const localZ = s * belt.velocity.x + c * belt.velocity.z
  const speed = Math.hypot(belt.velocity.x, belt.velocity.z)
  if (speed < 0.01 || (localZ >= 0 && Math.abs(localX) <= Math.abs(localZ))) return belt
  const factor = Math.max(3, (RUNNER.runSpeed * 1.15) / speed)
  return {
    ...belt,
    velocity: { x: belt.velocity.x * factor, y: belt.velocity.y, z: belt.velocity.z * factor },
  }
}

/** One shared catalog for menus, room configuration and the renderer. */
export const COURSE_PACK_VERSION = "playground-action-4"
export const COURSES: readonly CourseDefinition[] = [
  {
    ...SUNRISE_SCRAMBLE,
    description: "The original sunny scramble: spinning bars, islands and bumpers.",
    difficulty: "Easy",
  } satisfies CourseDefinition,
  SKY_HOP,
  BUMPER_BOULEVARD,
  CLOCKWORK_CROSSING,
  RIBBON_RIDGE,
  FESTIVAL_FINALE,
  ...CREATIVE_COURSES,
  ...MECHANISM_COURSES,
].map((course) => ({
  ...course,
  obstacles: course.obstacles.map((obstacle, index) =>
    obstacle.kind === "sweeper"
      ? {
          ...obstacle,
          centered: true,
          armLength: obstacle.armLength * 2,
          ...(index % 3 === 0 && obstacle.surge === undefined
            ? { surge: { periodSec: 7 + (index % 4), strength: 0.55 } }
            : {}),
        }
      : obstacle.kind === "mover"
        ? {
            ...obstacle,
            // The speed request concerns arrow-marked conveyors, not ferries.
            travelSec: obstacle.travelSec * 0.7,
            ...(obstacle.returnTravelSec === undefined
              ? {}
              : { returnTravelSec: obstacle.returnTravelSec * 0.7 }),
            dwellSec: obstacle.dwellSec * 0.65,
          }
        : obstacle.kind === "conveyor"
          ? tuneConveyor(obstacle)
          : obstacle,
  ),
}))

export function getCourse(id: string): CourseDefinition {
  const course = COURSES.find((entry) => entry.id === id)
  if (course === undefined) throw new Error(`Unknown course: ${id}`)
  return course
}

/** Bounded variations preserve the tested route and change obstacle rhythms. */
export function playableCourse(id: string, remixSeed: number | null = null): CourseDefinition {
  const base = getCourse(id)
  if (remixSeed === null) return base
  const rng = mulberry32((remixSeed ^ hashString(id)) >>> 0)
  return {
    ...base,
    obstacles: base.obstacles.map((obstacle) => {
      switch (obstacle.kind) {
        case "sweeper":
          return {
            ...obstacle,
            phaseDeg: rng() * 360,
            angularVelocityDeg: obstacle.angularVelocityDeg * (0.9 + rng() * 0.2),
          }
        case "mover":
          return {
            ...obstacle,
            phaseSec:
              rng() *
              (obstacle.travelSec +
                (obstacle.returnTravelSec ?? obstacle.travelSec) +
                obstacle.dwellSec * 2),
          }
        case "gate":
          return { ...obstacle, phaseSec: rng() * obstacle.periodSec }
        case "bumper":
          return { ...obstacle, bobPeriodSec: obstacle.bobPeriodSec * (0.9 + rng() * 0.2) }
        case "conveyor":
          return {
            ...obstacle,
            velocity: {
              ...obstacle.velocity,
              x: obstacle.velocity.x * (0.9 + rng() * 0.2),
              z: obstacle.velocity.z * (0.9 + rng() * 0.2),
            },
          }
        default:
          return assertNever(obstacle, "playableCourse")
      }
    }),
  }
}
