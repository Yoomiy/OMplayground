import { randomInt } from "node:crypto"
import { ActionRoom } from "../action/room"
import { winnerAnnouncement } from "../client/winner-announcement"
import {
  ACTION_CONTENT,
  ACTION_PROTOCOL,
  type ActionClientMessage,
  type ActionServerMessage,
} from "../shared/action-protocol"
import { AuthoritativeRace } from "../shared/authoritative-race"
import { NET } from "../shared/constants"
import { COURSES, playableCourse } from "../shared/course-catalog"
import { RUNNER_COLORS } from "../shared/course-palette"
import type { PlatformControl, PlatformMember, WobbleView } from "../shared/platform-protocol"
import { generateRoomCode } from "../shared/room-code"
import { buildResults, phaseMessage, rosterMessage } from "../shared/room-messages"
import { sessionForRoom } from "../shared/session"
import { asPlayerId, asRoomCode } from "../shared/types"
import {
  type Admission,
  AdmissionError,
  type PlatformProfile,
  type PlatformSession,
} from "./admission"
import type { Checkpoint, RoomCheckpoints } from "./checkpoint"
import type { PlatformGateway } from "./gateway"
import { platformLog } from "./logging"

type Member = PlatformMember & { disconnectedAt: number | null }
export type RoomWireMessage = ActionServerMessage | { type: "platform"; view: WobbleView }
export interface RoomPorts {
  send(userId: string, message: RoomWireMessage): void
  disconnect(userId: string, code: string): void
}

/** Platform lifecycle wraps the tested engine; identity never comes from control messages. */
export class PlaygroundWobbleRoom {
  readonly engine: ActionRoom
  readonly members = new Map<string, Member>()
  readonly observers = new Map<string, PlatformProfile>()
  readonly blocked = new Set<string>()
  readonly accepted: Checkpoint["results"] = []
  paused = false
  ended = false
  saved = false
  emptySince: number | null = Date.now()
  private pauseAt = 0
  private checkpoint: ReturnType<RoomCheckpoints["sign"]> | undefined
  private rematch: WobbleView["rematch"] = null
  private tail: Promise<unknown> = Promise.resolve()
  private savingResult = false
  private resultsDirty = false
  private lastSave = 0
  private lastLease = 0
  private session: PlatformSession
  private readonly roles = new Map<string, PlatformProfile["role"]>()
  private readonly grades = new Map<string, string | null>()
  private stoppedBy: string | null = null
  private completedAt: string | null = null
  hostId: string

  constructor(
    session: PlatformSession,
    readonly allocationId: string,
    private readonly gateway: PlatformGateway,
    private readonly checkpoints: RoomCheckpoints,
    private readonly ports: RoomPorts,
    saved?: Checkpoint,
  ) {
    this.session = session
    this.hostId = session.host_id
    this.engine = new ActionRoom(
      asRoomCode(generateRoomCode(() => randomInt(2 ** 32) / 2 ** 32)),
      randomInt(2 ** 32),
      Date.now(),
    )
    if (!saved)
      for (const [index, userId] of session.player_ids.entries()) {
        const member: Member = {
          userId,
          name: session.player_names[index] ?? "שחקן",
          colorIndex: index % 8,
          connected: false,
          loaded: false,
          pending: false,
          disconnectedAt: null,
        }
        this.members.set(userId, member)
        this.addActor(member)
      }
    if (saved) {
      this.engine.state = saved.state
      const selection = sessionForRoom(saved.state)
      if (saved.frame)
        this.engine.race = AuthoritativeRace.restore(
          saved.frame,
          playableCourse(selection.courseId, selection.remix ? saved.state.seed : null),
        )
      for (const old of saved.players)
        if (session.player_ids.includes(old.userId))
          this.members.set(old.userId, {
            ...old,
            connected: false,
            loaded: false,
            disconnectedAt: null,
          })
      for (const userId of saved.blocked) this.blocked.add(userId)
      this.accepted.push(...saved.results)
      this.engine.state = {
        ...this.engine.state,
        players: this.engine.state.players.filter((player) => this.members.has(player.id)),
      }
      for (const actor of saved.frame?.actors ?? [])
        if (!actor.npc && !this.members.has(actor.id)) this.engine.race?.remove(actor.id)
      this.paused = true
      this.saved = true
      this.pauseAt = Date.now()
      if (saved.countdownRemainingMs !== null)
        this.engine.state = {
          ...this.engine.state,
          phaseEndsAtMs: this.pauseAt + saved.countdownRemainingMs,
        }
      this.checkpoint = checkpoints.sign(saved)
    }
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(work)
    this.tail = pending.catch(() => undefined)
    return pending
  }

