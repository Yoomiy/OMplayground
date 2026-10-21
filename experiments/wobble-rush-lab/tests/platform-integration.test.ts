import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { AddressInfo } from "node:net"
import { WebSocket } from "ws"
import {
  AdmissionError,
  enforceAdmission,
  type PlatformProfile,
  type PlatformSession,
} from "../src/platform/admission"
import { canonical, RoomCheckpoints } from "../src/platform/checkpoint"
import { PlatformGateway } from "../src/platform/gateway"
import { platformLogger } from "../src/platform/logging"
import { PlaygroundWobbleRoom } from "../src/platform/room"
import { createPlatformService } from "../src/platform/service"
import { LaunchTickets } from "../src/platform/tickets"
import { FIXED_STEP_SEC, NET } from "../src/shared/constants"
import {
  createNpcRacers,
  npcInput,
  rewindNpcAfterRespawn,
  updateNpcProgress,
} from "../src/shared/npc"
import { platformControlSchema } from "../src/shared/platform-protocol"
import { asPlayerId, NEUTRAL_INPUT } from "../src/shared/types"
import { createWorldSnapshot } from "../src/shared/world"

const HOST = "11111111-1111-4111-8111-111111111111"
const GUEST = "22222222-2222-4222-8222-222222222222"
const LATE = "33333333-3333-4333-8333-333333333333"
const TEACHER = "44444444-4444-4444-8444-444444444444"
const SESSION = "55555555-5555-4555-8555-555555555555"
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing fixture value")
  return value
}
const SECRET = "test-only-secret-longer-than-thirty-two-characters"
const PROFILE = (userId: string): PlatformProfile => ({
  userId,
  name: userId === HOST ? "נועה Alex" : "שחקן",
  role: userId === TEACHER ? "teacher" : "kid",
  gender: "boy",
  grade: "3",
})
const session = (): PlatformSession => ({
  id: SESSION,
  host_id: HOST,
  gender: "boy",
  status: "waiting",
  is_open: true,
  invitation_code: "invite-test",
  player_ids: [HOST],
  player_names: [PROFILE(HOST).name],
  game_state: null,
  connected_player_ids: [],
  connected_player_names: [],
  games: { game_url: "wobble-rush", is_active: true, min_players: 2, max_players: 8 },
})

class FakeGateway extends PlatformGateway {
  row = session()
  denied = new Set<string>()
  removed = new Set<string>()
  roles = new Map<string, PlatformProfile["role"]>()
  fail = false
  audits: { action: string; outcome: string }[] = []
  messages: unknown[] = []
  constructor() {
    super("https://example.invalid", "test-only")
  }
  override async authenticate(token: unknown): Promise<PlatformProfile> {
    if (![HOST, GUEST, LATE, TEACHER].includes(String(token)))
      throw new AdmissionError("UNAUTHORIZED", 401)
    return this.profile(String(token))
  }
  override async profile(id: string): Promise<PlatformProfile> {
    if (this.removed.has(id)) throw new AdmissionError("PROFILE_DISABLED")
    const profile = PROFILE(id)
    return { ...profile, role: this.roles.get(id) ?? profile.role }
  }
  override async session(): Promise<PlatformSession> {
    return structuredClone(this.row)
  }
  override async withinRecess(profile: PlatformProfile): Promise<boolean> {
    return !this.denied.has(profile.userId)
  }
  override async admit(
    profile: PlatformProfile,
    _id: string,
    observer: boolean,
    invitationCode?: string,
  ) {
    return enforceAdmission({
      profile,
      session: structuredClone(this.row),
      observer,
      invitationCode,
      challenged: false,
      withinRecess: await this.withinRecess(profile),
    })
  }
  override async update(
    previous: PlatformSession,
    patch: Record<string, unknown>,
  ): Promise<PlatformSession> {
    if (this.fail) {
      this.fail = false
      throw new AdmissionError("PLATFORM_UNAVAILABLE", 503)
    }
    if (
      previous.game_state?.revision !== this.row.game_state?.revision ||
      canonical(previous.player_ids) !== canonical(this.row.player_ids)
    )
      throw new AdmissionError("SESSION_CHANGED", 409)
    this.row = structuredClone({ ...this.row, ...patch }) as PlatformSession
    if (patch.game_state) this.row.game_state = { ...this.row.game_state, revision: randomUUID() }
    return structuredClone(this.row)
  }
  override async audit(
    _admission: unknown,
    action: string,
    _target?: string,
    outcome = "requested",
  ): Promise<void> {
    this.audits.push({ action, outcome })
  }
  override async sendChat(_admission: unknown, message: unknown): Promise<void> {
    this.messages.push(message)
  }
}
async function fixture() {
  const gateway = new FakeGateway(),
    checkpoints = new RoomCheckpoints(SECRET),
    allocationId = randomUUID()
  gateway.row.game_state = {
    wobble: true,
    revision: randomUUID(),
    allocationId,
    leaseUntil: Date.now() + 60_000,
  }
  const disconnected: { id: string; code: string }[] = []
  const room = new PlaygroundWobbleRoom(
    await gateway.session(),
    allocationId,
    gateway,
    checkpoints,
    {
      send() {},
      disconnect(id, code) {
        disconnected.push({ id, code })
      },
    },
  )
  await room.attach(await gateway.admit(PROFILE(HOST), SESSION, false))
  await room.attach(await gateway.admit(PROFILE(GUEST), SESSION, false))
  for (const id of [HOST, GUEST]) await room.control(PROFILE(id), { action: "loaded" })
  return { gateway, room, checkpoints, disconnected }
}

