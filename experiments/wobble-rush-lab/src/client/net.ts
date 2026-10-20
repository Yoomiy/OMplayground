/**
 * WebSocket client for party mode. Owns exactly one socket, surfaces every failure
 * to the caller (no silent reconnect loops that hide a dead server).
 */

import {
  type ActionClientMessage,
  type ActionInput,
  type ActionServerMessage,
  decodeActionServerMessage,
} from "../shared/action-protocol"
import type { PlatformCommand } from "../shared/platform-protocol"

export class NetworkError extends Error {
  readonly detail: string
  constructor(detail: string) {
    super(`Multiplayer connection failed: ${detail}`)
    this.name = "NetworkError"
    this.detail = detail
  }
}

export type NetHandlers = {
  onMessage(message: ActionServerMessage): void
  onClose(reason: string, code: number): void
}

export class NetClient {
  private socket: WebSocket | null = null
  private cleanup: (() => void) | null = null
  private readonly handlers: NetHandlers
  private pendingInput: ActionInput | null = null
  private backpressureMs: number | null = null
  private reportBackpressure = false
  private lastControl: ActionInput | null = null
  private lastControlMs = -Infinity

  constructor(
    handlers: NetHandlers,
    private readonly now: () => number = () => performance.now(),
    private readonly platform?: { path: string; receive(value: unknown): boolean },
  ) {
    this.handlers = handlers
  }

