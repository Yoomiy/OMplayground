/** Transport callbacks for the authenticated app session. */
import type {
  ActionClientMessage,
  ActionServerMessage,
  AuthorityFrame,
} from "../shared/action-protocol"
import type { RaceResult, RoomPhase, RoomSnapshot } from "../shared/room"
import type { RoomSession } from "../shared/session"
import type { PlayerId } from "../shared/types"
import { assertNever } from "../shared/types"

export type SessionEvents = {
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
export interface SessionTransport {
  readonly active: boolean
  send(message: ActionClientMessage): void
  close(): void
}

export function dispatchSessionMessage(events: SessionEvents, message: ActionServerMessage): void {
  switch (message.type) {
    case "authority":
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
    case "results":
      events.onResults(message.results, message.session)
      break
    case "error":
      events.onFailure(message.message)
      break
    default:
      assertNever(message, "dispatchSessionMessage")
  }
}
