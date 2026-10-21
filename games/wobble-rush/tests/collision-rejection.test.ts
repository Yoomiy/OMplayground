import { expect, test } from "bun:test"
import { sphereMayTouchBox, sphereVsBox } from "../src/shared/collision"
import { mulberry32 } from "../src/shared/rng"
import { vec3 } from "../src/shared/types"

test("cheap box rejection never drops a narrow-phase hit across rotations, dimensions and edge cases", () => {
  const rng = mulberry32(53721)
  for (let n = 0; n < 50000; n++) {
    const box = {
      center: vec3((rng() - 0.5) * 100, (rng() - 0.5) * 30, (rng() - 0.5) * 100),
      halfExtents: vec3(0.001 + rng() * 20, 0.001 + rng() * 5, 0.001 + rng() * 20),
      yaw: n % 4 === 0 ? 0 : (rng() - 0.5) * Math.PI * 2,
    }
    const radius = 0.001 + rng() * 2
    const center = vec3(
      box.center.x + (rng() - 0.5) * 40,
      box.center.y + (rng() - 0.5) * 12,
      box.center.z + (rng() - 0.5) * 40,
    )
    if (sphereVsBox(center, radius, box).hit)
      expect(sphereMayTouchBox(center.x, center.y, center.z, radius, box)).toBe(true)
  }
  const box = { center: vec3(0, 0, 0), halfExtents: vec3(1, 0.01, 1), yaw: 0 }
  expect(sphereMayTouchBox(1.5, 0, 0, 0.5, box)).toBe(true)
  expect(sphereMayTouchBox(0, 0.51, 0, 0.5, box)).toBe(true)
  expect(sphereMayTouchBox(1.500001, 0, 0, 0.5, box)).toBe(false)
})
