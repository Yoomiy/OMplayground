/**
 * Game — the shell that binds simulation, scene and race state together.
 *
 * The simulation is the same pure code the unit tests exercise: `stepRunner` against a
 * `WorldSnapshot` built from the course. Rendering only ever reads simulation state.
 * The race lifecycle (solo/party starts, restarts, phase reactions) lives in
 * `race-director.ts`; this class is construction, wiring, the fixed-step pump
 * and rendering.
 */

import type { AuthorityFrame } from "../shared/action-protocol"
import { NET } from "../shared/constants"
import { RUNNER_COLORS, SUNRISE_SCRAMBLE } from "../shared/course"
import { COURSE_PACK_VERSION, playableCourse } from "../shared/course-catalog"
import type { GraphicsQuality } from "../shared/graphics-quality"
import type { WobbleView } from "../shared/platform-protocol"
import { RunnerPrediction } from "../shared/prediction"
import { type ProgressRacer, RaceProgress } from "../shared/race-progress"
import { stepRace } from "../shared/race-simulation"
import {
  createSession,
  type RaceSelection,
  type RoomSession,
  sessionForRoom,
} from "../shared/session"
import type { CourseDefinition, PlayerId } from "../shared/types"
import { createWorldSnapshot } from "../shared/world"
import { AudioKit } from "./audio"
import { createOrbit, updateOrbit } from "./camera-math"
import { CameraRig } from "./camera-rig"
import { ConnectionTiming } from "./connection-timing"
import { CourseView } from "./course-view"
import { installDebugApi } from "./debug-api"
import { Effects } from "./effects"
import { FixedStepPump } from "./fixed-step-pump"
import { FrameLoop } from "./frame-loop"
import { FrameMetrics } from "./frame-metrics"
import { loadGraphicsQuality, saveGraphicsQuality } from "./graphics-preferences"
import { InputSource } from "./input"
import { LocalRunner } from "./local-runner"
import { NpcPack } from "./npc-pack"
import { type PartyEvents, PartyLink, type PartyTransport } from "./party-link"
import { RaceClock } from "./race-clock"
import { RaceDirector } from "./race-director"
import type { FeedbackPorts } from "./race-feedback"
import { applyCrowdBumps, applyEvents } from "./race-feedback"
import { localFinisherId, rankFinishers, recordBest } from "./race-results"
import { RemoteRunners } from "./remote-runners"
import type { SceneKit } from "./scene-kit"
import { createSceneKit } from "./scene-kit"
import { Ui } from "./ui"

const PARTY_NPC_COUNT = 0

export class Game {
  private readonly ui: Ui
  private readonly kit: SceneKit
  private readonly camera: CameraRig
  private readonly effects = new Effects()
  private readonly audio = new AudioKit()
  private readonly input = new InputSource()
  private course: CourseDefinition = SUNRISE_SCRAMBLE
  private courseView: CourseView
  private readonly remotes: RemoteRunners
  private npcs: NpcPack
  private readonly party: PartyTransport
  private platformView: WobbleView | null = null
  private frozenWorldSec = 0
  private followId: PlayerId | null = null
  private readonly clock = new RaceClock()
  private runner: LocalRunner
  private readonly director: RaceDirector
  private readonly loop: FrameLoop
  private readonly reducedMotion: boolean
  private readonly prediction = new RunnerPrediction()
  private raceProgress = new RaceProgress(this.course)
  private officialProgress = new Map<
    string,
    { checkpoint: AuthorityFrame["actors"][number]["sim"]["checkpoint"]; finishedMs: number | null }
  >()
  private authorityCheckpoint = -1
  private authorityTick = 0
  private pingNonce = 0
  private partyStepTimer: ReturnType<typeof globalThis.setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof globalThis.setInterval> | null = null
  private readonly timing = new ConnectionTiming()
  private maxCorrectionM = 0
  private maxFrameMs = 0
  private readonly frameMetrics = new FrameMetrics()
  private lastRenderMs = 0
  private lastWorldDrawSec = 0
  private lastReportMs = -5000
  private disposed = false
  private readonly removeDebugApi: () => void
  private countdownTimer: ReturnType<typeof setTimeout> | null = null
  private readonly resize = (): void => this.kit.resize()