  private active(): Member[] {
    return [...this.members.values()].filter((member) => !member.pending)
  }
  private connected(): Member[] {
    return [...this.members.values()].filter((member) => member.connected)
  }
  private isComplete(): boolean {
    return this.engine.state.phase === "finished" && sessionForRoom(this.engine.state).complete
  }

  assertAdmission(admission: Admission): void {
    const id = admission.profile.userId
    if (this.ended) throw new AdmissionError("SESSION_COMPLETED", 409)
    if (this.blocked.has(id)) throw new AdmissionError("REMOVED_FROM_ROOM")
    if (admission.observer) {
      if (!this.observers.has(id) && this.observers.size >= 8) throw new AdmissionError("ROOM_FULL")
    } else if (!this.members.has(id) && this.members.size >= NET.maxPlayersPerRoom)
      throw new AdmissionError("ROOM_FULL")
  }

  async attach(admission: Admission): Promise<void> {
    this.assertAdmission(admission)
    const { profile } = admission
    const reconnecting = this.roles.has(profile.userId)
    this.roles.set(profile.userId, profile.role)
    this.grades.set(profile.userId, profile.grade)
    if (admission.observer) this.observers.set(profile.userId, profile)
    else {
      const existing = this.members.get(profile.userId)
      const cup = sessionForRoom(this.engine.state)
      const initialLobby = this.engine.state.phase === "lobby" && cup.round === 0
      const pending =
        existing?.lobbyRejoin && initialLobby ? false : (existing?.pending ?? !initialLobby)
      const member: Member = {
        userId: profile.userId,
        name: profile.name,
        colorIndex: existing?.colorIndex ?? this.freeColor(),
        connected: true,
        loaded: false,
        pending,
        lobbyRejoin: false,
        disconnectedAt: null,
      }
      this.members.set(profile.userId, member)
      this.emptySince = null
      if (!pending) this.addActor(member)
      if (!this.members.has(this.hostId)) this.hostId = profile.userId
    }
    await this.persist(true)
    this.restore(profile.userId)
    this.publish()
    platformLog("info", reconnecting ? "WOBBLE_PLAYER_RECONNECTED" : "WOBBLE_PLAYER_JOINED", {
      sessionId: this.session.id,
      userId: profile.userId,
      observer: admission.observer,
      pending: this.members.get(profile.userId)?.pending ?? false,
      phase: this.engine.state.phase,
      correlationId: admission.correlationId,
    })
  }

  private freeColor(): number {
    const used = new Set([...this.members.values()].map((member) => member.colorIndex))
    for (let index = 0; index < 8; index++) if (!used.has(index)) return index
    return 0
  }
  private addActor(member: Member): void {
    const id = asPlayerId(member.userId)
    if (this.engine.state.players.some((player) => player.id === id)) return
    this.engine.state = {
      ...this.engine.state,
      players: [
        ...this.engine.state.players,
        {
          id,
          name: member.name,
          colorIndex: member.colorIndex,
          ready: false,
          finishedMs: null,
          lastSeenMs: Date.now(),
          state: null,
        },
      ],
    }
  }

