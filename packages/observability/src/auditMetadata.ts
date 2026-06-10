/** Merge correlation_id into audit_log metadata (Option 1 — no schema column). */
export function auditMetadata(
  correlationId?: string | null,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const base = extra ? { ...extra } : {};
  if (correlationId?.trim()) {
    base.correlation_id = correlationId.trim();
  }
  return base;
}
