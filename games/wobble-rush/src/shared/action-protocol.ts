/** Versioned authoritative protocol. Clients can send controls, never transforms or results. */
import { z } from "zod"
import { NET } from "./constants"
import { COURSE_PACK_VERSION } from "./course-catalog"
import type { NpcRacer } from "./npc"
import { decodeServerMessage, ProtocolError, type ServerMessage } from "./protocol"
import { ROOM_PHASES } from "./room-types"
import { asCheckpointIndex, asPlayerId, RUNNER_STATES } from "./types"

export const ACTION_PROTOCOL = 7 as const
export const ACTION_CONTENT = COURSE_PACK_VERSION
export const MAX_CLIENT_BYTES = 4096
export const MAX_SEQUENCE_GAP = 4096
export const INPUT_HOLD_TICKS = 15
// One second bounds the server queue and prevents client-selected extra physics.
export const MAX_FUTURE_INPUT_TICKS = 60
export const RECONNECT_GRACE_MS = 30_000

export const playerInputSchema = z.strictObject({
  forward: z.number().min(-1).max(1),
  strafe: z.number().min(-1).max(1),
  jumpHeld: z.boolean(),
  jumpPressed: z.boolean(),
  divePressed: z.boolean(),
  cameraYaw: z.number().min(-Math.PI).max(Math.PI),
})

const inputSchema = z.strictObject({
  type: z.literal("input"),
  raceId: z.string().min(1).max(64),
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  tick: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  input: playerInputSchema,
  respawn: z.boolean(),
})
const clientSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("ping"),
    nonce: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    resync: z.boolean().optional(),
    network: z
      .strictObject({
        reason: z.enum(["ack_delay", "snapshot_delay", "correction", "send_backpressure"]),
        pendingInputs: z.number().int().min(0).max(1_000_000),
        frameAgeMs: z.number().min(0).max(60_000),
        correctionM: z.number().min(0).max(1000),
        maxFrameMs: z.number().min(0).max(60_000),
        rttMs: z.number().min(0).max(10_000),
      })
      .optional(),
  }),
  inputSchema,
])
export type ActionInput = z.infer<typeof inputSchema>
export type ActionClientMessage = z.infer<typeof clientSchema>

const vectorSchema = z.object({ x: z.number(), y: z.number(), z: z.number() })
export const runnerSimSchema = z.object({
  position: vectorSchema,
  velocity: vectorSchema,
  yaw: z.number(),
  grounded: z.boolean(),
  timeSinceGrounded: z.number(),
  jumpBuffer: z.number(),
  diveTimer: z.number(),
  diveCooldown: z.number(),
  stumbleTimer: z.number(),
  jumpRising: z.boolean(),
  state: z.enum(RUNNER_STATES),
  checkpoint: z.number().int().transform(asCheckpointIndex),
  carry: vectorSchema,
  lastContactId: z.string().nullable(),
  contactLockout: z.number(),
})
const scheduledInputSchema = z.object({
  tick: z.number().int().positive(),
  seq: z.number().int().positive(),
  input: playerInputSchema,
  respawn: z.boolean(),
})
export type ScheduledInput = z.infer<typeof scheduledInputSchema>
const npcStateSchema = z
  .object({
    id: z.string().transform(asPlayerId),
    name: z.string(),
    colorIndex: z.number().int(),
    skill: z.number().min(0).max(1),
    waypointIndex: z.number().int().min(0),
    reactionTimer: z.number(),
    wobblePhase: z.number(),
    finishedAtMs: z.number().nullable(),
    rideExitIndex: z.number().int().min(0).optional(),
  })
  .transform(
    ({ rideExitIndex, ...state }): NpcRacer =>
      rideExitIndex === undefined ? state : { ...state, rideExitIndex },
  )
const frameSchema = z.object({
  type: z.literal("frame"),
  raceId: z.string(),
  tick: z.number().int().min(0),
  worldTimeSec: z.number().min(0),
  serverNowMs: z.number(),
  phase: z.enum(ROOM_PHASES),
  actors: z
    .array(
      z.object({
        id: z.string().transform(asPlayerId),
        name: z.string(),
        colorIndex: z.number().int(),
        npc: z.boolean(),
        brain: npcStateSchema.nullable(),
        plannedInputs: z.array(scheduledInputSchema).max(MAX_FUTURE_INPUT_TICKS),
        sim: runnerSimSchema,
        ack: z.number().int().min(0),
        heldInput: playerInputSchema,
        inputTick: z.number().int(),
        respawnSeq: z.number().int().min(0),
        finishedMs: z.number().nullable(),
      }),
    )
    .max(NET.maxPlayersPerRoom + 2),
})
export type AuthorityFrame = z.infer<typeof frameSchema>
export type AuthorityActor = AuthorityFrame["actors"][number]
const controlSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("authority"), protocol: z.literal(ACTION_PROTOCOL) }),
  z.object({ type: z.literal("pong"), nonce: z.number(), serverNowMs: z.number() }),
])
export type ActionServerMessage = ServerMessage | AuthorityFrame | z.infer<typeof controlSchema>

export function decodeActionClientMessage(raw: string): ActionClientMessage {
  if (raw.length > MAX_CLIENT_BYTES || new TextEncoder().encode(raw).byteLength > MAX_CLIENT_BYTES)
    throw new ProtocolError(["Message is too large"])
  return clientSchema.parse(JSON.parse(raw))
}

export function decodeActionServerMessage(raw: string): ActionServerMessage {
  const value: unknown = JSON.parse(raw)
  if (typeof value === "object" && value !== null && "type" in value) {
    if (value.type === "frame") return frameSchema.parse(value)
    if (value.type === "authority" || value.type === "pong") return controlSchema.parse(value)
  }
  return decodeServerMessage(raw)
}