  restore(userId: string): void {
    this.ports.send(userId, {
      type: "welcome",
      you: asPlayerId(userId),
      room: this.engine.state.code,
      seed: this.engine.state.seed,
      snapshot: this.engine.state,
    })
    this.ports.send(userId, { type: "platform", view: this.view(userId) })
    this.ports.send(
      userId,
      phaseMessage(this.engine.state, this.paused ? this.pauseAt : Date.now()),
    )
    const frame = this.engine.frame(this.paused ? this.pauseAt : Date.now())
    if (frame) this.ports.send(userId, frame)
    if (this.engine.state.phase === "finished")
      this.ports.send(userId, {
        type: "results",
        results: buildResults(this.engine.state.players),
        session: sessionForRoom(this.engine.state),
      })
  }

  async detached(userId: string): Promise<void> {
    if (this.observers.delete(userId)) {
      await this.persist(false)
      this.publish()
      return
    }
    const member = this.members.get(userId)
    if (!member) return
    member.connected = false
    member.loaded = false
    member.disconnectedAt = Date.now()
    this.engine.race?.releaseControls(asPlayerId(userId))
    if (!this.connected().length && !this.ended && !this.isComplete()) {
      this.pause()
      await this.persist(true)
      platformLog("info", "WOBBLE_GAME_PAUSED", {
        sessionId: this.session.id,
        reason: "ROOM_EMPTY",
        saved: true,
      })
      this.emptySince = Date.now()
    } else await this.persist(true)
    if (!this.connected().length) this.emptySince ??= Date.now()
    this.publish()
  }

  async authorize(profile: PlatformProfile, social = false): Promise<Admission> {
    const fresh = await this.gateway.profile(profile.userId)
    const session = await this.gateway.session(this.session.id)
    const observer = this.observers.has(profile.userId)
    if (
      this.ended ||
      this.blocked.has(profile.userId) ||
      (!observer && !this.members.get(profile.userId)?.connected)
    )
      throw new AdmissionError("NOT_IN_ROOM")
    if (!observer && !session.player_ids.includes(profile.userId))
      throw new AdmissionError("NOT_IN_ROSTER")
    if (observer && fresh.role === "kid") throw new AdmissionError("CONTROL_FORBIDDEN")
    if (!observer && fresh.gender !== session.gender) throw new AdmissionError("GENDER_MISMATCH")
    if (fresh.role === "kid" && !(await this.gateway.withinRecess(fresh)))
      throw new AdmissionError("RECESS_DENIED")
    if (social && observer) throw new AdmissionError("READ_ONLY")
    if (session.status === "completed" && !this.isComplete())
      throw new AdmissionError("SESSION_COMPLETED")
    this.session = session
    this.roles.set(fresh.userId, fresh.role)
    this.grades.set(fresh.userId, fresh.grade)
    return { profile: fresh, session, observer }
  }

  /** Match decisions belong to a rostered player host, independent of staff role. */
  private isPlayerHost(userId: string): boolean {
    return (
      userId === this.hostId && !!this.members.get(userId)?.connected && !this.observers.has(userId)
    )
  }

