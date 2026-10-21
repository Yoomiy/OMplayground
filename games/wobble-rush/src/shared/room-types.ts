/**
 * Room state machine types: snapshot shapes, player records, actions the host
 * can apply and effects the host must perform.
 */

import type { ServerMessage } from "./protocol"
import type { RaceSelection, RoomSession } from "./session"
import type { PlayerId, RoomCode } from "./types"

export const ROOM_PHASES = ["lobby", "countdown", "racing", "finished"] as const
export type RoomPhase = (typeof ROOM_PHASES)[number]

export type RoomPlayer = {
  /** Connected membership for the authenticated native service. */
  readonly connected?: boolean | undefined
  readonly id: PlayerId
  readonly name: string
  readonly colorIndex: number
  readonly ready: boolean
  readonly finishedMs: number | null
  readonly lastSeenMs: number
  readonly state: null
}

export type RoomSnapshot = {
  readonly session?: RoomSession | undefined
  readonly code: RoomCode
  readonly phase: RoomPhase
  readonly seed: number
  readonly players: readonly RoomPlayer[]
  readonly phaseEndsAtMs: number | null
}

export type RaceResult = {
  readonly id: PlayerId
  readonly name: string
  readonly timeMs: number | null
  readonly place: number
}

export type RoomAction =
  | ({ readonly kind: "configure"; readonly id: PlayerId } & RaceSelection)
  | {
      readonly kind: "join"
      readonly id: PlayerId
      readonly name: string
      readonly colorIndex: number
    }
  | { readonly kind: "leave"; readonly id: PlayerId }
  | { readonly kind: "ready"; readonly id: PlayerId; readonly ready: boolean }
  | { readonly kind: "finish"; readonly id: PlayerId; readonly timeMs: number }
  | { readonly kind: "restart"; readonly id: PlayerId }
  | { readonly kind: "tick" }

export type RoomEffect =
  | { readonly kind: "broadcast"; readonly message: ServerMessage }
  | { readonly kind: "send"; readonly to: PlayerId; readonly message: ServerMessage }
  | { readonly kind: "disconnect"; readonly id: PlayerId; readonly reason: string }
  | { readonly kind: "schedule"; readonly atMs: number }

export type RoomState = RoomSnapshot

export type Reduction = { readonly state: RoomState; readonly effects: readonly RoomEffect[] }