  private session = createSession(0)
  private courseKey = ""
  private npcSeed = -1
  private pendingSelection: RaceSelection | null = null
  private selfId: PlayerId | null = null
  private roomCode: string | null = null
  private orbit = createOrbit(SUNRISE_SCRAMBLE.spawnYaw)

  constructor(root: HTMLElement, options?: { createParty(events: PartyEvents): PartyTransport }) {
    this.reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
    this.ui = new Ui(root, {
      onPlaySolo: (name, colorIndex) => this.director.startSolo(name, colorIndex),
      onPlayOnline: (name, colorIndex, code) => {
        this.pendingSelection = code === null ? this.ui.selection : null
        void this.director.startParty(name, colorIndex, code)
        this.startPartyPump()
      },
      onConfigure: (selection) => this.party.send({ type: "configure", ...selection }),
      onReady: (ready) => this.party.send({ type: "ready", ready }),
      onLeaveLobby: () => {
        this.party.leave()
        this.remotes.clear()
        this.director.backToMenu()
      },
      onRestart: () => this.director.restart(),
      onBackToMenu: () => this.director.backToMenu(),
      onToggleSound: (muted) => this.audio.setMuted(muted),
      onGraphicsQuality: (quality) => this.setGraphicsQuality(quality),
    })

    this.kit = createSceneKit(this.ui.canvas, loadGraphicsQuality())
    this.ui.setGraphicsQuality(this.kit.graphicsQuality)
    this.camera = new CameraRig(this.kit.camera)
    this.camera.setCourse(this.course)
    this.courseView = new CourseView(this.course)
    this.remotes = new RemoteRunners(this.kit.scene)
    this.npcs = new NpcPack(this.kit.scene, this.course)
    const events = this.partyEvents()
    this.party = options?.createParty(events) ?? new PartyLink(events)
    this.runner = new LocalRunner(this.kit.scene, this.course, RUNNER_COLORS[0] ?? "#FF7A5C")
    const game = this
    this.director = new RaceDirector({
      ui: this.ui,
      audio: this.audio,
      clock: this.clock,
      camera: this.camera,
      get runner() {
        return game.runner
      },
      remotes: this.remotes,
      get npcs() {
        return game.npcs
      },
      party: this.party,
      get course() {
        return game.course
      },
      selectCourse: (selection, seed) =>
        this.loadCourse(createSession(seed, { ...selection, mode: "race" }), seed),
      onRunnersReset: () => {
        this.orbit = createOrbit(this.course.spawnYaw)
      },
    })
    this.kit.scene.add(this.courseView.group, this.effects.group)

    globalThis.addEventListener("resize", this.resize)
    this.input.attach(this.ui.canvas)
    this.ui.show("start")
    this.camera.snapTo(this.course.spawn, this.course.spawnYaw)
    this.removeDebugApi = installDebugApi({
      performance: () => ({
        frames: this.frameMetrics.snapshot(),
        graphics: {
          quality: this.kit.graphicsQuality,
          pixelRatio: this.kit.renderer.getPixelRatio(),
          width: this.kit.renderer.domElement.width,
          height: this.kit.renderer.domElement.height,
          shadows: this.kit.renderer.shadowMap.enabled,
          shadowSize: this.kit.renderer.shadowMap.enabled ? this.kit.sun.shadow.mapSize.x : 0,
        },
        renderer: {
          drawCalls: this.kit.renderer.info.render.calls,
          triangles: this.kit.renderer.info.render.triangles,
          geometries: this.kit.renderer.info.memory.geometries,
          textures: this.kit.renderer.info.memory.textures,
        },
      }),
      state: () => ({
        phase: this.clock.phase,
        courseId: this.course.id,
        session: this.session,
        raceMs: this.clock.raceMs,
        worldTimeSec: this.clock.worldTimeSec,
        renderWorldTimeSec: this.lastWorldDrawSec,
        renderAtMs: this.lastRenderMs,
        checkpoint: this.runner.sim.checkpoint,
        position: { ...this.runner.sim.position },
        remotes: this.remotes.count,
        npcs: this.director.currentMode === "party" ? this.remotes.npcCount : this.npcs.size,
        npcProgress: this.npcs.progress(),
        remoteProgress: this.remotes.progress(),
        renderPosition: { ...this.runner.renderPosition },
        predictedActors: this.prediction.predictedActors.map((actor) => ({
          id: actor.id,
          npc: actor.npc,
          position: { ...actor.sim.position },
          velocity: { ...actor.sim.velocity },
          contact: actor.sim.lastContactId,
          respawnSeq: actor.respawnSeq,
        })),
        remotePositions: this.remotes.positions(),
        selfId: this.selfId,
        room: this.roomCode,
        serverTick: this.authorityTick,
        predictionTick: this.prediction.tick,
        pendingInputs: this.prediction.pendingCount,
        predictionHistory: this.prediction.historyCount,
        predictionFrozen: this.prediction.frozen,
        frameAgeMs: this.prediction.frameAgeMs,
        correctionM: this.maxCorrectionM,
        rttMs: this.timing.rttMs,
      }),
      autopilot: (enabled, routeIndex) => this.runner.setAutopilot(enabled, routeIndex),
    })

    this.loop = new FrameLoop(
      (dt, lagSec) => {
        if (this.director.currentMode === "solo")
          this.stepSimulation(dt, performance.now() - lagSec * 1000)
      },
      (dt, nowMs) => this.render(dt, nowMs),
    )
    this.loop.start()
    this.heartbeatTimer = globalThis.setInterval(() => {
      if (this.disposed || !this.party.active) return
      const pingAtMs = performance.now()
      this.pingNonce++
      this.timing.sent(this.pingNonce, pingAtMs)
      const racing = this.director.currentMode === "party" && this.clock.phase === "racing"
      const frameAge = this.prediction.frameAgeMs
      const reason =
        racing && frameAge > 500
          ? "snapshot_delay"
          : racing && this.prediction.pendingCount >= 120
            ? "ack_delay"
            : this.maxCorrectionM >= 0.5
              ? "correction"
              : null
      const report = reason !== null && pingAtMs - this.lastReportMs >= 5000
      this.party.send({
        type: "ping",
        nonce: this.pingNonce,
        resync: racing && (frameAge > 500 || this.prediction.pendingCount >= 120),
        ...(report
          ? {
              network: {
                reason,
                pendingInputs: Math.min(1_000_000, this.prediction.pendingCount),
                frameAgeMs: Math.min(60_000, frameAge),
                correctionM: Math.min(1000, this.maxCorrectionM),
                maxFrameMs: Math.min(60_000, this.maxFrameMs),
                rttMs: this.timing.rttMs,
              },
            }
          : {}),
      })
      if (report) this.lastReportMs = pingAtMs
      if (report || pingAtMs - this.lastReportMs >= 5000) {
        this.maxCorrectionM = 0
        this.maxFrameMs = 0
      }
    }, 1000)
    if (options !== undefined) this.director.enterEmbeddedParty()
    else this.director.resumeParty()
    this.startPartyPump()
  }

