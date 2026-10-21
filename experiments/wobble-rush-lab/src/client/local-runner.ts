/**
 * The player's own runner: simulation state, its mesh, and the optional autopilot.
 *
 * Autopilot hands control to the same NPC brain the AI racers use, which is what lets
 * automated QA drive a genuine run without faking physics or skipping the course.
 */

import type * as THREE from "three"
import type { NpcRacer } from "../shared/npc"
import { createNpcRacers, npcInput, rewindNpcAfterRespawn, updateNpcProgress } from "../shared/npc"
import { createRunner, respawnRunner } from "../shared/player"
import type { RaceRunner } from "../shared/race-simulation"
import type {
  CheckpointIndex,
  CourseDefinition,
  PlayerInput,
  RunnerSim,
  SimEvent,
  Vec3,
  WorldSnapshot,
} from "../shared/types"
import { CorrectionSmoother } from "./correction-smoother"
import { FixedPose } from "./fixed-pose"
import { RunnerView } from "./runner-view"

const AUTOPILOT_SEED = 7

export class LocalRunner {
  readonly sim: RunnerSim
  private readonly scene: THREE.Scene
  private readonly course: CourseDefinition
  private view: RunnerView
  private pilot: NpcRacer | null = null
  private readonly correction = new CorrectionSmoother()
  private readonly pose: FixedPose
  private previousStep: Vec3
  private drawnPosition: Vec3
  private label: string | undefined
  private currentColor = "#FF7A5C"

  get renderPosition(): Vec3 {
    return this.drawnPosition
  }

  smoothCorrection(previous: Vec3, snap = false, contact = false): void {
    const distance = Math.hypot(
      previous.x - this.sim.position.x,
      previous.y - this.sim.position.y,
      previous.z - this.sim.position.z,
    )
    if (snap || distance > 2.5) this.pose.reset(this.sim.position)
    else
      this.pose.translate({
        x: this.sim.position.x - previous.x,
        y: this.sim.position.y - previous.y,
        z: this.sim.position.z - previous.z,
      })
    this.correction.correct(previous, this.sim.position, snap, contact)
    if (distance > 2.5 && this.pilot !== null)
      rewindNpcAfterRespawn(this.pilot, this.sim, this.course)
  }

  restorePilotProgress(previous: CheckpointIndex): void {
    if (this.pilot !== null && this.sim.checkpoint < previous)
      rewindNpcAfterRespawn(this.pilot, this.sim, this.course)
  }

  constructor(scene: THREE.Scene, course: CourseDefinition, color: string) {
    this.currentColor = color
    this.scene = scene
    this.course = course
    this.sim = createRunner(course.spawn, course.spawnYaw)
    this.pose = new FixedPose(this.sim.position)
    this.previousStep = { ...this.sim.position }
    this.drawnPosition = { ...this.sim.position }
    this.view = new RunnerView(color)
    scene.add(this.view.group)
  }

  get autopilotActive(): boolean {
    return this.pilot !== null
  }

  setAutopilot(enabled: boolean, routeIndex = 0): void {
    const index = Math.max(0, Math.min(2, Math.floor(routeIndex)))
    this.pilot = enabled ? (createNpcRacers(this.course, AUTOPILOT_SEED, 3)[index] ?? null) : null
  }

  setColor(color: string): void {
    if (color === this.currentColor) return
    this.currentColor = color
    this.scene.remove(this.view.group)
    this.view.dispose()
    this.view = new RunnerView(color, this.label)
    this.scene.add(this.view.group)
  }

  setLabel(label: string): void {
    if (label === this.label) return
    this.label = label
    this.scene.remove(this.view.group)
    this.view.dispose()
    this.view = new RunnerView(this.currentColor, label)
    this.scene.add(this.view.group)
  }

  /** Respawn point for the checkpoint this runner has captured. */
  respawnPoint(): Vec3 {
    return (
      this.course.checkpoints.find((entry) => entry.index === this.sim.checkpoint)?.respawn ??
      this.course.spawn
    )
  }

  reset(checkpoint: CheckpointIndex): void {
    this.correction.reset()
    respawnRunner(this.sim, this.course.spawn)
    this.sim.checkpoint = checkpoint
    this.pose.reset(this.sim.position)
    if (this.pilot !== null) rewindNpcAfterRespawn(this.pilot, this.sim, this.course)
  }

  /** Prepare input; shared stepRace owns the movement/contact/progress ordering. */
  planStep(
    world: WorldSnapshot,
    timeSec: number,
    manual: PlayerInput,
    respawnRequested: boolean,
  ): RaceRunner {
    const pilot = this.pilot
    const input = pilot === null ? manual : npcInput(pilot, this.sim, this.course, world, timeSec)
    return { id: "self", sim: this.sim, input, respawnPoint: this.respawnPoint(), respawnRequested }
  }

  beginStep(): void {
    this.previousStep = { ...this.sim.position }
  }

  afterStep(events: readonly SimEvent[], dt: number, stepAtMs = performance.now()): void {
    if (events.some((event) => event.kind === "respawn")) this.pose.reset(this.sim.position)
    else this.pose.push(this.previousStep, this.sim.position, stepAtMs)
    const pilot = this.pilot
    if (pilot !== null && events.some((event) => event.kind === "respawn"))
      rewindNpcAfterRespawn(pilot, this.sim, this.course)
    if (pilot !== null) updateNpcProgress(pilot, this.sim, this.course, dt)
  }

  samplePosition(dt: number, nowMs: number): Vec3 {
    this.correction.advance(dt)
    return this.correction.position(this.pose.read(nowMs))
  }

  renderAt(position: Vec3, dt: number): void {
    this.drawnPosition = { ...position }
    this.view.update({ ...this.sim, position: this.drawnPosition }, dt)
  }

  dispose(): void {
    this.scene.remove(this.view.group)
    this.view.dispose()
  }
}
