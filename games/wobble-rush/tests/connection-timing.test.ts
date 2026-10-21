import { expect, test } from "bun:test"
import { ConnectionTiming } from "../src/client/connection-timing"

test("pongs later than the next ping retain their actual RTT and duplicates are ignored", () => {
  const timing = new ConnectionTiming()
  timing.sent(1, 0)
  timing.sent(2, 1000)
  timing.received(1, 1400)
  expect(timing.rttMs).toBe(1400)
  timing.received(1, 1600)
  expect(timing.rttMs).toBe(1400)
  timing.received(2, 2400)
  expect(timing.rttMs).toBe(1400)
  timing.sent(3, 3000)
  timing.received(3, 3100)
  expect(timing.rttMs).toBe(1400)
})

test("expired and unknown pong nonces cannot change the estimate", () => {
  const timing = new ConnectionTiming()
  timing.sent(1, 0)
  timing.sent(2, 10001)
  timing.received(1, 10002)
  timing.received(88, 10002)
  expect(timing.rttMs).toBe(0)
  timing.received(2, 10051)
  expect(timing.rttMs).toBe(50)
})

test("admission RTT seeds prediction before the first resumed frame", () => {
  const timing = new ConnectionTiming()
  timing.sample(240)
  expect(timing.rttMs).toBe(240)
  timing.sent(1, 1000)
  timing.received(1, 1040)
  expect(timing.rttMs).toBe(240)
})