  async control(
    profile: PlatformProfile,
    control: PlatformControl,
    correlationId = this.engine.correlationId,
  ): Promise<void> {
    const admission = await this.authorize(profile)
    admission.correlationId = correlationId
    const id = profile.userId
    const moderator = admission.profile.role !== "kid"
    const playerHost = this.isPlayerHost(id)
    if (control.action === "loaded") {
      const member = this.members.get(id)
      if (member) member.loaded = true
      this.publish()
      return
    }
    if (control.action === "color") {
      const member = this.members.get(id)
      if (admission.observer || !member) throw new AdmissionError("CONTROL_FORBIDDEN")
      if (this.engine.state.phase !== "lobby" || this.paused) throw new AdmissionError("LOBBY_ONLY")
      if (
        !Number.isInteger(control.colorIndex) ||
        control.colorIndex < 0 ||
        control.colorIndex >= RUNNER_COLORS.length
      )
        throw new AdmissionError("INVALID_COLOR", 400)
      const previousColor = member.colorIndex
      const previousPlayers = this.engine.state.players
      member.colorIndex = control.colorIndex
      this.engine.state = {
        ...this.engine.state,
        players: previousPlayers.map((player) =>
          player.id === id ? { ...player, colorIndex: control.colorIndex } : player,
        ),
      }
      try {
        await this.persist(true)
      } catch (error) {
        member.colorIndex = previousColor
        this.engine.state = { ...this.engine.state, players: previousPlayers }
        throw error
      }
      this.broadcast(rosterMessage(this.engine.state))
      this.publish()
      return
    }
    if (["rematch", "accept-rematch", "decline-rematch"].includes(control.action)) {
      if (admission.observer || !this.isComplete()) throw new AdmissionError("CANNOT_REMATCH")
      if (control.action === "rematch")
        this.rematch ??= { requestedBy: id, accepted: [], refused: [] }
      if (!this.rematch) throw new AdmissionError("CANNOT_REMATCH")
      this.rematch.accepted = this.rematch.accepted.filter((value) => value !== id)
      this.rematch.refused = this.rematch.refused.filter((value) => value !== id)
      ;(control.action === "decline-rematch" ? this.rematch.refused : this.rematch.accepted).push(
        id,
      )
      const connected = this.connected()
      let restarted = false
      if (
        connected.every(
          (member) =>
            this.rematch?.accepted.includes(member.userId) ||
            this.rematch?.refused.includes(member.userId),
        )
      ) {
        if (this.rematch.accepted.length >= 2) {
          const accepted = new Set(this.rematch.accepted)
          for (const member of this.members.values()) member.pending = !accepted.has(member.userId)
          this.restart(true)
          restarted = true
        }
        this.rematch = null
      }
      await this.persist(true)
      if (restarted)
        platformLog("info", "WOBBLE_REMATCH_STARTED", {
          sessionId: this.session.id,
          userId: id,
          correlationId,
          players: this.active().length,
        })
      this.publish()
      return
    }
    const raceDecision = ["configure", "start", "next"].includes(control.action)
    if (raceDecision ? !playerHost : !(playerHost || moderator))
      throw new AdmissionError("CONTROL_FORBIDDEN")
    if (control.action === "remove") {
      if (!moderator || control.userId === id) throw new AdmissionError("CONTROL_FORBIDDEN")
      await this.gateway.audit(admission, "remove", control.userId)
      this.blocked.add(control.userId)
      this.members.delete(control.userId)
      this.observers.delete(control.userId)
      this.engine.leave(asPlayerId(control.userId), Date.now())
      if (this.hostId === control.userId) this.hostId = this.connected()[0]?.userId ?? this.hostId
      if (!this.connected().length) {
        this.pause()
        this.emptySince = Date.now()
      }
      await this.persist(true)
      this.ports.disconnect(control.userId, "REMOVED_FROM_ROOM")
      await this.gateway.audit(admission, "remove", control.userId, "completed")
    } else if (control.action === "configure") {
      if (!COURSES.some((course) => course.id === control.courseId))
        throw new AdmissionError("UNKNOWN_COURSE", 400)
      if (
        this.engine.state.phase !== "lobby" ||
        sessionForRoom(this.engine.state).round !== 0 ||
        this.paused
      )
        throw new AdmissionError("LOBBY_ONLY")
      const host = this.engine.state.players[0]?.id
      if (!host) throw new AdmissionError("CANNOT_START")
      this.engine.command(
        host,
        { type: "configure", courseId: control.courseId, mode: control.mode, remix: control.remix },
        Date.now(),
      )
      this.flushEffects()
      await this.persist(true)
    } else if (control.action === "start") {
      if (
        this.paused ||
        this.engine.state.phase !== "lobby" ||
        this.active().length < 2 ||
        this.active().some((member) => !member.connected || !member.loaded)
      )
        throw new AdmissionError("CANNOT_START")
      for (const member of this.active())
        this.engine.command(asPlayerId(member.userId), { type: "ready", ready: true }, Date.now())
      this.flushEffects()
      await this.persist(true)
    } else if (control.action === "next") {
      if (this.engine.state.phase !== "finished" || this.isComplete() || this.resultsDirty)
        throw new AdmissionError("CANNOT_START")
      this.restart(false)
      await this.persist(true)
    } else if (control.action === "pause") {
      if (this.paused || !["racing", "countdown"].includes(this.engine.state.phase))
        throw new AdmissionError("CANNOT_PAUSE")
      this.pause()
      await this.persist(true)
    } else if (control.action === "resume") {
      if (
        !this.paused ||
        this.active().length < 2 ||
        this.active().some((member) => !member.connected || !member.loaded)
      )
        throw new AdmissionError("CANNOT_RESUME")
      const now = Date.now()
      const phaseEndsAtMs =
        this.engine.state.phaseEndsAtMs === null
          ? null
          : this.engine.state.phaseEndsAtMs + now - this.pauseAt
      this.engine.state = {
        ...this.engine.state,
        phaseEndsAtMs,
        session: {
          ...sessionForRoom(this.engine.state),
          startsAtMs:
            this.engine.state.phase === "countdown"
              ? phaseEndsAtMs
              : now - ((this.engine.race?.tick ?? 0) * 1000) / 60,
        },
      }
      this.paused = false
      await this.persist(true)
      for (const member of this.connected()) this.restore(member.userId)
      for (const observer of this.observers.values()) this.restore(observer.userId)
    } else if (control.action === "end") {
      if (moderator) await this.gateway.audit(admission, "end")
      this.pause()
      this.ended = true
      this.stoppedBy = id
      await this.persist(true, {
        stopped_by: id,
        ended_at: new Date().toISOString(),
        is_open: false,
      })
      this.publish()
      if (moderator) await this.gateway.audit(admission, "end", undefined, "completed")
    }
    this.publish()
    if (control.action === "end") {
      // Publish the saved terminal state before closing game/voice connections.
      for (const member of this.connected())
        this.ports.disconnect(member.userId, "SESSION_COMPLETED")
      for (const observer of this.observers.values())
        this.ports.disconnect(observer.userId, "SESSION_COMPLETED")
    }
    const events: Partial<Record<PlatformControl["action"], string>> = {
      start: "WOBBLE_COUNTDOWN_STARTED",
      next: "WOBBLE_NEXT_ROUND_READY",
      pause: "WOBBLE_GAME_PAUSED",
      resume: "WOBBLE_GAME_RESUMED",
      end: "WOBBLE_GAME_STOPPED",
      remove: "WOBBLE_PLAYER_REMOVED",
    }
    platformLog(
      control.action === "configure" ? "debug" : "info",
      events[control.action] ?? "WOBBLE_CONTROL_COMPLETED",
      {
        correlationId,
        sessionId: this.session.id,
        userId: id,
        action: control.action,
        phase: this.engine.state.phase,
        courseId: sessionForRoom(this.engine.state).courseId,
        mode: sessionForRoom(this.engine.state).mode,
        round: sessionForRoom(this.engine.state).round + 1,
        saved: this.saved,
        ...(control.action === "remove" ? { removedUserId: control.userId } : {}),
      },
    )
  }

