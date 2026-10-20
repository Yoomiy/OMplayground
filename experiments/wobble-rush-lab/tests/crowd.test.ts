import { describe, expect, test } from "bun:test"
import { FIXED_STEP_SEC, RUNNER } from "../src/shared/constants"
import type { CrowdBody, CrowdBump } from "../src/shared/crowd"
import { CROWD, resolveCrowdPass } from "../src/shared/crowd"

type BodyOptions = {
  readonly y?: number
  readonly vx?: number
  readonly vy?: number
  readonly vz?: number
  readonly movable?: boolean
  readonly radius?: number
}

const makeBody = (id: string, x: number, z: number, options: BodyOptions = {}): CrowdBody => ({
  id,
  radius: options.radius ?? RUNNER.radius,
  position: { x, y: options.y ?? RUNNER.radius, z },
  velocity: { x: options.vx ?? 0, y: options.vy ?? 0, z: options.vz ?? 0 },
  movable: options.movable ?? true,
})

const hDist = (a: CrowdBody, b: CrowdBody): number =>
  Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)

// Drive the production contact pass with the race tick's pass budget and response set.
const settleCrowd = (bodies: readonly CrowdBody[]): readonly CrowdBump[] => {
  const responded = new Set<string>()
  const bumps: CrowdBump[] = []
  for (let pass = 0; pass < CROWD.solverPasses; pass++)
    bumps.push(...resolveCrowdPass(bodies, responded))
  return bumps
}

const TOUCHING = RUNNER.radius * 2
const SETTLED = TOUCHING - CROWD.separationSlop

const snapshot = (bodies: readonly CrowdBody[]) =>
  bodies.map((b) => ({
    id: b.id,
    position: { ...b.position },
    velocity: { ...b.velocity },
  }))

