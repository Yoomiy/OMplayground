import { z } from "zod"
import { ACTION_CONTENT, ACTION_PROTOCOL } from "../shared/action-protocol"

const KEY = "wobble-resume-session"
const schema = z.object({
  protocol: z.literal(ACTION_PROTOCOL),
  content: z.literal(ACTION_CONTENT),
  room: z.string().regex(/^[A-HJ-NP-Z]{4}$/),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  graceMs: z.number().int().positive().max(60_000),
})
export type ResumeTicket = z.infer<typeof schema>

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}
export function readResumeTicket(): ResumeTicket | null {
  try {
    const raw = storage()?.getItem(KEY)
    if (!raw) return null
    const result = schema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
export function saveResumeTicket(ticket: ResumeTicket | null): void {
  try {
    if (ticket === null) storage()?.removeItem(KEY)
    else storage()?.setItem(KEY, JSON.stringify(ticket))
  } catch {
    // Browser privacy settings can disallow storage. Same-page recovery still
    // uses the in-memory ticket; refresh recovery then isn't available.
  }
}
