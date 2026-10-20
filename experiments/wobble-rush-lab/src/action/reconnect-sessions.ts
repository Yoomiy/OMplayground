import { randomBytes } from "node:crypto"
import { RECONNECT_GRACE_MS } from "../shared/action-protocol"
import type { PlayerId } from "../shared/types"
import type { MessageBudget } from "./message-budget"
import type { ActionRoom } from "./room"

export type PlayerSession<Peer> = {
  readonly token: string
  readonly id: PlayerId
  readonly room: ActionRoom
  readonly messageBudget: MessageBudget
  peer: Peer | null
  expiresAtMs: number | null
}

/** Process-local bearer tickets; never put tokens in URLs, telemetry or logs. */
export class ReconnectSessions<Peer> {
  private readonly tokens = new Map<string, PlayerSession<Peer>>()
  private readonly players = new Map<PlayerId, PlayerSession<Peer>>()

  create(
    id: PlayerId,
    room: ActionRoom,
    peer: Peer,
    messageBudget: MessageBudget,
  ): PlayerSession<Peer> {
    const session = {
      token: randomBytes(32).toString("base64url"),
      id,
      room,
      messageBudget,
      peer,
      expiresAtMs: null,
    }
    this.tokens.set(session.token, session)
    this.players.set(id, session)
    return session
  }

  forPlayer(id: PlayerId): PlayerSession<Peer> | undefined {
    return this.players.get(id)
  }

  find(token: string, room: ActionRoom, nowMs: number): PlayerSession<Peer> | null {
    const session = this.tokens.get(token)
    if (
      session === undefined ||
      session.room !== room ||
      (session.expiresAtMs !== null && nowMs >= session.expiresAtMs) ||
      !room.state.players.some((player) => player.id === session.id)
    )
      return null
    return session
  }

  detach(session: PlayerSession<Peer>, peer: Peer, nowMs: number): boolean {
    if (session.peer !== peer) return false
    session.peer = null
    session.expiresAtMs = nowMs + RECONNECT_GRACE_MS
    return true
  }

  revoke(session: PlayerSession<Peer>): void {
    this.tokens.delete(session.token)
    this.players.delete(session.id)
  }

  expired(nowMs: number): PlayerSession<Peer>[] {
    return [...this.tokens.values()].filter(
      (session) => session.expiresAtMs !== null && nowMs >= session.expiresAtMs,
    )
  }

  revokeRoom(room: ActionRoom): void {
    for (const session of this.tokens.values()) if (session.room === room) this.revoke(session)
  }
}
