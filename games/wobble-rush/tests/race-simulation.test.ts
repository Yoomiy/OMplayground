import { describe, expect, test } from "bun:test"
import { FIXED_STEP_SEC, RUNNER } from "../src/shared/constants"
import { COURSES } from "../src/shared/course-catalog"
import { createRunner, stepRunner } from "../src/shared/player"
import type { RaceRunner } from "../src/shared/race-simulation"
import { stepRace } from "../src/shared/race-simulation"
import { asObstacleId, NEUTRAL_INPUT, vec3 } from "../src/shared/types"
import { makeContactImpulse, makeStubWorld } from "./support/player-fixtures"

const racer = (id: string, x: number, z: number): RaceRunner => ({
  id,
  sim: createRunner(vec3(x, RUNNER.radius, z), 0),
  input: NEUTRAL_INPUT,
  respawnPoint: vec3(0, RUNNER.radius, 0),
})

describe("headless race tick", () => {
  test("every catalog course has a contiguous mandatory checkpoint sequence", () => {
    for (const course of COURSES)
      expect(
        course.checkpoints.map((cp) => Number(cp.index)),
        course.id,
      ).toEqual(course.checkpoints.map((_, index) => index))
  })

  test("finish is evaluated after another racer pushes the runner out of the volume", () => {
    const self = racer("a", 0, 3.02)
    const other = racer("b", 0, 3.2)
    const tick = stepRace(
      [self, other],
      makeStubWorld({ finishWhen: (p) => p.z >= 3 }),
      FIXED_STEP_SEC,
    )
    expect(self.sim.position.z).toBeLessThan(3)
    expect(tick.events.get("a")?.some((event) => event.kind === "finish")).toBe(false)
    expect(tick.events.get("b")?.some((event) => event.kind === "finish")).toBe(true)
  })

  test("crowd separation is repaired against walls before progress is awarded", () => {
    const base = makeStubWorld({ finishWhen: (p) => p.x > 0.2 })
    const world = {
      ...base,
      resolve(...args: Parameters<typeof base.resolve>) {
        const contact = base.resolve(...args)
        return {
          ...contact,
          position: { ...contact.position, x: Math.min(0.2, contact.position.x) },
        }
      },
    }
    const self = racer("a", 0.15, 0)
    const other = racer("b", -0.4, 0)
    const tick = stepRace([self, other], world, FIXED_STEP_SEC)
    expect(self.sim.position.x).toBe(0.2)
    expect(Math.abs(self.sim.position.x - other.sim.position.x)).toBeGreaterThan(
      RUNNER.radius * 2 - 0.003,
    )
    expect(tick.events.get("a")?.some((event) => event.kind === "finish")).toBe(false)
  })

  test("manual respawn ignores movement and cannot finish or capture a checkpoint in that tick", () => {
    const self = { ...racer("a", 10, 10), respawnRequested: true }
    const tick = stepRace([self], makeStubWorld({ finishWhen: () => true }), FIXED_STEP_SEC)
    expect(self.sim.position).toEqual(self.respawnPoint)
    expect(tick.events.get("a")?.map((event) => event.kind)).toEqual(["respawn"])
  })

  test("repeated pack/world passes respond to each obstacle at most once per tick", () => {
    let calls = 0
    const base = makeStubWorld({
      impulsesWhen: () =>
        ["left", "right"].map((id) =>
          makeContactImpulse({ kind: "bumper", obstacle: asObstacleId(id), speed: 0, lift: 0 }),
        ),
    })
    const world = {
      ...base,
      resolve(...args: Parameters<typeof base.resolve>) {
        calls++
        const contact = base.resolve(...args)
        return {
          ...contact,
          position: { ...contact.position, x: Math.min(0.2, contact.position.x) },
        }
      },
    }
    const tick = stepRace([racer("a", 0.15, 0), racer("b", -0.4, 0)], world, FIXED_STEP_SEC)
    expect(calls).toBeGreaterThan(4)
    for (const events of tick.events.values())
      expect(events.filter((event) => event.kind === "bounce")).toHaveLength(2)
  })

  test("a fall respawns once and does not capture the finish at the respawn point", () => {
    const self = racer("a", 0, 0)
    self.sim.position.y = -20
    const tick = stepRace(
      [self],
      makeStubWorld({ solid: false, finishWhen: () => true }),
      FIXED_STEP_SEC,
    )
    expect(tick.events.get("a")?.map((event) => event.kind)).toEqual(["respawn"])
  })

  test("roster order does not change a multi-racer collision", () => {
    const run = (reverse: boolean) => {
      const runners = [racer("a", 0, 0), racer("b", 0.3, 0.1), racer("c", 0.1, 0.4)]
      stepRace(reverse ? [...runners].reverse() : runners, makeStubWorld(), FIXED_STEP_SEC)
      return runners.map((runner) => runner.sim)
    }
    expect(run(false)).toEqual(run(true))
  })

  test("invalid duplicate roster is rejected before any racer is moved", () => {
    const self = racer("a", 0, 0)
    const before = structuredClone(self.sim)
    expect(() => stepRace([self, self], makeStubWorld(), FIXED_STEP_SEC)).toThrow("Duplicate")
    expect(self.sim).toEqual(before)
  })

  test("one racer follows the same movement as the single-runner controller", () => {
    const self = racer("a", 0, 0)
    const solo = structuredClone(self.sim)
    const world = makeStubWorld()
    for (let tick = 0; tick < 300; tick++) {
      const input = { ...NEUTRAL_INPUT, forward: 1, jumpPressed: tick === 30, jumpHeld: tick < 50 }
      const result = stepRace([{ ...self, input }], world, FIXED_STEP_SEC)
      const events = stepRunner(solo, input, world, FIXED_STEP_SEC, self.respawnPoint)
      expect(self.sim).toEqual(solo)
      expect(result.events.get("a")).toEqual(events)
    }
  })
})
