/** Public-route reconnect smoke. No browser/GPU timing, forged state or results. */
import assert from "node:assert/strict"
import { WebSocket } from "ws"
import {
  ACTION_CONTENT,
  ACTION_PROTOCOL,
  type ActionClientMessage,
  type ActionServerMessage,
  decodeActionServerMessage,
} from "../../src/shared/action-protocol"
import { NEUTRAL_INPUT } from "../../src/shared/types"

const base = Bun.argv[2] ?? "http://127.0.0.1:19003"
const response = await fetch(`${base}/api/rooms`, { method: "POST" })
assert.equal(response.status, 201)
const { code } = (await response.json()) as { code: string }
type Peer = { socket: WebSocket; messages: ActionServerMessage[]; closed: number | null }
const peers: Peer[] = []
const wait = async (condition: () => boolean) => {
  const end = performance.now() + 8000
  while (!condition() && performance.now() < end) await Bun.sleep(10)
  assert(condition(), "Expected host response")
}
const latest = <T extends ActionServerMessage["type"]>(peer: Peer, type: T) => {
  const result = peer.messages.findLast((entry) => entry.type === type)
  assert(result, `Missing ${type}`)
  return result as Extract<ActionServerMessage, { type: T }>
}
const open = async (command: ActionClientMessage) => {
  const peer: Peer = {
    socket: new WebSocket(`${base.replace(/^http/, "ws")}/ws/${code}`, { origin: base }),
    messages: [],
    closed: null,
  }
  peers.push(peer)
  peer.socket.on("message", (raw) => peer.messages.push(decodeActionServerMessage(raw.toString())))
  peer.socket.on("close", (code) => {
    peer.closed = code
  })
  await new Promise<void>((done, reject) => {
    peer.socket.once("open", done)
    peer.socket.once("error", reject)
  })
  peer.socket.send(JSON.stringify(command))
  await wait(() =>
    peer.messages.some((entry) => entry.type === "session" || entry.type === "error"),
  )
  assert(!peer.messages.some((entry) => entry.type === "error"))
  return peer
}
try {
  const join = {
    type: "join",
    protocol: ACTION_PROTOCOL,
    contentVersion: ACTION_CONTENT,
    mode: "party",
    name: "Reconnect QA",
    colorIndex: 0,
  } as const
  const a = await open(join),
    b = await open(join)
  for (const peer of [a, b]) peer.socket.send(JSON.stringify({ type: "ready", ready: true }))
  await wait(() => a.messages.some((entry) => entry.type === "frame" && entry.phase === "racing"))
  const id = latest(a, "welcome").you,
    token = latest(a, "session").token
  const raceId = latest(a, "frame").raceId
  a.socket.send(
    JSON.stringify({
      type: "input",
      tick: 1,
      raceId,
      seq: 1,
      input: { ...NEUTRAL_INPUT, forward: 1 },
      respawn: false,
    }),
  )
  await wait(() => latest(a, "frame").actors.some((actor) => actor.id === id && actor.ack === 1))
  a.socket.terminate()
  const resume = {
    type: "resume",
    protocol: ACTION_PROTOCOL,
    contentVersion: ACTION_CONTENT,
    token,
  } as const
  const returned = await open(resume)
  await wait(() => returned.messages.some((entry) => entry.type === "frame"))
  assert.equal(latest(returned, "welcome").you, id)
  assert.equal(latest(returned, "frame").raceId, raceId)
  assert(latest(returned, "frame").actors.some((actor) => actor.id === id && actor.ack === 1))
  const replacement = await open(resume)
  await wait(() => returned.closed === 4001)
  await wait(() => replacement.messages.some((entry) => entry.type === "frame"))
  assert.equal(latest(replacement, "welcome").you, id)
  assert.equal(latest(replacement, "frame").actors.filter((actor) => !actor.npc).length, 2)
  replacement.socket.send(
    JSON.stringify({
      type: "input",
      tick: 1,
      raceId,
      seq: 2,
      input: NEUTRAL_INPUT,
      respawn: false,
    }),
  )
  await wait(() =>
    latest(replacement, "frame").actors.some((actor) => actor.id === id && actor.ack === 2),
  )
  for (const peer of [replacement, b]) peer.socket.send(JSON.stringify({ type: "leave" }))
  console.log(
    JSON.stringify({
      base,
      protocol: ACTION_PROTOCOL,
      content: ACTION_CONTENT,
      checks: [
        "two-authoritative-racers",
        "same-actor-and-race-after-disconnect",
        "ack-preserved",
        "duplicate-connection-fenced-with-4001",
        "replacement-controls-accepted",
        "explicit-leave",
      ],
    }),
  )
} finally {
  for (const peer of peers) peer.socket.close(1000, "QA completed")
}
