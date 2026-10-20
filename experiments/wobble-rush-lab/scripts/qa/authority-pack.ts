/** Full course matrix through the authoritative host core; pilots submit controls only. */
import { AuthoritativeRace } from "../../src/shared/authoritative-race"
import { FIXED_STEP_SEC, NET } from "../../src/shared/constants"
import { COURSES, playableCourse } from "../../src/shared/course-catalog"
import {
  createNpcRacers,
  npcInput,
  rewindNpcAfterRespawn,
  updateNpcProgress,
} from "../../src/shared/npc"
import { asPlayerId } from "../../src/shared/types"
import { createWorldSnapshot } from "../../src/shared/world"

const selected = Bun.argv.slice(2)
let failed = 0
let runs = 0
for (const base of COURSES.filter(
  (course) => selected.length === 0 || selected.includes(course.id),
)) {
  for (const remix of [false, true]) {
    for (const seed of [7, 42, 99, 424242]) {
      const course = playableCourse(base.id, remix ? seed : null)
      const brains = createNpcRacers(course, seed, 3)
      const pilots = [brains[2], brains[1]]
      const players = pilots.map((_, index) => ({
        id: asPlayerId(`audit-human-${index}`),
        name: `Pilot ${index}`,
        colorIndex: index,
      }))
      const race = new AuthoritativeRace(`${course.id}:${remix}:${seed}`, course, players, seed)
      let frame = race.frame("racing", 0)
      const lastCheckpoint = course.checkpoints.at(-1)?.index ?? -1
      while (
        race.tick < 180 / FIXED_STEP_SEC &&
        frame.actors.some((actor) => actor.finishedMs === null)
      ) {
        const time = NET.countdownSec + (race.tick + 1) * FIXED_STEP_SEC
        const world = createWorldSnapshot(course, time)
        for (const [index, player] of players.entries()) {
          const actor = frame.actors.find((actor) => actor.id === player.id)
          const pilot = pilots[index]
          if (actor === undefined || pilot === undefined || actor.finishedMs !== null) continue
          race.enqueue(player.id, {
            type: "input",
            tick: race.tick + 1,
            raceId: race.raceId,
            seq: race.tick + 1,
            input: npcInput(pilot, actor.sim, course, world, time),
            respawn: false,
          })
        }
        const result = race.step()
        frame = race.frame("racing", 0)
        for (const [index, player] of players.entries()) {
          const actor = frame.actors.find((actor) => actor.id === player.id)
          const pilot = pilots[index]
          if (actor === undefined || pilot === undefined) continue
          if (result.events.get(player.id)?.some((event) => event.kind === "respawn"))
            rewindNpcAfterRespawn(pilot, actor.sim, course)
          updateNpcProgress(pilot, actor.sim, course, FIXED_STEP_SEC)
        }
      }
      const stuck = frame.actors.filter(
        (actor) => actor.finishedMs === null || actor.sim.checkpoint !== lastCheckpoint,
      )
      failed += stuck.length
      runs += frame.actors.length
      console.log(
        JSON.stringify({
          course: course.id,
          remix,
          seed,
          tick: race.tick,
          times: frame.actors.map((actor) => actor.finishedMs),
          checkpoints: frame.actors.map((actor) => actor.sim.checkpoint),
          stuck: stuck.map((actor) => ({
            id: actor.id,
            position: actor.sim.position,
            checkpoint: actor.sim.checkpoint,
            pilot: pilots[players.findIndex((player) => player.id === actor.id)],
          })),
        }),
      )
    }
  }
}
console.log(`${runs - failed}/${runs} authoritative racers finished`)
if (failed) process.exit(1)
