import { expect, test } from "bun:test"
import * as THREE from "three"
import { LocalRunner } from "../src/client/local-runner"
import { RemoteRunners } from "../src/client/remote-runners"
import { SpectatorTimeline } from "../src/client/spectator-timeline"
import type { AuthorityFrame } from "../src/shared/action-protocol"
import { AuthoritativeRace } from "../src/shared/authoritative-race"
import { RUNNER } from "../src/shared/constants"
import { SUNRISE_SCRAMBLE } from "../src/shared/course"
import { RunnerPrediction } from "../src/shared/prediction"
import type { CourseDefinition, Vec3 } from "../src/shared/types"
import { asObstacleId, asPlayerId, NEUTRAL_INPUT, vec3 } from "../src/shared/types"

const ids = [asPlayerId("a"), asPlayerId("b"), asPlayerId("c")] as const
const floor: CourseDefinition = {
  ...SUNRISE_SCRAMBLE,
  spawn: vec3(0, 0.45, 0),
  spawnYaw: 0,
  obstacles: [],
  checkpoints: [],
  waypoints: [],
  platforms: [
    {
      id: asObstacleId("floor"),
      kind: "path",
      color: "white",
      box: { center: vec3(0, -0.5, 0), halfExtents: vec3(100, 0.5, 100), yaw: 0 },
    },
  ],
  finish: { center: vec3(90, 1, 90), halfExtents: vec3(1, 1, 1), yaw: 0 },
}
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

// Real Three meshes; only name-label rasterization needs this small DOM substitute.
function nameLabels() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document")
  const noop = () => {}
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        getContext: () => ({
          beginPath: noop,
          moveTo: noop,
          arcTo: noop,
          closePath: noop,
          fill: noop,
          fillText: noop,
        }),
      }),
    },
  })
  return () => {
    if (descriptor) Object.defineProperty(globalThis, "document", descriptor)
    else Reflect.deleteProperty(globalThis, "document")
  }
}

