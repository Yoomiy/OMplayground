import { expect, test } from "bun:test"
import { NetClient } from "../src/client/net"
import { ACTION_PROTOCOL, type ActionInput } from "../src/shared/action-protocol"
import { NEUTRAL_INPUT } from "../src/shared/types"

class Socket {
  static OPEN = 1
  static CONNECTING = 0
  static latest: Socket
  readyState = 1
  bufferedAmount = 0
  sent: string[] = []
  closes: { code: number; reason: string }[] = []
  listeners = new Map<string, ((event: { data: string; code: number; reason: string }) => void)[]>()
  constructor() {
    Socket.latest = this
  }
  addEventListener(
    type: string,
    listener: (event: { data: string; code: number; reason: string }) => void,
  ): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }
  receive(data: unknown): void {
    for (const listener of this.listeners.get("message") ?? [])
      listener({ data: JSON.stringify(data), code: 0, reason: "" })
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(code: number, reason: string): void {
    this.closes.push({ code, reason })
    this.readyState = 3
  }
}

test("brief outbound backpressure keeps one latest sample and latches action edges without reconnecting", async () => {
  const ws = Object.getOwnPropertyDescriptor(globalThis, "WebSocket"),
    location = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "WebSocket", { value: Socket, configurable: true })
  Object.defineProperty(globalThis, "location", {
    value: { protocol: "http:", host: "example.test" },
    configurable: true,
  })
  let now = 0
  const client = new NetClient({ onMessage: () => {}, onClose: () => {} }, () => now)
  try {
    const connected = client.connect("TEST")
    const socket = Socket.latest
    socket.receive({ type: "authority", protocol: ACTION_PROTOCOL })
    await connected
    socket.bufferedAmount = 65 * 1024
    for (let seq = 1; seq <= 180; seq++) {
      now = seq * 16
      client.send({
        type: "input",
        raceId: "race",
        seq,
        tick: seq,
        respawn: seq === 2,
        input: {
          ...NEUTRAL_INPUT,
          strafe: seq === 180 ? 1 : 0,
          jumpPressed: seq === 1,
          divePressed: seq === 3,
        },
      })
    }
    expect(socket.sent).toHaveLength(0)
    expect(socket.closes).toHaveLength(0)
    socket.bufferedAmount = 0
    client.send({ type: "ping", nonce: 1 })
    expect(socket.sent).toHaveLength(2)
    const input = JSON.parse(socket.sent[0] ?? "null") as ActionInput
    expect(input.seq).toBe(180)
    expect(input.respawn).toBe(true)
    expect(input.input).toMatchObject({ strafe: 1, jumpPressed: true, divePressed: true })
    client.send({ type: "ping", nonce: 2 })
    expect(socket.sent).toHaveLength(3)
    socket.bufferedAmount = 65 * 1024
    client.send({
      type: "input",
      raceId: "old",
      seq: 181,
      tick: 181,
      respawn: true,
      input: { ...NEUTRAL_INPUT, jumpPressed: true },
    })
    socket.bufferedAmount = 0
    client.send({
      type: "input",
      raceId: "new",
      seq: 1,
      tick: 1,
      respawn: false,
      input: NEUTRAL_INPUT,
    })
    expect(JSON.parse(socket.sent.at(-1) ?? "null")).toMatchObject({
      raceId: "new",
      respawn: false,
      input: { jumpPressed: false },
    })
    const beforeHeld = socket.sent.length
    for (let step = 1; step <= 60; step++) {
      now += 1000 / 60
      client.send({
        type: "input",
        raceId: "new",
        seq: step + 1,
        tick: step + 1,
        respawn: false,
        input: NEUTRAL_INPUT,
      })
    }
    const heldWrites = socket.sent.length - beforeHeld
    expect(heldWrites).toBeGreaterThanOrEqual(8)
    expect(heldWrites).toBeLessThanOrEqual(10)
    const beforeTap = socket.sent.length
    client.send({
      type: "input",
      raceId: "new",
      seq: 62,
      tick: 62,
      respawn: false,
      input: { ...NEUTRAL_INPUT, jumpPressed: true, jumpHeld: true },
    })
    client.send({
      type: "input",
      raceId: "new",
      seq: 63,
      tick: 63,
      respawn: false,
      input: NEUTRAL_INPUT,
    })
    expect(socket.sent.length - beforeTap).toBe(2)
    socket.bufferedAmount = 65 * 1024
    client.send({ type: "ping", nonce: 3 })
    now += 10_001
    client.send({ type: "ping", nonce: 4 })
    expect(socket.closes).toEqual([{ code: 4000, reason: "connection backlog" }])
  } finally {
    client.close()
    if (ws) Object.defineProperty(globalThis, "WebSocket", ws)
    else Reflect.deleteProperty(globalThis, "WebSocket")
    if (location) Object.defineProperty(globalThis, "location", location)
    else Reflect.deleteProperty(globalThis, "location")
  }
})
