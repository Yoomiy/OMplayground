/** One predicted actor world: players, NPCs and obstacles always share the same tick. */
import type { ActionInput, AuthorityActor, AuthorityFrame, ScheduledInput } from "./action-protocol"
import { INPUT_HOLD_TICKS } from "./action-protocol"
import { stepActorWorld } from "./actor-world"
import { FIXED_STEP_SEC, NET } from "./constants"
import type { CrowdBump } from "./crowd"
import type { CourseDefinition, PlayerId, PlayerInput, RunnerSim, SimEvent } from "./types"

const INPUT_MARGIN_TICKS = 6
export const MAX_PREDICTION_LEAD_TICKS = 48
const MAX_LEAD_TICKS = 36

export class RunnerPrediction {
  raceId: string | null = null
  private sequence = 0
  private ack = 0
  private worldTick = 0
  private lastServerTick = -1
  private lastFrameMs = 0
  private lastStepMs = -Infinity
  private respawnSeq = 0
  private leadTicks = INPUT_MARGIN_TICKS
  private history: ActionInput[] = []
  private actors: AuthorityActor[] = []
  private readonly controls = new Map<PlayerId, Map<number, ScheduledInput>>()
  private readonly forecastIds = new Set<PlayerId>()
  private selfId: PlayerId | null = null
  private authorityPhase: AuthorityFrame["phase"] | null = null
  private authorityFinished = false
  lastReconcile = { respawned: false, replayedTicks: 0, resynced: false }

  constructor(private readonly now: () => number = () => performance.now()) {}

  get tick(): number {
    return this.worldTick
  }
  get predictedActors(): readonly AuthorityActor[] {
    return this.actors
  }
  get racing(): boolean {
    return this.authorityPhase === "racing"
  }
  get stepAtMs(): number {
    return this.lastStepMs
  }
  renderAt(nowMs: number): number {
    const alpha = Math.max(-1, Math.min(1, (nowMs - this.lastStepMs) / (FIXED_STEP_SEC * 1000)))
    return NET.countdownSec + Math.max(0, this.worldTick - 1 + alpha) * FIXED_STEP_SEC
  }
  get nextWorldTimeSec(): number {
    return NET.countdownSec + (this.worldTick + 1) * FIXED_STEP_SEC
  }
  get pendingCount(): number {
    return this.sequence - this.ack
  }
  get historyCount(): number {
    return this.history.length
  }
  get frameAgeMs(): number {
    return Math.max(0, this.now() - this.lastFrameMs)
  }
  get frozen(): boolean {
    return this.raceId !== null && this.worldTick >= this.lastServerTick + MAX_PREDICTION_LEAD_TICKS
  }

