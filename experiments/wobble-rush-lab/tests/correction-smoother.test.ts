import { expect, test } from "bun:test"
import { CorrectionSmoother } from "../src/client/correction-smoother"

const origin = { x: 0, y: 0, z: 0 }
const moved = { x: 0.2, y: 0, z: 0 }

test("small corrections preserve visual continuity and decay without touching physics", () => {
  const correction = new CorrectionSmoother()
  correction.correct(origin, moved)
  expect(correction.position(moved)).toEqual(origin)
  correction.advance(0.1)
  expect(correction.position(moved).x).toBeGreaterThan(0)
  expect(correction.position(moved).x).toBeLessThan(0.2)
  expect(moved.x).toBe(0.2)
})
test("contacts settle faster, respawns snap, and repeated offsets remain bounded", () => {
  const drift = new CorrectionSmoother(),
    contact = new CorrectionSmoother()
  drift.correct(origin, moved)
  contact.correct(origin, moved, false, true)
  drift.advance(0.05)
  contact.advance(0.05)
  expect(contact.position(moved).x).toBeGreaterThan(drift.position(moved).x)
  contact.correct(origin, moved, true)
  expect(contact.position(moved)).toEqual(moved)
  for (let i = 0; i < 100; i++) drift.correct(origin, moved)
  expect(Math.abs(drift.position(moved).x - moved.x)).toBeLessThanOrEqual(1.25)
  drift.correct(origin, { x: 3, y: 0, z: 0 })
  expect(drift.position(origin)).toEqual(origin)
})