type CapturedLog = Record<string, unknown> & { level: string; context: { event: string } }
const logCleanup: (() => void)[] = []
function captureLogs(): CapturedLog[] {
  const logs: CapturedLog[] = []
  const info = spyOn(platformLogger, "info").mockImplementation((record: unknown) => {
    logs.push({ ...(record as CapturedLog), level: "info" })
  })
  const debug = spyOn(platformLogger, "debug").mockImplementation((record: unknown) => {
    logs.push({ ...(record as CapturedLog), level: "debug" })
  })
  logCleanup.push(() => {
    info.mockRestore()
    debug.mockRestore()
  })
  return logs
}

describe("Wobble app admission and persistence", () => {
  for (const role of ["teacher", "admin"] as const) {
    test(`${role} observers can moderate but cannot configure, start or advance races`, async () => {
      const { gateway, room } = await fixture()
      gateway.roles.set(TEACHER, role)
      await room.attach(await gateway.admit(await gateway.profile(TEACHER), SESSION, true))
      expect(room.view(TEACHER)).toMatchObject({
        observer: true,
        actorId: null,
        canControl: false,
        canModerate: true,
      })
      for (const command of [
        { action: "configure", courseId: "sky-hop", mode: "cup", remix: true },
        { action: "start" },
        { action: "next" },
      ] as const) {
        const before = structuredClone(gateway.row)
        await expect(room.control(PROFILE(TEACHER), command)).rejects.toThrow("CONTROL_FORBIDDEN")
        expect(gateway.row).toEqual(before)
      }
      // Even a stale host ID must not turn an observing staff member into a player host.
      room.hostId = TEACHER
      expect(room.view(TEACHER).canControl).toBe(false)
      await expect(room.control(PROFILE(TEACHER), { action: "start" })).rejects.toThrow(
        "CONTROL_FORBIDDEN",
      )
      room.hostId = HOST
      await room.control(PROFILE(HOST), { action: "start" })
      await room.control(PROFILE(TEACHER), { action: "pause" })
      expect(room.paused).toBe(true)
      await room.control(PROFILE(TEACHER), { action: "resume" })
      expect(room.paused).toBe(false)
      await room.control(PROFILE(TEACHER), { action: "remove", userId: GUEST })
      expect(room.blocked.has(GUEST)).toBe(true)
      await room.control(PROFILE(TEACHER), { action: "end" })
      expect(room.ended).toBe(true)
    })
    test(`${role} joining as a player gets race decisions only when hosting`, async () => {
      const { gateway, room } = await fixture()
      gateway.roles.set(TEACHER, role)
      await room.attach(await gateway.admit(await gateway.profile(TEACHER), SESSION, false))
      await room.control(PROFILE(TEACHER), { action: "loaded" })
      await room.control(PROFILE(TEACHER), { action: "color", colorIndex: 6 })
      expect(room.view(TEACHER)).toMatchObject({
        observer: false,
        canControl: false,
        canModerate: true,
      })
      await expect(room.control(PROFILE(TEACHER), { action: "start" })).rejects.toThrow(
        "CONTROL_FORBIDDEN",
      )
      await expect(
        room.control(PROFILE(TEACHER), {
          action: "configure",
          courseId: "sky-hop",
          mode: "cup",
          remix: false,
        }),
      ).rejects.toThrow("CONTROL_FORBIDDEN")
      room.hostId = TEACHER
      expect(room.view(TEACHER).canControl).toBe(true)
      await room.control(PROFILE(TEACHER), {
        action: "configure",
        courseId: "sky-hop",
        mode: "cup",
        remix: false,
      })
      await room.control(PROFILE(TEACHER), { action: "start" })
      expect(room.engine.state.phase).toBe("countdown")
    })
  }
  test("maintenance during stopped-room teardown keeps completion durable until connections detach", async () => {
    const { gateway, room, disconnected } = await fixture()
    await room.control(PROFILE(HOST), { action: "end" })
    await room.maintain()
    expect([...new Set(disconnected.map((entry) => entry.id))].sort()).toEqual([HOST, GUEST].sort())
    expect(disconnected.every((entry) => entry.code === "SESSION_COMPLETED")).toBe(true)
    expect(room.ended).toBe(true)
    expect(gateway.row.status).toBe("completed")
    expect(gateway.row.connected_player_ids).toEqual([])
    const requests = disconnected.length
    await room.detached(HOST)
    await room.detached(GUEST)
    await room.maintain()
    expect(disconnected).toHaveLength(requests)
    expect(room.ended).toBe(true)
  })
  test("each racer chooses their own color and it survives reconnect, checkpoints and race start", async () => {
    const { gateway, room, checkpoints } = await fixture()
    const hostColor = room.members.get(HOST)?.colorIndex
    await room.control(PROFILE(GUEST), { action: "color", colorIndex: 6 })
    expect(room.view(HOST).players.find((player) => player.userId === GUEST)?.colorIndex).toBe(6)
    expect(room.members.get(HOST)?.colorIndex).toBe(hostColor)
    const saved = checkpoints.read(required(gateway.row.game_state).checkpoint, SESSION)
    expect(saved.players.find((player) => player.userId === GUEST)?.colorIndex).toBe(6)
    expect(saved.state.players.find((player) => player.id === GUEST)?.colorIndex).toBe(6)
    const restored = new PlaygroundWobbleRoom(
      await gateway.session(),
      room.allocationId,
      gateway,
      checkpoints,
      { send() {}, disconnect() {} },
      saved,
    )
    expect(restored.view(GUEST).players.find((player) => player.userId === GUEST)?.colorIndex).toBe(
      6,
    )
    await room.detached(GUEST)
    await room.attach(await gateway.admit(PROFILE(GUEST), SESSION, false))
    await room.control(PROFILE(GUEST), { action: "loaded" })
    expect(room.members.get(GUEST)?.colorIndex).toBe(6)
    await room.control(PROFILE(HOST), { action: "start" })
    expect(
      room.engine.race?.frame("countdown", Date.now()).actors.find((actor) => actor.id === GUEST)
        ?.colorIndex,
    ).toBe(6)
    await expect(room.control(PROFILE(GUEST), { action: "color", colorIndex: 2 })).rejects.toThrow(
      "LOBBY_ONLY",
    )
  })
  test("color changes reject forged identity, invalid palette values and observers; failed saves can retry", async () => {
    const { gateway, room } = await fixture()
    for (const colorIndex of [-1, 8, 1.5, NaN]) {
      expect(platformControlSchema.safeParse({ action: "color", colorIndex }).success).toBe(false)
      await expect(room.control(PROFILE(GUEST), { action: "color", colorIndex })).rejects.toThrow(
        "INVALID_COLOR",
      )
    }
    expect(
      platformControlSchema.safeParse({ action: "color", colorIndex: 2, userId: HOST }).success,
    ).toBe(false)
    await room.attach(await gateway.admit(PROFILE(TEACHER), SESSION, true))
    await expect(
      room.control(PROFILE(TEACHER), { action: "color", colorIndex: 2 }),
    ).rejects.toThrow("CONTROL_FORBIDDEN")
    const previous = room.members.get(GUEST)?.colorIndex
    gateway.fail = true
    await expect(room.control(PROFILE(GUEST), { action: "color", colorIndex: 7 })).rejects.toThrow(
      "PLATFORM_UNAVAILABLE",
    )
    expect(room.members.get(GUEST)?.colorIndex).toBe(previous)
    expect(room.engine.state.players.find((player) => player.id === GUEST)?.colorIndex).toBe(
      previous,
    )
    expect(room.paused).toBe(true)
    await room.persist(true)
    await room.control(PROFILE(HOST), { action: "resume" })
    await room.control(PROFILE(GUEST), { action: "color", colorIndex: 7 })
    expect(room.members.get(GUEST)?.colorIndex).toBe(7)
    room.pause()
    await expect(room.control(PROFILE(GUEST), { action: "color", colorIndex: 2 })).rejects.toThrow(
      "LOBBY_ONLY",
    )
  })
  test("host authority survives refresh; grace expiry transfers it and an expired lobby seat can rejoin", async () => {
    const { gateway, room } = await fixture()
    await room.detached(HOST)
    expect(room.view(GUEST).canControl).toBe(false)
    await room.attach(await gateway.admit(PROFILE(HOST), SESSION, false))
    expect(room.view(HOST).canControl).toBe(true)
    await room.detached(HOST)
    await room.maintain(Date.now() + 31_000)
    expect(room.hostId).toBe(GUEST)
    await room.attach(await gateway.admit(PROFILE(HOST), SESSION, false))
    expect(room.view(HOST).pending).toBe(false)
    await room.control(PROFILE(HOST), { action: "loaded" })
    await room.control(PROFILE(GUEST), { action: "start" })
    expect(room.engine.state.phase).toBe("countdown")
  })
  test("an actual control-only three-race cup persists each result once and rematches only after consent", async () => {
    const logs = captureLogs()
    const { gateway, room } = await fixture()
    await room.attach(await gateway.admit(PROFILE(TEACHER), SESSION, true))
    room.engine.state = { ...room.engine.state, seed: 7 }
    await room.control(PROFILE(HOST), {
      action: "configure",
      courseId: "sunrise-scramble",
      mode: "cup",
      remix: false,
    })
    for (let round = 0; round < 3; round++) {
      await room.control(PROFILE(HOST), { action: "start" })
      const race = required(room.engine.race)
      const brains = createNpcRacers(race.course, 7, 3)
      const pilots = [required(brains[2]), required(brains[1])]
      room.step(Date.now() + 3100)
      let frame = race.frame("racing", 0)
      while (race.tick < 180 * 60 && room.engine.state.phase !== "finished") {
        const worldTime = NET.countdownSec + (race.tick + 1) * FIXED_STEP_SEC
        const world = createWorldSnapshot(race.course, worldTime)
        for (const [index, id] of [HOST, GUEST].entries()) {
          const actor = required(frame.actors.find((actor) => actor.id === id))
          if (actor.finishedMs === null)
            room.input(id, {
              type: "input",
              raceId: race.raceId,
              seq: race.tick + 1,
              tick: race.tick + 1,
              input: npcInput(required(pilots[index]), actor.sim, race.course, world, worldTime),
              respawn: false,
            })
        }
        const previous = frame
        room.step(Date.now() + 3200 + (race.tick * 1000) / 60)
        frame = race.frame("racing", 0)
        for (const [index, id] of [HOST, GUEST].entries()) {
          const actor = required(frame.actors.find((actor) => actor.id === id)),
            pilot = required(pilots[index])
          if (actor.respawnSeq !== previous.actors.find((actor) => actor.id === id)?.respawnSeq)
            rewindNpcAfterRespawn(pilot, actor.sim, race.course)
          updateNpcProgress(pilot, actor.sim, race.course, FIXED_STEP_SEC)
        }
      }
      expect(room.engine.state.phase).toBe("finished")
      expect(room.view(HOST).results.every((row) => row.timeMs !== null)).toBe(true)
      if (round === 0) {
        // A lease heartbeat and a failed result save must not claim completion.
        await room.persist(false, {}, true)
        expect(logs.filter((log) => log.context.event === "WOBBLE_RACE_COMPLETED")).toHaveLength(0)
        gateway.fail = true
        await expect(room.saveResults()).rejects.toThrow("PLATFORM_UNAVAILABLE")
        expect(logs.filter((log) => log.context.event === "WOBBLE_RACE_COMPLETED")).toHaveLength(0)
      }
      await room.saveResults()
      if (room.paused) await room.control(PROFILE(HOST), { action: "resume" })
      await room.persist(false)
      const completed = logs.filter((log) => log.context.event === "WOBBLE_RACE_COMPLETED")
      expect(completed).toHaveLength(round + 1)
      expect(completed.at(-1)).toMatchObject({
        sessionId: SESSION,
        round: round + 1,
        mode: "cup",
        players: 2,
        finishers: 2,
        saved: true,
      })
      expect(room.accepted).toHaveLength(round + 1)
      expect(gateway.row.status).toBe(round === 2 ? "completed" : "playing")
      if (round < 2) {
        const before = structuredClone(gateway.row)
        expect(room.view(TEACHER).canControl).toBe(false)
        await expect(room.control(PROFILE(TEACHER), { action: "next" })).rejects.toThrow(
          "CONTROL_FORBIDDEN",
        )
        expect(room.engine.state.phase).toBe("finished")
        expect(gateway.row).toEqual(before)
        await room.control(PROFILE(HOST), { action: "next" })
      }
    }
    expect(room.view(HOST).standings.reduce((sum, row) => sum + row.points, 0)).toBe(54)
    for (const action of ["rematch", "accept-rematch", "decline-rematch"] as const)
      await expect(room.control(PROFILE(TEACHER), { action })).rejects.toThrow("CANNOT_REMATCH")
    await room.control(PROFILE(HOST), { action: "rematch" })
    expect(room.engine.state.phase).toBe("finished")
    await room.control(PROFILE(GUEST), { action: "accept-rematch" })
    expect(room.engine.state.phase).toBe("lobby")
    expect(room.engine.state.session?.round).toBe(0)
    expect(gateway.row.status).toBe("waiting")
    expect(logs.filter((log) => log.context.event === "WOBBLE_GAME_COMPLETED")).toHaveLength(1)
    expect(logs.filter((log) => log.context.event === "WOBBLE_RACE_STARTED")).toHaveLength(3)
    expect(logs.filter((log) => log.context.event === "WOBBLE_REMATCH_STARTED")).toHaveLength(1)
    const gameComplete = logs.find((log) => log.context.event === "WOBBLE_GAME_COMPLETED")
    expect(gameComplete).toMatchObject({ mode: "cup", rounds: 3, saved: true })
    expect(
      (required(gameComplete).winnerUserIds as string[]).every((id) => [HOST, GUEST].includes(id)),
    ).toBe(true)
  }, 30_000)
  test("backend checks game, private invitations, gender, recess and original paused roster", () => {
    const args = {
      profile: PROFILE(GUEST),
      session: session(),
      observer: false,
      withinRecess: true,
      challenged: false,
    }
    expect(() =>
      enforceAdmission({
        ...args,
        session: { ...args.session, games: { game_url: "chess", is_active: true } },
      }),
    ).toThrow("GAME_UNAVAILABLE")
    expect(() =>
      enforceAdmission({ ...args, session: { ...args.session, is_open: false } }),
    ).toThrow("SESSION_CLOSED")
    expect(
      enforceAdmission({
        ...args,
        session: { ...args.session, is_open: false },
        invitationCode: "invite-test",
      }).profile.userId,
    ).toBe(GUEST)
    expect(() =>
      enforceAdmission({ ...args, profile: { ...args.profile, gender: "girl" } }),
    ).toThrow("GENDER_MISMATCH")
    expect(() => enforceAdmission({ ...args, withinRecess: false })).toThrow("RECESS_DENIED")
    expect(() =>
      enforceAdmission({ ...args, session: { ...args.session, status: "paused" } }),
    ).toThrow("NOT_IN_ROSTER")
    expect(() => enforceAdmission({ ...args, observer: true })).toThrow("OBSERVER_FORBIDDEN")
  })
  test("launch tickets are single-use, expire and bind allocation/session", () => {
    const tickets = new LaunchTickets(SECRET)
    const token = tickets.issue(
      { userId: HOST, sessionId: SESSION, allocationId: "a", roomId: SESSION, observer: false },
      100,
    )
    expect(() => tickets.consume(token, SESSION, "b", 101)).toThrow()
    expect(tickets.consume(token, SESSION, "a", 101).userId).toBe(HOST)
    expect(() => tickets.consume(token, SESSION, "a", 102)).toThrow()
    expect(() =>
      tickets.consume(
        tickets.issue(
          { userId: HOST, sessionId: SESSION, allocationId: "a", roomId: SESSION, observer: false },
          100,
        ),
        SESSION,
        "a",
        30_101,
      ),
    ).toThrow()
  })
  test("loading alone does not auto-start, and participants cannot start or remove", async () => {
    const { room } = await fixture()
    expect(room.engine.state.phase).toBe("lobby")
    await expect(room.control(PROFILE(GUEST), { action: "start" })).rejects.toThrow(
      "CONTROL_FORBIDDEN",
    )
    await expect(room.control(PROFILE(HOST), { action: "remove", userId: GUEST })).rejects.toThrow(
      "CONTROL_FORBIDDEN",
    )
    await room.control(PROFILE(HOST), { action: "start" })
    expect(room.engine.state.phase).toBe("countdown")
    expect(room.engine.race?.frame("countdown", Date.now()).actors).toHaveLength(4)
  })
  test("exact paused positions, NPC brains, tick and cup selection survive JSONB key reordering and fresh room restoration", async () => {
    const { gateway, room, checkpoints } = await fixture()
    await room.control(PROFILE(HOST), {
      action: "configure",
      courseId: "sunrise-scramble",
      mode: "cup",
      remix: true,
    })
    await room.control(PROFILE(HOST), { action: "start" })
    room.step(Date.now() + 3100)
    room.input(HOST, {
      type: "input",
      raceId: required(room.engine.race).raceId,
      seq: 1,
      tick: required(room.engine.race).tick + 1,
      input: { ...NEUTRAL_INPUT, jumpHeld: true, jumpPressed: true },
      respawn: false,
    })
    for (let i = 0; i < 12; i++) room.step(Date.now() + 3200 + i)
    await room.control(PROFILE(HOST), { action: "pause" })
    const before = required(room.engine.race).frame("racing", 0)
    const reorder = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reorder)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, child]) => [key, reorder(child)]),
            )
          : value
    const signed = reorder(required(gateway.row.game_state).checkpoint)
    const saved = checkpoints.read(signed, SESSION)
    const restored = new PlaygroundWobbleRoom(
      await gateway.session(),
      room.allocationId,
      gateway,
      checkpoints,
      { send() {}, disconnect() {} },
      saved,
    )
    expect(restored.paused).toBe(true)
    expect(required(restored.engine.race).frame("racing", 0)).toEqual(before)
    expect(restored.engine.state.session?.mode).toBe("cup")
    restored.step(Date.now() + 90_000)
    expect(required(restored.engine.race).tick).toBe(before.tick)
    expect(() =>
      checkpoints.read(
        { ...(required(gateway.row.game_state).checkpoint as object), signature: "tampered" },
        SESSION,
      ),
    ).toThrow("SAVE_UNAVAILABLE")
    expect(() => checkpoints.read(signed, SESSION, saved.savedAt + 24 * 60 * 60_000)).toThrow(
      "SAVE_EXPIRED",
    )
  })
  test("failed saves retain the last durable checkpoint and can retry", async () => {
    const { gateway, room } = await fixture()
    const previous = structuredClone(gateway.row.game_state)
    gateway.fail = true
    await expect(room.control(PROFILE(HOST), { action: "start" })).rejects.toThrow(
      "PLATFORM_UNAVAILABLE",
    )
    expect(room.saved).toBe(false)
    expect(gateway.row.game_state).toEqual(previous)
    await room.persist(true)
    expect(room.saved).toBe(true)
  })
  test("late arrivals wait without acquiring an actor; authorized teachers observe without a player seat", async () => {
    const { gateway, room } = await fixture()
    await room.control(PROFILE(HOST), { action: "start" })
    await room.attach(await gateway.admit(PROFILE(LATE), SESSION, false))
    await room.attach(await gateway.admit(PROFILE(TEACHER), SESSION, true))
    expect(room.view(LATE).pending).toBe(true)
    expect(room.view(LATE).actorId).toBeNull()
    expect(room.engine.state.players).toHaveLength(2)
    expect(room.view(TEACHER).canModerate).toBe(true)
    await expect(room.authorize(PROFILE(TEACHER), true)).rejects.toThrow("READ_ONLY")
    await room.control(PROFILE(TEACHER), { action: "remove", userId: LATE })
    await expect(room.attach(await gateway.admit(PROFILE(LATE), SESSION, false))).rejects.toThrow(
      "REMOVED_FROM_ROOM",
    )
    expect(gateway.audits.map((row) => row.outcome)).toEqual(["requested", "completed"])
  })
  test("per-child recess expiry preserves the other racer; final departure saves the roster and paused heartbeat does not extend expiry", async () => {
    const { gateway, room, disconnected } = await fixture()
    await room.control(PROFILE(HOST), { action: "start" })
    gateway.denied.add(GUEST)
    await room.maintain()
    expect(disconnected).toContainEqual({ id: GUEST, code: "RECESS_DENIED" })
    expect(room.view(HOST).players.find((player) => player.userId === HOST)?.connected).toBe(true)
    expect(room.paused).toBe(false)
    await room.detached(HOST)
    expect(gateway.row.status).toBe("paused")
    expect(gateway.row.player_ids).toEqual([HOST, GUEST])
    expect(gateway.row.connected_player_ids).toEqual([])
    const activity = gateway.row.last_activity
    await room.persist(false, {}, true)
    expect(gateway.row.last_activity).toBe(activity)
    await room.hibernate()
    expect(gateway.row.game_state?.leaseUntil).toBe(0)
  })
  test("concurrent saved roster removal cannot be overwritten by an old room", async () => {
    const { gateway, room } = await fixture()
    gateway.row.player_ids = [HOST]
    gateway.row.player_names = [PROFILE(HOST).name]
    await expect(room.persist(false)).rejects.toThrow("SESSION_CHANGED")
    expect(gateway.row.player_ids).toEqual([HOST])
    await room.maintain()
    expect(room.members.has(GUEST)).toBe(false)
  })
})

