/** Short deployment smoke: two real sockets, racing frames and bunched controls. */
import assert from "node:assert/strict"
import { WebSocket } from "ws"
import {
  ACTION_CONTENT,
  ACTION_PROTOCOL,
  decodeActionServerMessage,
} from "../../src/shared/action-protocol"
import { NEUTRAL_INPUT } from "../../src/shared/types"

const base = Bun.argv[2] ?? "http://127.0.0.1:19003"
const jitter = Bun.argv.includes("--jitter")
const response = await fetch(`${base}/api/rooms`, { method: "POST" })
assert.equal(response.status, 201)
const { code } = (await response.json()) as { code: string }
const delay = (ms: number) => new Promise((done) => setTimeout(done, ms))
const peers = [0, 1].map(() => ({
  socket: new WebSocket(`${base.replace(/^http/, "ws")}/ws/${code}`, { origin: base }),
  errors: [] as string[],
  frame: null as Extract<ReturnType<typeof decodeActionServerMessage>, { type: "frame" }> | null,
  closed: false,
  frames: 0,
}))
try {
  await Promise.all(
    peers.map(
      (peer) =>
        new Promise<void>((done, reject) => {
          peer.socket.on("message", (raw) => {
            const message = decodeActionServerMessage(raw.toString())
            if (message.type === "error") peer.errors.push(message.code)
            if (message.type === "frame") {
              peer.frame = message
              peer.frames++
            }
          })
          peer.socket.on("close", () => {
            peer.closed = true
          })
          peer.socket.once("error", reject)
          peer.socket.once("open", () => {
            peer.socket.send(
              JSON.stringify({
                type: "join",
                protocol: ACTION_PROTOCOL,
                contentVersion: ACTION_CONTENT,
                mode: "party",
                name: "Transport QA",
                colorIndex: 0,
              }),
            )
            done()
          })
        }),
    ),
  )
  await delay(150)
  for (const peer of peers) peer.socket.send(JSON.stringify({ type: "ready", ready: true }))
  const deadline = Date.now() + 10_000
  while (!peers.every((peer) => peer.frame?.phase === "racing") && Date.now() < deadline)
    await delay(25)
  assert(peers.every((peer) => peer.frame?.phase === "racing"))
  let seq = 0
  const sendBatch = async (size: number, waitMs: number) => {
    for (const peer of peers)
      for (let index = 1; index <= size; index++)
        peer.socket.send(
          JSON.stringify({
            type: "input",
            tick: 1,
            raceId: peer.frame?.raceId,
            seq: seq + index,
            input: { ...NEUTRAL_INPUT, jumpPressed: index === 1 },
            respawn: false,
          }),
        )
    seq += size
    await delay(waitMs)
  }
  if (jitter) await delay(1800)
  for (let burst = 0; burst < 4; burst++) {
    if (jitter) await sendBatch(108, 600)
    await sendBatch(36, jitter ? 1800 : 600)
  }
  console.log(
    JSON.stringify({
      jitter,
      seq,
      errors: peers.map((peer) => peer.errors),
      closed: peers.map((peer) => peer.closed),
    }),
  )
  for (const peer of peers) {
    assert.deepEqual(peer.errors, [])
    assert.equal(peer.closed, false)
    assert.equal(peer.frame?.phase, "racing")
    assert.equal(peer.frame?.actors.filter((actor) => !actor.npc && actor.ack === seq).length, 2)
    assert.equal(peer.frame?.actors.filter((actor) => actor.npc).length, 2)
  }
  assert.equal(peers[0]?.frame?.raceId, peers[1]?.frame?.raceId)
  console.log(
    JSON.stringify({
      base,
      content: ACTION_CONTENT,
      protocol: ACTION_PROTOCOL,
      checks: [
        "two-joined-clients",
        "authoritative-racing",
        jitter ? "108-plus-36-controls-clumped-at-average-60hz" : "repeated-36-control-bursts",
        `both-ack-${seq}`,
        "server-npcs",
        "no-errors-or-disconnects",
      ],
      frames: peers.map((peer) => peer.frames),
    }),
  )
} finally {
  for (const peer of peers) peer.socket.close(1000, "QA completed")
}
