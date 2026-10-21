import { expect, test } from "bun:test"
import { FixedPose } from "../src/client/fixed-pose"

test("a 144 Hz display follows constant 60 Hz movement continuously instead of repeating poses", () => {
  const pose = new FixedPose({ x: 0, y: 0, z: 0 })
  let tick = 0
  for (let frame = 3; frame < 144; frame++) {
    const nowMs = (frame * 1000) / 144
    const target = Math.floor(nowMs / (1000 / 60))
    while (tick < target) {
      tick++
      pose.push({ x: tick - 1, y: 0, z: 0 }, { x: tick, y: 0, z: 0 }, (tick * 1000) / 60)
    }
    expect(pose.read(nowMs).x).toBeCloseTo(nowMs / (1000 / 60) - 1, 8)
  }
})

test("respawns snap without interpolating across the course; corrections preserve local interpolation", () => {
  const pose = new FixedPose({ x: 0, y: 0, z: 0 })
  pose.push({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 100)
  const before = pose.read(105)
  pose.translate({ x: 0, y: 2, z: 0 })
  expect(pose.read(105)).toEqual({ ...before, y: 2 })
  pose.reset({ x: 40, y: 1, z: 200 })
  expect(pose.read(105)).toEqual({ x: 40, y: 1, z: 200 })
})

test("a compositor timestamp before the latest timer step uses the older pose segment", () => {
  const pose = new FixedPose({ x: 0, y: 0, z: 0 })
  for (let tick = 1; tick <= 3; tick++)
    pose.push({ x: tick - 1, y: 0, z: 0 }, { x: tick, y: 0, z: 0 }, (tick * 1000) / 60)
  expect(pose.read(48).x).toBeCloseTo(48 / (1000 / 60) - 1, 8)
  expect(pose.read(52).x).toBeCloseTo(52 / (1000 / 60) - 1, 8)
})
