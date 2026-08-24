/** Convert unknown failures into Pino's structured `err` shape without leaking payloads. */
export function logError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (error && typeof error === "object") {
    const obj = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown; stack?: unknown };
    if (typeof obj.message === "string") {
      const parts = [obj.message];
      if (typeof obj.details === "string" && obj.details) parts.push(`details: ${obj.details}`);
      if (typeof obj.hint === "string" && obj.hint) parts.push(`hint: ${obj.hint}`);
      if (typeof obj.code === "string" && obj.code) parts.push(`code: ${obj.code}`);
      const err = new Error(parts.join(" | "));
      if (typeof obj.stack === "string") err.stack = obj.stack;
      return err;
    }
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error(String(error));
    }
  }
  return new Error(String(error));
}

