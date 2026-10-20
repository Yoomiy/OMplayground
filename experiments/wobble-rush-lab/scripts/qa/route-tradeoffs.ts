/** Compare route costs with equal driving skill; render frame rates do not enter this audit. */
import { COURSES, playableCourse } from "../../src/shared/course-catalog"
import { COURSE_STAGES } from "../../src/shared/creative-courses"
import {
  createNpcRacers,
  npcInput,
  rewindNpcAfterRespawn,
  updateNpcProgress,
} from "../../src/shared/npc"
import { createRunner, stepRunner } from "../../src/shared/player"
import { createWorldSnapshot } from "../../src/shared/world"

const only = Bun.argv[2]
for (const base of COURSES.filter(
  (c) => c.routes !== undefined && (only === undefined || c.id === only),
)) {
  for (const seed of [7, 42, 99, 424242]) {
    const course = playableCourse(base.id, seed)
    const racers = createNpcRacers(course, seed, 3).map((npc) => ({ ...npc, skill: 0.92 }))
    const sims = racers.map(() => createRunner(course.spawn, course.spawnYaw))
    const times: (number | null)[] = racers.map(() => null),
      falls = racers.map(() => 0)
    const splits: Record<number, number>[] = racers.map(() => ({}))
    for (let tick = 0; tick < 10800 && times.some((t) => t === null); tick++) {
      const time = (tick + 1) / 60,
        world = createWorldSnapshot(course, time)
      for (const [i, npc] of racers.entries()) {
        const sim = sims[i]
        if (sim === undefined || times[i] !== null) continue
        const respawn =
          course.checkpoints.find((cp) => cp.index === sim.checkpoint)?.respawn ?? course.spawn
        const events = stepRunner(
          sim,
          npcInput(npc, sim, course, world, time),
          world,
          1 / 60,
          respawn,
        )
        if (events.some((e) => e.kind === "respawn")) {
          falls[i] = (falls[i] ?? 0) + 1
          rewindNpcAfterRespawn(npc, sim, course)
        }
        for (const event of events)
          if (event.kind === "checkpoint") {
            const row = splits[i]
            if (row !== undefined) row[event.index] = Number(time.toFixed(2))
          }
        updateNpcProgress(npc, sim, course, 1 / 60)
        if (events.some((e) => e.kind === "finish")) times[i] = Number(time.toFixed(2))
      }
    }
    if (times.some((t) => t === null))
      throw new Error(`${course.id} seed ${seed} has an unfinished equal-skill pilot`)
    console.log(
      JSON.stringify({
        course: course.id,
        seed,
        times,
        falls,
        splits,
        sections: COURSE_STAGES[course.id]?.map((stage) => ({
          hint: stage.hint,
          roads: stage.roads.map((road) => ({
            width: road.width ?? 4.6,
            gaps: road.gaps?.length ?? 0,
            length: Number(
              road.points
                .reduce((sum, b, i) => {
                  const a = road.points[i - 1]
                  return sum + (a ? Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) : 0)
                }, 0)
                .toFixed(1),
            ),
          })),
        })),
      }),
    )
  }
}
