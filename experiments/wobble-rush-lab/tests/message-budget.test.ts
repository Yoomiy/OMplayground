import { expect, test } from "bun:test"
import {
  MESSAGE_BURST_CAPACITY,
  MESSAGE_RATE_PER_SEC,
  MessageBudget,
} from "../src/action/message-budget"

test("a finite burst allowance refills at the sustained ceiling, without window resets", () => {
  const budget = new MessageBudget(0)
  for (let index = 0; index < MESSAGE_BURST_CAPACITY; index++) expect(budget.consume(0)).toBe(true)
  expect(budget.consume(0)).toBe(false)
  for (let index = 0; index < MESSAGE_RATE_PER_SEC / 2; index++)
    expect(budget.consume(500)).toBe(true)
  expect(budget.consume(500)).toBe(false)
  expect(budget.consume(499)).toBe(false)
  expect(budget.consume(501)).toBe(false)
})

test("idle time cannot accumulate an unlimited future burst", () => {
  const budget = new MessageBudget(0)
  expect(budget.consume(0)).toBe(true)
  for (let index = 0; index < MESSAGE_BURST_CAPACITY; index++)
    expect(budget.consume(1_000_000)).toBe(true)
  expect(budget.consume(1_000_000)).toBe(false)
})

test("ten minutes of 60 Hz controls survive repeated 1.8-second network holds plus heartbeats", () => {
  const arrivals: number[] = []
  for (let tick = 0; tick < 60 * 600; tick++) {
    const generationMs = (tick * 1000) / 60
    const cycleMs = generationMs % 5000
    arrivals.push(cycleMs < 1800 ? generationMs - cycleMs + 1800 : generationMs)
  }
  for (let ms = 0; ms < 600_000; ms += 2000) arrivals.push(ms)
  arrivals.sort((a, b) => a - b)
  const budget = new MessageBudget(0)
  let oldWindowMs = 0
  let oldCount = 0
  let rejectedByOldLimit = false
  for (const now of arrivals) {
    if (now - oldWindowMs >= 1000) {
      oldWindowMs = now
      oldCount = 0
    }
    if (++oldCount > 120) rejectedByOldLimit = true
    expect(budget.consume(now)).toBe(true)
  }
  expect(rejectedByOldLimit).toBe(true)
})

test("a sustained flood exhausts its allowance and a new connection gets its own budget", () => {
  const flood = new MessageBudget(0)
  let rejectedAt: number | null = null
  for (let index = 0; index < 1000; index++)
    if (!flood.consume((index * 1000) / 240)) {
      rejectedAt = index
      break
    }
  expect(rejectedAt).not.toBeNull()
  expect(rejectedAt).toBeLessThan(500)
  expect(new MessageBudget(0).consume(0)).toBe(true)
})