describe("separation", () => {
  test("a three-runner squeeze does not leave the first pair deeply overlapping", () => {
    const bodies = [makeBody("a", 0, 0), makeBody("b", 0.5, 0), makeBody("c", 1, 0)]
    settleCrowd(bodies)
    for (const [i, a] of bodies.entries())
      for (const b of bodies.slice(i + 1)) expect(hDist(a, b)).toBeGreaterThan(SETTLED - 0.001)
  })

  test("a crowded pack stays finite, separates and cannot gain kinetic energy", () => {
    const bodies = Array.from({ length: 10 }, (_, i) =>
      makeBody(String(i), (i % 4) * 0.4, Math.floor(i / 4) * 0.4, {
        vx: i % 2 === 0 ? 8 : -8,
        vz: i % 3 === 0 ? 6 : -6,
      }),
    )
    const energy = () => bodies.reduce((sum, b) => sum + b.velocity.x ** 2 + b.velocity.z ** 2, 0)
    const before = energy()
    const bumps = settleCrowd(bodies)
    expect(new Set(bumps.map((b) => `${b.a}:${b.b}`)).size).toBe(bumps.length)
    expect(energy()).toBeLessThanOrEqual(before + 1e-8)
    for (const [i, a] of bodies.entries())
      for (const b of bodies.slice(i + 1)) expect(hDist(a, b)).toBeGreaterThan(SETTLED - 0.02)
  })

  test("racers on different bridge levels do not push or exchange momentum", () => {
    const a = makeBody("lower", 0, 0, { vx: 8 })
    const b = makeBody("upper", 0.1, 0, { y: 10 + RUNNER.radius, vx: -8 })
    const before = snapshot([a, b])
    expect(resolveCrowdPass([a, b])).toHaveLength(0)
    expect(snapshot([a, b])).toEqual(before)
  })

  test("a jump that clears another racer does not cause a sideways shove", () => {
    const a = makeBody("ground", 0, 0)
    const b = makeBody("jump", 0.1, 0, { y: RUNNER.radius + TOUCHING, vx: -8 })
    const before = snapshot([a, b])
    expect(resolveCrowdPass([a, b])).toHaveLength(0)
    expect(snapshot([a, b])).toEqual(before)
  })

  test("partially overlapping spheres use their horizontal cross section", () => {
    const a = makeBody("ground", 0, 0)
    const b = makeBody("jump", 0.1, 0, { y: RUNNER.radius + 0.6 })
    resolveCrowdPass([a, b])
    expect(hDist(a, b)).toBeCloseTo(Math.sqrt(TOUCHING ** 2 - 0.6 ** 2) - CROWD.separationSlop)
    expect(a.position.y).toBe(RUNNER.radius)
    expect(b.position.y).toBe(RUNNER.radius + 0.6)
  })

  test("two overlapping movable bodies each take half the correction and end just touching, y untouched", () => {
    const a = makeBody("a", 0, 0, { vy: 2 })
    const b = makeBody("b", 0.5, 0, { vy: -3 })
    const bumps = resolveCrowdPass([a, b])
    const half = (TOUCHING - 0.5 - CROWD.separationSlop) / 2
    expect(a.position.x).toBeCloseTo(-half, 9)
    expect(b.position.x).toBeCloseTo(0.5 + half, 9)
    expect(hDist(a, b)).toBeCloseTo(SETTLED, 9)
    expect(a.position.y).toBe(RUNNER.radius)
    expect(b.position.y).toBe(RUNNER.radius)
    expect(bumps).toHaveLength(0)
  })

  test("a movable body colliding with an immovable one takes the whole correction; the immovable one is untouched", () => {
    const a = makeBody("a", 0, 0)
    const b = makeBody("b", 0.5, 0, { movable: false, vx: -3 })
    resolveCrowdPass([a, b])
    expect(a.position.x).toBeCloseTo(-(TOUCHING - 0.5 - CROWD.separationSlop), 9)
    expect(hDist(a, b)).toBeCloseTo(SETTLED, 9)
    expect(b.position.x).toBe(0.5)
    expect(b.position.z).toBe(0)
    expect(b.velocity.x).toBe(-3)
    expect(a.velocity.x).toBeCloseTo(-(1 + CROWD.restitution) * 3, 9)
  })

  test("two immovable bodies are left untouched and report nothing", () => {
    const a = makeBody("a", 0, 0, { movable: false, vx: 4 })
    const b = makeBody("b", 0.3, 0.2, { movable: false, vx: -4 })
    const before = snapshot([a, b])
    const bumps = resolveCrowdPass([a, b])
    expect(snapshot([a, b])).toEqual(before)
    expect(bumps).toHaveLength(0)
  })

  test("coincident centres separate along a deterministic axis instead of producing NaN", () => {
    const a = makeBody("a", 1, 1)
    const b = makeBody("b", 1, 1)
    const c = makeBody("a", 1, 1)
    const d = makeBody("b", 1, 1)
    resolveCrowdPass([a, b])
    resolveCrowdPass([c, d])
    expect(Number.isNaN(hDist(a, b))).toBe(false)
    expect(hDist(a, b)).toBeCloseTo(SETTLED, 9)
    expect(b.position.x).toBeGreaterThan(a.position.x)
    expect(a.position.z).toBe(1)
    expect(b.position.z).toBe(1)
    expect(snapshot([a, b])).toEqual(snapshot([c, d]))
  })
})

describe("impulse exchange", () => {
  test("a reopened pair separates again without firing a second impact in the same tick", () => {
    const a = makeBody("a", 0, 0, { vx: 8 })
    const b = makeBody("b", 0.5, 0)
    const responded = new Set<string>()
    expect(resolveCrowdPass([a, b], responded)).toHaveLength(1)
    // A later rival/world contact can close the pair again during the solve.
    a.position.x = 0
    b.position.x = 0.5
    a.velocity.x = 6
    b.velocity.x = 0
    expect(resolveCrowdPass([a, b], responded)).toHaveLength(0)
    expect(hDist(a, b)).toBeCloseTo(SETTLED, 9)
    expect(a.velocity.x).toBe(6)
    expect(b.velocity.x).toBe(0)
  })

  test("a fast body closing on a slow one transfers momentum; velocity.y never changes", () => {
    const fast = makeBody("fast", 0, 0, { vx: 8, vy: 1 })
    const slow = makeBody("slow", 0.5, 0, { vx: 2, vy: -1 })
    resolveCrowdPass([fast, slow])
    const impulse = ((1 + CROWD.restitution) * (8 - 2)) / 2
    expect(fast.velocity.x).toBeCloseTo(8 - impulse, 9)
    expect(slow.velocity.x).toBeCloseTo(2 + impulse, 9)
    expect(slow.velocity.x).toBeGreaterThan(2)
    expect(fast.velocity.x).toBeLessThan(8)
    expect(fast.velocity.y).toBe(1)
    expect(slow.velocity.y).toBe(-1)
  })

  test("a body already moving away is not pulled back", () => {
    const a = makeBody("a", 0, 0, { vx: -3 })
    const b = makeBody("b", 0.5, 0, { vx: 3 })
    resolveCrowdPass([a, b])
    expect(a.velocity.x).toBe(-3)
    expect(b.velocity.x).toBe(3)
    expect(hDist(a, b)).toBeCloseTo(SETTLED, 9)
  })

  test("non-overlapping bodies are not mutated and report nothing", () => {
    const a = makeBody("a", 0, 0, { vx: 5, vy: 2 })
    const b = makeBody("b", 3, 4, { vx: -5, vy: -2 })
    const before = snapshot([a, b])
    const bumps = resolveCrowdPass([a, b])
    expect(snapshot([a, b])).toEqual(before)
    expect(bumps).toHaveLength(0)
  })
})