  static socketUrl(code: string): string {
    const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${globalThis.location.host}/ws/${code}`
  }

  /** Resolves once the socket is open; rejects with NetworkError otherwise. */
  connect(code: string, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      let confirmed = false
      let watchdog: ReturnType<typeof globalThis.setInterval> | null = null
      let lastMessageMs = this.now()
      const stopWatchdog = () => {
        if (watchdog !== null) globalThis.clearInterval(watchdog)
        watchdog = null
      }
      const timeout = globalThis.setTimeout(() => {
        this.close()
        reject(new NetworkError("שרת המרוץ לא הגיב."))
      }, timeoutMs)
      let socket: WebSocket
      try {
        socket = new WebSocket(
          this.platform === undefined
            ? NetClient.socketUrl(code)
            : new URL(this.platform.path, globalThis.location.href).href.replace(/^http/, "ws"),
        )
      } catch (error) {
        globalThis.clearTimeout(timeout)
        reject(new NetworkError(error instanceof Error ? error.message : String(error)))
        return
      }
      this.socket = socket
      this.cleanup = () => {
        globalThis.clearTimeout(timeout)
        stopWatchdog()
        reject(new NetworkError("החיבור נסגר"))
      }

      socket.addEventListener("error", () => {
        if (this.socket !== socket) return
        globalThis.clearTimeout(timeout)
        const failure = new NetworkError(`לא ניתן להתחבר לחדר ${code}`)
        reject(failure)
      })
      socket.addEventListener("close", (event) => {
        stopWatchdog()
        if (this.socket !== socket) return
        globalThis.clearTimeout(timeout)
        this.cleanup?.()
        this.cleanup = null
        this.socket = null
        if (!confirmed) reject(new NetworkError("לא ניתן להתחבר לשרת המרוץ."))
        this.handlers.onClose(event.reason === "" ? "connection closed" : event.reason, event.code)
      })
      socket.addEventListener("message", (event) => {
        if (this.socket !== socket) return
        const data: unknown = event.data
        if (typeof data !== "string") return
        let message: ActionServerMessage
        try {
          if (confirmed && this.platform?.receive(JSON.parse(data))) {
            lastMessageMs = this.now()
            return
          }
          message = decodeActionServerMessage(data)
          if (!confirmed && message.type !== "authority")
            throw new NetworkError("יש לטעון מחדש את המשחק כדי להתחבר לשרת.")
        } catch (error) {
          globalThis.clearTimeout(timeout)
          socket.close(1008, "invalid server protocol")
          reject(error)
          return
        }
        lastMessageMs = this.now()
        if (!confirmed) {
          confirmed = true
          let lastCheckMs = this.now()
          watchdog = globalThis.setInterval(() => {
            if (this.socket !== socket) {
              stopWatchdog()
              return
            }
            const nowMs = this.now()
            const suspended = nowMs - lastCheckMs > 2000
            lastCheckMs = nowMs
            // Give queued message events a turn after a blocked renderer or
            // backgrounded tab; a delayed timer alone does not prove a loss.
            if (suspended || nowMs - lastMessageMs <= 5000) return
            stopWatchdog()
            this.cleanup = null
            this.socket = null
            socket.close(4000, "connection lost")
            this.handlers.onClose("connection lost", 4000)
          }, 1000)
          globalThis.clearTimeout(timeout)
          resolve()
        }
        this.handlers.onMessage(message)
      })
    })
  }

  send(message: ActionClientMessage): void {
    const socket = this.socket
    if (socket === null || socket.readyState !== WebSocket.OPEN) return
    if (message.type === "input" && this.pendingInput !== null) {
      const held = this.pendingInput.raceId === message.raceId ? this.pendingInput : null
      message = {
        ...message,
        respawn: message.respawn || (held?.respawn ?? false),
        input: {
          ...message.input,
          jumpPressed: message.input.jumpPressed || (held?.input.jumpPressed ?? false),
          divePressed: message.input.divePressed || (held?.input.divePressed ?? false),
        },
      }
      this.pendingInput = null
    }
    if (socket.bufferedAmount > 64 * 1024) {
      this.backpressureMs ??= this.now()
      this.reportBackpressure = true
      if (message.type === "input") this.pendingInput = message
      // Give TCP a bounded opportunity to drain. Keep one control sample, never
      // enqueue seconds of obsolete movement or reconnect on a brief backlog.
      if (this.now() - this.backpressureMs > 10_000) socket.close(4000, "connection backlog")
      return
    }
    this.backpressureMs = null
    if (this.reportBackpressure && message.type === "ping") {
      message = {
        ...message,
        network: {
          pendingInputs: 0,
          frameAgeMs: 0,
          correctionM: 0,
          maxFrameMs: 0,
          rttMs: 0,
          ...message.network,
          reason: "send_backpressure",
        },
      }
      this.reportBackpressure = false
    }
    if (this.pendingInput !== null) {
      socket.send(JSON.stringify(this.pendingInput))
      this.pendingInput = null
    }
    if (message.type === "input") {
      const previous = this.lastControl
      const changed =
        previous === null ||
        previous.raceId !== message.raceId ||
        message.respawn ||
        message.input.jumpPressed ||
        message.input.divePressed ||
        message.input.forward !== previous.input.forward ||
        message.input.strafe !== previous.input.strafe ||
        message.input.jumpHeld !== previous.input.jumpHeld ||
        message.input.cameraYaw !== previous.input.cameraYaw
      // Held controls are deterministic. Send changes immediately and refresh
      // at 10 Hz; there is no benefit to 60 identical TCP writes per second.
      if (!changed && this.now() - this.lastControlMs < 100) return
      this.lastControl = message
      this.lastControlMs = this.now()
    }
    socket.send(JSON.stringify(message))
  }

  sendPlatform(message: PlatformCommand): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  close(): void {
    this.lastControl = null
    this.lastControlMs = -Infinity
    this.pendingInput = null
    this.backpressureMs = null
    this.cleanup?.()
    this.cleanup = null
    const socket = this.socket
    this.socket = null
    if (
      socket !== null &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close(1000, "left")
    }
  }
}

/** Human-readable notice while the budget breaker has multiplayer paused. */
export function pauseMessage(resetsAtIso: string | null): string {
  const day =
    resetsAtIso !== null && !Number.isNaN(Date.parse(resetsAtIso))
      ? resetsAtIso.slice(0, 10)
      : "בחודש הבא"
  return `המשחק ברשת הושהה עד ${day}. המשחק לבד עדיין זמין!`
}

export type ServiceStatus = { readonly paused: boolean; readonly resetsAt: string | null }

const SERVICE_STATUS_OPEN: ServiceStatus = { paused: false, resetsAt: null }

/**
 * Reads GET /api/status. Fails open on any error — a status endpoint we cannot
 * reach must never block play on its own.
 */
export async function fetchServiceStatus(fetcher: typeof fetch): Promise<ServiceStatus> {
  try {
    const response = await fetcher("/api/status")
    if (!response.ok) return SERVICE_STATUS_OPEN
    const payload: unknown = await response.json()
    if (typeof payload !== "object" || payload === null) return SERVICE_STATUS_OPEN
    if (!("paused" in payload) || typeof payload.paused !== "boolean") return SERVICE_STATUS_OPEN
    if (!("resetsAt" in payload)) return SERVICE_STATUS_OPEN
    const resetsAt: unknown = payload.resetsAt
    if (resetsAt !== null && typeof resetsAt !== "string") return SERVICE_STATUS_OPEN
    return { paused: payload.paused, resetsAt }
  } catch {
    return SERVICE_STATUS_OPEN
  }
}

/** Asks the server for a fresh room code. */
export async function createRoom(fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher("/api/rooms", { method: "POST" })
  if (!response.ok) {
    let pauseDetail: string | null = null
    try {
      const payload: unknown = await response.json()
      if (typeof payload === "object" && payload !== null && "error" in payload) {
        const body: unknown = payload.error
        if (
          typeof body === "object" &&
          body !== null &&
          "code" in body &&
          body.code === "service_paused"
        ) {
          const resetsAt: unknown = "resetsAt" in body ? body.resetsAt : null
          pauseDetail = pauseMessage(typeof resetsAt === "string" ? resetsAt : null)
        }
      }
    } catch {
      // Unreadable body — fall through to the generic HTTP error.
    }
    throw new NetworkError(pauseDetail ?? `לא ניתן ליצור חדר (HTTP ${response.status})`)
  }
  const payload: unknown = await response.json()
  if (typeof payload !== "object" || payload === null || !("code" in payload)) {
    throw new NetworkError("room creation returned an unexpected payload")
  }
  const code = payload.code
  if (typeof code !== "string") throw new NetworkError("room creation returned a non-string code")
  return code
}
