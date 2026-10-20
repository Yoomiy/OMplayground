/**
 * Party mode transport: owns the socket, decodes server messages and hands them to
 * the game as typed callbacks. Every failure surfaces — nothing reconnects silently.
 */

import {
  ACTION_CONTENT,
  ACTION_PROTOCOL,
  type ActionClientMessage,
  type ActionServerMessage,
  type AuthorityFrame,
} from "../shared/action-protocol"
import type { ClientMessage } from "../shared/protocol"
import type { RaceResult, RoomPhase, RoomSnapshot } from "../shared/room"
import type { RoomSession } from "../shared/session"
import type { PlayerId } from "../shared/types"
import { assertNever } from "../shared/types"
import { createRoom, fetchServiceStatus, NetClient, NetworkError, pauseMessage } from "./net"
import { type ResumeTicket, readResumeTicket, saveResumeTicket } from "./resume-ticket"

/**
 * Renders an in-band error frame for the UI: a service_paused notice is already
 * player-facing copy and passes through verbatim; anything else gets its code
 * prefixed so the failure stays diagnosable.
 */
export function partyFailureText(code: string, message: string): string {
  const explanations: Readonly<Record<string, string>> = {
    invalid_command: "התקבלה פעולה לא תקינה",
    rate_limited: "נשלחו יותר מדי פעולות",
    resume_expired: "הזמן להתחברות מחדש עבר. יש לפתוח חדר חדש",
    race_stopped: "המרוץ נעצר בשרת. יש לפתוח חדר חדש",
    internal: "אירעה תקלה בשרת",
    room_full: "החדר מלא",
    race_in_progress: "המרוץ כבר התחיל",
    incompatible_client: "יש לטעון מחדש את המשחק בכל הדפדפנים",
  }
  return code === "service_paused"
    ? message
    : `${explanations[code] ?? "לא ניתן להשלים את הפעולה"} (${code})`
}

export type PartyEvents = {
  onConnection(reconnecting: boolean, rttMs?: number): void
  onWelcome(you: PlayerId, snapshot: RoomSnapshot, seed: number): void
  onRoster(snapshot: RoomSnapshot): void
  onPhase(
    phase: RoomPhase,
    phaseEndsAtMs: number | null,
    serverNowMs: number,
    session?: RoomSession,
  ): void
  onResults(results: readonly RaceResult[], session?: RoomSession): void
  onFailure(message: string): void
  onFrame(frame: AuthorityFrame): void
  onPong(nonce: number, serverNowMs: number): void
}

export type PartyTransport = Pick<
  PartyLink,
  "active" | "hasSavedSession" | "join" | "resumeSaved" | "send" | "leave" | "close"
>

export class PartyLink {
  private client: NetClient | null = null
  private generation = 0
  private retryTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  private ticket: ResumeTicket | null = null
  private recovering = false
  private deadlineMs = 0
  private abortOpen: (() => void) | null = null

  constructor(private readonly events: PartyEvents) {}

  get active(): boolean {
    return this.client !== null || this.recovering
  }
  get hasSavedSession(): boolean {
    return readResumeTicket() !== null
  }

  async join(code: string | null, join: Extract<ClientMessage, { type: "join" }>): Promise<void> {
    this.leave()
    const generation = this.generation
    try {
      const status = await fetchServiceStatus(fetch)
      if (generation !== this.generation) return
      if (status.paused) {
        this.fail(pauseMessage(status.resetsAt))
        return
      }
      const roomCode = code ?? (await createRoom())
      if (generation !== this.generation) return
      await this.open(
        roomCode,
        { ...join, mode: "party", contentVersion: ACTION_CONTENT, protocol: ACTION_PROTOCOL },
        generation,
      )
    } catch (error) {
      if (generation === this.generation)
        this.fail(error instanceof Error ? error.message : "לא ניתן להצטרף למרוץ.")
    }
  }

  resumeSaved(): void {
    const ticket = readResumeTicket()
    if (ticket === null) return
    this.close()
    this.ticket = ticket
    this.beginRecovery()
  }

  send(message: ActionClientMessage): void {
    if (!this.recovering) this.client?.send(message)
  }

  leave(): void {
    if (!this.recovering) this.client?.send({ type: "leave" })
    this.ticket = null
    saveResumeTicket(null)
    this.close()
    this.events.onConnection(false)
  }

  /** Page disposal preserves the per-tab ticket for a refresh. */
  close(): void {
    this.generation++
    this.abortOpen?.()
    this.abortOpen = null
    if (this.retryTimer !== null) globalThis.clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.recovering = false
    this.client?.close()
    this.client = null
  }

  private fail(message: string): void {
    this.close()
    this.ticket = null
    saveResumeTicket(null)
    this.events.onConnection(false)
    this.events.onFailure(message)
  }

