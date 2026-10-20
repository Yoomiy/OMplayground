import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { WebSocket } from "ws"
import { createActionHost } from "../src/action/host"
import { MESSAGE_BURST_CAPACITY } from "../src/action/message-budget"
import {
  ACTION_CONTENT,
  ACTION_PROTOCOL,
  type ActionServerMessage,
  decodeActionServerMessage,
} from "../src/shared/action-protocol"

test("Node host isolates rooms, rejects forged results and bounds room admission", async () => {
  const host = createActionHost({ staticRoot: resolve("dist"), maxRooms: 2 })
  await new Promise<void>((done) => host.server.listen(0, "127.0.0.1", done))
  const address = host.server.address()
  if (address === null || typeof address === "string") throw new Error("No host address")
  const base = `http://127.0.0.1:${address.port}`
  const clients: WebSocket[] = []
  try {
    expect(
      (
        await fetch(`${base}/api/rooms`, {
          method: "POST",
          headers: { origin: "https://unrelated.example" },
        })
      ).status,
    ).toBe(403)
    const create = async () => {
      const response = await fetch(`${base}/api/rooms`, { method: "POST" })
      const payload: unknown = await response.json()
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("code" in payload) ||
        typeof payload.code !== "string"
      )
        throw new Error("No room code")
      return payload.code
    }
    const first = await create()
    const second = await create()
    expect((await fetch(`${base}/api/rooms`, { method: "POST" })).status).toBe(503)
    const open = async (code: string) => {
      const socket = new WebSocket(`${base.replace("http:", "ws:")}/ws/${code}`)
      clients.push(socket)
      const messages: ActionServerMessage[] = []
      socket.on("message", (raw) => messages.push(decodeActionServerMessage(raw.toString())))
      await new Promise<void>((done, reject) => {
        socket.once("open", done)
        socket.once("error", reject)
      })
      socket.send(
        JSON.stringify({
          type: "join",
          protocol: ACTION_PROTOCOL,
          contentVersion: ACTION_CONTENT,
          mode: "party",
          name: "QA",
          colorIndex: 0,
        }),
      )
      return { socket, messages }
    }
    const a = await open(first)
    const b = await open(second)
    await new Promise((done) => setTimeout(done, 40))
    expect(host.rooms.get(first)?.state.players).toHaveLength(1)
    expect(host.rooms.get(second)?.state.players).toHaveLength(1)
    a.socket.send(JSON.stringify({ type: "finish", timeMs: 0 }))
    await new Promise<void>((done) => a.socket.once("close", () => done()))
    expect(
      a.messages.some((message) => message.type === "error" && message.code === "invalid_command"),
    ).toBe(true)
    expect(b.messages.some((message) => message.type === "results")).toBe(false)
    expect(host.rooms.get(second)?.state.players).toHaveLength(1)
    expect(host.metrics.rejectedMessages).toBe(1)
    const health: unknown = await (await fetch(`${base}/api/health`)).json()
    expect(health).toMatchObject({
      ok: true,
      runtime: "authoritative-node",
      protocol: ACTION_PROTOCOL,
    })
    const readiness = await fetch(`${base}/ready`)
    expect(readiness.status).toBe(200)
    expect(await readiness.json()).toMatchObject({ ready: true, protocol: ACTION_PROTOCOL })
    expect(readiness.headers.get("x-correlation-id")).toBeTruthy()
  } finally {
    for (const socket of clients) socket.terminate()
    await host.close()
  }
}, 10_000)

test("empty room reservations expire and release admission capacity", async () => {
  const host = createActionHost({ staticRoot: resolve("dist"), maxRooms: 1 })
  await new Promise<void>((done) => host.server.listen(0, "127.0.0.1", done))
  const address = host.server.address()
  if (address === null || typeof address === "string") throw new Error("No host address")
  const base = `http://127.0.0.1:${address.port}`
  try {
    expect((await fetch(`${base}/api/rooms`, { method: "POST" })).status).toBe(201)
    expect((await fetch(`${base}/api/rooms`, { method: "POST" })).status).toBe(503)
    for (const room of host.rooms.values()) room.lastActivityMs -= 31_000
    await new Promise((done) => setTimeout(done, 100))
    expect(host.rooms.size).toBe(0)
    expect((await fetch(`${base}/api/rooms`, { method: "POST" })).status).toBe(201)
  } finally {
    await host.close()
  }
})

test("the traffic ceiling still closes a connection flooding valid pings", async () => {
  const host = createActionHost({ staticRoot: resolve("dist"), maxRooms: 1 })
  await new Promise<void>((done) => host.server.listen(0, "127.0.0.1", done))
  const address = host.server.address()
  if (address === null || typeof address === "string") throw new Error("No host address")
  let socket: WebSocket | null = null
  try {
    const base = `http://127.0.0.1:${address.port}`
    const { code } = (await (await fetch(`${base}/api/rooms`, { method: "POST" })).json()) as {
      code: string
    }
    socket = new WebSocket(`${base.replace("http:", "ws:")}/ws/${code}`)
    const messages: ActionServerMessage[] = []
    socket.on("message", (raw) => messages.push(decodeActionServerMessage(raw.toString())))
    await new Promise<void>((done, reject) => {
      socket?.once("open", done)
      socket?.once("error", reject)
    })
    const closed = new Promise<void>((done) => socket?.once("close", () => done()))
    for (let nonce = 0; nonce < MESSAGE_BURST_CAPACITY + 20; nonce++)
      socket.send(JSON.stringify({ type: "ping", nonce }))
    await closed
    expect(host.metrics.rejectedMessages).toBe(1)
    expect(messages.filter((message) => message.type === "pong").length).toBeGreaterThanOrEqual(
      MESSAGE_BURST_CAPACITY,
    )
    expect(
      messages.some((message) => message.type === "error" && message.code === "rate_limited"),
    ).toBe(true)
  } finally {
    socket?.terminate()
    await host.close()
  }
}, 5000)