  private startPartyPump(): void {
    if (this.partyStepTimer !== null || this.director.currentMode !== "party") return
    let lastMs = performance.now()
    let sampleAtMs = lastMs
    const pump = new FixedStepPump((dt, lagSec) =>
      this.stepSimulation(dt, sampleAtMs - lagSec * 1000),
    )
    this.partyStepTimer = globalThis.setInterval(() => {
      if (this.disposed || this.director.currentMode !== "party") {
        if (this.partyStepTimer !== null) globalThis.clearInterval(this.partyStepTimer)
        this.partyStepTimer = null
        return
      }
      const nowMs = performance.now()
      sampleAtMs = nowMs
      pump.advance((nowMs - lastMs) / 1000)
      lastMs = nowMs
    }, 8)
  }

  private loadCourse(session: RoomSession, seed: number): void {
    this.session = session
    const key = `${session.courseId}:${session.remix ? seed : "classic"}`
    if (this.courseKey === key) {
      const count = this.director.currentMode === "party" ? PARTY_NPC_COUNT : 4
      if (this.npcSeed !== seed || this.npcs.size !== count) this.npcs.spawn(seed, count)
      this.npcSeed = seed
      return
    }
    this.clock.idle()
    const pilot = this.runner.autopilotActive
    this.kit.scene.remove(this.courseView.group)
    this.courseView.dispose()
    this.runner.dispose()
    this.npcs.dispose()
    this.remotes.clear()
    this.course = playableCourse(session.courseId, session.remix ? seed : null)
    this.raceProgress = new RaceProgress(this.course)
    this.officialProgress.clear()
    this.camera.setCourse(this.course)
    this.courseView = new CourseView(this.course)
    this.kit.scene.add(this.courseView.group)
    this.kit.setTheme(this.course.theme)
    this.runner = new LocalRunner(
      this.kit.scene,
      this.course,
      RUNNER_COLORS[this.director.currentColorIndex % RUNNER_COLORS.length] ?? "#FF7A5C",
    )
    this.runner.setAutopilot(pilot)
    this.npcs = new NpcPack(this.kit.scene, this.course)
    this.npcs.spawn(seed, this.director.currentMode === "party" ? PARTY_NPC_COUNT : 4)
    this.orbit = createOrbit(this.course.spawnYaw)
    this.camera.snapTo(this.course.spawn, this.course.spawnYaw)
    this.npcSeed = seed
    this.courseKey = key
    this.ui.setCourse(session)
  }