  private beginRecovery(): void {
    if (this.ticket === null) {
      this.fail("החיבור נותק. יש לפתוח חדר חדש.")
      return
    }
    if (!this.recovering) {
      this.recovering = true
      this.deadlineMs = performance.now() + this.ticket.graceMs
      this.events.onConnection(true)
    }
    const generation = this.generation
    const attempt = async () => {
      this.retryTimer = null
      const ticket = this.ticket
      if (generation !== this.generation || !this.recovering || ticket === null) return
      if (performance.now() >= this.deadlineMs) {
        this.fail("לא ניתן להתחבר מחדש בתוך 30 שניות. יש לפתוח חדר חדש.")
        return
      }
      try {
        await this.open(
          ticket.room,
          {
            type: "resume",
            token: ticket.token,
            protocol: ACTION_PROTOCOL,
            contentVersion: ACTION_CONTENT,
          },
          generation,
        )
      } catch {
        if (generation !== this.generation || !this.recovering) return
        const remaining = this.deadlineMs - performance.now()
        if (remaining <= 0) {
          this.fail("לא ניתן להתחבר מחדש בתוך 30 שניות. יש לפתוח חדר חדש.")
          return
        }
        this.retryTimer = globalThis.setTimeout(attempt, Math.min(1000, remaining))
      }
    }
    if (this.retryTimer === null) this.retryTimer = globalThis.setTimeout(attempt, 250)
  }

  private async open(
    code: string,
    command: ActionClientMessage,
    generation: number,
  ): Promise<void> {
    const timeoutMs = this.recovering
      ? Math.max(1, Math.min(5000, this.deadlineMs - performance.now()))
      : 5000
    let authenticated = false
    let admissionSentMs = 0
    let confirm = () => {}
    let refuse: (error: Error) => void = () => {}
    const accepted = new Promise<void>((resolve, reject) => {
      confirm = resolve
      refuse = reject
    })
    const abort = () => refuse(new NetworkError("Connection cancelled"))
    this.abortOpen = abort
    // Attach a handler immediately: a socket can close before connect() settles.
    void accepted.catch(() => {})
    const timeout = globalThis.setTimeout(
      () => refuse(new NetworkError("Race host did not admit this connection.")),
      timeoutMs,
    )
    const client = new NetClient({
      onMessage: (message) => {
        if (generation !== this.generation || this.client !== client) return
        if (message.type === "error") {
          const text = partyFailureText(message.code, message.message)
          refuse(new NetworkError(text))
          this.fail(text)
          return
        }
        if (message.type === "session") {
          authenticated = true
          this.ticket = {
            protocol: ACTION_PROTOCOL,
            content: ACTION_CONTENT,
            token: message.token,
            room: message.room,
            graceMs: message.graceMs,
          }
          saveResumeTicket(this.ticket)
          this.recovering = false
          this.events.onConnection(false, performance.now() - admissionSentMs)
          confirm()
          return
        }
        dispatchPartyMessage(this.events, message)
      },
      onClose: (reason, code) => {
        if (generation !== this.generation || this.client !== client) return
        this.client = null
        refuse(new NetworkError(reason))
        if (code === 4001) {
          this.fail("המשחק מחובר כעת בלשונית אחרת.")
        } else if (code === 1008 || code === 4002) {
          this.fail(`החיבור הסתיים: ${reason}. יש לפתוח חדר חדש.`)
        } else if (authenticated) this.beginRecovery()
      },
    })
    this.client = client
    try {
      await client.connect(code, timeoutMs)
      if (generation !== this.generation || this.client !== client) return
      admissionSentMs = performance.now()
      client.send(command)
      await accepted
    } catch (error) {
      if (this.client === client) {
        this.client = null
        client.close()
      }
      throw error
    } finally {
      globalThis.clearTimeout(timeout)
      if (this.abortOpen === abort) this.abortOpen = null
    }
  }
}

export function dispatchPartyMessage(events: PartyEvents, message: ActionServerMessage): void {
  switch (message.type) {
    case "authority":
    case "session":
      break
    case "frame":
      events.onFrame(message)
      break
    case "pong":
      events.onPong(message.nonce, message.serverNowMs)
      break
    case "welcome":
      events.onWelcome(message.you, message.snapshot, message.seed)
      break
    case "roster":
      events.onRoster(message.snapshot)
      break
    case "phase":
      events.onPhase(message.phase, message.phaseEndsAtMs, message.serverNowMs, message.session)
      break
    case "states":
      throw new NetworkError("Legacy movement snapshots are unsupported by this build.")
    case "results":
      events.onResults(message.results, message.session)
      break
    case "error":
      events.onFailure(partyFailureText(message.code, message.message))
      break
    default:
      assertNever(message, "PartyLink.dispatch")
  }
}
