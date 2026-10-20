/**
 * The AI pack: spawning, stepping and rendering NPC racers.
 *
 * Used for solo races. Party NPCs live in the authoritative/predicted actor world.
 */

import type * as THREE from "three"
import { RUNNER_COLORS } from "../shared/course"
import type { NpcRacer } from "../shared/npc"
import { createNpcRacers, npcInput, rewindNpcAfterRespawn, updateNpcProgress } from "../shared/npc"
import { createRunner, respawnRunner } from "../shared/player"
import type { ProgressRacer } from "../shared/race-progress"
import type { RaceRunner, RaceTick } from "../shared/race-simulation"
import type {
  CheckpointIndex,
  CourseDefinition,
  RunnerSim,
  SimEvent,
  Vec3,
  WorldSnapshot,
} from "../shared/types"
import type { FinisherRow } from "./race-results"
import { localFinisherId } from "./race-results"
import { RunnerView } from "./runner-view"

type NpcEntry = { readonly racer: NpcRacer; readonly sim: RunnerSim; readonly view: RunnerView }

export type NpcStepContext = {
  readonly world: WorldSnapshot
  readonly timeSec: number
  readonly dt: number
  readonly raceMs: number
}

/** Staggers the starting grid so runners do not spawn inside each other. */
function startOffset(spawn: Vec3, index: number): Vec3 {
  return {
    x: spawn.x + ((index % 4) - 1.5) * 1.5,
    y: spawn.y,
    z: spawn.z - Math.floor(index / 4) * 1.6,
  }
}

export class NpcPack {
  private readonly scene: THREE.Scene
  private readonly course: CourseDefinition
  private readonly entries: NpcEntry[] = []

  constructor(scene: THREE.Scene, course: CourseDefinition) {
    this.scene = scene
    this.course = course
  }

  get size(): number {
    return this.entries.length
  }

  progress(): number[] {
    return this.entries.map((entry) => entry.sim.position.z)
  }

  racers(): ProgressRacer[] {
    return this.entries.map((entry) => ({
      id: entry.racer.id,
      sim: entry.sim,
      finishedMs: entry.racer.finishedAtMs,
    }))
  }

  spawn(seed: number, count: number): void {
    this.dispose()
    for (const racer of createNpcRacers(this.course, seed, count)) {
      const spawn = startOffset(this.course.spawn, racer.colorIndex)
      const view = new RunnerView(
        RUNNER_COLORS[racer.colorIndex % RUNNER_COLORS.length] ?? "#5CC9F5",
        racer.name,
      )
      this.scene.add(view.group)
      this.entries.push({ racer, sim: createRunner(spawn, this.course.spawnYaw), view })
    }
  }

  reset(checkpoint: CheckpointIndex): void {
    for (const entry of this.entries) {
      respawnRunner(entry.sim, startOffset(this.course.spawn, entry.racer.colorIndex))
      entry.sim.checkpoint = checkpoint
      entry.racer.waypointIndex = 0
      entry.racer.reactionTimer = 0
      entry.racer.finishedAtMs = null
    }
  }

  planStep(context: NpcStepContext): RaceRunner[] {
    const runners: RaceRunner[] = []
    for (const entry of this.entries) {
      if (entry.racer.finishedAtMs !== null) continue
      const input = npcInput(entry.racer, entry.sim, this.course, context.world, context.timeSec)
      const respawn =
        this.course.checkpoints.find((cp) => cp.index === entry.sim.checkpoint)?.respawn ??
        this.course.spawn
      runners.push({ id: entry.racer.id, sim: entry.sim, input, respawnPoint: respawn })
    }
    return runners
  }

  afterStep(
    tick: RaceTick,
    context: NpcStepContext,
    onEvents: (events: readonly SimEvent[]) => void,
  ): void {
    for (const entry of this.entries) {
      const events = tick.events.get(entry.racer.id)
      if (events === undefined) continue
      if (events.some((event) => event.kind === "respawn"))
        rewindNpcAfterRespawn(entry.racer, entry.sim, this.course)
      updateNpcProgress(entry.racer, entry.sim, this.course, context.dt)
      if (entry.racer.finishedAtMs === null && events.some((event) => event.kind === "finish")) {
        entry.racer.finishedAtMs = context.raceMs
      }
      onEvents(events)
    }
  }

  render(dt: number): void {
    for (const entry of this.entries) entry.view.update(entry.sim, dt)
  }

  finishers(startIndex: number): readonly FinisherRow[] {
    return this.entries.map((entry, index) => ({
      id: localFinisherId(startIndex + index),
      name: entry.racer.name,
      timeMs: entry.racer.finishedAtMs === null ? null : Math.round(entry.racer.finishedAtMs),
    }))
  }

  dispose(): void {
    for (const entry of this.entries) {
      this.scene.remove(entry.view.group)
      entry.view.dispose()
    }
    this.entries.length = 0
  }
}
