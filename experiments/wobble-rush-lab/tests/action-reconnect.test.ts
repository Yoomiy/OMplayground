import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { WebSocket } from "ws"
import { createActionHost } from "../src/action/host"
import {
  ACTION_CONTENT,
  ACTION_PROTOCOL,
  type ActionServerMessage,
  decodeActionServerMessage,
} from "../src/shared/action-protocol"
import { asPlayerId, NEUTRAL_INPUT } from "../src/shared/types"

const wait = async (condition: () => boolean) => {
  const end = performance.now() + 3000
  while (!condition() && performance.now() < end) await Bun.sleep(5)
  expect(condition()).toBe(true)
}
type Client = { socket: WebSocket; messages: ActionServerMessage[]; closed: number | null }
const message = <T extends ActionServerMessage["type"]>(client: Client, type: T) => {
  const found = client.messages.findLast((entry) => entry.type === type)
  if (found === undefined) throw new Error(`Missing ${type}`)
  return found as Extract<ActionServerMessage, { type: T }>
}
async function fixture(run: (kit: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const kit = await setup()
  try {
    await run(kit)
  } finally {
    for (const client of kit.clients) client.socket.terminate()
    await kit.host.close()
  }
}
async function setup() {
  const host = createActionHost({ staticRoot: resolve("dist"), maxRooms: 2 })
  await new Promise<void>((done) => host.server.listen(0, "127.0.0.1", done))
  const address = host.server.address()
  if (address === null || typeof address === "string") throw new Error("No address")
  const base = `http://127.0.0.1:${address.port}`
  const clients: Client[] = []
  const createRoom = async () => {
    const payload = (await (await fetch(`${base}/api/rooms`, { method: "POST" })).json()) as {
      code: string
    }
    return payload.code
  }
  const code = await createRoom()
  const room = host.rooms.get(code)
  if (room === undefined) throw new Error("No room")
  const open = async (roomCode = code, compress = true) => {
    const client: Client = {
      socket: new WebSocket(`${base.replace("http:", "ws:")}/ws/${roomCode}`, {
        perMessageDeflate: compress,
      }),
      messages: [],
      closed: null,
    }
    clients.push(client)
    client.socket.on("message", (raw) =>
      client.messages.push(decodeActionServerMessage(raw.toString())),
    )
    client.socket.on("close", (code) => {
      client.closed = code
    })
    await new Promise<void>((done, reject) => {
      client.socket.once("open", done)
      client.socket.once("error", reject)
    })
    return client
  }
  const send = (client: Client, payload: unknown) => client.socket.send(JSON.stringify(payload))
  const join = async (name = "QA") => {
    const client = await open()
    send(client, {
      type: "join",
      protocol: ACTION_PROTOCOL,
      contentVersion: ACTION_CONTENT,
      mode: "party",
      name,
      colorIndex: 0,
    })
    await wait(() => client.messages.some((entry) => entry.type === "session"))
    return client
  }
  const resume = async (client: Client, token: string) => {
    send(client, {
      type: "resume",
      protocol: ACTION_PROTOCOL,
      contentVersion: ACTION_CONTENT,
      token,
    })
    await wait(() =>
      client.messages.some((entry) => entry.type === "session" || entry.type === "error"),
    )
  }
  const start = async (a: Client, b: Client) => {
    send(a, { type: "ready", ready: true })
    send(b, { type: "ready", ready: true })
    await wait(() => room.state.phase === "countdown")
    room.state = { ...room.state, phaseEndsAtMs: Date.now() - 1 }
    await wait(() => room.state.phase === "racing")
  }
  return { host, code, room, clients, open, send, join, resume, start, createRoom }
}

test(
  "a racing player resumes the same authoritative actor and releases stale controls",
  () =>
    fixture(async (k) => {
      const a = await k.join("Host"),
        b = await k.join("Guest")
      const id = message(a, "welcome").you
      const token = message(a, "session").token
      await k.start(a, b)
      await wait(() =>
        a.messages.some((entry) => entry.type === "frame" && entry.phase === "racing"),
      )
      const raceId = message(a, "frame").raceId
      k.send(a, {
        type: "input",
        tick: 1,
        raceId,
        seq: 1,
        input: { ...NEUTRAL_INPUT, forward: 1 },
        respawn: false,
      })
      await wait(() => (message(a, "frame").actors.find((actor) => actor.id === id)?.ack ?? 0) >= 1)
      const before = message(a, "frame")
      a.socket.terminate()
      await wait(() => k.host.sessions.forPlayer(id)?.peer === null)
      expect(k.room.state.players).toHaveLength(2)
      expect(k.host.sessions.forPlayer(id)?.expiresAtMs).toBeGreaterThan(Date.now())
      const next = await k.open()
      await k.resume(next, token)
      await wait(() => next.messages.some((entry) => entry.type === "frame"))
      expect(message(next, "welcome").you).toBe(id)
      expect(message(next, "session").resumed).toBe(true)
      const restored = message(next, "frame")
      expect(restored.raceId).toBe(raceId)
      expect(restored.tick).toBeGreaterThanOrEqual(before.tick)
      expect(restored.actors.find((actor) => actor.id === id)?.sim.checkpoint).toBe(
        before.actors.find((actor) => actor.id === id)?.sim.checkpoint,
      )
      expect(k.room.state.players.map((player) => player.id).filter((p) => p === id)).toHaveLength(
        1,
      )
      const ack = restored.actors.find((actor) => actor.id === id)?.ack ?? 0
      k.send(next, {
        type: "input",
        tick: 1,
        raceId,
        seq: ack + 1,
        input: NEUTRAL_INPUT,
        respawn: false,
      })
      await wait(
        () =>
          (message(next, "frame").actors.find((actor) => actor.id === id)?.ack ?? 0) === ack + 1,
      )
    }),
  10_000,
)

test("connection takeover fences old commands and old close handlers", () =>
  fixture(async (k) => {
    const original = await k.join()
    const id = message(original, "welcome").you
    const session = k.host.sessions.forPlayer(id)
    const oldPeer = session?.peer
    if (oldPeer == null || session === undefined) throw new Error("Missing owner")
    const replacement = await k.open()
    await k.resume(replacement, session.token)
    await wait(() => original.closed === 4001)
    oldPeer.socket.emit("message", Buffer.from(JSON.stringify({ type: "leave" })), false)
    expect(k.room.state.players.map((player) => player.id)).toEqual([id])
    expect(k.host.sessions.forPlayer(id)?.peer).not.toBe(oldPeer)
    expect(k.host.sessions.forPlayer(id)?.peer?.messageBudget).toBe(oldPeer.messageBudget)
    expect(message(replacement, "welcome").you).toBe(id)
  }))

test("a disconnected reservation still counts toward room capacity", () =>
  fixture(async (k) => {
    const members = []
    for (let index = 0; index < 8; index++) members.push(await k.join(`Racer ${index}`))
    const original = members[0]
    if (original === undefined) throw new Error("No host")
    const id = message(original, "welcome").you
    original.socket.terminate()
    await wait(() => k.host.sessions.forPlayer(id)?.peer === null)
    const newcomer = await k.open()
    k.send(newcomer, {
      type: "join",
      protocol: ACTION_PROTOCOL,
      contentVersion: ACTION_CONTENT,
      mode: "party",
      name: "New",
      colorIndex: 0,
    })
    await wait(() => newcomer.messages.some((entry) => entry.type === "error"))
    expect(message(newcomer, "error").code).toBe("room_full")
    expect(k.room.state.players).toHaveLength(8)
    const session = k.host.sessions.forPlayer(id)
    if (session === undefined) throw new Error("No reservation")
    const resumed = await k.open()
    await k.resume(resumed, session.token)
    expect(message(resumed, "welcome").you).toBe(id)
    expect(k.room.state.players).toHaveLength(8)
  }))

test("tickets cannot cross rooms; missing, revoked and expired tickets never create actors", () =>
  fixture(async (k) => {
    const original = await k.join()
    const token = message(original, "session").token
    const id = message(original, "welcome").you
    const wrongRoom = await k.open(await k.createRoom())
    await k.resume(wrongRoom, token)
    expect(message(wrongRoom, "error").code).toBe("resume_expired")
    const invalid = await k.open()
    await k.resume(invalid, "x".repeat(43))
    expect(message(invalid, "error").code).toBe("resume_expired")
    original.socket.terminate()
    await wait(() => k.host.sessions.forPlayer(id)?.peer === null)
    const session = k.host.sessions.forPlayer(id)
    if (session === undefined) throw new Error("No reservation")
    session.expiresAtMs = Date.now() - 1
    const expired = await k.open()
    await k.resume(expired, token)
    expect(message(expired, "error").code).toBe("resume_expired")
    await wait(() => k.room.state.players.length === 0)
  }))

test("explicit leave revokes immediately and expiry hands host control to the next racer", () =>
  fixture(async (k) => {
    const a = await k.join("Host"),
      b = await k.join("Guest")
    const first = message(a, "welcome").you,
      second = message(b, "welcome").you
    const token = message(a, "session").token
    a.socket.terminate()
    await wait(() => k.host.sessions.forPlayer(first)?.peer === null)
    await wait(() =>
      b.messages.some(
        (entry) => entry.type === "roster" && entry.snapshot.players[0]?.connected === false,
      ),
    )
    const session = k.host.sessions.forPlayer(first)
    if (session === undefined) throw new Error("No reservation")
    session.expiresAtMs = Date.now() - 1
    await wait(() => k.room.state.players[0]?.id === second)
    k.send(b, { type: "configure", courseId: "sky-hop", mode: "race", remix: false })
    await wait(() => k.room.state.session?.courseId === "sky-hop")
    const expired = await k.open()
    await k.resume(expired, token)
    expect(message(expired, "error").code).toBe("resume_expired")
    const otherToken = message(b, "session").token
    k.send(b, { type: "leave" })
    await wait(() => k.room.state.players.length === 0)
    expect(k.host.sessions.forPlayer(second)).toBeUndefined()
    const revoked = await k.open()
    await k.resume(revoked, otherToken)
    expect(message(revoked, "error").code).toBe("resume_expired")
  }))

test("a completed cup snapshot and results replay without awarding points again", () =>
  fixture(async (k) => {
    const a = await k.join(),
      b = await k.join()
    k.send(a, { type: "configure", courseId: "sky-hop", mode: "cup", remix: false })
    await wait(() => k.room.state.session?.mode === "cup")
    await k.start(a, b)
    if (k.room.race === null) throw new Error("No race")
    k.room.race.tick = 10800
    await wait(() => k.room.state.phase === "finished")
    const standings = JSON.stringify(k.room.state.session?.standings)
    const token = message(a, "session").token
    const id = message(a, "welcome").you
    a.socket.terminate()
    await wait(() => k.host.sessions.forPlayer(id)?.peer === null)
    const next = await k.open()
    await k.resume(next, token)
    await wait(() => next.messages.some((entry) => entry.type === "results"))
    expect(JSON.stringify(message(next, "results").session?.standings)).toBe(standings)
    expect(JSON.stringify(k.room.state.session?.standings)).toBe(standings)
    expect(message(next, "welcome").you).toBe(asPlayerId(id))
  }))

test("resync pings preserve the connection and rate-limit client diagnostics", () =>
  fixture(async (k) => {
    const a = await k.join("Resync"),
      b = await k.join("Other")
    await k.start(a, b)
    await wait(() => a.messages.some((entry) => entry.type === "frame" && entry.phase === "racing"))
    const sessions = a.messages.filter((entry) => entry.type === "session").length
    for (let nonce = 1; nonce <= 4; nonce++)
      k.send(a, {
        type: "ping",
        nonce,
        resync: true,
        network: {
          reason: "ack_delay",
          pendingInputs: 180,
          frameAgeMs: 40,
          correctionM: 0.2,
          maxFrameMs: 20,
          rttMs: 100,
        },
      })
    await wait(() => a.messages.some((entry) => entry.type === "pong" && entry.nonce === 4))
    expect(k.host.metrics.clientReports).toBe(1)
    expect(k.host.metrics.resyncRequests).toBe(1)
    expect(a.messages.filter((entry) => entry.type === "session")).toHaveLength(sessions)
    expect(a.closed).toBeNull()
    expect(k.host.metrics.rejectedMessages).toBe(0)
  }))

test("uncompressed clients remain compatible and finished races stop redundant snapshots", () =>
  fixture(async (k) => {
    const compressed = await k.join("Compressed")
    const plain = await k.open(k.code, false)
    k.send(plain, {
      type: "join",
      protocol: ACTION_PROTOCOL,
      contentVersion: ACTION_CONTENT,
      mode: "party",
      name: "Plain",
      colorIndex: 1,
    })
    await wait(() => plain.messages.some((entry) => entry.type === "session"))
    await k.start(compressed, plain)
    await wait(() =>
      [compressed, plain].every((client) =>
        client.messages.some((entry) => entry.type === "frame" && entry.phase === "racing"),
      ),
    )
    expect(plain.socket.extensions).toBe("")
    expect(message(compressed, "frame").actors.map((actor) => actor.id)).toEqual(
      message(plain, "frame").actors.map((actor) => actor.id),
    )
    k.room.state = { ...k.room.state, phase: "finished" }
    await Bun.sleep(100)
    const frameCount = compressed.messages.filter((entry) => entry.type === "frame").length
    await Bun.sleep(200)
    expect(compressed.messages.filter((entry) => entry.type === "frame")).toHaveLength(frameCount)
    k.send(compressed, { type: "ping", nonce: 101, resync: true })
    await wait(() =>
      compressed.messages.some((entry) => entry.type === "pong" && entry.nonce === 101),
    )
    await wait(() => message(compressed, "frame").phase === "finished")
    expect(compressed.closed).toBeNull()
    expect(plain.closed).toBeNull()
  }))
