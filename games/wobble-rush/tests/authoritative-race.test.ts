import { describe, expect, test } from "bun:test"
import {
  type ActionInput,
  decodeActionClientMessage,
  MAX_CLIENT_BYTES,
  MAX_SEQUENCE_GAP,
} from "../src/shared/action-protocol"
import { AuthoritativeRace } from "../src/shared/authoritative-race"
import { FIXED_STEP_SEC } from "../src/shared/constants"
import type { CourseDefinition, PlayerInput } from "../src/shared/types"
import {
  asCheckpointIndex,
  asObstacleId,
  asPlayerId,
  NEUTRAL_INPUT,
  vec3,
} from "../src/shared/types"

const id = asPlayerId("human")
const course: CourseDefinition = {
  id: "authority-test",
  name: "Authority test",
  spawn: vec3(0, 1.1, 0),
  spawnYaw: 0,
  platforms: [
    {
      id: asObstacleId("floor"),
      kind: "path",
      color: "white",
      box: { center: vec3(0, -0.5, 12), halfExtents: vec3(8, 0.5, 20), yaw: 0 },
    },
  ],
  obstacles: [],
  killY: -10,
  waypoints: [],
  checkpoints: [0, 1].map((index) => ({
    index: asCheckpointIndex(index),
    id: asObstacleId(`cp${index}`),
    respawn: vec3(0, 1.1, index * 10),
    label: String(index),
    trigger: { center: vec3(0, 1, index * 10), halfExtents: vec3(7, 2, 0.8), yaw: 0 },
  })),
  finish: { center: vec3(0, 1, 20), halfExtents: vec3(7, 2, 0.8), yaw: 0 },
}
const create = () =>
  new AuthoritativeRace("race", course, [{ id, name: "Human", colorIndex: 0 }], 7, 0)
const command = (
  seq: number,
  input: PlayerInput = { ...NEUTRAL_INPUT, forward: 1 },
): ActionInput => ({ type: "input", raceId: "race", seq, tick: 1, input, respawn: false })
const actor = (race: AuthoritativeRace) => {
  const first = race.frame("racing", 0).actors[0]
  if (first === undefined) throw new Error("Missing test actor")
  return first
}

