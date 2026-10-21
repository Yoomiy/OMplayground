/** Node-only integrated-host soak. Fixture identities/storage; no real Supabase or media. */
import assert from "node:assert/strict"
import { fork } from "node:child_process"
import { once } from "node:events"
import { cpus, loadavg } from "node:os"
import { monitorEventLoopDelay } from "node:perf_hooks"
import { WebSocket } from "ws"
import {
  AdmissionError,
  enforceAdmission,
  type PlatformProfile,
  type PlatformSession,
} from "../src/platform/admission"
import { canonical } from "../src/platform/checkpoint"
import { PlatformGateway } from "../src/platform/gateway"
import { createPlatformService } from "../src/platform/service"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms))
class SoakGateway extends PlatformGateway {
  readonly rows = new Map<string, PlatformSession>()
  writes = 0
  constructor() {
    super("https://fixture.invalid", "fixture-only")
    for (let room = 0; room < 3; room++)
      this.rows.set(id(100 + room), {
        id: id(100 + room),
        host_id: id(room * 8 + 1),
        gender: "boy",
        status: "waiting",
        is_open: true,
        invitation_code: null,
        player_ids: [id(room * 8 + 1)],
        player_names: ["Fixture"],
        game_state: null,
        games: { game_url: "wobble-rush", is_active: true, min_players: 2, max_players: 8 },
      })
  }
  override async profile(userId: string): Promise<PlatformProfile> {
    if (!Array.from({ length: 24 }, (_, n) => id(n + 1)).includes(userId))
      throw new AdmissionError("UNAUTHORIZED", 401)
    return { userId, name: "Fixture", gender: "boy", grade: "3", role: "kid" }
  }
  override async authenticate(token: unknown) {
    return this.profile(String(token))
  }
  override async session(sessionId: string) {
    const row = this.rows.get(sessionId)
    if (!row) throw new AdmissionError("BAD_SESSION", 404)
    return structuredClone(row)
  }
  override async withinRecess() {
    return true
  }
  override async admit(profile: PlatformProfile, sessionId: string, observer: boolean) {
    return enforceAdmission({
      profile,
      session: await this.session(sessionId),
      observer,
      challenged: false,
      withinRecess: true,
    })
  }
  override async update(previous: PlatformSession, patch: Record<string, unknown>) {
    const row = await this.session(previous.id)
    if (
      row.game_state?.revision !== previous.game_state?.revision ||
      canonical(row.player_ids) !== canonical(previous.player_ids)
    )
      throw new AdmissionError("SESSION_CHANGED", 409)
    const next = structuredClone({ ...row, ...patch }) as PlatformSession
    this.rows.set(row.id, next)
    this.writes++
    return structuredClone(next)
  }
}

