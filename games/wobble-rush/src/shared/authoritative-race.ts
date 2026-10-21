/** Fixed-step, headless source of race truth. No browser position/time is accepted. */
import type { ActionInput, AuthorityActor, AuthorityFrame } from "./action-protocol"
import { INPUT_HOLD_TICKS, MAX_FUTURE_INPUT_TICKS, MAX_SEQUENCE_GAP } from "./action-protocol"
import { stepActorWorld } from "./actor-world"
import { FIXED_STEP_SEC, NET } from "./constants"
import type { NpcRacer } from "./npc"
import { createNpcRacers } from "./npc"
import { createRunner } from "./player"
import type { RaceTick } from "./race-simulation"
import type { RoomPhase } from "./room-types"
import type { CourseDefinition, PlayerId } from "./types"
import { NEUTRAL_INPUT } from "./types"

type Actor = Omit<AuthorityActor, "plannedInputs"> & {
  inputs: Map<number, ActionInput>
  receivedSeq: number
  brain: NpcRacer | null
}
export type RacePlayer = {
  readonly id: PlayerId
  readonly name: string
  readonly colorIndex: number
}

export class InputSequenceError extends Error {}

export class AuthoritativeRace {
  tick = 0
  private readonly actors = new Map<PlayerId, Actor>()

  /** Only the platform's verified, versioned checkpoint may call this boundary. */
  static restore(frame: AuthorityFrame, course: CourseDefinition): AuthoritativeRace {
    const race = new AuthoritativeRace(frame.raceId, course, [], 0, 0)
    race.tick = frame.tick
    for (const actor of structuredClone(frame.actors)) {
      race.actors.set(actor.id, {
        ...actor,
        inputs: new Map(),
        receivedSeq: actor.ack,
        heldInput: NEUTRAL_INPUT,
        inputTick: -INPUT_HOLD_TICKS,
      })
    }
    return race
  }

  constructor(
    readonly raceId: string,
    readonly course: CourseDefinition,
    players: readonly RacePlayer[],
    seed: number,
    npcCount = 2,
  ) {
    const npcs = createNpcRacers(course, seed, npcCount)
    const roster = [
      ...players.map((p) => ({ ...p, brain: null })),
      ...npcs.map((brain) => ({ ...brain, brain })),
    ]
    for (const [index, player] of roster.entries()) {
      const sim = createRunner(
        {
          x: course.spawn.x + ((index % 4) - (Math.min(roster.length, 4) - 1) / 2) * 1.3,
          y: course.spawn.y,
          z: course.spawn.z - Math.floor(index / 4) * 1.6,
        },
        course.spawnYaw,
      )
      sim.checkpoint = course.checkpoints[0]?.index ?? sim.checkpoint
      this.actors.set(player.id, {
        id: player.id,
        name: player.name,
        colorIndex: player.colorIndex,
        npc: player.brain !== null,
        brain: player.brain,
        sim,
        ack: 0,
        respawnSeq: 0,
        finishedMs: null,
        receivedSeq: 0,
        inputs: new Map(),
        heldInput: NEUTRAL_INPUT,
        inputTick: -INPUT_HOLD_TICKS,
      })
    }
  }

  enqueue(id: PlayerId, message: ActionInput): boolean {
    const actor = this.actors.get(id)
    if (
      message.raceId !== this.raceId ||
      actor === undefined ||
      actor.npc ||
      actor.finishedMs !== null
    )
      return false
    if (message.seq <= actor.receivedSeq) return false
    if (message.seq - actor.receivedSeq > MAX_SEQUENCE_GAP)
      throw new InputSequenceError("Input sequence gap exceeded")
    // A client schedules controls, never physics steps. The host still advances
    // the entire room exactly once per tick. Ignore impossible future claims.
    if (message.tick > this.tick + MAX_FUTURE_INPUT_TICKS) return false
    actor.receivedSeq = message.seq
    const tick = Math.max(this.tick + 1, message.tick)
    const pending = actor.inputs.get(tick)
    actor.inputs.set(tick, {
      ...message,
      tick,
      respawn: message.respawn || (pending?.respawn ?? false),
      input: {
        ...message.input,
        jumpPressed: message.input.jumpPressed || (pending?.input.jumpPressed ?? false),
        divePressed: message.input.divePressed || (pending?.input.divePressed ?? false),
      },
    })
    return true
  }

  remove(id: PlayerId): void {
    this.actors.delete(id)
  }

  /** Release stale controls immediately and let a new connection start from its ack. */
  releaseControls(id: PlayerId): void {
    const actor = this.actors.get(id)
    if (actor === undefined || actor.npc) return
    actor.inputs.clear()
    actor.heldInput = NEUTRAL_INPUT
    actor.inputTick = -INPUT_HOLD_TICKS
    actor.receivedSeq = actor.ack
  }

  step(): RaceTick {
    this.tick++
    const commands = new Map<PlayerId, ActionInput>()
    for (const actor of this.actors.values()) {
      const command = actor.inputs.get(this.tick)
      actor.inputs.delete(this.tick)
      if (command !== undefined) commands.set(actor.id, command)
    }
    return stepActorWorld([...this.actors.values()], this.course, this.tick, commands)
  }

  /** Lifecycle checks do not allocate a full replicated snapshot every host tick. */
  get finishers(): readonly { id: PlayerId; finishedMs: number }[] {
    return [...this.actors.values()].flatMap((actor) =>
      !actor.npc && actor.finishedMs !== null
        ? [{ id: actor.id, finishedMs: actor.finishedMs }]
        : [],
    )
  }

  frame(
    phase: RoomPhase,
    nowMs: number,
    countdownWorldSec: number = NET.countdownSec,
  ): AuthorityFrame {
    return {
      type: "frame",
      raceId: this.raceId,
      tick: this.tick,
      serverNowMs: nowMs,
      phase,
      worldTimeSec:
        phase === "countdown" ? countdownWorldSec : NET.countdownSec + this.tick * FIXED_STEP_SEC,
      actors: [...this.actors.values()].map((actor) => ({
        id: actor.id,
        name: actor.name,
        colorIndex: actor.colorIndex,
        npc: actor.npc,
        brain: actor.brain === null ? null : structuredClone(actor.brain),
        plannedInputs: [...actor.inputs.values()]
          .sort((a, b) => a.tick - b.tick)
          .map(({ tick, seq, input, respawn }) => ({ tick, seq, input: { ...input }, respawn })),
        sim: structuredClone(actor.sim),
        ack: actor.ack,
        heldInput: { ...actor.heldInput },
        inputTick: actor.inputTick,
        respawnSeq: actor.respawnSeq,
        finishedMs: actor.finishedMs,
      })),
    }
  }
}
