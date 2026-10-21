import { randomUUID } from "node:crypto"
import type { ActionInput, AuthorityFrame } from "../shared/action-protocol"
import { AuthoritativeRace } from "../shared/authoritative-race"
import { NET } from "../shared/constants"
import { playableCourse } from "../shared/course-catalog"
import { completeIfDone } from "../shared/room-completion"
import { createRoom, reduceRoom } from "../shared/room-reducers"
import type { RoomAction, RoomEffect, RoomState } from "../shared/room-types"
import { ROUND_LIMIT_MS, sessionForRoom } from "../shared/session"
import type { PlayerId, RoomCode } from "../shared/types"

type RaceCommand =
  | ActionInput
  | { type: "configure"; courseId: string; mode: "race" | "cup"; remix: boolean }
  | { type: "ready"; ready: boolean }
  | { type: "restart" }

/** Room lifecycle; only simulation-generated finishes reach the result reducers. */
export class RaceRoom {
  state: RoomState
  race: AuthoritativeRace | null = null
  lastActivityMs: number
  private effects: RoomEffect[] = []

  constructor(
    code: RoomCode,
    seed: number,
    nowMs: number,
    readonly correlationId: string = randomUUID(),
  ) {
    this.state = createRoom(code, seed)
    this.lastActivityMs = nowMs
  }

  command(id: PlayerId, message: RaceCommand, nowMs: number): void {
    this.lastActivityMs = nowMs
    if (message.type === "input") {
      if (this.state.phase === "racing") this.race?.enqueue(id, message)
      return
    }
    let action: RoomAction
    switch (message.type) {
      case "configure":
        action = {
          kind: "configure",
          id,
          courseId: message.courseId,
          mode: message.mode,
          remix: message.remix,
        }
        break
      case "ready":
        action = { kind: "ready", id, ready: message.ready }
        break
      case "restart":
        action = { kind: "restart", id }
        break
    }
    const before = this.state.phase
    this.reduce(action, nowMs)
    if (before !== "countdown" && this.state.phase === "countdown") {
      const session = sessionForRoom(this.state)
      this.race = new AuthoritativeRace(
        randomUUID(),
        playableCourse(session.courseId, session.remix ? this.state.seed : null),
        this.state.players,
        this.state.seed,
      )
    }
    if (this.state.phase === "lobby") this.race = null
  }

  leave(id: PlayerId, nowMs: number): void {
    this.lastActivityMs = nowMs
    this.race?.remove(id)
    this.reduce({ kind: "leave", id }, nowMs)
    if (this.state.players.length === 0) this.race = null
  }

  step(nowMs: number): void {
    if (this.state.phase === "countdown") this.reduce({ kind: "tick" }, nowMs)
    if (this.state.phase !== "racing" || this.race === null) return
    this.race.step()
    for (const actor of this.race.finishers) {
      if (this.state.players.some((player) => player.id === actor.id && player.finishedMs === null))
        this.reduce({ kind: "finish", id: actor.id, timeMs: actor.finishedMs }, nowMs)
    }
    if ((this.race.tick * 1000) / 60 >= ROUND_LIMIT_MS) {
      const completion = completeIfDone(this.state, true)
      this.state = completion.state
      this.effects.push(...completion.effects)
    }
  }

  frame(nowMs: number): AuthorityFrame | null {
    const remaining =
      this.state.phaseEndsAtMs === null ? 0 : (this.state.phaseEndsAtMs - nowMs) / 1000
    return (
      this.race?.frame(this.state.phase, nowMs, Math.max(0, NET.countdownSec - remaining)) ?? null
    )
  }

  drainEffects(): RoomEffect[] {
    const effects = this.effects
    this.effects = []
    return effects
  }

  private reduce(action: RoomAction, nowMs: number): void {
    const reduction = reduceRoom(this.state, action, nowMs)
    this.state = reduction.state
    this.effects.push(...reduction.effects)
  }
}
