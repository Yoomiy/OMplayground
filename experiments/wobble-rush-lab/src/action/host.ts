/** Independent Node action host. All hot state is in bounded, process-owned rooms. */
import { randomInt, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { resolve } from "node:path"
import { WebSocket, WebSocketServer } from "ws"
import { ZodError } from "zod"
import {
  ACTION_PROTOCOL,
  type ActionServerMessage,
  decodeActionClientMessage,
  MAX_CLIENT_BYTES,
  RECONNECT_GRACE_MS,
} from "../shared/action-protocol"
import { InputSequenceError } from "../shared/authoritative-race"
import { FIXED_STEP_SEC, NET } from "../shared/constants"
import { generateRoomCode } from "../shared/room-code"
import { buildResults, phaseMessage, rosterMessage } from "../shared/room-messages"
import type { PlayerId } from "../shared/types"
import { asPlayerId, asRoomCode } from "../shared/types"
import { logger } from "./logging"
import { MessageBudget } from "./message-budget"
import { type PlayerSession, ReconnectSessions } from "./reconnect-sessions"
import { ActionRoom } from "./room"

type Peer = {
  socket: WebSocket
  id: PlayerId
  room: ActionRoom
  connectedMs: number
  lastDiagnosticMs: number
  lastResyncMs: number
  lastMessageMs: number
  lastPongMs: number
  lastPingMs: number
  lastInputMs: number | null
  inputLeadTicks: number | null
  inputRaceCurrent: boolean
  messageBudget: MessageBudget
  session: PlayerSession<Peer> | null
  retired: boolean
  backpressureSince: number | null
}
type HostOptions = {
  staticRoot: string
  maxRooms?: number
  allowedOrigin?: string
  seed?: number
  compressSnapshots?: boolean
}
const ROOM_TTL_MS = 15 * 60_000
const EMPTY_ROOM_TTL_MS = 30_000
const MAX_STALL_MS = 1000
const MAX_CATCHUP_STEPS = 12
const MAX_BUFFERED_BYTES = 256 * 1024

export function createActionHost(options: HostOptions) {
  const maxRooms = options.maxRooms ?? 4
  const rooms = new Map<string, ActionRoom>()
  const peers = new Set<Peer>()
  const sessions = new ReconnectSessions<Peer>()
  // Bound stale closing sockets so simultaneous reconnects can use spare slots.
  const socketOptions = {
    noServer: true,
    maxPayload: MAX_CLIENT_BYTES,
    perMessageDeflate:
      options.compressSnapshots === false
        ? false
        : {
            threshold: 1024,
            serverNoContextTakeover: true,
            clientNoContextTakeover: true,
            serverMaxWindowBits: 11,
            concurrencyLimit: 2,
            zlibDeflateOptions: { level: 1, memLevel: 4 },
          },
    closeTimeout: 1000,
  }
  const wss = new WebSocketServer(socketOptions)
  const metrics = {
    ticks: 0,
    maxPulseMs: 0,
    overloadStops: 0,
    rejectedMessages: 0,
    clientReports: 0,
    resyncRequests: 0,
    skippedSnapshots: 0,
  }
  let lastPulse = performance.now()
  let accumulatedMs = 0
  let nextBroadcastMs = performance.now()
  let draining = false

  const send = (peer: Peer, message: ActionServerMessage): void => {
    if (peer.retired || peer.socket.readyState !== WebSocket.OPEN) return
    const buffered = peer.socket.bufferedAmount
    if (buffered > 64 * 1024) {
      peer.backpressureSince ??= Date.now()
      // Frames replace one another; never enqueue seconds of obsolete state.
      if (message.type === "frame") metrics.skippedSnapshots++
      if (Date.now() - peer.backpressureSince > 10_000) peer.socket.close(4000, "slow connection")
      if (message.type === "frame" || buffered > MAX_BUFFERED_BYTES) return
    } else peer.backpressureSince = null
    if (message.type === "welcome" || message.type === "roster") {
      message = {
        ...message,
        snapshot: {
          ...message.snapshot,
          players: message.snapshot.players.map((player) => ({
            ...player,
            connected: sessions.forPlayer(player.id)?.peer != null,
          })),
        },
      }
    }
    peer.socket.send(JSON.stringify(message), { compress: message.type === "frame" })
  }
  const broadcast = (room: ActionRoom, message: ActionServerMessage): void => {
    for (const peer of peers) if (peer.room === room) send(peer, message)
  }
  const revokePeer = (peer: Peer): void => {
    const session = peer.session
    if (session !== null && session.peer === peer) {
      sessions.revoke(session)
      session.peer = null
      peer.room.leave(peer.id, Date.now())
    }
    peer.retired = true
  }
  const restore = (peer: Peer, resumed: boolean): void => {
    const session = peer.session
    if (session === null) throw new Error("Missing player session")
    const room = peer.room
    room.lastActivityMs = Date.now()
    room.race?.releaseControls(peer.id)
    send(peer, {
      type: "welcome",
      you: peer.id,
      room: room.state.code,
      seed: room.state.seed,
      snapshot: room.state,
    })
    send(peer, {
      type: "session",
      token: session.token,
      room: room.state.code,
      graceMs: RECONNECT_GRACE_MS,
      resumed,
    })
    if (resumed) {
      send(peer, phaseMessage(room.state, Date.now()))
      const frame = room.frame(Date.now())
      if (frame !== null) send(peer, frame)
      if (room.state.phase === "finished")
        send(peer, {
          type: "results",
          results: buildResults(room.state.players),
          session: room.state.session,
        })
      broadcast(room, rosterMessage(room.state))
    }
  }
  const effects = (room: ActionRoom): void => {
    for (const effect of room.drainEffects()) {
      if (effect.kind === "broadcast") {
        if (effect.message.type === "results") {
          const frame = room.frame(Date.now())
          if (frame !== null) broadcast(room, frame)
        }
        broadcast(room, effect.message)
        if (effect.message.type === "phase") {
          const frame = room.frame(Date.now())
          if (frame !== null) broadcast(room, frame)
        }
        if (effect.message.type === "results")
          logger.info(
            {
              correlationId: room.correlationId,
              roomCode: room.state.code,
              protocol: "socket",
              context: {
                event: "ACTION_RACE_COMPLETED",
                status: "success",
                round: effect.message.session?.round,
              },
            },
            "Race completed",
          )
        if (effect.message.type === "phase")
          logger.info(
            {
              correlationId: room.correlationId,
              roomCode: room.state.code,
              protocol: "socket",
              context: {
                event: "ACTION_PHASE_CHANGED",
                status: "success",
                phase: effect.message.phase,
              },
            },
            "Race phase changed",
          )
      } else if (effect.kind === "send") {
        for (const peer of peers)
          if (peer.room === room && peer.id === effect.to) send(peer, effect.message)
      } else if (effect.kind === "disconnect") {
        for (const peer of peers)
          if (peer.room === room && peer.id === effect.id) {
            revokePeer(peer)
            peer.socket.close(1008, effect.reason)
          }
      }
      // Schedule effects belong to the Worker adapter; the action host owns its fixed-step timer.
    }
  }
  const stopRoom = (room: ActionRoom, reason: string): void => {
    logger.info(
      {
        correlationId: room.correlationId,
        roomCode: room.state.code,
        protocol: "background",
        context: { event: "ACTION_ROOM_STOPPED", status: "success", reason },
      },
      "Room stopped",
    )
    broadcast(room, { type: "error", code: "race_stopped", message: reason })
    sessions.revokeRoom(room)
    for (const peer of peers)
      if (peer.room === room) {
        peer.retired = true
        peer.socket.close(1011, reason)
      }
    rooms.delete(room.state.code)
  }
  const json = (response: ServerResponse, status: number, body: unknown): void => {
    response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" })
    response.end(JSON.stringify(body))
  }
  const originAllowed = (request: IncomingMessage): boolean => {
    const origin = request.headers.origin
    if (origin === undefined) return true // Non-browser QA clients; no platform identity is used in this lab.
    if (options.allowedOrigin !== undefined) return origin === options.allowedOrigin
    try {
      return new URL(origin).host === request.headers.host
    } catch {
      return false
    }
  }
  const handleHttp = async (
    request: IncomingMessage,
    response: ServerResponse,
    correlationId: string,
  ): Promise<void> => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname
    if ((path === "/ready" || path === "/api/ready") && request.method === "GET") {
      const ready = !draining && performance.now() - lastPulse <= MAX_STALL_MS
      json(response, ready ? 200 : 503, { ready, protocol: ACTION_PROTOCOL })
      return
    }
    if ((path === "/health" || path === "/api/health") && request.method === "GET") {
      json(response, 200, {
        ok: true,
        protocol: ACTION_PROTOCOL,
        runtime: "authoritative-node",
        memoryRssBytes: process.memoryUsage().rss,
        cpuUsage: process.cpuUsage(),
        rooms: rooms.size,
        connections: peers.size,
        metrics,
      })
      return
    }
    if (path === "/api/status" && request.method === "GET") {
      json(response, 200, { paused: false, resetsAt: null })
      return
    }
    if (path === "/api/rooms" && request.method === "POST") {
      if (draining) {
        json(response, 503, { error: "Host shutting down" })
        return
      }
      if (!originAllowed(request)) {
        json(response, 403, { error: "origin" })
        return
      }
      if (rooms.size >= maxRooms) {
        json(response, 503, { error: "Room capacity reached" })
        return
      }
      let code: string
      do {
        code = generateRoomCode(() => randomInt(2 ** 32) / 2 ** 32)
      } while (rooms.has(code))
      rooms.set(
        code,
        new ActionRoom(
          asRoomCode(code),
          options.seed ?? randomInt(2 ** 32),
          Date.now(),
          correlationId,
        ),
      )
      logger.info(
        {
          correlationId,
          roomCode: code,
          protocol: "http",
          context: { event: "ACTION_ROOM_CREATED", status: "success" },
        },
        "Room created",
      )
      json(response, 201, { code })
      return
    }
    const staticFiles: Record<string, readonly [string, string]> = {
      "/": ["index.html", "text/html"],
      "/index.html": ["index.html", "text/html"],
      "/assets/main.js": ["assets/main.js", "text/javascript"],
      "/assets/main.js.map": ["assets/main.js.map", "application/json"],
      "/assets/style.css": ["assets/style.css", "text/css"],
    }
    const file = staticFiles[path]
    if (request.method !== "GET" || file === undefined) {
      json(response, 404, { error: "Not found" })
      return
    }
    const bytes = await readFile(resolve(options.staticRoot, file[0]))
    response.writeHead(200, { "content-type": file[1], "cache-control": "no-store" })
    response.end(bytes)
  }
  const server = createServer((request, response) => {
    const correlationId = randomUUID()
    response.setHeader("x-correlation-id", correlationId)
    void handleHttp(request, response, correlationId).catch((err) => {
      logger.error(
        {
          correlationId,
          err,
          protocol: "http",
          context: { event: "ACTION_HTTP_FAILED", status: "failed" },
        },
        "Action request failed",
      )
      if (!response.headersSent) json(response, 500, { error: "Asset unavailable" })
      else response.end()
    })
  })
  server.headersTimeout = 10_000
  server.requestTimeout = 10_000
  server.on("upgrade", (request, socket, head) => {
    const match = /^\/ws\/([A-HJ-NP-Z]{4})$/.exec(request.url ?? "")
    const room = match?.[1] === undefined ? undefined : rooms.get(match[1])
    if (
      draining ||
      !originAllowed(request) ||
      room === undefined ||
      peers.size >= maxRooms * 12 ||
      [...peers].filter((peer) => peer.room === room).length >= NET.maxPlayersPerRoom + 2
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
      return
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      const now = Date.now()
      const peer: Peer = {
        socket: ws,
        id: asPlayerId(randomUUID()),
        room,
        connectedMs: now,
        lastMessageMs: now,
        lastPongMs: now,
        lastPingMs: now,
        lastInputMs: null,
        inputLeadTicks: null,
        inputRaceCurrent: false,
        lastDiagnosticMs: 0,
        lastResyncMs: 0,
        messageBudget: new MessageBudget(performance.now()),
        session: null,
        retired: false,
        backpressureSince: null,
      }
      peers.add(peer)
      send(peer, { type: "authority", protocol: ACTION_PROTOCOL })
      ws.on("error", () => ws.close())
      // Browser networking answers protocol pings even when a background tab's
      // JavaScript timers are throttled. Application silence releases controls;
      // it is not evidence that the underlying connection has died.
      ws.on("pong", () => {
        peer.lastPongMs = Date.now()
      })
      ws.on("message", (data, binary) => {
        if (peer.retired || ws.readyState !== WebSocket.OPEN) return
        if (peer.session !== null && peer.session.peer !== peer) return
        let handlingCommand = false
        let rejectionReason = "invalid_schema"
        try {
          const nowMs = Date.now()
          if (!peer.messageBudget.consume(performance.now())) {
            rejectionReason = "message_rate"
            throw new Error("Message limit")
          }
          if (binary) {
            rejectionReason = "binary_message"
            throw new Error("Binary message")
          }
          const message = decodeActionClientMessage(data.toString())
          peer.lastMessageMs = nowMs
          if (message.type === "input") {
            peer.lastInputMs = nowMs
            peer.inputLeadTicks = Math.max(
              -60_000,
              Math.min(60_000, message.tick - (room.race?.tick ?? 0)),
            )
            peer.inputRaceCurrent = message.raceId === room.race?.raceId
          }
          if (message.type === "resume") {
            if (peer.session !== null) return
            const session = sessions.find(message.token, room, nowMs)
            if (session === null) {
              send(peer, {
                type: "error",
                code: "resume_expired",
                message:
                  "Your reconnect window has ended, or the server restarted. Start a new room.",
              })
              peer.retired = true
              ws.close(4002, "resume expired")
              return
            }
            const previous = session.peer
            // Resuming cannot mint another flood allowance for the same racer.
            if (!session.messageBudget.consume(performance.now())) {
              rejectionReason = "message_rate"
              throw new Error("Message limit")
            }
            peer.messageBudget = session.messageBudget
            peer.id = session.id
            peer.session = session
            session.peer = peer
            session.expiresAtMs = null
            if (previous !== null && previous !== peer) {
              previous.retired = true
              previous.socket.close(4001, "Connected in another tab")
            }
            restore(peer, true)
            logger.info(
              {
                correlationId: room.correlationId,
                roomCode: room.state.code,
                protocol: "socket",
                context: {
                  event: "ACTION_PLAYER_RESUMED",
                  status: "success",
                  connectionId: peer.id,
                  transportCompression: ws.extensions === "permessage-deflate",
                },
              },
              "Player reconnected",
            )
            return
          }
          if (message.type === "ping") {
            send(peer, { type: "pong", nonce: message.nonce, serverNowMs: nowMs })
            if (
              peer.session !== null &&
              message.network !== undefined &&
              nowMs - peer.lastDiagnosticMs >= 5000
            ) {
              peer.lastDiagnosticMs = nowMs
              metrics.clientReports++
              logger.info(
                {
                  correlationId: room.correlationId,
                  roomCode: room.state.code,
                  protocol: "socket",
                  context: {
                    event: "ACTION_CLIENT_NETWORK",
                    status: "observed",
                    connectionId: peer.id,
                    ...message.network,
                    inputAgeMs: peer.lastInputMs === null ? null : nowMs - peer.lastInputMs,
                    inputLeadTicks: peer.inputLeadTicks,
                    inputRaceCurrent: peer.inputRaceCurrent,
                  },
                },
                "Client network/correction report",
              )
            }
            if (peer.session !== null && message.resync && nowMs - peer.lastResyncMs >= 1000) {
              peer.lastResyncMs = nowMs
              metrics.resyncRequests++
              const frame = room.frame(nowMs)
              if (frame !== null) send(peer, frame)
            }
            return
          }
          const joined = room.state.players.some((player) => player.id === peer.id)
          if (!joined && message.type !== "join") {
            rejectionReason = "join_required"
            throw new Error("Join required")
          }
          handlingCommand = true
          room.command(peer.id, message, nowMs)
          if (
            message.type === "join" &&
            !joined &&
            room.state.players.some((player) => player.id === peer.id)
          ) {
            peer.session = sessions.create(peer.id, room, peer, peer.messageBudget)
            restore(peer, false)
            logger.info(
              {
                correlationId: room.correlationId,
                roomCode: room.state.code,
                protocol: "socket",
                context: {
                  event: "ACTION_PLAYER_JOINED",
                  status: "success",
                  connectionId: peer.id,
                  transportCompression: ws.extensions === "permessage-deflate",
                },
              },
              "Player joined",
            )
          }
          if (message.type === "leave") revokePeer(peer)
          effects(room)
          if (message.type === "leave") ws.close(1000, "left")
        } catch (err) {
          if (handlingCommand && !(err instanceof InputSequenceError)) {
            logger.error(
              {
                correlationId: room.correlationId,
                roomCode: room.state.code,
                err,
                protocol: "socket",
                context: { event: "ACTION_COMMAND_FAILED", status: "failed" },
              },
              "Race command failed",
            )
            send(peer, {
              type: "error",
              code: "internal",
              message: "Race command failed. Please rejoin a new room.",
            })
            ws.close(1011, "command failed")
            revokePeer(peer)
            effects(room)
            return
          }
          metrics.rejectedMessages++
          logger.warn(
            {
              correlationId: room.correlationId,
              roomCode: room.state.code,
              protocol: "socket",
              context: {
                event: "ACTION_COMMAND_REJECTED",
                status: "failed",
                connectionId: peer.id,
                reason: err instanceof InputSequenceError ? "sequence_gap" : rejectionReason,
                ...(err instanceof ZodError
                  ? { fields: err.issues.slice(0, 8).map((issue) => issue.path.join(".")) }
                  : {}),
              },
            },
            "Invalid race command rejected",
          )
          send(peer, {
            type: "error",
            code: rejectionReason === "message_rate" ? "rate_limited" : "invalid_command",
            message:
              rejectionReason === "message_rate"
                ? "The connection sent too much traffic. Reload and create a new room."
                : "Unsupported or invalid race command. Reload and create a new room.",
          })
          ws.close(1008, rejectionReason === "message_rate" ? "traffic limit" : "invalid command")
          revokePeer(peer)
          effects(room)
        }
      })
      ws.on("close", (closeCode, closeReason) => {
        peers.delete(peer)
        const session = peer.session
        if (!peer.retired && session !== null && sessions.detach(session, peer, Date.now())) {
          room.race?.releaseControls(peer.id)
          if (room.state.phase === "lobby")
            room.command(peer.id, { type: "ready", ready: false }, Date.now())
          effects(room)
          broadcast(room, rosterMessage(room.state))
        }
        logger.info(
          {
            correlationId: room.correlationId,
            roomCode: room.state.code,
            protocol: "socket",
            context: {
              event: "ACTION_CONNECTION_CLOSED",
              status: "success",
              connectionId: peer.id,
              closeCode,
              closeReason: [
                "left",
                "connection lost",
                "connection backlog",
                "slow connection",
                "connection timed out",
                "Connected in another tab",
                "resume expired",
                "traffic limit",
                "invalid command",
                "invalid server protocol",
              ].includes(closeReason.toString())
                ? closeReason.toString()
                : "other",
              lastMessageAgeMs: Math.max(0, Date.now() - peer.lastMessageMs),
              bufferedBytes: ws.bufferedAmount,
              lastPongAgeMs: Math.max(0, Date.now() - peer.lastPongMs),
            },
          },
          "Connection closed",
        )
      })
    })
  })

  const timer = setInterval(() => {
    const monoMs = performance.now()
    const elapsed = monoMs - lastPulse
    lastPulse = monoMs
    metrics.maxPulseMs = Math.max(metrics.maxPulseMs, elapsed)
    if (elapsed > MAX_STALL_MS) {
      metrics.overloadStops++
      for (const room of rooms.values())
        if (room.state.phase === "racing" || room.state.phase === "countdown")
          stopRoom(room, "Race stopped after a server stall. Please start a new room.")
      accumulatedMs = 0
    } else accumulatedMs += elapsed
    let steps = 0
    while (accumulatedMs >= FIXED_STEP_SEC * 1000 && steps < MAX_CATCHUP_STEPS) {
      accumulatedMs -= FIXED_STEP_SEC * 1000
      steps++
      metrics.ticks++
      for (const room of rooms.values()) {
        try {
          room.step(Date.now())
          effects(room)
        } catch (error) {
          logger.error(
            {
              correlationId: room.correlationId,
              roomCode: room.state.code,
              err: error,
              protocol: "background",
              context: { event: "ACTION_SIMULATION_FAILED", status: "failed" },
            },
            "Race simulation failed",
          )
          stopRoom(room, "Race simulation stopped. Please start a new room.")
        }
      }
    }
    if (monoMs >= nextBroadcastMs) {
      nextBroadcastMs = monoMs + 50
      const nowMs = Date.now()
      for (const room of rooms.values()) {
        // Final frames are sent with results and on resume/resync. Repeating an
        // unchanged finished race at 20 Hz wastes bandwidth on every idle tab.
        const frame =
          room.state.phase === "countdown" || room.state.phase === "racing"
            ? room.frame(nowMs)
            : null
        if (frame !== null) broadcast(room, frame)
        const ttl = room.state.players.length === 0 ? EMPTY_ROOM_TTL_MS : ROOM_TTL_MS
        if (nowMs - room.lastActivityMs > ttl) stopRoom(room, "Room expired")
      }
      for (const peer of peers) {
        const joined = peer.room.state.players.some((player) => player.id === peer.id)
        if ((!joined && nowMs - peer.connectedMs > 5000) || nowMs - peer.lastPongMs > 30_000)
          peer.socket.close(4000, "connection timed out")
        else if (
          joined &&
          peer.socket.readyState === WebSocket.OPEN &&
          nowMs - peer.lastPingMs >= 10_000
        ) {
          peer.lastPingMs = nowMs
          peer.socket.ping()
        }
      }
      for (const session of sessions.expired(nowMs)) {
        sessions.revoke(session)
        session.room.leave(session.id, nowMs)
        effects(session.room)
        logger.info(
          {
            correlationId: session.room.correlationId,
            roomCode: session.room.state.code,
            protocol: "background",
            context: {
              event: "ACTION_RECONNECT_EXPIRED",
              status: "success",
              connectionId: session.id,
            },
          },
          "Reconnect reservation expired",
        )
      }
    }
  }, 8)

  return {
    server,
    rooms,
    metrics,
    sessions,
    close: async (): Promise<void> => {
      draining = true
      clearInterval(timer)
      const closed = new Promise<void>((resolveClose) => server.close(() => resolveClose()))
      for (const peer of peers) peer.socket.terminate()
      await new Promise<void>((resolveClose) => wss.close(() => resolveClose()))
      await closed
    },
  }
}
