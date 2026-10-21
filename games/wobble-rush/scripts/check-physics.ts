/** Exact trajectory fingerprint; compare identical Node bundles before/after physics optimizations. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { AuthoritativeRace } from "../src/shared/authoritative-race"
import { COURSES, playableCourse } from "../src/shared/course-catalog"

for (const base of COURSES)
  for (const remix of [false, true]) {
    const race = new AuthoritativeRace(
      "digest",
      playableCourse(base.id, remix ? 42 : null),
      [],
      42,
      4,
    )
    const hash = createHash("sha256")
    let finished = false
    while (race.tick < 10800 && !finished) {
      race.step()
      const frame = race.frame("racing", (race.tick * 1000) / 60)
      hash.update(JSON.stringify(frame))
      finished = frame.actors.every((actor) => actor.finishedMs !== null)
    }
    assert.ok(finished, `${base.id} remix=${remix}: NPCs exceeded 180 simulated seconds`)
    console.log(
      JSON.stringify({
        course: base.id,
        remix,
        ticks: race.tick,
        finished,
        sha256: hash.digest("hex"),
      }),
    )
  }
