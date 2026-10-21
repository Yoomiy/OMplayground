import { expect, test } from "bun:test"
import { SPECTATOR_BUFFER_MS, SpectatorTimeline } from "../src/client/spectator-timeline"
import { AuthoritativeRace } from "../src/shared/authoritative-race"
import { SUNRISE_SCRAMBLE } from "../src/shared/course"
import { asPlayerId } from "../src/shared/types"

function setup() {
  let now = 0
  const timeline = new SpectatorTimeline(() => now)
  const race = new AuthoritativeRace(
    "watch",
    SUNRISE_SCRAMBLE,
    [{ id: asPlayerId("a"), name: "A", colorIndex: 0 }],
    7,
    0,
  )
  return {
    timeline,
    race,
    time: (value: number) => {
      now = value
    },
  }
}

test("spectator poses and obstacles share a buffered, fractional tick without extrapolation", () => {
  const s = setup()
  for (let tick = 0; tick <= 24; tick += 4) {
    s.time((tick * 1000) / 60)
    const frame = s.race.frame("racing", (tick * 1000) / 60)
    frame.tick = tick
    frame.worldTimeSec = 3 + tick / 60
    const actor = frame.actors[0]
    if (!actor) throw new Error("Missing actor")
    actor.sim.position.z = tick
    s.timeline.push(frame)
  }
  s.time(400 + 1000 / 120)
  const sample = s.timeline.read()
  expect(sample).not.toBeNull()
  expect(sample?.tick).toBeCloseTo(24 - (SPECTATOR_BUFFER_MS * 60) / 1000 + 0.5)
  expect(sample?.actors[0]?.sim.position.z).toBeCloseTo(sample?.tick ?? -1)
  expect(sample?.worldTimeSec).toBeCloseTo(3 + (sample?.tick ?? 0) / 60)
  s.time(2000)
  const frozen = s.timeline.read()
  expect(frozen?.tick).toBe(24)
  expect(frozen?.worldTimeSec).toBe(3.4)
  s.time(3000)
  expect(s.timeline.read()).toEqual(frozen)
})

test("spectators never interpolate across respawns, removal, or finish boundaries", () => {
  const s = setup()
  const lower = s.race.frame("racing", 0)
  const upper = structuredClone(lower)
  upper.tick = 4
  upper.worldTimeSec += 4 / 60
  const target = upper.actors[0]
  if (!target) throw new Error("Missing actor")
  target.sim.position.z = 100
  target.respawnSeq++
  target.finishedMs = 67
  s.timeline.push(lower)
  s.time((4 * 1000) / 60)
  s.timeline.push(upper)
  s.time(SPECTATOR_BUFFER_MS + (2 * 1000) / 60)
  const before = s.timeline.read()
  expect(before?.actors[0]?.sim.position).toEqual(lower.actors[0]?.sim.position)
  expect(before?.actors[0]?.finishedMs).toBeNull()
  s.time(1000)
  expect(s.timeline.read()?.actors[0]).toEqual(target)
  s.time(1100)
  s.timeline.push({ ...upper, tick: 8, worldTimeSec: 3 + 8 / 60, actors: [] })
  s.time(2000)
  expect(s.timeline.read()?.actors).toEqual([])
})

test("packet jitter cannot reverse the spectator clock and storage stays bounded", () => {
  const s = setup()
  let previous = 0
  for (let tick = 0; tick < 600; tick += 4) {
    s.time((tick * 1000) / 60 + (tick % 12) * 3)
    const frame = { ...s.race.frame("racing", 0), tick, worldTimeSec: 3 + tick / 60 }
    s.timeline.push(frame)
    const sample = s.timeline.read()
    expect(sample?.tick).toBeGreaterThanOrEqual(previous)
    expect(sample?.tick).toBeLessThanOrEqual(tick)
    previous = sample?.tick ?? previous
    expect(s.timeline.frameCount).toBeLessThanOrEqual(32)
    s.timeline.push({ ...frame, tick: tick - 1 })
    expect(s.timeline.read()?.tick).toBeGreaterThanOrEqual(previous)
  }
})

test("pause, resume, reconnect gaps and a new cup race start clean presentation epochs", () => {
  const s = setup()
  s.timeline.push(s.race.frame("racing", 0))
  s.time(100)
  const paused = { ...s.race.frame("finished", 100), tick: 12, worldTimeSec: 3.2 }
  s.timeline.push(paused)
  expect(s.timeline.read()?.tick).toBe(12)
  s.time(500)
  expect(s.timeline.read()?.worldTimeSec).toBe(3.2)
  s.timeline.push({ ...paused, phase: "racing" })
  expect(s.timeline.read()?.tick).toBe(12)
  s.time(1200)
  s.timeline.push({ ...paused, phase: "racing", tick: 60, worldTimeSec: 4 })
  expect(s.timeline.read()?.tick).toBe(60)
  s.time(1300)
  s.timeline.push({
    ...paused,
    raceId: "next-course",
    tick: 0,
    worldTimeSec: 0,
    phase: "countdown",
  })
  expect(s.timeline.read()?.tick).toBe(0)
  expect(s.timeline.frameCount).toBe(1)
  s.timeline.clear()
  expect(s.timeline.read()).toBeNull()
})

test("a stale TCP batch recovers to the buffered live edge without replaying the outage", () => {
  const s = setup()
  s.timeline.push(s.race.frame("racing", 0))
  s.time(5000)
  const frozen = s.timeline.read()
  expect(frozen?.tick).toBe(0)
  for (let tick = 4; tick <= 300; tick += 4)
    s.timeline.push({ ...s.race.frame("racing", 0), tick, worldTimeSec: 3 + tick / 60 })
  const recovered = s.timeline.read()
  expect(recovered?.tick).toBeCloseTo(294)
  expect(recovered?.worldTimeSec).toBeCloseTo(7.9)
  expect(s.timeline.frameCount).toBeLessThanOrEqual(32)
})
