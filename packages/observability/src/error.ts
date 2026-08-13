/** Convert unknown failures into Pino's structured `err` shape without leaking payloads. */
export function logError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : String(error));
}
