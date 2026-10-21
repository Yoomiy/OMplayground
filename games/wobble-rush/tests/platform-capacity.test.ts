import { expect, spyOn, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { AddressInfo } from "node:net"
import { WebSocket } from "ws"
import {
  AdmissionError,
  enforceAdmission,
  type PlatformProfile,
  type PlatformSession,
} from "../src/platform/admission"
import { PlatformGateway } from "../src/platform/gateway"
import { platformLogger } from "../src/platform/logging"
import { createPlatformService } from "../src/platform/service"

class MultiRoomGateway extends PlatformGateway {
  readonly rows = new Map<string, PlatformSession>()
  constructor() {
    super("https://fixture.invalid", "fixture-only")
    for (let index = 0; index < 33; index++) {
      const id = randomUUID()
      this.rows.set(id, {
        id,
        host_id: id,
        gender: "boy",
        status: "waiting",
        is_open: true,
        invitation_code: null,
        player_ids: [id],
        player_names: ["Fixture"],
        game_state: null,
        games: { game_url: "wobble-rush", is_active: true },
      })
    }
  }
  override async authenticate(token: unknown): Promise<PlatformProfile> {
    const userId = String(token)
    if (!this.rows.has(userId)) throw new AdmissionError("UNAUTHORIZED", 401)
    return { userId, name: "Fixture", role: "kid", gender: "boy", grade: "3" }
  }
  override async session(id: string): Promise<PlatformSession> {
    const row = this.rows.get(id)
    if (!row) throw new AdmissionError("BAD_SESSION", 404)
    return structuredClone(row)
  }
  override async admit(profile: PlatformProfile, id: string, observer: boolean) {
    return enforceAdmission({
      profile,
      session: await this.session(id),
      observer,
      challenged: false,
      withinRecess: true,
    })
  }
  override async update(previous: PlatformSession, patch: Record<string, unknown>) {
    const row = await this.session(previous.id)
    if (row.game_state?.revision !== previous.game_state?.revision)
      throw new AdmissionError("SESSION_CHANGED", 409)
    const next = structuredClone({ ...row, ...patch }) as PlatformSession
    if (patch.game_state) next.game_state = { ...next.game_state, revision: randomUUID() }
    this.rows.set(next.id, next)
    return structuredClone(next)
  }
}

test("room and socket admission have no room-derived cap; lifecycle logs report hosted room counts", async () => {
  const logs: Record<string, unknown>[] = []
  const info = spyOn(platformLogger, "info").mockImplementation((record: unknown) => {
    logs.push(record as Record<string, unknown>)
  })
  const gateway = new MultiRoomGateway()
  const service = createPlatformService({
    gateway,
    secret: "capacity-fixture-only-secret-at-least-32-characters",
    origins: ["http://app.test"],
    clientDir: "dist/client",
    release: "capacity-test",
  })
  const sockets: WebSocket[] = []
  let closed = false
  try {
    await new Promise<void>((done) => service.server.listen(0, "127.0.0.1", done))
    const base = `http://127.0.0.1:${(service.server.address() as AddressInfo).port}`
    const ids = [...gateway.rows.keys()]
    const first = ids[0]
    if (!first) throw new Error("Missing room fixture")
    // Duplicate concurrent launches share one allocation, including when many rooms are pending.
    const launches = await Promise.all(
      [...ids, first].map((id) =>
        fetch(`${base}/api/wobble/launch`, {
          method: "POST",
          headers: {
            Origin: "http://app.test",
            Authorization: `Bearer ${id}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: id }),
        }),
      ),
    )
    expect(launches.every((response) => response.status === 200)).toBe(true)
    expect(service.rooms.size).toBe(33)
    const allocated = logs.filter(
      (log) => (log.context as { event: string }).event === "WOBBLE_ROOM_ALLOCATED",
    )
    expect(allocated).toHaveLength(33)
    expect(allocated.map((log) => log.activeRooms)).toEqual(
      Array.from({ length: 33 }, (_, index) => index + 1),
    )
    const ready = await fetch(`${base}/ready`).then((response) => response.json())
    expect(ready).toMatchObject({ ready: true, rooms: 33 })
    expect(ready).not.toHaveProperty("maxRooms")
    // The former two-room setting also rejected the 81st WebSocket before admission.
    // Check transport acceptance independently of player-seat and role checks.
    await Promise.all(
      Array.from(
        { length: 81 },
        () =>
          new Promise<void>((done, reject) => {
            const socket = new WebSocket(`${base.replace("http", "ws")}/app-ws/${first}`, {
              headers: { Origin: "http://app.test" },
            })
            sockets.push(socket)
            socket.once("error", reject)
            socket.once("message", (raw) => {
              expect(JSON.parse(raw.toString()).type).toBe("authority")
              done()
            })
          }),
      ),
    )
    expect(await fetch(`${base}/health`).then((response) => response.json())).toMatchObject({
      rooms: 33,
      connections: 81,
    })
    await service.close()
    closed = true
    expect(
      logs.find((log) => (log.context as { event: string }).event === "WOBBLE_SERVICE_DRAINING"),
    ).toMatchObject({ activeRooms: 33 })
    expect(
      logs.find((log) => (log.context as { event: string }).event === "WOBBLE_SERVICE_DRAINED"),
    ).toMatchObject({ activeRooms: 0, closedRooms: 33 })
    expect(service.rooms.size).toBe(0)
  } finally {
    try {
      for (const socket of sockets) socket.terminate()
      if (!closed) await service.close()
    } finally {
      info.mockRestore()
    }
  }
}, 10_000)