  private restart(newMatch: boolean): void {
    const first = this.engine.state.players[0]?.id
    if (!first) throw new AdmissionError("CANNOT_START")
    this.engine.command(first, { type: "restart" }, Date.now())
    if (newMatch)
      for (const member of this.members.values())
        if (member.connected && !this.rematch?.refused.includes(member.userId))
          member.pending = false
    this.engine.state = { ...this.engine.state, players: [] }
    for (const member of this.members.values()) member.lobbyRejoin = false
    for (const member of this.active()) this.addActor(member)
    this.paused = false
    this.rematch = null
    this.flushEffects()
    this.broadcast(rosterMessage(this.engine.state))
  }

  input(userId: string, message: ActionClientMessage): void {
    const member = this.members.get(userId)
    if (
      message.type === "input" &&
      member?.connected &&
      !member.pending &&
      !this.paused &&
      !this.ended
    )
      this.engine.command(asPlayerId(userId), message, Date.now())
  }

  pause(): void {
    if (this.paused) return
    this.pauseAt = Date.now()
    this.paused = true
    this.saved = false
    for (const member of this.members.values())
      this.engine.race?.releaseControls(asPlayerId(member.userId))
    this.publish()
    const frame = this.engine.frame(this.pauseAt)
    if (frame) this.broadcast(frame)
  }

