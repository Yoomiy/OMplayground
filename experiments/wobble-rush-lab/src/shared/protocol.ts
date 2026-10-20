/**
 * Multiplayer wire protocol for Wobble Rush 3D.
 *
 * Every frame on the WebSocket is a single JSON text message validated with
 * Zod at the boundary. Decoding either direction throws a {@link ProtocolError}
 * carrying human-readable issues; encoding is a plain JSON stringify because
 * outbound messages are already typed.
 */

import { z } from "zod"
import type { RaceResult, RemoteRunnerState, RoomPhase, RoomSnapshot } from "./room"
import { ROOM_PHASES } from "./room"
import type { RaceSelection, RoomSession } from "./session"
import type { PlayerId, RoomCode, RunnerState } from "./types"
import { asPlayerId, asRoomCode, RUNNER_STATES } from "./types"

export const PROTOCOL_VERSION = 1 as const

export class ProtocolError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Protocol error: ${issues.join("; ")}`)
    this.name = "ProtocolError"
    this.issues = issues
  }
}

/* ------------------------------------------------------------------ *
 * Message types — the contract both sides compile against.
 * ------------------------------------------------------------------ */

export type ClientMessage =
  | {
      readonly type: "join"
      readonly name: string
      readonly mode: "solo" | "party"
      readonly colorIndex: number
      readonly contentVersion?: string | undefined
    }
  | { readonly type: "ready"; readonly ready: boolean }
  | ({ readonly type: "configure" } & RaceSelection)
  | {
      readonly type: "state"
      readonly p: readonly [number, number, number]
      readonly v: readonly [number, number, number]
      readonly yaw: number
      readonly st: RunnerState
      readonly cp: number
    }
  | { readonly type: "finish"; readonly timeMs: number }
  | { readonly type: "restart" }
  | { readonly type: "leave" }

export type ServerMessage =
  | {
      readonly type: "welcome"
      readonly you: PlayerId
      readonly room: RoomCode
      readonly seed: number
      readonly snapshot: RoomSnapshot
    }
  | { readonly type: "roster"; readonly snapshot: RoomSnapshot }
  | {
      readonly type: "phase"
      readonly phase: RoomPhase
      readonly serverNowMs: number
      readonly phaseEndsAtMs: number | null
      readonly seed: number
      readonly session?: RoomSession | undefined
    }
  | {
      readonly type: "states"
      readonly serverNowMs: number
      readonly players: readonly RemoteRunnerState[]
    }
  | {
      readonly type: "results"
      readonly results: readonly RaceResult[]
      readonly session?: RoomSession | undefined
    }
  | { readonly type: "error"; readonly code: string; readonly message: string }

/* ------------------------------------------------------------------ *
 * Zod schemas. `z.number()` in Zod 4 rejects NaN and ±Infinity, which is
 * exactly the finiteness guarantee the simulation needs.
 * ------------------------------------------------------------------ */

const vec3TupleSchema = z.tuple([z.number(), z.number(), z.number()])

const playerIdSchema = z.string().min(1).transform(asPlayerId)
const roomCodeSchema = z.string().min(1).transform(asRoomCode)
const runnerStateSchema = z.enum(RUNNER_STATES)
const roomPhaseSchema = z.enum(ROOM_PHASES)

const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    name: z.string(),
    mode: z.enum(["solo", "party"]),
    colorIndex: z.number(),
    contentVersion: z.string().optional(),
  }),
  z.object({ type: z.literal("ready"), ready: z.boolean() }),
  z.object({
    type: z.literal("configure"),
    courseId: z.string().min(1).max(64),
    mode: z.enum(["race", "cup"]),
    remix: z.boolean(),
  }),
  z.object({
    type: z.literal("state"),
    p: vec3TupleSchema,
    v: vec3TupleSchema,
    yaw: z.number(),
    st: runnerStateSchema,
    cp: z.number(),
  }),
  z.object({ type: z.literal("finish"), timeMs: z.number() }),
  z.object({ type: z.literal("restart") }),
  z.object({ type: z.literal("leave") }),
])

const remoteRunnerStateSchema = z.object({
  id: playerIdSchema,
  p: vec3TupleSchema,
  v: vec3TupleSchema,
  yaw: z.number(),
  st: runnerStateSchema,
  cp: z.number(),
})

const roomPlayerSchema = z.object({
  connected: z.boolean().optional(),
  id: playerIdSchema,
  name: z.string(),
  colorIndex: z.number(),
  ready: z.boolean(),
  finishedMs: z.number().nullable(),
  lastSeenMs: z.number(),
  state: remoteRunnerStateSchema.nullable(),
})

const sessionSchema = z.object({
  contentVersion: z.string(),
  courseId: z.string(),
  mode: z.enum(["race", "cup"]),
  remix: z.boolean(),
  round: z.number().int().min(0).max(2),
  playlist: z.array(z.string()).min(1).max(3),
  complete: z.boolean(),
  startsAtMs: z.number().nullable(),
  standings: z.array(
    z.object({
      id: playerIdSchema,
      name: z.string(),
      points: z.number(),
      finishes: z.number(),
      totalMs: z.number(),
    }),
  ),
})

const roomSnapshotSchema = z.object({
  session: sessionSchema.optional(),
  code: roomCodeSchema,
  phase: roomPhaseSchema,
  seed: z.number(),
  players: z.array(roomPlayerSchema),
  phaseEndsAtMs: z.number().nullable(),
})

const raceResultSchema = z.object({
  id: playerIdSchema,
  name: z.string(),
  timeMs: z.number().nullable(),
  place: z.number(),
})

const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("welcome"),
    you: playerIdSchema,
    room: roomCodeSchema,
    seed: z.number(),
    snapshot: roomSnapshotSchema,
  }),
  z.object({ type: z.literal("roster"), snapshot: roomSnapshotSchema }),
  z.object({
    type: z.literal("phase"),
    phase: roomPhaseSchema,
    serverNowMs: z.number(),
    phaseEndsAtMs: z.number().nullable(),
    seed: z.number(),
    session: sessionSchema.optional(),
  }),
  z.object({
    type: z.literal("states"),
    serverNowMs: z.number(),
    players: z.array(remoteRunnerStateSchema),
  }),
  z.object({
    type: z.literal("results"),
    results: z.array(raceResultSchema),
    session: sessionSchema.optional(),
  }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
])

/* ------------------------------------------------------------------ *
 * Encode / decode.
 * ------------------------------------------------------------------ */

function toText(raw: string | ArrayBuffer): string {
  return typeof raw === "string" ? raw : new TextDecoder().decode(raw)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new ProtocolError([`invalid JSON: ${e.message}`])
    }
    throw e
  }
}

export function decodeClientMessage(raw: string | ArrayBuffer): ClientMessage {
  const result = clientMessageSchema.safeParse(parseJson(toText(raw)))
  if (!result.success) {
    throw new ProtocolError(
      result.error.issues.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`),
    )
  }
  return result.data
}

export function encodeClientMessage(msg: ClientMessage): string {
  return JSON.stringify(msg)
}

export function decodeServerMessage(raw: string | ArrayBuffer): ServerMessage {
  const result = serverMessageSchema.safeParse(parseJson(toText(raw)))
  if (!result.success) {
    throw new ProtocolError(
      result.error.issues.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`),
    )
  }
  return result.data
}

export function encodeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg)
}
