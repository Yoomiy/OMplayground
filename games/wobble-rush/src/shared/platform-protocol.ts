/** Authenticated app commands, separate from authoritative movement inputs. */
import { z } from "zod"
import { RUNNER_COLORS } from "./course-palette"

export const platformControlSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.enum([
      "loaded",
      "start",
      "next",
      "pause",
      "resume",
      "end",
      "rematch",
      "accept-rematch",
      "decline-rematch",
    ]),
  }),
  z.strictObject({
    action: z.literal("color"),
    colorIndex: z
      .number()
      .int()
      .min(0)
      .max(RUNNER_COLORS.length - 1),
  }),
  z.strictObject({ action: z.literal("remove"), userId: z.string().uuid() }),
  z.strictObject({
    action: z.literal("configure"),
    courseId: z.string().max(64),
    mode: z.enum(["race", "cup"]),
    remix: z.boolean(),
  }),
])
export type PlatformControl = z.infer<typeof platformControlSchema>
export const platformCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("attach"), ticket: z.string().min(1).max(2048) }),
  z.strictObject({ type: z.literal("control"), control: platformControlSchema }),
])
export type PlatformCommand = z.infer<typeof platformCommandSchema>
export type { PlatformMember, WobbleView } from "./platform-view"