const services: ReturnType<typeof createPlatformService>[] = []
afterEach(async () => {
  try {
    for (const service of services.splice(0)) await service.close()
  } finally {
    for (const cleanup of logCleanup.splice(0)) cleanup()
  }
})
test("an expired initial allocation without a first checkpoint can retry without discarding a race save", async () => {
  const gateway = new FakeGateway()
  gateway.row.game_state = {
    wobble: true,
    revision: randomUUID(),
    allocationId: "abandoned-first-launch",
    leaseUntil: 0,
  }
  const service = createPlatformService({
    gateway,
    secret: SECRET,
    origins: ["http://app.test"],
    clientDir: "app-dist/client",
    maxRooms: 2,
    release: "integration-test",
  })
  services.push(service)
  await new Promise<void>((done) => service.server.listen(0, "127.0.0.1", done))
  const base = `http://127.0.0.1:${(service.server.address() as AddressInfo).port}`
  const response = await fetch(`${base}/api/wobble/launch`, {
    method: "POST",
    headers: {
      Origin: "http://app.test",
      Authorization: `Bearer ${HOST}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId: SESSION }),
  })
  expect(response.status).toBe(200)
  expect(service.rooms.get(SESSION)?.engine.state.phase).toBe("lobby")
  expect(gateway.row.game_state?.allocationId).not.toBe("abandoned-first-launch")
})
test("real HTTP/WS launch rejects anonymous entry, authenticates two racers, reconnects stable actors and restores after service drain", async () => {
  const logs = captureLogs()
  const gateway = new FakeGateway()
  const revoked: string[] = []
  const start = async () => {
    const service = createPlatformService({
      gateway,
      secret: SECRET,
      origins: ["http://app.test"],
      clientDir: "app-dist/client",
      maxRooms: 2,
      release: "integration-test",
      revokeVoice: async (_sessionId, userId) => {
        revoked.push(userId)
      },
    })
    services.push(service)
    await new Promise<void>((done) => service.server.listen(0, "127.0.0.1", done))
    return {
      service,
      url: `http://127.0.0.1:${(service.server.address() as AddressInfo).port}`,
    }
  }
  const { service, url } = await start()
  expect((await fetch(`${url}/api/rooms`, { method: "POST" })).status).toBe(404)
  expect(
    (
      await fetch(`${url}/api/wobble/launch`, {
        method: "POST",
        headers: { Origin: "http://evil.test" },
      })
    ).status,
  ).toBe(403)
  async function join(base: string, id: string) {
    const response = await fetch(`${base}/api/wobble/launch`, {
      method: "POST",
      headers: {
        Origin: "http://app.test",
        Authorization: `Bearer ${id}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: SESSION }),
    })
    expect(response.status).toBe(200)
    const launch = (await response.json()) as { ticket: string }
    const socket = new WebSocket(`${base.replace("http", "ws")}/app-ws/${SESSION}`, {
      headers: { Origin: "http://app.test" },
    })
    const messages: Record<string, unknown>[] = []
    await new Promise<void>((done, reject) => {
      socket.on("error", reject)
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString())
        messages.push(message)
        if (message.type === "authority")
          socket.send(JSON.stringify({ type: "attach", ticket: launch.ticket }))
        if (message.type === "platform") done()
      })
    })
    socket.send(JSON.stringify({ type: "control", control: { action: "loaded" } }))
    return { socket, messages }
  }
  const host = await join(url, HOST),
    guest = await join(url, GUEST)
  await Bun.sleep(50)
  expect(service.rooms.get(SESSION)?.engine.state.players.map((player) => player.id)).toEqual([
    asPlayerId(HOST),
    asPlayerId(GUEST),
  ])
  host.socket.send(JSON.stringify({ type: "control", control: { action: "start" } }))
  await Bun.sleep(50)
  expect(service.rooms.get(SESSION)?.engine.state.phase).toBe("countdown")
  host.socket.send(
    JSON.stringify({
      type: "ping",
      nonce: 123,
      network: {
        reason: "correction",
        pendingInputs: 1,
        frameAgeMs: 20,
        correctionM: 0.2,
        maxFrameMs: 16,
        rttMs: 10,
      },
    }),
  )
  await Bun.sleep(50)
  expect(
    logs.some((log) => log.context.event === "WOBBLE_CLIENT_NETWORK" && log.level === "debug"),
  ).toBe(true)
  expect(
    logs.some((log) => log.context.event === "WOBBLE_CLIENT_NETWORK" && log.level === "info"),
  ).toBe(false)
  const tick = service.rooms.get(SESSION)?.engine.race?.tick
  await join(url, HOST)
  expect(
    service.rooms.get(SESSION)?.engine.state.players.filter((player) => player.id === HOST),
  ).toHaveLength(1)
  expect(service.rooms.get(SESSION)?.engine.race?.tick).toBe(tick)
  await service.close()
  services.splice(services.indexOf(service), 1)
  expect(gateway.row.status).toBe("paused")
  expect(gateway.row.game_state?.leaseUntil).toBe(0)
  const second = await start()
  const restoredHost = await join(second.url, HOST)
  const restoredGuest = await join(second.url, GUEST)
  const teacher = await join(second.url, TEACHER)
  expect(second.service.rooms.get(SESSION)?.paused).toBe(true)
  expect(second.service.rooms.get(SESSION)?.engine.race?.tick).toBe(tick)
  expect(guest.messages.some((message) => message.type === "welcome")).toBe(true)
  const closed = Promise.all(
    [restoredHost, restoredGuest, teacher].map(
      (client) => new Promise<void>((done) => client.socket.once("close", () => done())),
    ),
  )
  await required(second.service.rooms.get(SESSION)).run(() =>
    required(second.service.rooms.get(SESSION)).control(PROFILE(HOST), { action: "end" }),
  )
  // Maintenance can observe the saved completion before socket close handlers run.
  // Voice removal is idempotent; assert cleanup identities rather than RPC count.
  await required(second.service.rooms.get(SESSION)).run(() =>
    required(second.service.rooms.get(SESSION)).maintain(),
  )
  await closed
  expect(gateway.row.status).toBe("completed")
  expect(gateway.row.connected_player_ids).toEqual([])
  expect([...new Set(revoked)].sort()).toEqual([HOST, GUEST, TEACHER].sort())
  expect(
    restoredGuest.messages.some(
      (message) => message.type === "platform" && (message.view as { ended?: boolean }).ended,
    ),
  ).toBe(true)
  const finishedLaunch = await fetch(`${second.url}/api/wobble/launch`, {
    method: "POST",
    headers: {
      Origin: "http://app.test",
      Authorization: `Bearer ${HOST}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId: SESSION }),
  })
  expect(finishedLaunch.status).toBe(409)
  expect(await finishedLaunch.json()).toEqual({ code: "SESSION_COMPLETED" })
  expect(
    logs.some((log) => log.context.event === "WOBBLE_PLAYER_RECONNECTED" && log.userId === HOST),
  ).toBe(true)
  expect(
    logs.some(
      (log) =>
        log.context.event === "WOBBLE_PLAYER_DISCONNECTED" &&
        log.userId === HOST &&
        log.reason === "REPLACEMENT_TAB",
    ),
  ).toBe(true)
  expect(
    logs.some(
      (log) =>
        log.context.event === "WOBBLE_PLAYER_DISCONNECTED" && log.reason === "SERVICE_RESTART",
    ),
  ).toBe(true)
  expect(
    logs.filter(
      (log) =>
        log.context.event === "WOBBLE_PLAYER_DISCONNECTED" && log.reason === "SESSION_COMPLETED",
    ),
  ).toHaveLength(3)
  expect(logs.filter((log) => log.context.event === "WOBBLE_GAME_STOPPED")).toHaveLength(1)
  expect(logs.some((log) => log.context.event === "WOBBLE_ROOM_RESTORED")).toBe(true)
  expect(
    logs.some((log) => log.context.event === "WOBBLE_LAUNCH_REJECTED" && log.level === "debug"),
  ).toBe(true)
}, 20_000)