  private get ports(): FeedbackPorts {
    return {
      effects: this.effects,
      audio: this.audio,
      ui: this.ui,
      camera: this.camera,
      runnerColor:
        RUNNER_COLORS[this.director.currentColorIndex % RUNNER_COLORS.length] ?? "#FF7A5C",
      checkpointTotal: this.course.checkpoints.length - 1,
    }
  }

  private partyEvents(): PartyEvents {
    return {
      onWelcome: (you, snapshot, seed) => {
        this.selfId = you
        this.roomCode = snapshot.code
        this.loadCourse(sessionForRoom(snapshot), seed)
        const self = snapshot.players.find((player) => player.id === you)
        if (self !== undefined) this.director.restoreIdentity(self.name, self.colorIndex)
        this.ui.setCourse(sessionForRoom(snapshot))
        this.ui.setRoom(snapshot, this.director.playerName, this.selfId)
      },
      onRoster: (snapshot) => {
        const self = snapshot.players.find((player) => player.id === this.selfId)
        if (self && self.colorIndex !== this.director.currentColorIndex)
          this.director.restoreIdentity(self.name, self.colorIndex)
        this.roomCode = snapshot.code
        this.loadCourse(sessionForRoom(snapshot), snapshot.seed)
        this.ui.setRoom(snapshot, this.director.playerName, this.selfId)
        this.remotes.sync(snapshot, this.selfId)
        if (this.pendingSelection !== null && snapshot.players[0]?.id === this.selfId) {
          const selection = this.pendingSelection
          this.pendingSelection = null
          this.party.send({ type: "configure", ...selection })
        }
      },
      onPhase: (phase, endsAtMs, serverNowMs, session) => {
        if (phase === "countdown" || phase === "lobby") {
          this.prediction.clear()
          this.authorityCheckpoint = -1
        }
        if (session !== undefined) {
          this.session = session
          if (phase === "countdown") this.ui.setCourse(session)
        }
        this.director.onPhase(phase, endsAtMs, serverNowMs, session)
      },
      onResults: (results, session) => {
        if (session !== undefined) this.session = session
        this.director.setResults(results)
        const mine = results.find((row) => row.id === this.selfId)
        if (mine?.timeMs !== null && mine?.timeMs !== undefined) this.clock.finishAt(mine.timeMs)
        else this.clock.finish()
        this.audio.stopMusic()
        this.showFinishScreen()
      },
      onFrame: (frame) => this.onAuthorityFrame(frame),
      onPong: (nonce) => this.timing.received(nonce, performance.now()),
      onFailure: (message) => {
        this.clock.idle()
        this.ui.showError(message)
      },
      onConnection: (reconnecting, rttMs) => {
        if (rttMs !== undefined) this.timing.sample(rttMs)
        this.ui.setReconnecting(reconnecting)
        if (reconnecting) {
          this.prediction.clear()
          this.input.reset()
          this.clock.suspend()
          this.audio.stopMusic()
        }
      },
    }
  }

