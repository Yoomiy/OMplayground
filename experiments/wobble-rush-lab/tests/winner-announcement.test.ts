import { expect, test } from "bun:test"
import { isolate } from "../src/client/hebrew"
import { winnerAnnouncement } from "../src/client/winner-announcement"
import { createSession } from "../src/shared/session"
import { asPlayerId } from "../src/shared/types"

test("cup winners use points, finishes and total time; exact ties share the win", () => {
  const alice = { id: asPlayerId("a"), name: "Alice", points: 28, finishes: 3, totalMs: 90_000 }
  const bob = { ...alice, id: asPlayerId("b"), name: "Bob" }
  const cup = {
    ...createSession(42, { courseId: "sky-hop", mode: "cup", remix: false }),
    complete: true,
  }
  expect(winnerAnnouncement([], { ...cup, standings: [alice, { ...bob, points: 26 }] })).toBe(
    `הזוכה בגביע: ${isolate("Alice")}!`,
  )
  expect(winnerAnnouncement([], { ...cup, standings: [alice, { ...bob, finishes: 2 }] })).toBe(
    `הזוכה בגביע: ${isolate("Alice")}!`,
  )
  expect(winnerAnnouncement([], { ...cup, standings: [alice, { ...bob, totalMs: 90_001 }] })).toBe(
    `הזוכה בגביע: ${isolate("Alice")}!`,
  )
  expect(winnerAnnouncement([], { ...cup, standings: [alice, bob] })).toBe(
    `זכייה משותפת בגביע: ${isolate("Alice")} ו־${isolate("Bob")}!`,
  )
  expect(
    winnerAnnouncement([], { ...cup, standings: [{ ...alice, points: 0, finishes: 0 }] }),
  ).toBe("הגביע הסתיים ללא מסיימים.")
})

test("rounds announce accepted finishers, including ties, and never name a DNF winner", () => {
  const results = [
    { id: asPlayerId("a"), name: "Alice", place: 1, timeMs: 1000 },
    { id: asPlayerId("b"), name: "Bob", place: 2, timeMs: 1200 },
  ] as const
  expect(winnerAnnouncement(results)).toBe(`הזוכה במרוץ: ${isolate("Alice")}!`)
  expect(winnerAnnouncement([results[0], { ...results[1], timeMs: 1000 }])).toBe(
    `תיקו במקום הראשון: ${isolate("Alice")} ו־${isolate("Bob")}!`,
  )
  expect(winnerAnnouncement([])).toBe("אין מסיימים במרוץ הזה.")
  expect(winnerAnnouncement(results.map((row) => ({ ...row, timeMs: null })))).toBe(
    "אין מסיימים במרוץ הזה.",
  )
})
