/** Expected service failures belong to the feature that made the request. */
export class FeatureRequestError extends Error {
  constructor(
    message: string,
    readonly unavailable = false,
  ) {
    super(message);
    this.name = "FeatureRequestError";
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

export function backendUnavailable(error: unknown): boolean {
  return (
    isRecord(error) &&
    ["PGRST202", "PGRST204", "PGRST205", "42883", "42P01", "42703"].includes(String(error.code))
  );
}

/** Stop polling incompatible deployments; back off transient failures. Explicit retry always works. */
export class FeatureRetryGate {
  private blocked = false;
  private failures = 0;
  private retryAt = 0;

  allows(manual = false): boolean {
    if (manual) this.success();
    return !this.blocked && Date.now() >= this.retryAt;
  }

  success(): void {
    this.blocked = false;
    this.failures = 0;
    this.retryAt = 0;
  }

  fail(error: unknown): void {
    this.blocked = error instanceof FeatureRequestError && error.unavailable;
    this.retryAt = Date.now() + Math.min(60_000, 5000 * 2 ** Math.min(this.failures++, 4));
  }
}