  private onAuthorityFrame(frame: AuthorityFrame): void {
    if (this.disposed || this.director.currentMode !== "party" || this.selfId === null) return
    const observing =
      this.platformView !== null && (this.platformView.observer || this.platformView.pending)
    const actor = observing
      ? (frame.actors.find((actor) => !actor.npc && actor.finishedMs === null) ?? frame.actors[0])
      : frame.actors.find((actor) => actor.id === this.selfId)
    if (actor === undefined) return
    this.followId = actor.id
    this.frozenWorldSec = frame.worldTimeSec
    if (this.platformView !== null)
      this.runner.setLabel(observing ? actor.name : `${actor.name} · אני`)
    const frozen = this.platformView?.paused || this.platformView?.ended
    const predictionFrame = frozen ? { ...frame, phase: "finished" as const } : frame
    const previous = { ...this.runner.sim.position }
    const previousCheckpoint = this.runner.sim.checkpoint
    const initial = this.prediction.reconcile(
      this.runner.sim,
      predictionFrame,
      actor,
      this.course,
      this.timing.rttMs / 2000,
      observing,
    )
    if (initial === null) return
    this.runner.restorePilotProgress(previousCheckpoint)
    if (initial) this.remotes.clear()
    const correctionM = Math.hypot(
      previous.x - this.runner.sim.position.x,
      previous.y - this.runner.sim.position.y,
      previous.z - this.runner.sim.position.z,
    )
    if (!initial && !this.prediction.lastReconcile.respawned)
      this.maxCorrectionM = Math.max(this.maxCorrectionM, correctionM)
    this.runner.smoothCorrection(
      previous,
      initial ||
        actor.finishedMs !== null ||
        this.prediction.lastReconcile.respawned ||
        this.prediction.lastReconcile.resynced,
      actor.sim.stumbleTimer > 0,
    )
    this.remotes.syncPredicted(
      this.prediction.predictedActors,
      observing ? actor.id : this.selfId,
      this.prediction.tick,
      this.prediction.stepAtMs,
      true,
      initial || this.prediction.lastReconcile.resynced,
    )
    this.officialProgress = new Map(
      frame.actors.map((entry) => [
        entry.id,
        { checkpoint: entry.sim.checkpoint, finishedMs: entry.finishedMs },
      ]),
    )
    this.authorityTick = frame.tick
    this.ui.setCheckpoints(actor.sim.checkpoint, this.course.checkpoints.length - 1)
    this.clock.syncAuthority(
      frame.phase === "racing" ? NET.countdownSec + this.prediction.tick / 60 : frame.worldTimeSec,
      frame.phase === "racing" ? 0 : this.timing.rttMs / 2000,
      NET.countdownSec,
      initial || this.prediction.lastReconcile.resynced,
    )
    if (frozen) this.clock.suspend()
    if (actor.sim.checkpoint > this.authorityCheckpoint) {
      if (this.authorityCheckpoint >= 0)
        applyEvents(
          [{ kind: "checkpoint", index: actor.sim.checkpoint, position: actor.sim.position }],
          this.ports,
          true,
        )
      this.authorityCheckpoint = actor.sim.checkpoint
    }
    if (actor.finishedMs !== null && this.clock.phase === "racing") {
      this.clock.finishAt(actor.finishedMs)
      this.effects.finish(actor.sim.position)
      this.audio.play("finish")
      this.audio.stopMusic()
      this.ui.setWaiting()
    }
  }

