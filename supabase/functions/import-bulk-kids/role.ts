/** Role is optional for a kids import, but an explicit unknown role is an error. */
export function parseImportRole(value: unknown): "kid" | "teacher" | null {
  if (value === undefined || value === null) return "kid";
  if (typeof value !== "string") return null;
  const clean = value.trim().toLowerCase();
  if (!clean || clean === "kid") return "kid";
  if (clean === "teacher") return "teacher";
  return null;
}
