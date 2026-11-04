type Backend = "database" | "media";

const safeCodes = new Set([
  "unauthenticated",
  "permission_denied",
  "not_found",
  "unavailable",
  "internal",
  "unknown",
  "deadline_exceeded",
  "bad_route",
  "malformed",
  "invalid_argument",
  "resource_exhausted",
  "canceled",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
]);

/** Keep useful provider diagnostics, never its body, headers, URL or token. */
export class ClassroomReadinessError extends Error {
  readonly backend: Backend;
  readonly httpStatus?: number;
  readonly code?: string;
  readonly hint: string;

  constructor(backend: Backend, error: unknown) {
    let httpStatus: number | undefined, code: string | undefined;
    let cause = error;
    for (
      let depth = 0;
      cause && typeof cause === "object" && depth < 4;
      depth++
    ) {
      const value = cause as {
        status?: unknown;
        code?: unknown;
        name?: unknown;
        cause?: unknown;
      };
      if (
        typeof value.status === "number" &&
        Number.isInteger(value.status) &&
        value.status >= 100 &&
        value.status <= 599
      )
        httpStatus ??= value.status;
      if (
        typeof value.code === "string" &&
        (safeCodes.has(value.code) ||
          (backend === "database" &&
            /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(value.code)))
      )
        code ??= value.code;
      if (value.name === "TimeoutError" || value.name === "AbortError")
        code ??= value.name;
      cause = value.cause;
    }
    const hint = readinessHint(backend, httpStatus, code);
    const details = [httpStatus && `HTTP ${httpStatus}`, code]
      .filter(Boolean)
      .join(", ");
    super(
      `Classroom ${backend} readiness failed${details ? ` (${details})` : ""}. ${hint}`,
    );
    this.name = "ClassroomReadinessError";
    this.backend = backend;
    this.httpStatus = httpStatus;
    this.code = code;
    this.hint = hint;
    // Do not attach the original cause: SDK errors can contain credentials or
    // full reverse-proxy response bodies, and Pino serializes nested causes.
  }
}

function readinessHint(
  backend: Backend,
  status?: number,
  code?: string,
): string {
  if (
    status === 401 ||
    status === 403 ||
    code === "unauthenticated" ||
    code === "permission_denied"
  )
    return backend === "media"
      ? "Check LIVEKIT_URL reaches the LiveKit API and LIVEKIT_API_KEY / LIVEKIT_API_SECRET match its configured keys; also check reverse-proxy authentication and server clocks."
      : "Check SUPABASE_URL and SUPABASE_SECRET_KEY belong to the same project and the server key has access.";
  if (
    backend === "media" &&
    (status === 404 || code === "bad_route" || code === "not_found")
  )
    return "Check LIVEKIT_URL and reverse-proxy routing for /twirp/livekit.RoomService/ListRooms.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    return "Check the backend hostname and DNS resolution from this service.";
  if (code && /CERT|TLS|SELF_SIGNED|VERIFY_LEAF/.test(code))
    return "Check the backend TLS certificate, hostname and trusted certificate chain.";
  if (code && /TIMEOUT|Timeout|Abort|deadline_exceeded/.test(code))
    return "The backend did not respond within the readiness deadline; check connectivity and backend health.";
  if (
    backend === "database" &&
    (code === "42P01" || code === "42703" || code === "PGRST205")
  )
    return "Check the classroom schema migrations are applied to the configured Supabase project.";
  return backend === "media"
    ? "Check LiveKit API connectivity and its server/reverse-proxy logs."
    : "Check database connectivity and the classroom schema in the configured Supabase project.";
}