  private stepSimulation(dt: number, stepAtMs = performance.now()): void {
    if (this.platformView?.paused || this.platformView?.ended) return
    // Solo physics uses this fixed-step clock; party prediction uses server ticks.
    const tick = this.clock.tick(dt, this.director.currentMode === "solo")
    this.ui.setConnectionDelayed(
      this.director.currentMode === "party" &&
        this.clock.phase === "racing" &&
        (this.prediction.frameAgeMs > 500 || this.prediction.pendingCount >= 120),
    )
    if (this.clock.phase === "countdown" || tick.started) this.ui.setCountdown(tick.label)
    if (tick.started) {
      this.audio.play("go")
      this.countdownTimer = globalThis.setTimeout(() => this.ui.setCountdown(null), 450)
    }
    if (this.clock.phase === "racing") {
      this.ui.setTimer(this.clock.raceMs)
    }

    const locked = this.clock.locked
    if (this.platformView && (this.platformView.observer || this.platformView.pending)) {
      this.runner.beginStep()
      if (this.prediction.advanceSpectator(this.course, stepAtMs)) {
        this.runner.afterStep([], dt, stepAtMs)
        this.remotes.syncPredicted(
          this.prediction.predictedActors,
          this.followId,
          this.prediction.tick,
          stepAtMs,
        )
      }
      return
    }
    if (
      locked &&
      this.director.currentMode === "party" &&
      this.prediction.advanceSpectator(this.course, stepAtMs)
    ) {
      this.remotes.syncPredicted(
        this.prediction.predictedActors,
        this.selfId,
        this.prediction.tick,
        stepAtMs,
      )
    }
    if (!locked) this.runner.beginStep()
    const manual = this.input.sample(this.orbit.yaw, locked)
    if (!locked && this.director.currentMode === "party") {
      const time = this.prediction.nextWorldTimeSec
      const respawnRequested = this.input.consumeRespawn()
      const planned = this.runner.autopilotActive
        ? this.runner.planStep(
            createWorldSnapshot(this.course, time),
            time,
            manual,
            respawnRequested,
          )
        : { input: manual, respawnRequested }
      try {
        const result = this.prediction.advance(
          this.runner.sim,
          planned.input,
          planned.respawnRequested ?? false,
          this.course,
          stepAtMs,
        )
        if (result !== null) {
          this.party.send(result.message)
          this.remotes.syncPredicted(
            this.prediction.predictedActors,
            this.selfId,
            this.prediction.tick,
            stepAtMs,
          )
          applyCrowdBumps(result.bumps, this.ports, this.selfId ?? "self")
          this.runner.afterStep(result.events, dt, stepAtMs)
          applyEvents(result.events, this.ports, true)
        }
      } catch (error) {
        this.clock.idle()
        this.ui.showError(error instanceof Error ? error.message : "החיבור למרוץ נכשל")
      }
      return
    }
    if (!locked) {
      const world = createWorldSnapshot(this.course, this.clock.worldTimeSec)
      const context = {
        world,
        timeSec: this.clock.worldTimeSec,
        dt,
        raceMs: this.clock.raceMs,
      }
      const tick = stepRace(
        [
          this.runner.planStep(world, context.timeSec, manual, this.input.consumeRespawn()),
          ...this.npcs.planStep(context),
        ],
        world,
        dt,
      )
      const events = tick.events.get("self") ?? []
      this.runner.afterStep(events, dt, stepAtMs)
      this.npcs.afterStep(tick, context, (events) => {
        applyEvents(events, this.ports, false)
      })
      applyCrowdBumps(tick.bumps, this.ports, "self")
      if (applyEvents(events, this.ports, true).finished && this.clock.phase === "racing")
        this.finishRace()
    }
  }

  private finishRace(): void {
    this.clock.finish()
    this.effects.finish(this.runner.sim.position)
    this.audio.play("finish")
    this.audio.stopMusic()
    if (this.director.currentMode === "solo") this.showFinishScreen()
    else this.ui.setWaiting()
  }

  private showFinishScreen(): void {
    const finished =
      this.director.currentMode === "solo" ||
      this.director.raceResults.some((row) => row.id === this.selfId && row.timeMs !== null)
    const note = finished
      ? recordBest(
          this.clock.raceMs,
          globalThis.localStorage,
          `${COURSE_PACK_VERSION}:${this.courseKey}`,
        ).note
      : "המרוץ הגיע למגבלת שלוש הדקות. אפשר לנסות שוב!"
    const results =
      this.director.raceResults.length > 0
        ? this.director.raceResults
        : rankFinishers([
            {
              id: localFinisherId(0),
              name: this.director.playerName,
              timeMs: Math.round(this.clock.raceMs),
            },
            ...this.npcs.finishers(1),
          ])
    this.ui.showFinish(this.clock.raceMs, note, results, this.session, finished)
  }