for (const delay of [3, 6])
  for (const fps of [60, 120])
    for (const mode of ["glancing", "steering"] as const) {
      test(`remote contacts remain separated in third-player and teacher meshes: ${mode}, ${delay} ticks delay, ${fps} Hz`, () => {
        const restoreDocument = nameLabels()
        let now = 0
        let race = new AuthoritativeRace(
          "presentation",
          floor,
          ids.map((id, colorIndex) => ({ id, name: id, colorIndex })),
          7,
          0,
        )
        const initial = race.frame("racing", 0)
        for (const [index, actor] of initial.actors.entries())
          actor.sim.position =
            index === 2 ? vec3(0, 0.45, -20) : vec3(index === 0 ? -1.3 : 1.3, 0.45, 0)
        race = AuthoritativeRace.restore(initial, floor)
        const scene = new THREE.Scene()
        const runner = new LocalRunner(scene, floor, "#fff")
        const remotes = new RemoteRunners(scene)
        const teacherScene = new THREE.Scene()
        const followed = new LocalRunner(teacherScene, floor, "#fff")
        const teacherRemotes = new RemoteRunners(teacherScene)
        const prediction = new RunnerPrediction(() => now)
        const spectator = new SpectatorTimeline(() => now)
        const self = initial.actors.find((actor) => actor.id === ids[2])
        if (!self) throw new Error("Missing third player")
        prediction.reconcile(runner.sim, initial, self, floor, delay / 60)
        runner.smoothCorrection(self.sim.position, true)
        remotes.syncPredicted(prediction.predictedActors, ids[2], prediction.tick, 0, false, true)
        spectator.push(initial)
        const packets: { at: number; frame: AuthorityFrame }[] = []
        let seq = 0,
          contacts = 0,
          fractionalSamples = 0,
          displayedSamples = 0,
          previousSpectatorTick = 0
        let minPlayer = Infinity,
          minTeacher = Infinity
        let maxPlayerStep = 0,
          maxTeacherStep = 0
        const previousPlayer = new Map<string, Vec3>(),
          previousTeacher = new Map<string, Vec3>()
        try {
          for (let n = 1; n < 540; n++) {
            now = (n * 1000) / 60
            const positions = race.frame("racing", now).actors.map((actor) => actor.sim.position)
            for (let index = 0; index < 2; index++) {
              const own = positions[index],
                other = positions[1 - index],
                id = ids[index]
              if (!own || !other || !id) throw new Error("Missing rival")
              const angle =
                Math.atan2(other.z - own.z, other.x - own.x) +
                Math.sin(Math.floor(n / 11) * 17 + index * 11) * 0.9
              const phase = n % 180,
                towards = index === 0 ? -1 : 1
              const input =
                mode === "steering"
                  ? { ...NEUTRAL_INPUT, strafe: -Math.cos(angle), forward: Math.sin(angle) }
                  : {
                      ...NEUTRAL_INPUT,
                      strafe: phase < 70 ? towards : phase < 100 ? 0 : -towards,
                      forward: index === 0 ? Math.sin(Math.floor(n / 17)) * 0.6 : 0,
                    }
              race.enqueue(id, {
                type: "input",
                raceId: race.raceId,
                seq: ++seq,
                tick: race.tick + 7,
                respawn: false,
                input,
              })
            }
            contacts += race.step().bumps.length
            // Match the native service's 15 Hz snapshots. Periodically bunch two packets.
            if (n % 4 === 0)
              packets.push({
                at: n + delay + (n % 64 === 0 ? 4 : 0),
                frame: race.frame("racing", now),
              })
            runner.beginStep()
            prediction.advance(runner.sim, NEUTRAL_INPUT, false, floor, now)
            runner.afterStep([], 1 / 60, now)
            remotes.syncPredicted(prediction.predictedActors, ids[2], prediction.tick, now)
            while (packets[0] && packets[0].at <= n) {
              const packet = packets.shift()
              if (!packet) throw new Error("Missing packet")
              const actor = packet.frame.actors.find((actor) => actor.id === ids[2])
              if (!actor) throw new Error("Missing third player")
              const previous = { ...runner.sim.position }
              prediction.reconcile(runner.sim, packet.frame, actor, floor, delay / 60)
              runner.smoothCorrection(previous, prediction.lastReconcile.resynced)
              remotes.syncPredicted(
                prediction.predictedActors,
                ids[2],
                prediction.tick,
                prediction.stepAtMs,
                true,
                prediction.lastReconcile.resynced,
              )
              spectator.push(packet.frame)
            }
            const beforeRender = structuredClone(prediction.predictedActors)
            for (let sub = 0; sub < fps / 60; sub++) {
              const drawAt = now + (sub * 1000) / fps
              const local = {
                id: ids[2],
                position: { ...runner.samplePosition(1 / fps, drawAt) },
                reference: runner.sim.position,
                active: true,
              }
              remotes.render(drawAt, 1 / fps, local)
              runner.renderAt(local.position, 1 / fps)
              const draws = remotes.positions()
              for (const draw of draws) {
                const previous = previousPlayer.get(draw.id)
                if (previous && n > 10) {
                  const change = distance(previous, draw.position)
                  maxPlayerStep = Math.max(maxPlayerStep, change)
                }
                previousPlayer.set(draw.id, draw.position)
              }
              const a = draws.find((actor) => actor.id === ids[0]),
                b = draws.find((actor) => actor.id === ids[1])
              if (!a || !b) throw new Error("Missing remote meshes")
              if (n > 10) minPlayer = Math.min(minPlayer, distance(a.position, b.position))
              const sample = spectator.read(drawAt)
              if (!sample) throw new Error("Missing spectator sample")
              expect(sample.tick).toBeGreaterThanOrEqual(previousSpectatorTick)
              previousSpectatorTick = sample.tick
              if (Math.abs(sample.tick - Math.round(sample.tick)) > 0.01) fractionalSamples++
              expect(sample.worldTimeSec).toBeCloseTo(3 + sample.tick / 60)
              const actor = sample.actors.find((actor) => actor.id === ids[0])
              if (!actor) throw new Error("Missing followed racer")
              Object.assign(followed.sim, actor.sim)
              const watched = {
                id: ids[0],
                position: { ...actor.sim.position },
                reference:
                  sample.references.find((actor) => actor.id === ids[0])?.sim.position ??
                  actor.sim.position,
                active: true,
              }
              teacherRemotes.renderBuffered(sample.actors, sample.references, 1 / fps, watched)
              followed.renderAt(watched.position, 1 / fps)
              for (const draw of [
                { id: ids[0], position: followed.renderPosition },
                ...teacherRemotes.positions(),
              ]) {
                const previous = previousTeacher.get(draw.id)
                if (previous && n > 10)
                  maxTeacherStep = Math.max(maxTeacherStep, distance(previous, draw.position))
                previousTeacher.set(draw.id, draw.position)
              }
              const rival = teacherRemotes.positions().find((actor) => actor.id === ids[1])
              if (!rival) throw new Error("Missing watched rival")
              if (n > 10)
                minTeacher = Math.min(minTeacher, distance(followed.renderPosition, rival.position))
              displayedSamples++
            }
            expect(prediction.predictedActors).toEqual(beforeRender)
          }
          expect(contacts).toBeGreaterThan(0)
          expect(displayedSamples).toBeGreaterThan(500)
          expect(fractionalSamples).toBeGreaterThan(100)
          expect(minPlayer).toBeGreaterThan(RUNNER.radius * 2 - 0.005)
          expect(minTeacher).toBeGreaterThan(RUNNER.radius * 2 - 0.005)
          expect(maxPlayerStep).toBeLessThan(RUNNER.radius * 2 + 0.05)
          expect(maxTeacherStep).toBeLessThan(0.5)
        } finally {
          runner.dispose()
          followed.dispose()
          remotes.clear()
          teacherRemotes.clear()
          restoreDocument()
        }
      })
    }