describe("no jitter", () => {
  test("a resting pair stays settled for 120 ticks with negligible drift and no repeated bumps", () => {
    const a = makeBody("a", 0, 0)
    const b = makeBody("b", TOUCHING - 0.1, 0)
    const first = resolveCrowdPass([a, b])
    expect(first).toHaveLength(0)
    let minAx = a.position.x
    let maxAx = a.position.x
    let minBx = b.position.x
    let maxBx = b.position.x
    let laterBumps = 0
    for (let tick = 0; tick < 120; tick += 1) {
      a.position.x += a.velocity.x * FIXED_STEP_SEC
      a.position.z += a.velocity.z * FIXED_STEP_SEC
      b.position.x += b.velocity.x * FIXED_STEP_SEC
      b.position.z += b.velocity.z * FIXED_STEP_SEC
      laterBumps += resolveCrowdPass([a, b]).length
      minAx = Math.min(minAx, a.position.x)
      maxAx = Math.max(maxAx, a.position.x)
      minBx = Math.min(minBx, b.position.x)
      maxBx = Math.max(maxBx, b.position.x)
    }
    expect(laterBumps).toBe(0)
    expect(maxAx - minAx).toBeLessThan(1e-9)
    expect(maxBx - minBx).toBeLessThan(1e-9)
    expect(a.velocity.x).toBe(0)
    expect(b.velocity.x).toBe(0)
    expect(hDist(a, b)).toBeCloseTo(SETTLED, 9)
  })
})

describe("bump reporting", () => {
  test("a gentle graze below the bump threshold reports nothing but still nudges", () => {
    const a = makeBody("a", 0, 0, { vx: 0.5 })
    const b = makeBody("b", TOUCHING - 0.1, 0)
    const bumps = resolveCrowdPass([a, b])
    expect(bumps).toHaveLength(0)
    expect(b.velocity.x).toBeGreaterThan(0)
  })

  test("a real collision reports one bump in array order with a positive closing speed", () => {
    const slow = makeBody("slow", 0, 0)
    const fast = makeBody("fast", -(TOUCHING - 0.1), 0, { vx: 6 })
    const bumps = resolveCrowdPass([slow, fast])
    expect(bumps).toHaveLength(1)
    for (const bump of bumps) {
      expect(bump.a).toBe("slow")
      expect(bump.b).toBe("fast")
      expect(bump.speed).toBeCloseTo(6, 9)
      expect(bump.speed).toBeGreaterThan(0)
      expect(bump.point.x).toBeGreaterThan(fast.position.x)
      expect(bump.point.x).toBeLessThan(slow.position.x)
      expect(bump.point.y).toBe(RUNNER.radius)
    }
  })
})

describe("determinism", () => {
  test("two identical runs mutate identically and return identical bumps", () => {
    const build = () => [
      makeBody("alpha", 0, 0, { vx: 7, vy: 1 }),
      makeBody("bravo", 0.6, 0.2, { vx: -1 }),
      makeBody("charlie", 5, 5, { vx: 2 }),
      makeBody("delta", 0.2, -0.5, { movable: false, vx: 1 }),
    ]
    const runOne = build()
    const runTwo = build()
    const bumpsOne = resolveCrowdPass(runOne)
    const bumpsTwo = resolveCrowdPass(runTwo)
    expect(bumpsOne.length).toBeGreaterThan(0)
    expect(snapshot(runOne)).toEqual(snapshot(runTwo))
    expect(bumpsOne).toEqual(bumpsTwo)
  })
})
