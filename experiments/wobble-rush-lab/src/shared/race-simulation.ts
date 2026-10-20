/**
 * Headless race tick. All racers move before contacts and progress are resolved.
 * No DOM, renderer, transport, clocks or effects belong here. An authoritative
 * host can drive this same tick with validated inputs and a fixed world time.
 */
import { RUNNER } from "./constants"
import type { CrowdBody, CrowdBump } from "./crowd"
import { CROWD, resolveCrowdPass } from "./crowd"
import {
  captureRunnerProgress,
  respawnRunner,
  settleRunnerContact,
  stepRunnerMotion,
} from "./player"
import type { PlayerInput, RunnerSim, SimEvent, Vec3, WorldSnapshot } from "./types"

export type RaceRunner = {
  readonly id: string
  readonly sim: RunnerSim
  readonly input: PlayerInput
  readonly respawnPoint: Vec3
  readonly respawnRequested?: boolean
}

export type RaceTick = {
  readonly events: ReadonlyMap<string, readonly SimEvent[]>
  readonly bumps: readonly CrowdBump[]
}

/** Pass active racers only; paused and finished racers must not be stepped. */
export function stepRace(
  runners: readonly RaceRunner[],
  world: WorldSnapshot,
  dt: number,
): RaceTick {
  const ordered = [...runners].sort((a, b) => a.id.localeCompare(b.id))
  const ids = new Set(ordered.map((runner) => runner.id))
  if (ids.size !== runners.length) throw new Error("Duplicate race runner")
  const events = new Map<string, SimEvent[]>()
  const active: RaceRunner[] = []
  for (const runner of ordered) {
    let moved: readonly SimEvent[]
    if (runner.respawnRequested) {
      respawnRunner(runner.sim, runner.respawnPoint)
      moved = [{ kind: "respawn", position: runner.respawnPoint }]
    } else moved = stepRunnerMotion(runner.sim, runner.input, world, dt, runner.respawnPoint)
    events.set(runner.id, [...moved])
    if (!moved.some((event) => event.kind === "respawn")) active.push(runner)
  }

  const bodies: CrowdBody[] = active.map((runner) => ({
    id: runner.id,
    radius: RUNNER.radius,
    position: runner.sim.position,
    velocity: runner.sim.velocity,
    movable: true,
  }))
  const bumps = new Map<string, CrowdBump>()
  const responded = new Set<string>()
  const respawned = new Set<string>()
  const seenContacts = new Map(
    active.map((runner) => [
      runner.id,
      new Set(
        (events.get(runner.id) ?? []).flatMap((event) =>
          event.kind === "hit" || event.kind === "bounce" ? [event.obstacle] : [],
        ),
      ),
    ]),
  )
  // Alternate constraints: repairing a wall contact can put a runner back into
  // a rival. A single crowd pass followed by one world pass cannot resolve that.
  for (let pass = 0; pass < CROWD.solverPasses; pass++) {
    const before = active.map((runner) => ({ ...runner.sim.position }))
    for (const bump of resolveCrowdPass(
      bodies.filter((body) => !respawned.has(body.id)),
      responded,
    )) {
      const key = JSON.stringify([bump.a, bump.b])
      if (!bumps.has(key)) bumps.set(key, bump)
    }
    let corrected = false
    for (const [index, runner] of active.entries()) {
      if (respawned.has(runner.id)) continue
      const previous = before[index]
      if (previous?.x === runner.sim.position.x && previous?.z === runner.sim.position.z) continue
      corrected = true
      const repaired = settleRunnerContact(
        runner.sim,
        world,
        runner.respawnPoint,
        seenContacts.get(runner.id),
        previous,
      )
      events.get(runner.id)?.push(...repaired)
      if (repaired.some((event) => event.kind === "respawn")) respawned.add(runner.id)
    }
    if (!corrected) break
  }
  for (const runner of active) {
    const moved = events.get(runner.id)
    if (moved === undefined) continue
    if (!moved.some((event) => event.kind === "respawn"))
      moved.push(...captureRunnerProgress(runner.sim, world))
  }
  return { events, bumps: [...bumps.values()] }
}