if (process.argv.includes("--host")) {
  const gateway = new SoakGateway()
  const service = createPlatformService({
    gateway,
    secret: "soak-fixture-only-secret-at-least-32-characters",
    origins: ["http://soak.test"],
    clientDir: "dist/client",
    release: "soak",
  })
  const lag = monitorEventLoopDelay({ resolution: 10 })
  lag.enable()
  let startCpu = process.cpuUsage(),
    start = performance.now(),
    peakRss = process.memoryUsage().rss
  const memory = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
  }, 1000)
  service.server.listen(0, "127.0.0.1", () => {
    const address = service.server.address()
    if (!address || typeof address === "string") throw new Error("Missing port")
    process.send?.({ kind: "ready", base: `http://127.0.0.1:${address.port}` })
  })
  process.on("message", (message) => {
    if (!message || typeof message !== "object" || !("kind" in message)) return
    if (message.kind === "measure") {
      startCpu = process.cpuUsage()
      start = performance.now()
      lag.reset()
      peakRss = process.memoryUsage().rss
      process.send?.({ kind: "measuring" })
    }
    if (message.kind === "stop")
      void (async () => {
        const elapsed = performance.now() - start,
          cpu = process.cpuUsage(startCpu)
        const health = await (
          await fetch(
            `http://127.0.0.1:${(service.server.address() as { port: number }).port}/health`,
          )
        ).json()
        const stats = {
          kind: "report",
          seconds: elapsed / 1000,
          cpuPercentOfOneCore: (cpu.user + cpu.system) / (elapsed * 10),
          rssMiB: process.memoryUsage().rss / 2 ** 20,
          peakRssMiB: Math.max(peakRss, process.memoryUsage().rss) / 2 ** 20,
          eventLoopP95Ms: lag.percentile(95) / 1e6,
          eventLoopP99Ms: lag.percentile(99) / 1e6,
          eventLoopMaxMs: lag.max / 1e6,
          fixtureWrites: gateway.writes,
          health,
        }
        clearInterval(memory)
        lag.disable()
        await service.close()
        process.send?.(stats)
        process.disconnect?.()
      })().catch((error) => {
        console.error(error)
        process.exit(1)
      })
  })
} else {
  const seconds = Number(process.env.WOBBLE_SOAK_SECONDS ?? 180)
  assert.ok(Number.isInteger(seconds) && seconds >= 10 && seconds <= 3600)
  const child = fork(process.argv[1] ?? "", ["--host"], {
    env: { ...process.env, NODE_ENV: "production", LOG_LEVEL: "error" },
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  })
  const clients: WebSocket[] = [],
    rtt: number[] = []
  let shutdownRequested = false
  let stopping = false,
    closed = 0,
    rejected = 0,
    frames = 0,
    bytes = 0,
    controls = 0
  let inputTimer: ReturnType<typeof setInterval> | undefined
  let pingTimer: ReturnType<typeof setInterval> | undefined
  const startLoad = loadavg()
  const message = (kind: string) =>
    new Promise<Record<string, unknown>>((done, fail) => {
      const timeout = setTimeout(() => {
        child.off("message", receive)
        fail(new Error(`Child timeout: ${kind}`))
      }, 15000)
      const receive = (value: unknown) => {
        if (value && typeof value === "object" && "kind" in value && value.kind === kind) {
          clearTimeout(timeout)
          child.off("message", receive)
          done(value as Record<string, unknown>)
        }
      }
      child.on("message", receive)
    })
  try {
    const { base } = await message("ready")
    assert.equal(typeof base, "string")
    const launch = async (sessionId: string, userId: string) => {
      const response = await fetch(`${base}/api/wobble/launch`, {
        method: "POST",
        headers: {
          Origin: "http://soak.test",
          Authorization: `Bearer ${userId}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      })
      return {
        status: response.status,
        body: (await response.json()) as { ticket: string; code?: string },
      }
    }
    const peers: {
      socket: WebSocket
      tick: number
      raceId: string
      sequence: number
      index: number
      phase: string
    }[] = []
    for (let room = 0; room < 2; room++) {
      for (let index = 0; index < 8; index++) {
        const ticket = await launch(id(100 + room), id(room * 8 + index + 1))
        assert.equal(ticket.status, 200)
        const socket = new WebSocket(
          `${String(base).replace("http", "ws")}/app-ws/${id(100 + room)}`,
          { headers: { Origin: "http://soak.test" } },
        )
        clients.push(socket)
        const peer = { socket, tick: 0, raceId: "", sequence: 0, index, phase: "lobby" }
        peers.push(peer)
        await new Promise<void>((done, fail) => {
          let loaded = false
          socket.on("error", fail)
          socket.on("close", () => {
            if (!stopping) closed++
          })
          socket.on("message", (raw) => {
            bytes += Buffer.byteLength(raw.toString())
            const value = JSON.parse(raw.toString())
            if (value.type === "authority")
              socket.send(JSON.stringify({ type: "attach", ticket: ticket.body.ticket }))
            if (value.type === "platform" && !loaded) {
              loaded = true
              socket.send(JSON.stringify({ type: "control", control: { action: "loaded" } }))
              done()
            }
            if (value.type === "error") rejected++
            if (value.type === "frame") {
              frames++
              peer.tick = value.tick
              peer.raceId = value.raceId
              peer.phase = value.phase
            }
            if (value.type === "pong") rtt.push(performance.now() - value.nonce)
          })
        })
      }
    }
    const additional = await launch(id(102), id(17))
    assert.equal(additional.status, 200)
    await pause(200)
    for (const [room, host] of [peers[0], peers[8]].entries()) {
      assert.ok(host)
      host.socket.send(
        JSON.stringify({
          type: "control",
          control: {
            action: "configure",
            courseId: room ? "spiral-summit" : "sunrise-scramble",
            mode: "race",
            remix: true,
          },
        }),
      )
      host.socket.send(JSON.stringify({ type: "control", control: { action: "start" } }))
    }
    inputTimer = setInterval(() => {
      for (const peer of peers)
        if (peer.phase === "racing" && peer.socket.readyState === WebSocket.OPEN) {
          const phase = Math.floor(peer.tick / 6) % 30
          peer.socket.send(
            JSON.stringify({
              type: "input",
              raceId: peer.raceId,
              tick: peer.tick + 12,
              seq: ++peer.sequence,
              respawn: false,
              input: {
                forward: 1,
                strafe: ((peer.index % 3) - 1) * 0.3,
                cameraYaw: 0,
                jumpHeld: phase < 3,
                jumpPressed: phase === 0,
                divePressed: phase === 15,
              },
            }),
          )
          controls++
        }
    }, 100)
    pingTimer = setInterval(() => {
      for (const socket of clients)
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: "ping", nonce: Math.floor(performance.now()) }))
    }, 1000)
    await pause(4000)
    const measuring = message("measuring")
    child.send({ kind: "measure" })
    await measuring
    for (let elapsed = 0; elapsed < seconds; elapsed += Math.min(30, seconds - elapsed)) {
      const window = Math.min(30, seconds - elapsed)
      await pause(window * 1000)
      console.error(
        `Integrated soak: ${elapsed + window}/${seconds}s, ${frames} frames, ${closed} unexpected closes, ${rejected} command errors`,
      )
    }
    clearInterval(inputTimer)
    clearInterval(pingTimer)
    stopping = true
    const report = message("report")
    shutdownRequested = true
    child.send({ kind: "stop" })
    const server = await report
    const health = server.health as {
      rooms: number
      connections: number
      metrics: { overloadPauses: number; skippedFrames: number; rejected: number }
    }
    assert.equal(health.rooms, 3)
    assert.equal(health.connections, 16)
    assert.equal(health.metrics.overloadPauses, 0)
    assert.equal(health.metrics.skippedFrames, 0)
    assert.equal(health.metrics.rejected, 0)
    rtt.sort((a, b) => a - b)
    console.log(
      JSON.stringify(
        {
          label: process.env.WOBBLE_SOAK_LABEL ?? "candidate",
          environment: {
            cpu: cpus()[0]?.model,
            cores: cpus().length,
            loadStart: startLoad,
            loadEnd: loadavg(),
          },
          fixture:
            "isolated server process, native Node/ws clients; in-memory authenticated database fixture; no real Supabase/media/GPU",
          racingRooms: 2,
          hostedRooms: health.rooms,
          humanClients: 16,
          serverNpcs: 4,
          server,
          clients: {
            frames,
            bytes,
            controls,
            unexpectedCloses: closed,
            commandErrors: rejected,
            localhostRttP95Ms: rtt[Math.floor(rtt.length * 0.95)],
            localhostRttP99Ms: rtt[Math.floor(rtt.length * 0.99)],
          },
          additionalRoomStatus: additional.status,
        },
        null,
        2,
      ),
    )
    assert.equal(closed, 0)
    assert.equal(rejected, 0)
    assert.ok(frames > seconds * 16 * 10)
  } finally {
    stopping = true
    clearInterval(inputTimer)
    clearInterval(pingTimer)
    for (const socket of clients) socket.terminate()
    if (child.exitCode === null) {
      if (!shutdownRequested && child.connected) child.send({ kind: "stop" })
      const kill = setTimeout(() => child.kill("SIGKILL"), 10000)
      await once(child, "exit")
      clearTimeout(kill)
    }
  }
}
