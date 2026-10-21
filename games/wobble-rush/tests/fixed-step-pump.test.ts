import { expect, test } from "bun:test"
import { FixedStepPump } from "../src/client/fixed-step-pump"
import { FIXED_STEP_SEC, MAX_STEPS_PER_FRAME } from "../src/shared/constants"

test("timer jitter preserves 60 fixed physics/input steps per second without drawing", () => {
  const steps: number[] = []
  const pump = new FixedStepPump((dt) => steps.push(dt))
  for (let i = 0; i < 1000; i++) pump.advance(i % 2 === 0 ? 0.008 : 0.012)
  expect(steps.length).toBeGreaterThanOrEqual(599)
  expect(steps.length).toBeLessThanOrEqual(600)
  expect(steps.every((dt) => dt === FIXED_STEP_SEC)).toBe(true)
})
test("a blocked thread retains the catch-up cap and has no negative time debt", () => {
  let steps = 0
  const pump = new FixedStepPump(() => steps++)
  pump.advance(-1)
  expect(steps).toBe(0)
  pump.advance(5)
  expect(steps).toBe(MAX_STEPS_PER_FRAME)
  pump.advance(FIXED_STEP_SEC)
  expect(steps).toBe(MAX_STEPS_PER_FRAME + 1)
})

test("timer catch-up retains nominal physics timestamps rather than putting all steps at the callback time", () => {
  let nowMs = 40
  const at: number[] = []
  const pump = new FixedStepPump((_dt, lagSec) => at.push(nowMs - lagSec * 1000))
  pump.advance(0.04)
  expect(at[0]).toBeCloseTo(1000 / 60)
  expect(at[1]).toBeCloseTo(2000 / 60)
  nowMs = 48
  pump.advance(0.008)
  expect(at).toHaveLength(2)
  nowMs = 56
  pump.advance(0.008)
  expect(at[2]).toBeCloseTo(50)
})