  step(now: number): void {
    if (this.paused || this.ended || this.resultsDirty) return
    this.engine.step(now)
    this.flushEffects()
  }
  frame(): void {
    const frame = this.engine.frame(this.paused ? this.pauseAt : Date.now())
    if (frame) this.broadcast(frame)
  }
  private flushEffects(): void {
    const effects = this.engine.drainEffects()
    for (const effect of effects) {
      if (effect.kind === "broadcast") {
        if (effect.message.type === "phase" && effect.message.phase === "racing")
          platformLog("info", "WOBBLE_RACE_STARTED", {
            sessionId: this.session.id,
            raceId: this.engine.race?.raceId,
            courseId: sessionForRoom(this.engine.state).courseId,
            mode: sessionForRoom(this.engine.state).mode,
            round: sessionForRoom(this.engine.state).round + 1,
            players: this.active().length,
          })
        if (effect.message.type === "results") {
          const raceId = this.engine.race?.raceId ?? ""
          if (!this.accepted.some((result) => result.raceId === raceId)) {
            this.accepted.push({
              raceId,
              round: sessionForRoom(this.engine.state).round,
              rows: effect.message.results,
            })
            if (this.accepted.length > 16) this.accepted.shift()
            this.resultsDirty = true
          }
        }
        this.broadcast(effect.message)
      } else if (effect.kind === "send") this.ports.send(effect.to, effect.message)
    }
    if (effects.length) this.publish()
  }
  private broadcast(message: RoomWireMessage): void {
    for (const member of this.connected()) this.ports.send(member.userId, message)
    for (const observer of this.observers.values()) this.ports.send(observer.userId, message)
  }
  publish(): void {
    for (const member of this.connected())
      this.ports.send(member.userId, { type: "platform", view: this.view(member.userId) })
    for (const observer of this.observers.values())
      this.ports.send(observer.userId, { type: "platform", view: this.view(observer.userId) })
  }
  view(userId: string): WobbleView {
    const selection = sessionForRoom(this.engine.state)
    const observer = this.observers.has(userId)
    const member = this.members.get(userId)
    return {
      version: 1,
      sessionId: this.session.id,
      selfUserId: userId,
      actorId: observer || member?.pending ? null : userId,
      hostUserId: this.hostId,
      observer,
      pending: member?.pending ?? false,
      canControl: !this.ended && this.isPlayerHost(userId),
      canModerate:
        observer || this.roles.get(userId) === "teacher" || this.roles.get(userId) === "admin",
      paused: this.paused,
      saved: this.saved && !this.resultsDirty,
      ended: this.ended,
      phase: this.engine.state.phase,
      courseId: selection.courseId,
      mode: selection.mode,
      remix: selection.remix,
      round: selection.round,
      complete: selection.complete,
      playlist: selection.playlist,
      players: [...this.members.values()].map(({ disconnectedAt: _, ...member }) => ({
        ...member,
      })),
      observers: [...this.observers.values()].map((profile) => ({
        userId: profile.userId,
        name: profile.name,
        role: profile.role === "admin" ? "admin" : "teacher",
      })),
      results:
        this.engine.state.phase === "finished" ? [...buildResults(this.engine.state.players)] : [],
      standings: selection.standings,
      winnerText: winnerAnnouncement(buildResults(this.engine.state.players), selection),
      rematch: this.rematch,
    }
  }

