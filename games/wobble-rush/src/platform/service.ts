import { randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { extname, resolve, sep } from "node:path"
import { WebSocket, WebSocketServer } from "ws"
import { logError } from "../../../../packages/observability/src/error"
import {
  ACTION_CONTENT,
  ACTION_PROTOCOL,
  decodeActionClientMessage,
  MAX_CLIENT_BYTES,
} from "../shared/action-protocol"
import { COURSES } from "../shared/course-catalog"
import { courseName } from "../shared/hebrew"
import { platformCommandSchema } from "../shared/platform-protocol"
import { AdmissionError, type PlatformProfile } from "./admission"
import { type Checkpoint, RoomCheckpoints, SAVE_TTL_MS } from "./checkpoint"
import type { PlatformGateway } from "./gateway"
import { platformLog } from "./logging"
import { MessageBudget } from "./message-budget"
import { PlaygroundWobbleRoom, type RoomWireMessage } from "./room"
import { LaunchTickets } from "./tickets"

type Peer = {
  socket: WebSocket
  profile: PlatformProfile | null
  room: PlaygroundWobbleRoom | null
  pongAt: number
  pingAt: number
  budget: MessageBudget
  commands: number
  reportAt: number
  correlationId: string
  connectedAt: number
  closeReason: string | null
}
export interface PlatformServiceOptions {
  gateway: PlatformGateway
  secret: string
  origins: string[]
  clientDir: string
  release: string
  maxRooms: number
  createVoiceToken?: (args: {
    sessionId: string
    userId: string
    displayName: string
  }) => Promise<{ token: string; serverUrl: string }>
  revokeVoice?: (sessionId: string, userId: string) => Promise<void>
}

export function createPlatformService(options: PlatformServiceOptions) {
  const tickets = new LaunchTickets(options.secret)
  const checkpoints = new RoomCheckpoints(options.secret)
  const origins = new Set(options.origins)
  if (
    !origins.size ||
    options.maxRooms < 1 ||
    options.maxRooms > 32 ||
    !Number.isInteger(options.maxRooms)
  )
    throw new Error("App origins and a bounded room limit are required")
  for (const origin of origins)
    if (new URL(origin).origin !== origin) throw new Error("APP_ORIGINS must contain exact origins")
  const rooms = new Map<string, PlaygroundWobbleRoom>()
  const allocations = new Map<string, Promise<PlaygroundWobbleRoom>>()
  const connections = new Map<string, Peer>()
  const peers = new Set<Peer>()
  const rates = new Map<string, { at: number; count: number }>()
  const voice = new Map<
    string,
    { expires: number; promise: Promise<{ token: string; serverUrl: string }> }
  >()
  const clientRoot = resolve(options.clientDir)
  let draining = false
  let maintaining = false
  let lastMaintenance = 0
  let lastPulse = performance.now()
  let accumulator = 0
  let nextFrame = 0
  const metrics = { ticks: 0, overloadPauses: 0, rejected: 0, skippedFrames: 0 }
  const key = (sessionId: string, userId: string) => `${sessionId}:${userId}`

  function send(peer: Peer, message: RoomWireMessage): void {
    if (peer.socket.readyState !== WebSocket.OPEN) return
    if (peer.socket.bufferedAmount > 64 * 1024 && message.type === "frame") {
      metrics.skippedFrames++
      return
    }
    if (peer.socket.bufferedAmount > 256 * 1024) {
      peer.closeReason = "SEND_BACKPRESSURE"
      peer.socket.close(4000, "connection backlog")
      return
    }
    peer.socket.send(JSON.stringify(message), { compress: message.type === "frame" })
  }
  function disconnect(sessionId: string, userId: string, code: string): void {
    const peer = connections.get(key(sessionId, userId))
    if (peer) {
      peer.closeReason = code
      send(peer, { type: "error", code, message: code })
      peer.socket.close(4002, code)
    }
    voice.delete(key(sessionId, userId))
    if (options.revokeVoice)
      void options.revokeVoice(sessionId, userId).catch((error: unknown) =>
        platformLog("error", "WOBBLE_VOICE_REVOKE_FAILED", {
          sessionId,
          userId,
          err: logError(error),
          ...(error &&
          typeof error === "object" &&
          "code" in error &&
          typeof error.code === "string"
            ? { voiceCode: error.code }
            : {}),
          ...(error &&
          typeof error === "object" &&
          "status" in error &&
          typeof error.status === "number"
            ? { voiceStatus: error.status }
            : {}),
        }),
      )
  }
  function rateLimit(identity: string, limit: number, window = 60_000): void {
    const now = Date.now()
    for (const [id, rate] of rates) if (now - rate.at >= 60_000) rates.delete(id)
    const previous = rates.get(identity)
    const rate = previous && now - previous.at < window ? previous : { at: now, count: 0 }
    if (++rate.count > limit || rates.size >= 10_000) throw new AdmissionError("RATE_LIMITED", 429)
    rates.set(identity, rate)
  }

  async function allocate(
    admission: Awaited<ReturnType<PlatformGateway["admit"]>>,
  ): Promise<PlaygroundWobbleRoom> {
    const id = admission.session.id
    const existing = rooms.get(id)
    if (existing) return existing
    const pending = allocations.get(id)
    if (pending) return pending
    if (draining || rooms.size + allocations.size >= options.maxRooms)
      throw new AdmissionError("SERVICE_BUSY", 503)
    const work = (async () => {
      const session = await options.gateway.session(id)
      if (session.status === "completed") throw new AdmissionError("SESSION_COMPLETED", 409)
      let saved: Checkpoint | undefined
      if (session.game_state) {
        if (session.game_state.wobble !== true)
          throw new AdmissionError("INCOMPATIBLE_SESSION", 409)
        if (Number(session.game_state.leaseUntil) > Date.now())
          throw new AdmissionError("SESSION_RECOVERING", 503)
        if (session.game_state.checkpoint !== undefined)
          saved = checkpoints.read(session.game_state.checkpoint, id)
        else if (session.status !== "waiting") throw new AdmissionError("SAVE_UNAVAILABLE", 409)
        if (
          session.status === "paused" &&
          session.last_activity &&
          Date.now() - Date.parse(session.last_activity) >= SAVE_TTL_MS
        )
          throw new AdmissionError("SAVE_EXPIRED", 409)
      }
      const allocationId = randomUUID()
      const claimed = await options.gateway.update(session, {
        ...(saved ? { status: "paused" } : {}),
        connected_player_ids: [],
        connected_player_names: [],
        game_state: {
          wobble: true,
          version: 1,
          allocationId,
          leaseUntil: Date.now() + 60_000,
          ...(saved ? { checkpoint: checkpoints.sign(saved) } : {}),
        },
      })
      try {
        const room = new PlaygroundWobbleRoom(
          claimed,
          allocationId,
          options.gateway,
          checkpoints,
          {
            send(userId, message) {
              const peer = connections.get(key(id, userId))
              if (peer) send(peer, message)
            },
            disconnect(userId, code) {
              disconnect(id, userId, code)
            },
          },
          saved,
        )
        rooms.set(id, room)
        platformLog("info", saved ? "WOBBLE_ROOM_RESTORED" : "WOBBLE_ROOM_ALLOCATED", {
          sessionId: id,
          allocationId,
          restored: !!saved,
        })
        return room
      } catch (error) {
        const failed = await options.gateway.session(id)
        if (failed.game_state?.allocationId === allocationId)
          await options.gateway.update(failed, {
            game_state: { ...failed.game_state, leaseUntil: 0 },
            status: saved ? "paused" : "waiting",
          })
        throw error
      }
    })()
    allocations.set(id, work)
    try {
      return await work
    } finally {
      if (allocations.get(id) === work) allocations.delete(id)
    }
  }

  function json(response: ServerResponse, status: number, value: unknown): void {
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    })
    response.end(JSON.stringify(value))
  }
  async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
    let raw = ""
    for await (const chunk of request) {
      raw += chunk.toString()
      if (Buffer.byteLength(raw) > 12_000) throw new AdmissionError("REQUEST_TOO_LARGE", 413)
    }
    try {
      const value: unknown = JSON.parse(raw)
      if (value && typeof value === "object" && !Array.isArray(value))
        return value as Record<string, unknown>
    } catch {
      /* One bounded parse failure below. */
    }
    throw new AdmissionError("BAD_REQUEST", 400)
  }
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const suppliedCorrelation = request.headers["x-correlation-id"]
    const correlationId =
      typeof suppliedCorrelation === "string" && /^[0-9a-f-]{36}$/i.test(suppliedCorrelation)
        ? suppliedCorrelation
        : randomUUID()
    response.setHeader("X-Correlation-ID", correlationId)
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("Referrer-Policy", "no-referrer")
    const origin = request.headers.origin
    if (origin && origins.has(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin)
      response.setHeader("Vary", "Origin")
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization,Content-Type,X-Correlation-ID",
      )
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    }
    if (request.method === "OPTIONS") {
      response.writeHead(origin && origins.has(origin) ? 204 : 403)
      response.end()
      return
    }
    const path = new URL(request.url ?? "/", "http://wobble.internal").pathname
    if (path === "/health") {
      json(response, 200, {
        ok: true,
        release: options.release,
        protocol: ACTION_PROTOCOL,
        rooms: rooms.size,
        connections: peers.size,
        metrics,
      })
      return
    }
    if (path === "/ready") {
      json(response, draining ? 503 : 200, {
        ready: !draining,
        release: options.release,
        rooms: rooms.size,
        maxRooms: options.maxRooms,
      })
      return
    }
    if (path === "/api/wobble/config") {
      json(response, 200, {
        version: 1,
        protocol: ACTION_PROTOCOL,
        content: ACTION_CONTENT,
        release: options.release,
        appOrigins: [...origins],
        capabilities: [
          "authenticated-rooms",
          "host-start",
          "saved-games",
          "teacher-observation",
          "social",
        ],
        minPlayers: 2,
        maxPlayers: NET_MAX_PLAYERS,
        courses: COURSES.map((course) => ({ id: course.id, name: courseName(course) })),
      })
      return
    }
    if (
      ["/api/wobble/launch", "/api/wobble/chat", "/api/wobble/voice"].includes(path) &&
      request.method === "POST"
    ) {
      if (!origin || !origins.has(origin)) throw new AdmissionError("ORIGIN_FORBIDDEN")
      if (draining) throw new AdmissionError("SERVICE_DRAINING", 503)
      rateLimit(
        `request:${path}:${request.socket.remoteAddress}`,
        path.endsWith("/launch") ? 200 : 2000,
      )
      const profile = await options.gateway.authenticate(
        request.headers.authorization?.replace(/^Bearer\s+/i, ""),
      )
      const input = await body(request)
      if (typeof input.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.sessionId))
        throw new AdmissionError("BAD_SESSION", 400)
      if (path.endsWith("/launch")) {
        rateLimit(`launch:${profile.userId}`, 20)
        if (
          input.invitationCode !== undefined &&
          (typeof input.invitationCode !== "string" || input.invitationCode.length > 100)
        )
          throw new AdmissionError("BAD_REQUEST", 400)
        const observer = profile.role !== "kid" && input.participation !== "player"
        const admission = await options.gateway.admit(
          profile,
          input.sessionId,
          observer,
          input.invitationCode as string | undefined,
        )
        admission.correlationId = correlationId
        const room = await allocate(admission)
        room.assertAdmission(admission)
        const ticket = tickets.issue({
          userId: profile.userId,
          sessionId: input.sessionId,
          roomId: input.sessionId,
          allocationId: room.allocationId,
          observer,
          correlationId,
          ...(typeof input.invitationCode === "string"
            ? { invitationCode: input.invitationCode }
            : {}),
        })
        json(response, 200, {
          version: 1,
          sessionId: input.sessionId,
          ticket,
          protocol: ACTION_PROTOCOL,
          release: options.release,
        })
        platformLog("info", "WOBBLE_LAUNCH_COMPLETED", {
          sessionId: input.sessionId,
          userId: profile.userId,
          correlationId,
          observer,
        })
      } else {
        const room = rooms.get(input.sessionId)
        if (!room) throw new AdmissionError("NOT_IN_ROOM")
        const admission = await room.run(() => room.authorize(profile, true))
        if (path.endsWith("/chat")) {
          rateLimit(`chat:${profile.userId}`, 1, 700)
          await options.gateway.sendChat(admission, input.message)
          json(response, 200, { ok: true })
        } else {
          if (!options.createVoiceToken) throw new AdmissionError("VOICE_UNAVAILABLE", 503)
          rateLimit(`voice:${profile.userId}`, 20)
          const identity = key(input.sessionId, profile.userId)
          for (const [id, cached] of voice) if (cached.expires <= Date.now()) voice.delete(id)
          let cached = voice.get(identity)
          if (!cached) {
            const promise = options.createVoiceToken({
              sessionId: input.sessionId,
              userId: profile.userId,
              displayName: profile.name,
            })
            cached = { expires: Date.now() + 30_000, promise }
            voice.set(identity, cached)
            void promise.catch(() => {
              if (voice.get(identity)?.promise === promise) voice.delete(identity)
            })
          }
          let result: { token: string; serverUrl: string }
          try {
            result = await cached.promise
          } catch {
            throw new AdmissionError("VOICE_UNAVAILABLE", 503)
          }
          await room.run(() => room.authorize(profile, true))
          json(response, 200, result)
        }
      }
      return
    }
    if (path.startsWith("/api/") || path.startsWith("/ws")) {
      json(response, 404, { code: "AUTHENTICATED_LAUNCH_REQUIRED" })
      return
    }
    if (!["GET", "HEAD"].includes(request.method ?? "")) {
      json(response, 405, { code: "METHOD_NOT_ALLOWED" })
      return
    }
    let decoded: string
    try {
      decoded = decodeURIComponent(path)
    } catch {
      throw new AdmissionError("BAD_PATH", 400)
    }
    const file = resolve(clientRoot, `.${decoded === "/" ? "/index.html" : decoded}`)
    if (!file.startsWith(clientRoot + sep)) throw new AdmissionError("BAD_PATH", 400)
    const info = await stat(file).catch(() => null)
    if (!info?.isFile()) {
      json(response, 404, { code: "NOT_FOUND" })
      return
    }
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    }
    response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream")
    response.setHeader("Cache-Control", "no-cache")
    if (extname(file) === ".html")
      response.setHeader("Content-Security-Policy", `frame-ancestors ${[...origins].join(" ")}`)
    response.setHeader("Content-Length", info.size)
    if (request.method === "HEAD") response.end()
    else
      createReadStream(file)
        .on("error", () => response.destroy())
        .pipe(response)
  }
  const server = createServer((request, response) => {
    void handle(request, response).catch((error) => {
      const known = error instanceof AdmissionError
      const completedLaunch =
        known &&
        error.code === "SESSION_COMPLETED" &&
        request.url?.split("?")[0] === "/api/wobble/launch"
      platformLog(
        completedLaunch ? "debug" : known && error.status < 500 ? "warn" : "error",
        completedLaunch ? "WOBBLE_LAUNCH_REJECTED" : "WOBBLE_REQUEST_FAILED",
        {
          correlationId: response.getHeader("X-Correlation-ID"),
          code: known ? error.code : "SERVICE_UNAVAILABLE",
          path: request.url?.split("?")[0],
        },
      )
      if (!response.headersSent)
        json(response, known ? error.status : 503, {
          code: known ? error.code : "SERVICE_UNAVAILABLE",
        })
      else response.destroy()
    })
  })
  server.requestTimeout = 10_000
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_CLIENT_BYTES,
    perMessageDeflate: {
      threshold: 1024,
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      concurrencyLimit: 2,
      zlibDeflateOptions: { level: 1, memLevel: 4 },
    },
  })
  server.on("upgrade", (request, socket, head) => {
    const path = new URL(request.url ?? "/", "http://wobble.internal").pathname
    const sessionId = path.split("/")[2]
    const origin = request.headers.origin
    let sameOrigin = false
    try {
      sameOrigin = !!origin && new URL(origin).host === request.headers.host
    } catch {
      /* Reject below. */
    }
    if (
      draining ||
      !sessionId ||
      !/^\/app-ws\/[0-9a-f-]{36}$/i.test(path) ||
      !origin ||
      (!origins.has(origin) && !sameOrigin) ||
      peers.size >= options.maxRooms * 32 + 16
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
      return
    }
    wss.handleUpgrade(request, socket, head, (socket) => {
      const peer: Peer = {
        socket,
        profile: null,
        room: null,
        pongAt: Date.now(),
        pingAt: 0,
        budget: new MessageBudget(Date.now()),
        commands: 0,
        reportAt: 0,
        correlationId: randomUUID(),
        connectedAt: Date.now(),
        closeReason: null,
      }
      peers.add(peer)
      socket.on("error", (error) =>
        platformLog("warn", "WOBBLE_SOCKET_ERROR", {
          sessionId,
          userId: peer.profile?.userId,
          correlationId: peer.correlationId,
          err: logError(error),
        }),
      )
      socket.send(JSON.stringify({ type: "authority", protocol: ACTION_PROTOCOL }))
      const timeout = setTimeout(() => {
        if (!peer.profile) socket.close(1008, "admission timeout")
      }, 5000)
      let attaching = false
      socket.on("pong", () => {
        peer.pongAt = Date.now()
      })
      socket.on("message", (data, binary) => {
        if (binary || !peer.budget.consume(Date.now())) {
          socket.close(1008, "rate limited")
          return
        }
        const receive = async () => {
          const raw = data.toString()
          if (!peer.profile) {
            if (attaching) throw new AdmissionError("INVALID_TICKET", 401)
            attaching = true
            const command = platformCommandSchema.parse(JSON.parse(raw))
            if (command.type !== "attach") throw new AdmissionError("INVALID_TICKET", 401)
            const room = rooms.get(sessionId)
            if (!room) throw new AdmissionError("ROOM_UNAVAILABLE", 503)
            const ticket = tickets.consume(command.ticket, sessionId, room.allocationId)
            const profile = await options.gateway.profile(ticket.userId)
            if (ticket.correlationId) peer.correlationId = ticket.correlationId
            const admission = await options.gateway.admit(
              profile,
              sessionId,
              ticket.observer,
              ticket.invitationCode,
            )
            admission.correlationId = ticket.correlationId
            await room.run(async () => {
              room.assertAdmission(admission)
              const identity = key(sessionId, profile.userId)
              const previous = connections.get(identity)
              if (previous) {
                previous.closeReason = "REPLACEMENT_TAB"
                previous.socket.close(4001, "replacement tab")
              }
              peer.profile = profile
              peer.room = room
              connections.set(identity, peer)
              await room.attach(admission)
              clearTimeout(timeout)
            })
            return
          }
          const room = peer.room
          const profile = peer.profile
          if (!room || connections.get(key(sessionId, profile.userId)) !== peer) return
          const value = JSON.parse(raw) as { type?: unknown }
          if (value.type === "control") {
            rateLimit(`control:${profile.userId}`, 20, 10_000)
            if (++peer.commands > 8) {
              peer.commands--
              throw new AdmissionError("RATE_LIMITED", 429)
            }
            try {
              const command = platformCommandSchema.parse(value)
              if (command.type === "control")
                await room.run(() => room.control(profile, command.control, peer.correlationId))
            } finally {
              peer.commands--
            }
          } else {
            const message = decodeActionClientMessage(raw)
            if (message.type === "ping") {
              if (message.network && Date.now() - peer.reportAt >= 5000) {
                peer.reportAt = Date.now()
                platformLog("debug", "WOBBLE_CLIENT_NETWORK", {
                  sessionId,
                  userId: profile.userId,
                  correlationId: peer.correlationId,
                  release: options.release,
                  ...message.network,
                })
              }
              send(peer, { type: "pong", nonce: message.nonce, serverNowMs: Date.now() })
              if (message.resync) room.restore(profile.userId)
            } else if (message.type === "input") room.input(profile.userId, message)
            else throw new AdmissionError("CONTROL_FORBIDDEN")
          }
        }
        void receive().catch((error) => {
          metrics.rejected++
          const code = error instanceof AdmissionError ? error.code : "BAD_COMMAND"
          platformLog("warn", "WOBBLE_COMMAND_REJECTED", {
            sessionId,
            correlationId: peer.correlationId,
            userId: peer.profile?.userId,
            code,
          })
          send(peer, { type: "error", code, message: code })
          if (
            !peer.profile ||
            ["RECESS_DENIED", "NOT_IN_ROSTER", "PROFILE_DISABLED", "REMOVED_FROM_ROOM"].includes(
              code,
            )
          )
            socket.close(4002, code)
        })
      })
      socket.on("close", (closeCode) => {
        clearTimeout(timeout)
        peers.delete(peer)
        if (peer.profile)
          platformLog(
            peer.closeReason === "HEARTBEAT_TIMEOUT" ? "warn" : "info",
            "WOBBLE_PLAYER_DISCONNECTED",
            {
              sessionId,
              userId: peer.profile.userId,
              correlationId: peer.correlationId,
              protocol: "socket",
              closeCode,
              reason:
                peer.closeReason ??
                (closeCode === 1000 || closeCode === 1001 ? "CLIENT_CLOSED" : "CONNECTION_LOST"),
              duration_ms: Date.now() - peer.connectedAt,
              phase: peer.room?.engine.state.phase,
              ended: peer.room?.ended ?? false,
            },
          )
        if (!peer.profile || connections.get(key(sessionId, peer.profile.userId)) !== peer) return
        connections.delete(key(sessionId, peer.profile.userId))
        if (draining) return
        const profile = peer.profile
        if (peer.room)
          void peer.room
            .run(() => peer.room?.detached(profile.userId) ?? Promise.resolve())
            .catch(() =>
              platformLog("error", "WOBBLE_LEAVE_SAVE_FAILED", {
                sessionId,
                userId: profile.userId,
              }),
            )
      })
    })
  })
  const timer = setInterval(() => {
    const at = performance.now(),
      elapsed = at - lastPulse
    lastPulse = at
    if (elapsed > 1000) {
      accumulator = 0
      for (const [sessionId, room] of rooms)
        if (!room.paused && !room.ended) {
          metrics.overloadPauses++
          platformLog("warn", "WOBBLE_SIMULATION_STALLED", { sessionId, duration_ms: elapsed })
          room.pause()
          void room
            .run(() => room.persist(true))
            .catch(() => platformLog("error", "WOBBLE_STALL_SAVE_FAILED", { sessionId }))
        }
    } else accumulator = Math.min(accumulator + elapsed, (12 * 1000) / 60)
    while (accumulator >= 1000 / 60) {
      accumulator -= 1000 / 60
      for (const room of rooms.values()) room.step(Date.now())
      metrics.ticks++
    }
    if (at >= nextFrame) {
      nextFrame = at + 1000 / 15
      for (const [sessionId, room] of rooms) {
        room.frame()
        void room
          .saveResults()
          .catch(() => platformLog("error", "WOBBLE_RESULTS_SAVE_FAILED", { sessionId }))
      }
    }
    const now = Date.now()
    for (const peer of peers) {
      if (now - peer.pongAt > 30_000) {
        peer.closeReason = "HEARTBEAT_TIMEOUT"
        peer.socket.terminate()
      } else if (now - peer.pingAt > 5000 && peer.socket.readyState === WebSocket.OPEN) {
        peer.pingAt = now
        peer.socket.ping()
      }
    }
    if (!maintaining && now - lastMaintenance > 15_000) {
      maintaining = true
      lastMaintenance = now
      void (async () => {
        for (const [sessionId, room] of rooms) {
          await room
            .run(() => room.maintain(now))
            .catch(() => {
              room.pause()
              platformLog("error", "WOBBLE_MAINTENANCE_FAILED", { sessionId })
            })
          if (room.emptySince !== null && now - room.emptySince >= 30_000 && room.saved) {
            try {
              await room.run(() => room.hibernate())
              for (const observer of room.observers.values())
                disconnect(sessionId, observer.userId, "SESSION_SAVED")
              rooms.delete(sessionId)
              platformLog("info", "WOBBLE_ROOM_HIBERNATED", { sessionId, saved: true })
            } catch {
              platformLog("error", "WOBBLE_HIBERNATE_FAILED", { sessionId })
            }
          }
        }
      })()
        .finally(() => {
          maintaining = false
        })
        .catch(() => platformLog("error", "WOBBLE_MAINTENANCE_FAILED", {}))
    }
  }, 8)
  timer.unref()

  return {
    server,
    rooms,
    async close() {
      draining = true
      clearInterval(timer)
      const pending = [...allocations.values()]
      await Promise.allSettled(pending)
      const saves = await Promise.allSettled(
        [...rooms.values()].map((room) => room.run(() => room.hibernate())),
      )
      for (const peer of peers) {
        peer.closeReason = "SERVICE_RESTART"
        peer.socket.close(1012, "service restart")
      }
      for (const peer of peers) peer.socket.terminate()
      await new Promise<void>((done) => wss.close(() => done()))
      if (server.listening)
        await new Promise<void>((done, reject) =>
          server.close((error) => (error ? reject(error) : done())),
        )
      if (saves.some((result) => result.status === "rejected"))
        throw new Error("One or more Wobble saves failed during drain")
    },
  }
}
const NET_MAX_PLAYERS = 8
