/** Run the bundled script with Node: actual ws/zlib CPU and on-wire byte comparison. */
import assert from "node:assert/strict"
import type { Socket } from "node:net"
import { monitorEventLoopDelay } from "node:perf_hooks"
import { WebSocket } from "ws"
import { createActionHost } from "../../src/action/host"
import { ACTION_CONTENT, ACTION_PROTOCOL } from "../../src/shared/action-protocol"

const activeControls = process.env.LAB_ACTIVE_LOAD === "1"
const delay = (ms: number) => new Promise((done) => setTimeout(done, ms))
async function benchmark(compressSnapshots: boolean) {
  const host = createActionHost({ staticRoot: "dist", maxRooms: 4, compressSnapshots })
  await new Promise<void>((done) => host.server.listen(0, "127.0.0.1", done))
  const address = host.server.address()
  if (!address || typeof address === "string") throw new Error("No address")
  const base = `http://127.0.0.1:${address.port}`
  const clients: {
    ws: WebSocket
    transport: Socket | null
    joined: boolean
    frames: number
    payloadBytes: number
    id: string | null
    sequence: number
  }[] = []
  const lag = monitorEventLoopDelay({ resolution: 10 })
  try {
    for (let room = 0; room < 4; room++) {
      const { code } = (await (await fetch(`${base}/api/rooms`, { method: "POST" })).json()) as {
        code: string
      }
      const peers = Array.from({ length: 8 }, (_, index) => {
        const peer = {
          ws: new WebSocket(`${base.replace("http:", "ws:")}/ws/${code}`),
          transport: null as Socket | null,
          joined: false,
          frames: 0,
          payloadBytes: 0,
          id: null as string | null,
          sequence: 0,
        }
        clients.push(peer)
        peer.ws.on("upgrade", (response) => {
          peer.transport = response.socket
        })
        peer.ws.on("open", () =>
          peer.ws.send(
            JSON.stringify({
              type: "join",
              protocol: ACTION_PROTOCOL,
              contentVersion: ACTION_CONTENT,
              mode: "party",
              name: `Bandwidth ${index}`,
              colorIndex: index,
            }),
          ),
        )
        peer.ws.on("message", (raw) => {
          const text = raw.toString(),
            message = JSON.parse(text)
          if (message.type === "session") peer.joined = true
          if (message.type === "welcome") peer.id = message.you
          if (message.type === "frame") {
            peer.frames++
            peer.payloadBytes += Buffer.byteLength(text)
            if (activeControls && message.phase === "racing" && peer.id !== null) {
              const actor = message.actors.find((actor: { id: string }) => actor.id === peer.id)
              if (actor?.finishedMs === null) {
                const phase = Math.floor(message.tick / 3) % 60
                peer.ws.send(
                  JSON.stringify({
                    type: "input",
                    raceId: message.raceId,
                    seq: ++peer.sequence,
                    tick: message.tick + 12,
                    respawn: false,
                    input: {
                      forward: 1,
                      strafe: ((index % 3) - 1) * 0.25,
                      cameraYaw: 0,
                      jumpHeld: phase < 3,
                      jumpPressed: phase === 0,
                      divePressed: phase === 30,
                    },
                  }),
                )
              }
            }
          }
          if (message.type === "error") throw new Error(message.code)
        })
        return peer
      })
      const deadline = performance.now() + 5000
      while (!peers.every((peer) => peer.joined) && performance.now() < deadline) await delay(5)
      assert(peers.every((peer) => peer.joined))
      for (const peer of peers) peer.ws.send(JSON.stringify({ type: "ready", ready: true }))
      await delay(60)
      const state = host.rooms.get(code)
      assert(state)
      state.state = { ...state.state, phaseEndsAtMs: Date.now() - 1 }
    }
    await delay(300)
    const wire = () => clients.reduce((sum, peer) => sum + (peer.transport?.bytesRead ?? 0), 0)
    const frames = () => clients.reduce((sum, peer) => sum + peer.frames, 0)
    const payload = () => clients.reduce((sum, peer) => sum + peer.payloadBytes, 0)
    const start = {
      wire: wire(),
      frames: frames(),
      payload: payload(),
      cpu: process.cpuUsage(),
      at: performance.now(),
    }
    lag.enable()
    await delay(activeControls ? 10000 : 5000)
    const elapsedMs = performance.now() - start.at,
      cpu = process.cpuUsage(start.cpu)
    lag.disable()
    const result = {
      compressSnapshots,
      activeControls,
      inputMessages: clients.reduce((sum, peer) => sum + peer.sequence, 0),
      clients: clients.length,
      rooms: 4,
      negotiated: clients.filter((peer) => peer.ws.extensions === "permessage-deflate").length,
      elapsedMs,
      frames: frames() - start.frames,
      wireBytes: wire() - start.wire,
      payloadBytes: payload() - start.payload,
      cpuMs: (cpu.user + cpu.system) / 1000,
      cpuPercentOneCore: (cpu.user + cpu.system) / 10 / elapsedMs,
      rssBytes: process.memoryUsage().rss,
      eventLoopP99Ms: lag.percentile(99) / 1e6,
      metrics: host.metrics,
    }
    if (activeControls) assert(result.inputMessages > 1000)
    assert.equal(host.metrics.overloadStops, 0)
    assert.equal(host.metrics.rejectedMessages, 0)
    assert(clients.every((peer) => peer.ws.readyState === WebSocket.OPEN))
    return result
  } finally {
    for (const peer of clients) peer.ws.terminate()
    await host.close()
    lag.disable()
  }
}
const plain = await benchmark(false),
  compressed = await benchmark(true)
const savedPercent =
  100 * (1 - compressed.wireBytes / compressed.frames / (plain.wireBytes / plain.frames))
assert.equal(compressed.negotiated, 32)
assert(savedPercent > 40)
console.log(
  JSON.stringify({
    plain,
    compressed,
    savedPercent,
    limitation: activeControls
      ? "Ten-second profiles with four rooms/eight moving, jumping and diving input clients plus two NPCs each; Node host/client CPU combined, not sustained capacity or physical-network acceptance."
      : "Five-second transport comparison with four rooms of eight stationary humans plus two moving NPCs; not physical-network or general capacity acceptance.",
  }),
)
