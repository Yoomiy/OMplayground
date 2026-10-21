import { expect, test } from "bun:test"
import { COURSES } from "../src/shared/course-catalog"
import { type ProgressRacer, RaceProgress } from "../src/shared/race-progress"
import { asCheckpointIndex, asObstacleId, type CourseDefinition, vec3 } from "../src/shared/types"
import { course } from "./support/world-fixtures"

const points = [vec3(0, 0, 0), vec3(0, 0, 20), vec3(10, 0, 20), vec3(10, 0, 0), vec3(20, 0, 0)]
const c: CourseDefinition = {
  ...course,
  waypoints: points,
  checkpoints: [0, 1].map((i) => ({
    id: asObstacleId(`cp-${i}`),
    index: asCheckpointIndex(i),
    respawn: points[i === 0 ? 0 : 4] ?? vec3(0, 0, 0),
    trigger: course.finish,
    label: "",
  })),
}
const runner = (
  id: string,
  p: readonly [number, number, number],
  checkpoint = 0,
  finishedMs: number | null = null,
): ProgressRacer => ({
  id,
  sim: { position: vec3(...p), checkpoint: asCheckpointIndex(checkpoint) },
  finishedMs,
})

test("returning sections rank progress along the road rather than world Z", () => {
  const progress = new RaceProgress(c),
    a = runner("a", [10, 0, 5]),
    b = runner("b", [0, 0, 15])
  expect(progress.place("a", [a, b])).toBe("1 / 2")
  expect(progress.place("b", [a, b])).toBe("2 / 2")
})
test("checkpoint order and accepted finishes dominate geometry, including respawn", () => {
  const progress = new RaceProgress(c),
    a = runner("a", [0, 0, 0], 1),
    b = runner("b", [20, 0, 0])
  expect(progress.place("a", [a, b])).toBe("1 / 2")
  expect(
    progress.place("b", [
      { ...a, finishedMs: 1000 },
      { ...b, finishedMs: 900 },
    ]),
  ).toBe("1 / 2")
  expect(progress.place("b", [{ ...a, finishedMs: 900 }, b])).toBe("2 / 2")
})
test("different-length branches compare normalized section fractions", () => {
  const branch: CourseDefinition = {
    ...c,
    routes: [
      { name: "short", waypoints: [vec3(0, 0, 0), vec3(20, 0, 0)], checkpointWaypoints: [0, 1] },
      {
        name: "long",
        waypoints: [vec3(0, 0, 0), vec3(0, 0, 10), vec3(20, 0, 10), vec3(20, 0, 0)],
        checkpointWaypoints: [0, 3],
      },
    ],
  }
  const progress = new RaceProgress(branch)
  expect(progress.score(runner("a", [10, 0, 0]).sim)).toBeCloseTo(0.5)
  expect(progress.score(runner("b", [10, 0, 10]).sim)).toBeCloseTo(0.5)
  expect(progress.place("a", [runner("a", [10, 0, 0]), runner("b", [16, 0, 10])])).toBe("2 / 2")
})
test("height and authored checkpoint indices disambiguate stacked/crossing roads", () => {
  const elevated: CourseDefinition = {
    ...c,
    routes: [
      {
        name: "stacked",
        waypoints: [vec3(0, 0, 0), vec3(10, 0, 0), vec3(10, 5, 0), vec3(0, 5, 0), vec3(0, 5, 10)],
        checkpointWaypoints: [0, 4],
      },
    ],
  }
  const progress = new RaceProgress(elevated)
  expect(progress.score(runner("a", [5, 5, 0]).sim)).toBeGreaterThan(
    progress.score(runner("b", [5, 0, 0]).sim),
  )
  expect(progress.score(runner("a", [0, 0, 0], 1).sim)).toBeGreaterThan(
    progress.score(runner("b", [0, 5, 10]).sim),
  )
})
test("each authored route stays within its validated checkpoint section", () => {
  for (const course of COURSES) {
    const progress = new RaceProgress(course)
    for (const route of course.routes ?? [])
      for (const [section, index] of (route.checkpointWaypoints ?? []).entries()) {
        const point = route.waypoints[index]
        if (!point) throw new Error("Missing authored waypoint")
        const score = progress.score({ position: point, checkpoint: asCheckpointIndex(section) })
        expect(Number.isFinite(score)).toBe(true)
        expect(score).toBeGreaterThanOrEqual(section)
        expect(score).toBeLessThan(section + 1)
      }
  }
})