describe("authoritative controls", () => {
  test("disconnect drops pending edges and movement, then a new connection continues from its ack", () => {
    const race = create()
    const reference = create()
    for (const target of [race, reference]) {
      target.enqueue(id, command(1))
      target.step()
    }
    race.enqueue(id, { ...command(2, { ...NEUTRAL_INPUT, jumpPressed: true }), respawn: true })
    race.releaseControls(id)
    reference.enqueue(id, command(2, NEUTRAL_INPUT))
    race.step()
    reference.step()
    expect(actor(race).sim).toEqual(actor(reference).sim)
    expect(actor(race).ack).toBe(1)
    expect(race.enqueue(id, command(2))).toBe(true)
    reference.enqueue(id, command(3))
    race.step()
    reference.step()
    expect(actor(race).sim).toEqual(actor(reference).sim)
    expect(actor(race).ack).toBe(2)
  })

  test("network protocol rejects forged transforms, checkpoints, finish times and invalid controls", () => {
    const invalid = [
      { type: "finish", timeMs: 0 },
      { type: "state", p: [0, 0, 1000], v: [0, 0, 0], cp: 99, yaw: 0, st: "run" },
      { ...command(1), playerId: "someone-else" },
      { ...command(1), timeMs: 0 },
      { ...command(1), seq: 1.1 },
      { ...command(1), input: { ...NEUTRAL_INPUT, forward: 2 } },
      { ...command(1), input: { ...NEUTRAL_INPUT, cameraYaw: 1e100 } },
      { ...command(1), input: { ...NEUTRAL_INPUT, checkpoint: 100 } },
    ]
    for (const payload of invalid)
      expect(() => decodeActionClientMessage(JSON.stringify(payload))).toThrow()
    expect(() => decodeActionClientMessage("x".repeat(MAX_CLIENT_BYTES + 1))).toThrow()
    expect(decodeActionClientMessage(JSON.stringify(command(1)))).toEqual(command(1))
  })

  test("a valid network burst is sampled once without disconnecting or buying extra physics", () => {
    const burst = create()
    const normal = create()
    for (let seq = 1; seq <= 90; seq++) expect(burst.enqueue(id, command(seq))).toBe(true)
    expect(actor(burst).ack).toBe(0)
    for (let tick = 1; tick <= 12; tick++) {
      normal.enqueue(id, command(tick))
      normal.step()
      burst.step()
      expect(actor(burst).sim).toEqual(actor(normal).sim)
      expect(actor(burst).ack).toBe(90)
    }
  })

  test("coalescing keeps the newest direction and preserves a brief jump exactly once", () => {
    const burst = create()
    const normal = create()
    burst.step()
    normal.step()
    burst.enqueue(id, command(1, { ...NEUTRAL_INPUT, jumpPressed: true }))
    for (let seq = 2; seq <= 40; seq++)
      burst.enqueue(id, command(seq, { ...NEUTRAL_INPUT, strafe: 1 }))
    normal.enqueue(id, command(1, { ...NEUTRAL_INPUT, strafe: 1, jumpPressed: true }))
    for (let tick = 0; tick < 12; tick++) {
      burst.step()
      normal.step()
      expect(actor(burst).sim).toEqual(actor(normal).sim)
    }
    expect(actor(burst).ack).toBe(40)
    expect(actor(burst).sim.position.x).toBeLessThan(0)
    expect(actor(burst).sim.position.y).toBeGreaterThan(1)
  })

  test("coalescing retains respawn and dive edges, then clears them after one host step", () => {
    const burst = create()
    const normal = create()
    for (let seq = 1; seq <= 20; seq++) {
      burst.enqueue(id, command(seq))
      normal.enqueue(id, command(seq))
      burst.step()
      normal.step()
    }
    burst.enqueue(id, { ...command(21), respawn: true })
    burst.enqueue(id, command(22, { ...NEUTRAL_INPUT, divePressed: true }))
    burst.enqueue(id, command(23))
    normal.enqueue(id, {
      ...command(21, { ...NEUTRAL_INPUT, forward: 1, divePressed: true }),
      respawn: true,
    })
    for (let tick = 0; tick < 12; tick++) {
      burst.step()
      normal.step()
      expect(actor(burst).sim).toEqual(actor(normal).sim)
    }
    expect(actor(burst).ack).toBe(23)
    expect(actor(burst).sim.position.z).toBeGreaterThan(0.1)
  })

  test("stale, duplicate, foreign and previous-race inputs do not change simulation", () => {
    const race = create()
    expect(race.enqueue(id, { ...command(1), raceId: "old-race" })).toBe(false)
    expect(race.enqueue(asPlayerId("outsider"), command(1))).toBe(false)
    expect(race.enqueue(id, command(1))).toBe(true)
    expect(race.enqueue(id, command(1))).toBe(false)
    expect(() => race.enqueue(id, command(1 + MAX_SEQUENCE_GAP + 1))).toThrow()
    race.step()
    expect(actor(race).ack).toBe(1)
    expect(race.tick).toBe(1)
  })

  test("held input expires after a silent client stops sending", () => {
    const race = create()
    race.enqueue(id, command(1))
    for (let tick = 0; tick < 60; tick++) race.step()
    const stopped = actor(race).sim.position
    for (let tick = 0; tick < 60; tick++) race.step()
    expect(actor(race).sim.position).toEqual(stopped)
    expect(actor(race).finishedMs).toBeNull()
  })

  test("actual controls capture the required checkpoint and generate a server-tick finish", () => {
    const race = create()
    for (let seq = 1; seq <= 300 && actor(race).finishedMs === null; seq++) {
      race.enqueue(id, command(seq))
      race.step()
    }
    const finished = actor(race)
    expect(finished.sim.checkpoint).toBe(asCheckpointIndex(1))
    expect(finished.finishedMs).toBeGreaterThan(2000)
    expect(finished.finishedMs).toBe(Math.round(race.tick * FIXED_STEP_SEC * 1000))
    const position = finished.sim.position
    expect(race.enqueue(id, command(301))).toBe(false)
    for (let tick = 0; tick < 60; tick++) race.step()
    expect(actor(race).sim.position).toEqual(position)
  })
})
