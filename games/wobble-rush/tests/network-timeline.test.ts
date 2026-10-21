import { describe, expect, test } from "bun:test"
import { NetworkTimeline } from "../src/client/network-timeline"
import { RaceClock } from "../src/client/race-clock"

describe("continuous network timing", () => {
  test("jittery snapshots and changing RTT cannot reverse or jump a constant-speed bar", () => {
    let now = 0
    const clock = new RaceClock(() => now)
    clock.beginCountdown(3)
    clock.syncAuthority(3, 0.05, 3)
    clock.startRacing()
    let previous = clock.renderWorldTimeSec
    for (let frame = 1; frame <= 1440; frame++) {
      now = (frame * 1000) / 144
      if (frame % 7 === 0) {
        const delay = frame % 21 === 0 ? 0.11 : 0.03
        const halfRtt = frame % 14 === 0 ? 0.07 : 0.04
        clock.syncAuthority(3 + now / 1000 - delay, halfRtt, 3)
      }
      if (frame % 2 === 0) clock.tick(1 / 60, false)
      const current = clock.renderWorldTimeSec
      const step = current - previous
      expect(step).toBeGreaterThanOrEqual(0.9 / 144 - 1e-10)
      expect(step).toBeLessThanOrEqual(1.1 / 144 + 1e-10)
      previous = current
    }
    expect(Math.abs(clock.renderWorldTimeSec - (3 + now / 1000))).toBeLessThan(0.08)
  })

  test("a delayed batch changes the target without moving the displayed world", () => {
    const clock = new NetworkTimeline(10, 1000)
    expect(clock.read(1050)).toBeCloseTo(10.05)
    for (let index = 0; index < 20; index++) clock.sync(8 + index * 0.05, 1050)
    expect(clock.read(1050)).toBeCloseTo(10.05)
    expect(clock.read(1100)).toBeCloseTo(10.095)
  })

  test("a stable new clock offset converges without a permanent phase error", () => {
    const clock = new NetworkTimeline(0, 0)
    for (let now = 50; now <= 10_000; now += 50) {
      clock.sync(now / 1000 + 0.2, now)
      clock.read(now)
    }
    expect(clock.read(10_000)).toBeCloseTo(10.2, 5)
  })

  test("countdown to racing preserves the display clock and reconnect resets it", () => {
    let now = 0
    const clock = new RaceClock(() => now)
    clock.beginCountdown(3)
    clock.syncAuthority(2.99, 0.04, 3)
    now = 30
    const before = clock.renderWorldTimeSec
    clock.startRacing()
    clock.syncNetworkWorld(1000, 1000, 3)
    expect(clock.renderWorldTimeSec).toBe(before)
    clock.suspend()
    clock.startRacing()
    clock.syncAuthority(20, 0.04, 3)
    expect(clock.renderWorldTimeSec).toBeCloseTo(20.04)
    clock.idle()
    expect(clock.renderWorldTimeSec).toBe(0)
  })
})
