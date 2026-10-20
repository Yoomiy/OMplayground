import { FIXED_STEP_SEC } from "../../src/shared/constants"
import { COURSES, playableCourse } from "../../src/shared/course-catalog"
import {
  createNpcRacers,
  npcInput,
  rewindNpcAfterRespawn,
  updateNpcProgress,
} from "../../src/shared/npc"
import { createRunner, stepRunner } from "../../src/shared/player"
import { stepRace } from "../../src/shared/race-simulation"
import { createWorldSnapshot } from "../../src/shared/world"

const seeds = [7, 42, 99, 424242]
let failed = 0
let runs = 0
const args = Bun.argv.slice(2)
const crowd = args.includes("--crowd")
const selected = args.filter((arg) => arg !== "--crowd")
for (const base of COURSES.filter(
  (course) => selected.length === 0 || selected.includes(course.id),
)) {
  for (const remix of [false, true]) {
    for (const seed of seeds) {
      const course = playableCourse(base.id, remix ? seed : null)
      const npcs = createNpcRacers(course, seed, 4)
      const sims = npcs.map((_, index) =>
        createRunner({ ...course.spawn, x: course.spawn.x + (index - 1.5) * 1.5 }, course.spawnYaw),
      )
      const times: (number | null)[] = npcs.map(() => null)
      const falls = npcs.map(() => 0)
      const captured = npcs.map(() => new Set<number>())
      for (let tick = 0; tick < 180 / FIXED_STEP_SEC && times.some((t) => t === null); tick++) {
        const t = (tick + 1) * FIXED_STEP_SEC
        const world = createWorldSnapshot(course, t)
        const runners = npcs.flatMap((npc, index) => {
          const sim = sims[index]
          if (sim === undefined || times[index] !== null) return []
          return [
            {
              id: npc.id,
              sim,
              input: npcInput(npc, sim, course, world, t),
              respawnPoint:
                course.checkpoints.find((cp) => cp.index === sim.checkpoint)?.respawn ??
                course.spawn,
            },
          ]
        })
        const results = crowd
          ? stepRace(runners, world, FIXED_STEP_SEC).events
          : new Map(
              runners.map((runner) => [
                runner.id,
                stepRunner(runner.sim, runner.input, world, FIXED_STEP_SEC, runner.respawnPoint),
              ]),
            )
        for (const [index, npc] of npcs.entries()) {
          const sim = sims[index]
          if (sim === undefined || times[index] !== null) continue
          const events = results.get(npc.id) ?? []
          if (events.some((e) => e.kind === "respawn")) rewindNpcAfterRespawn(npc, sim, course)
          updateNpcProgress(npc, sim, course, FIXED_STEP_SEC)
          for (const event of events)
            if (event.kind === "checkpoint") captured[index]?.add(event.index)
          if (events.some((e) => e.kind === "respawn")) falls[index] = (falls[index] ?? 0) + 1
          if (events.some((e) => e.kind === "finish")) times[index] = t
        }
      }
      runs += npcs.length
      const lastCheckpoint = course.checkpoints.at(-1)?.index ?? 0
      const stuck = sims.filter(
        (sim, index) =>
          times[index] === null ||
          sim.checkpoint !== lastCheckpoint ||
          course.checkpoints.some((cp) => !captured[index]?.has(cp.index)),
      ).length
      failed += stuck
      console.log(
        JSON.stringify({
          course: course.id,
          crowd,
          remix,
          seed,
          times: times.map((t) => (t === null ? null : Number(t.toFixed(2)))),
          falls,
          routes: npcs.map(
            (npc) =>
              course.routes?.[npc.colorIndex % course.routes.length]?.name ?? "Original road",
          ),
          checkpoints: sims.map((sim) => sim.checkpoint),
          captured: captured.map((indices) => [...indices].sort((a, b) => a - b)),
          stuck: sims.flatMap((sim, index) =>
            times[index] === null
              ? [{ index, pos: sim.position, cp: sim.checkpoint, wp: npcs[index]?.waypointIndex }]
              : [],
          ),
        }),
      )
    }
  }
}
console.log(`${runs - failed}/${runs} NPC runs finished`)
if (failed) process.exit(1)
