/** The host and client advance the same complete actor world, including crowd contacts. */
import type { AuthorityActor, ScheduledInput } from "./action-protocol"
import { INPUT_HOLD_TICKS } from "./action-protocol"
import { FIXED_STEP_SEC, NET } from "./constants"
import { npcInput, rewindNpcAfterRespawn, updateNpcProgress } from "./npc"
import { type RaceTick, stepRace } from "./race-simulation"
import type { CourseDefinition, PlayerId, PlayerInput } from "./types"
import { NEUTRAL_INPUT } from "./types"
import { createWorldSnapshot } from "./world"

export type WorldActor = Omit<AuthorityActor, "name" | "colorIndex" | "plannedInputs">

/** Forecast IDs may hold known controls only inside the caller's bounded prediction window. */
export function stepActorWorld(
  actors: readonly WorldActor[],
  course: CourseDefinition,
  tick: number,
  commands: ReadonlyMap<PlayerId, ScheduledInput>,
  forecastIds: ReadonlySet<PlayerId> = new Set(),
): RaceTick {
  const time = NET.countdownSec + tick * FIXED_STEP_SEC
  const world = createWorldSnapshot(course, time)
  const runners = []
  for (const actor of actors) {
    if (actor.finishedMs !== null) continue
    let input: PlayerInput
    let respawnRequested = false
    if (actor.brain !== null) input = npcInput(actor.brain, actor.sim, course, world, time)
    else {
      const next = commands.get(actor.id)
      if (next !== undefined) {
        actor.ack = Math.max(actor.ack, next.seq)
        actor.heldInput = { ...next.input, jumpPressed: false, divePressed: false }
        actor.inputTick = tick
        input = next.input
        respawnRequested = next.respawn
      } else
        input =
          tick - actor.inputTick <= INPUT_HOLD_TICKS || forecastIds.has(actor.id)
            ? actor.heldInput
            : NEUTRAL_INPUT
    }
    const respawnPoint =
      course.checkpoints.find((cp) => cp.index === actor.sim.checkpoint)?.respawn ?? course.spawn
    runners.push({ id: actor.id, sim: actor.sim, input, respawnPoint, respawnRequested })
  }
  const result = stepRace(runners, world, FIXED_STEP_SEC)
  for (const actor of actors) {
    const events = result.events.get(actor.id)
    if (events === undefined) continue
    if (events.some((event) => event.kind === "respawn")) actor.respawnSeq++
    if (actor.brain !== null) {
      if (events.some((event) => event.kind === "respawn"))
        rewindNpcAfterRespawn(actor.brain, actor.sim, course)
      updateNpcProgress(actor.brain, actor.sim, course, FIXED_STEP_SEC)
    }
    if (events.some((event) => event.kind === "finish"))
      actor.finishedMs = Math.round(tick * FIXED_STEP_SEC * 1000)
  }
  return result
}