  async maintain(now = Date.now()): Promise<void> {
    const fresh = await this.gateway.session(this.session.id)
    if (
      fresh.game_state?.allocationId !== this.allocationId ||
      (fresh.status === "completed" && !this.isComplete())
    ) {
      this.ended = true
      for (const member of this.connected())
        this.ports.disconnect(member.userId, "SESSION_COMPLETED")
      return
    }
    this.session = fresh
    for (const member of [...this.members.values()]) {
      if (!fresh.player_ids.includes(member.userId)) {
        this.members.delete(member.userId)
        this.engine.leave(asPlayerId(member.userId), now)
        this.ports.disconnect(member.userId, "REMOVED_FROM_ROOM")
        continue
      }
      if (member.connected) {
        try {
          await this.authorize(await this.gateway.profile(member.userId))
        } catch (error) {
          if (error instanceof AdmissionError && error.status < 500) {
            this.ports.disconnect(member.userId, error.code)
            await this.detached(member.userId)
          } else throw error
        }
      } else if (
        !this.paused &&
        member.disconnectedAt !== null &&
        now - member.disconnectedAt >= 30_000 &&
        !member.pending
      ) {
        member.pending = true
        member.lobbyRejoin =
          this.engine.state.phase === "lobby" && sessionForRoom(this.engine.state).round === 0
        this.engine.leave(asPlayerId(member.userId), now)
        if (member.userId === this.hostId)
          this.hostId =
            this.connected().find((player) => !player.pending)?.userId ??
            this.connected()[0]?.userId ??
            this.hostId
        this.flushEffects()
      }
    }
    for (const profile of [...this.observers.values()]) {
      try {
        await this.authorize(profile)
      } catch (error) {
        if (error instanceof AdmissionError && error.status < 500) {
          this.observers.delete(profile.userId)
          this.ports.disconnect(profile.userId, error.code)
        } else throw error
      }
    }
    if (!this.saved || this.resultsDirty || (!this.paused && now - this.lastSave >= 15_000))
      await this.persist(false)
    else if (now - this.lastLease >= 15_000 && !this.ended) await this.persist(false, {}, true)
    this.publish()
  }