  reconcile(
    sim: RunnerSim,
    frame: AuthorityFrame,
    actor: AuthorityActor,
    course: CourseDefinition,
    oneWaySec = 0,
  ): boolean | null {
    const initial = frame.raceId !== this.raceId
    if (!initial && frame.tick < this.lastServerTick) return null
    const respawned = !initial && actor.respawnSeq !== this.respawnSeq
    const resynced = !initial && (this.frameAgeMs > 500 || frame.tick >= this.worldTick)
    if (initial) {
      this.sequence = actor.ack
      this.history = []
      this.raceId = frame.raceId
    }
    if (initial || frame.phase === "countdown")
      this.leadTicks = Math.min(
        MAX_LEAD_TICKS,
        Math.max(
          INPUT_MARGIN_TICKS,
          Math.ceil((oneWaySec * 2) / FIXED_STEP_SEC) + INPUT_MARGIN_TICKS,
        ),
      )
    const target =
      frame.phase === "countdown" || frame.phase === "finished"
        ? frame.tick
        : initial || resynced
          ? frame.tick + this.leadTicks
          : this.worldTick
    if (initial || resynced) this.lastStepMs = this.now()
    this.lastServerTick = frame.tick
    this.lastFrameMs = this.now()
    this.respawnSeq = actor.respawnSeq
    this.ack = actor.ack
    this.selfId = actor.id
    this.authorityPhase = frame.phase
    this.authorityFinished = actor.finishedMs !== null
    const acceptedSeq = Math.max(actor.ack, ...actor.plannedInputs.map((command) => command.seq))
    this.sequence = Math.max(this.sequence, acceptedSeq)
    this.history = this.history.filter(
      (sample) => sample.tick > frame.tick && sample.seq > actor.ack,
    )
    this.actors = structuredClone(frame.actors)
    const self = this.actors.find((entry) => entry.id === actor.id)
    if (self === undefined) throw new Error("Authoritative snapshot omitted this racer")
    Object.assign(sim, self.sim)
    self.sim = sim
    this.controls.clear()
    this.forecastIds.clear()
    for (const entry of this.actors) {
      this.controls.set(
        entry.id,
        new Map(entry.plannedInputs.map((command) => [command.tick, command])),
      )
      // Never revive controls that the host has already expired or released.
      if (entry.id !== this.selfId && frame.tick - entry.inputTick <= INPUT_HOLD_TICKS)
        this.forecastIds.add(entry.id)
    }
    const ownControls = this.controls.get(actor.id)
    for (const command of this.history)
      if (command.seq > acceptedSeq) ownControls?.set(command.tick, command)
    this.worldTick = frame.tick
    while (this.worldTick < target) this.simulate(course)
    this.lastReconcile = { respawned, replayedTicks: target - frame.tick, resynced }
    return initial
  }

  advance(
    sim: RunnerSim,
    input: PlayerInput,
    respawn: boolean,
    course: CourseDefinition,
    stepAtMs = this.now(),
  ): { message: ActionInput; events: readonly SimEvent[]; bumps: readonly CrowdBump[] } | null {
    if (this.raceId === null || this.selfId === null) return null
    const message: ActionInput = {
      type: "input",
      raceId: this.raceId,
      seq: ++this.sequence,
      tick: this.worldTick + 1,
      respawn,
      input: {
        ...input,
        cameraYaw: Math.atan2(Math.sin(input.cameraYaw), Math.cos(input.cameraYaw)),
      },
    }
    if (this.frozen) return { message, events: [], bumps: [] }
    const self = this.actors.find((actor) => actor.id === this.selfId)
    if (self === undefined) return null
    self.sim = sim
    this.controls.get(this.selfId)?.set(message.tick, message)
    this.history.push(message)
    this.lastStepMs = stepAtMs
    const result = this.simulate(course)
    return {
      message,
      events: (result.events.get(this.selfId) ?? []).filter(
        (event) => event.kind !== "checkpoint" && event.kind !== "finish",
      ),
      bumps: result.bumps,
    }
  }

  /** Finished players still observe the same live world without uploading dead controls. */
  advanceSpectator(course: CourseDefinition, stepAtMs = this.now()): boolean {
    if (!this.racing || !this.authorityFinished || this.frozen) return false
    this.lastStepMs = stepAtMs
    this.simulate(course)
    return true
  }

  clear(): void {
    this.raceId = null
    this.history = []
    this.actors = []
    this.controls.clear()
    this.forecastIds.clear()
    this.selfId = null
    this.authorityPhase = null
    this.authorityFinished = false
    this.sequence = 0
    this.ack = 0
    this.worldTick = 0
    this.lastServerTick = -1
    this.lastStepMs = -Infinity
  }

  private simulate(course: CourseDefinition) {
    this.worldTick++
    const commands = new Map<PlayerId, ScheduledInput>()
    for (const actor of this.actors) {
      const pending = this.controls.get(actor.id)
      const command = pending?.get(this.worldTick)
      pending?.delete(this.worldTick)
      if (command === undefined) continue
      commands.set(actor.id, command)
      if (actor.id !== this.selfId) this.forecastIds.add(actor.id)
    }
    return stepActorWorld(this.actors, course, this.worldTick, commands, this.forecastIds)
  }
}
