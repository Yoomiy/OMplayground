/** Full-world reconciliation cost; run with Bun on an otherwise quiet host. */
import { AuthoritativeRace } from "../../src/shared/authoritative-race"
import { playableCourse } from "../../src/shared/course-catalog"
import { createRunner } from "../../src/shared/player"
import { RunnerPrediction } from "../../src/shared/prediction"
import { asPlayerId, NEUTRAL_INPUT } from "../../src/shared/types"

for (const humans of [2, 8]) {
  const course = playableCourse("sunrise-scramble"),
    ids = Array.from({ length: humans }, (_, i) => asPlayerId(`p${i}`))
  const race = new AuthoritativeRace(
    "cost",
    course,
    ids.map((id, i) => ({ id, name: id, colorIndex: i })),
    7,
  )
  let now = 0
  const prediction = new RunnerPrediction(() => now),
    sim = createRunner(course.spawn, 0),
    samples = []
  for (let step = 0; step < 2100; step++) {
    now = (step * 1000) / 60
    race.step()
    if (step % 3 === 0) {
      const frame = race.frame("racing", now)
      const start = performance.now()
      const actor = frame.actors[0]
      if (actor === undefined) throw new Error("Missing actor")
      prediction.reconcile(sim, frame, actor, course, 0.15)
      if (step > 300) samples.push(performance.now() - start)
    }
    const result = prediction.advance(sim, NEUTRAL_INPUT, false, course, now)
    if (result && step % 6 === 0) race.enqueue(asPlayerId("p0"), result.message)
  }
  samples.sort((a, b) => a - b)
  console.log(
    JSON.stringify({
      humans,
      actors: humans + 2,
      snapshots: samples.length,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p95Ms: samples[Math.floor(samples.length * 0.95)],
      p99Ms: samples[Math.floor(samples.length * 0.99)],
      maxMs: samples.at(-1),
      environment: "ARM64 2-core VPS; full world replay, 300ms RTT lead",
    }),
  )
}
