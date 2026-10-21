import { expect, test } from "bun:test"
import { box, deck } from "../src/shared/course-builders"
import { intersectFootprints, junctionPaint } from "../src/shared/junction-paint"
import { vec3 } from "../src/shared/types"

test("crossroads paint covers only the shared walking footprint", () => {
  const a = box(vec3(0, -0.35, 0), vec3(2, 0.35, 6))
  const b = { ...a, yaw: Math.PI / 2 }
  const polygon = intersectFootprints(a, b)
  expect(polygon.length).toBe(4)
  for (const p of polygon) {
    expect(Math.abs(p.x)).toBeCloseTo(2)
    expect(Math.abs(p.z)).toBeCloseTo(2)
  }
})

test("rotated intersection vertices remain inside both roads", () => {
  const a = box(vec3(2, 0, 3), vec3(2, 0.35, 5), 0.7),
    b = box(vec3(0, 0, 4), vec3(1.7, 0.35, 4), -0.4)
  const polygon = intersectFootprints(a, b)
  expect(polygon.length).toBeGreaterThan(2)
  for (const p of polygon)
    for (const box of [a, b]) {
      const dx = p.x - box.center.x,
        dz = p.z - box.center.z,
        c = Math.cos(box.yaw),
        s = Math.sin(box.yaw)
      expect(Math.abs(c * dx - s * dz)).toBeLessThanOrEqual(box.halfExtents.x + 1e-8)
      expect(Math.abs(s * dx + c * dz)).toBeLessThanOrEqual(box.halfExtents.z + 1e-8)
    }
})

test("separate, abutting and overpass roads do not gain a fake junction", () => {
  const a = deck("a", "path", "red", -2, 2, -5, 5),
    b = deck("b", "path", "blue", 2, 6, -5, 5)
  expect(junctionPaint([a, b])).toEqual([])
  const high = deck("high", "path", "blue", -5, 5, -2, 2, 3.6)
  expect(junctionPaint([a, high])).toEqual([])
  expect(junctionPaint([a, deck("cross", "path", "blue", -5, 5, -2, 2)]).length).toBe(1)
})
