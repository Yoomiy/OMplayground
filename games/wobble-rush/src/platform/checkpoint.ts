import { createHmac, timingSafeEqual } from "node:crypto"
import { ACTION_CONTENT, ACTION_PROTOCOL, type AuthorityFrame } from "../shared/action-protocol"
import type { PlatformMember } from "../shared/platform-protocol"
import type { RaceResult, RoomState } from "../shared/room-types"
import { AdmissionError } from "./admission"

export const SAVE_TTL_MS = 24 * 60 * 60_000
export interface Checkpoint {
  version: 1
  protocol: typeof ACTION_PROTOCOL
  content: typeof ACTION_CONTENT
  sessionId: string
  savedAt: number
  state: RoomState
  frame: AuthorityFrame | null
  players: PlatformMember[]
  blocked: string[]
  results: { raceId: string; round: number; rows: readonly RaceResult[] }[]
  hostId: string
  countdownRemainingMs: number | null
}
/** JSONB may reorder keys. Sign a canonical representation, never raw JSON.stringify. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`
  return JSON.stringify(value)
}
export class RoomCheckpoints {
  constructor(private readonly secret: string) {
    if (secret.length < 32)
      throw new Error("WOBBLE_TICKET_SECRET must contain at least 32 characters")
  }
  sign(data: Checkpoint): { data: Checkpoint; signature: string } {
    return {
      data,
      signature: createHmac("sha256", this.secret).update(canonical(data)).digest("base64url"),
    }
  }
  read(value: unknown, sessionId: string, now = Date.now()): Checkpoint {
    if (!value || typeof value !== "object") throw new AdmissionError("SAVE_UNAVAILABLE", 409)
    const { data, signature } = value as ReturnType<RoomCheckpoints["sign"]>
    if (!data || typeof signature !== "string" || signature.length > 100)
      throw new AdmissionError("SAVE_UNAVAILABLE", 409)
    const expected = createHmac("sha256", this.secret).update(canonical(data)).digest()
    const supplied = Buffer.from(signature, "base64url")
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
      throw new AdmissionError("SAVE_UNAVAILABLE", 409)
    if (
      data.version !== 1 ||
      data.protocol !== ACTION_PROTOCOL ||
      data.content !== ACTION_CONTENT ||
      data.sessionId !== sessionId
    )
      throw new AdmissionError("INCOMPATIBLE_SESSION", 409)
    if (
      !Number.isFinite(data.savedAt) ||
      now - data.savedAt >= SAVE_TTL_MS ||
      data.savedAt > now + 60_000
    )
      throw new AdmissionError("SAVE_EXPIRED", 409)
    return structuredClone(data)
  }
}