  private render(dt: number, nowMs: number): void {
    if (this.lastRenderMs > 0)
      this.maxFrameMs = Math.max(this.maxFrameMs, nowMs - this.lastRenderMs)
    this.lastRenderMs = nowMs
    this.ui.setConnectionDelayed(
      this.director.currentMode === "party" &&
        this.clock.phase === "racing" &&
        (this.prediction.frameAgeMs > 500 || this.prediction.pendingCount >= 120),
    )
    const worldTime =
      this.platformView?.paused ||
      this.platformView?.ended ||
      this.platformView?.phase === "finished"
        ? this.frozenWorldSec
        : this.director.currentMode === "party" && this.prediction.racing
          ? this.prediction.renderAt(nowMs)
          : this.clock.renderWorldTimeSec
    this.lastWorldDrawSec = worldTime
    this.courseView.update(worldTime, this.reducedMotion)
    this.runner.render(dt, nowMs)
    this.npcs.render(dt)
    this.remotes.render(nowMs, dt)
    this.effects.update(dt)

    const sim = this.runner.sim
    if (this.input.consumeRecenter()) {
      this.orbit = { ...createOrbit(sim.yaw), followCooldownSec: 1.4 }
    }
    this.orbit = updateOrbit(this.orbit, this.input.takeOrbitDelta(dt), sim.velocity, dt)
    this.camera.update(this.runner.renderPosition, sim.velocity, this.orbit, dt, this.reducedMotion)
    this.kit.sun.position.set(sim.position.x + 28, 46, sim.position.z - 18)
    this.kit.sun.target.position.set(sim.position.x, 0, sim.position.z)
    this.kit.sun.target.updateMatrixWorld()

    if (this.clock.phase === "racing") {
      const racers: ProgressRacer[] =
        this.director.currentMode === "party"
          ? this.prediction.predictedActors.map((actor) => {
              const official = this.officialProgress.get(actor.id)
              return {
                id: actor.id,
                sim: {
                  position: actor.sim.position,
                  checkpoint: official?.checkpoint ?? actor.sim.checkpoint,
                },
                finishedMs: official?.finishedMs ?? null,
              }
            })
          : [{ id: "self", sim, finishedMs: null }, ...this.npcs.racers()]
      this.ui.setPlace(
        this.raceProgress.place(
          this.director.currentMode === "party" ? (this.selfId ?? "") : "self",
          racers,
        ),
      )
    }
    const covered =
      !!this.platformView &&
      (this.platformView.paused ||
        this.platformView.ended ||
        this.platformView.phase === "lobby" ||
        this.platformView.phase === "finished")
    const drawing = !document.hidden && !covered
    this.frameMetrics.record(nowMs, drawing)
    if (drawing) this.kit.render()
  }

  setGraphicsQuality(quality: GraphicsQuality): void {
    this.kit.setGraphicsQuality(quality)
    this.ui.setGraphicsQuality(quality)
    saveGraphicsQuality(quality)
  }

  setPlatformView(view: WobbleView): void {
    const wasPaused = this.platformView?.paused ?? false
    const wasWatching =
      !!this.platformView && (this.platformView.observer || this.platformView.pending)
    this.platformView = view
    if (wasPaused !== view.paused || wasWatching !== (view.observer || view.pending)) {
      this.prediction.clear()
      this.input.reset()
    }
    if (view.paused || view.ended) {
      this.clock.suspend()
      this.audio.stopMusic()
    }
  }

  releaseInput(): void {
    this.input.reset()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeDebugApi()
    globalThis.removeEventListener("resize", this.resize)
    if (this.countdownTimer !== null) globalThis.clearTimeout(this.countdownTimer)
    if (this.heartbeatTimer !== null) globalThis.clearInterval(this.heartbeatTimer)
    if (this.partyStepTimer !== null) globalThis.clearInterval(this.partyStepTimer)
    this.loop.stop()
    this.ui.dispose()
    this.input.detach(this.ui.canvas)
    this.party.close()
    this.audio.dispose()
    this.effects.dispose()
    this.runner.dispose()
    this.npcs.dispose()
    this.remotes.clear()
    this.courseView.dispose()
    this.kit.dispose()
  }
}