  async persist(
    activity: boolean,
    extra: Record<string, unknown> = {},
    leaseOnly = false,
  ): Promise<void> {
    const now = Date.now()
    const previous = await this.gateway.session(this.session.id)
    if (previous.game_state?.allocationId !== this.allocationId)
      throw new AdmissionError("SESSION_CHANGED", 409)
    // A concurrent saved-roster removal must never be resurrected by a heartbeat.
    for (const id of this.session.player_ids)
      if (!previous.player_ids.includes(id) && this.members.has(id))
        throw new AdmissionError("SESSION_CHANGED", 409)
    let checkpoint = this.checkpoint
    const writesCheckpoint = !leaseOnly || !checkpoint
    const completedRace = this.resultsDirty && writesCheckpoint ? this.accepted.at(-1) : undefined
    if (writesCheckpoint) {
      const at = this.paused ? this.pauseAt : now
      checkpoint = this.checkpoints.sign({
        version: 1,
        protocol: ACTION_PROTOCOL,
        content: ACTION_CONTENT,
        sessionId: this.session.id,
        savedAt: now,
        state: structuredClone(this.engine.state),
        frame: this.engine.frame(at),
        players: [...this.members.values()].map(({ disconnectedAt: _, ...member }) => ({
          ...member,
          connected: false,
          loaded: false,
        })),
        blocked: [...this.blocked],
        results: structuredClone(this.accepted),
        hostId: this.hostId,
        countdownRemainingMs:
          this.engine.state.phaseEndsAtMs === null
            ? null
            : Math.max(0, this.engine.state.phaseEndsAtMs - at),
      })
    }
    const members = [...this.members.values()]
    const connected = this.connected()
    const host = this.members.get(this.hostId)
    const status =
      this.ended || this.isComplete()
        ? "completed"
        : this.paused
          ? "paused"
          : this.engine.state.phase === "lobby" && sessionForRoom(this.engine.state).round === 0
            ? "waiting"
            : "playing"
    if ((this.ended || this.isComplete()) && !this.completedAt)
      this.completedAt = new Date(now).toISOString()
    if (status !== "completed") this.completedAt = null
    try {
      this.session = await this.gateway.update(previous, {
        status,
        host_id: this.hostId,
        ...(host ? { host_name: host.name } : {}),
        ...(this.grades.has(this.hostId) ? { host_grade: this.grades.get(this.hostId) } : {}),
        player_ids: members.map((member) => member.userId),
        player_names: members.map((member) => member.name),
        connected_player_ids: this.ended ? [] : connected.map((member) => member.userId),
        connected_player_names: this.ended ? [] : connected.map((member) => member.name),
        connected_observer_ids: [],
        peak_player_count: Math.max(previous.peak_player_count ?? 0, members.length),
        ...(activity || (!this.paused && !this.isComplete())
          ? { last_activity: new Date(now).toISOString() }
          : {}),
        ...(this.ended
          ? { stopped_by: this.stoppedBy, ended_at: this.completedAt, is_open: false }
          : {}),
        ...(this.isComplete()
          ? { ended_at: this.completedAt }
          : !this.ended
            ? { ended_at: null }
            : {}),
        game_state: {
          wobble: true,
          version: 1,
          allocationId: this.allocationId,
          leaseUntil: this.ended ? 0 : now + 60_000,
          checkpoint,
        },
        ...extra,
      })
      this.checkpoint = checkpoint
      this.saved = true
      if (writesCheckpoint) this.resultsDirty = false
      if (completedRace) this.logCompletedRace(completedRace)
      this.lastLease = now
      if (!leaseOnly) this.lastSave = now
    } catch (error) {
      this.saved = false
      this.pause()
      platformLog("error", "WOBBLE_SAVE_FAILED", {
        sessionId: this.session.id,
        code: error instanceof AdmissionError ? error.code : "SAVE_FAILED",
      })
      throw error
    }
  }

  private logCompletedRace(result: Checkpoint["results"][number]): void {
    const selection = sessionForRoom(this.engine.state)
    const finishers = result.rows.filter((row) => row.timeMs !== null)
    const best = Math.min(...finishers.map((row) => row.timeMs ?? Infinity))
    const winnerUserIds = finishers.filter((row) => row.timeMs === best).map((row) => row.id)
    const fields = {
      sessionId: this.session.id,
      raceId: result.raceId,
      courseId: selection.courseId,
      mode: selection.mode,
      round: result.round + 1,
      players: result.rows.length,
      finishers: finishers.length,
      winnerUserIds,
      saved: true,
    }
    platformLog("info", "WOBBLE_RACE_COMPLETED", fields)
    if (selection.complete) {
      const first = selection.standings[0]
      const cupWinnerIds =
        first && first.finishes > 0
          ? selection.standings
              .filter(
                (row) =>
                  row.points === first.points &&
                  row.finishes === first.finishes &&
                  row.totalMs === first.totalMs,
              )
              .map((row) => row.id)
          : []
      platformLog("info", "WOBBLE_GAME_COMPLETED", {
        ...fields,
        winnerUserIds: selection.mode === "cup" ? cupWinnerIds : winnerUserIds,
        rounds: selection.playlist.length,
      })
    }
  }

  async saveResults(): Promise<void> {
    if (!this.resultsDirty || this.savingResult) return
    this.savingResult = true
    try {
      await this.run(() => this.persist(true))
    } finally {
      this.savingResult = false
      this.publish()
    }
  }
  async hibernate(): Promise<void> {
    if (!this.ended && !this.isComplete()) this.pause()
    await this.persist(false)
    const previous = await this.gateway.session(this.session.id)
    if (previous.game_state?.allocationId === this.allocationId)
      await this.gateway.update(previous, {
        connected_player_ids: [],
        connected_player_names: [],
        game_state: { ...previous.game_state, leaseUntil: 0 },
      })
  }
}
