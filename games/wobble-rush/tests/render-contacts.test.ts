import { expect, test } from "bun:test"
import { constrainRenderContacts, type RenderBody } from "../src/client/render-contacts"

const body = (id: string, x: number, shownX: number, y = 0.45, active = true): RenderBody => ({
  id,
  reference: { x, y, z: 0 },
  previous: { x, y, z: 0 },
  position: { x: shownX, y, z: 0 },
  active,
})

test("display corrections preserve contact separation and side without changing reference physics", () => {
  const a = body("a", -0.449, 0.3),
    b = body("b", 0.449, -0.3)
  const reference = structuredClone([a.reference, b.reference])
  constrainRenderContacts([a, b])
  expect(b.position.x - a.position.x).toBeCloseTo(0.898)
  expect([a.reference, b.reference]).toEqual(reference)
})

test("only offending display offsets are removed; a correctly placed player is not shoved", () => {
  const a = body("a", -0.449, 0.2),
    b = body("b", 0.449, 0.449)
  constrainRenderContacts([a, b])
  expect(a.position.x).toBeCloseTo(-0.449)
  expect(b.position.x).toBe(0.449)
})

test("jumps, finished racers and ordinary non-contact smoothing remain unconstrained", () => {
  for (const b of [
    body("b", 0.449, 0.1, 2),
    body("b", 0.449, 0.1, 0.45, false),
    body("b", 4, 3.8),
  ]) {
    const bodies = [body("a", -0.449, -0.2), b]
    const before = structuredClone(bodies)
    constrainRenderContacts(bodies)
    expect(bodies).toEqual(before)
  }
})

test("a full ten-actor pack has bounded render work and falls back to valid world positions", () => {
  const bodies = Array.from({ length: 10 }, (_, i) => body(String(i), i * 0.898, 0))
  constrainRenderContacts(bodies)
  for (let i = 1; i < bodies.length; i++)
    expect((bodies[i]?.position.x ?? 0) - (bodies[i - 1]?.position.x ?? 0)).toBeGreaterThanOrEqual(
      0.8979,
    )
})

test("a fast correction cannot cross a rival between already separated display endpoints", () => {
  const a = body("a", -0.449, 0.9),
    b = body("b", 0.449, -0.9)
  constrainRenderContacts([a, b])
  expect(b.position.x - a.position.x).toBeGreaterThanOrEqual(0.8979)
})
