import { createLogger } from "../../../../packages/observability/src/logger"
export const platformLogger = createLogger("wobble-server")
export function platformLog(
  level: "debug" | "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  platformLogger[level]({
    ...fields,
    message: event.toLowerCase().replaceAll("_", " "),
    context: { event, status: level === "warn" || level === "error" ? "failed" : "success" },
  })
}
