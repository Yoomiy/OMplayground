# Logging and audit guide

Use this guide whenever a feature adds a user action, HTTP endpoint, Socket.io
event, scheduled/background job, external-service call, database write, browser
workflow, or long-running process.

The current implementation lives in `packages/observability`. The older
`tmp/logging_coverage_prototype.md` explains the original design, but this file
is the maintained contributor contract.

## 1. Decide what the feature needs

For each new flow, answer all of these questions during implementation and
review:

1. **Does it cross a lifecycle or business boundary?** Log low-volume events
   such as create, join, leave, pause, resume, stop, conversion start/finish,
   token issuance, and cleanup completion through Pino.
2. **Can it fail in a way that needs diagnosis?** Log the terminal failure with
   the original structured error and enough safe context to identify the flow.
3. **Is it a privileged admin/teacher or security action?** Write a durable
   Supabase `audit_log` row in addition to any operational Pino log.
4. **Does it run without an awaiting caller?** Supervise the promise and log
   rejection. Never use an unexplained `.catch(() => {})` on meaningful work.
5. **Is it high-frequency?** Aggregate, sample, or log only terminal failures.
   Never emit one line per tick, frame, pointer movement, voxel input, snapshot,
   Yjs update, awareness update, or media packet.
6. **Does it handle user content or credentials?** Design the log fields so the
   sensitive value is never passed to the logger; redaction is a final safety
   net, not permission to log it.

Not every successful function call needs a log. A log should mark an important
boundary, explain a failure, or support a security audit.

## 2. Choose the correct destination

### Operational Pino logs

Use Pino for service health, request/socket lifecycle, recoverable degradation,
failures, retries, external dependencies, and background work. These logs go to
stdout and the Railway log drain.

Use the shared logger from `@playground/observability`; do not add `console.*`,
Morgan, or a second logger to maintained Node services.

### Durable `audit_log`

Use Supabase `audit_log` for low-volume actions that answer “who changed or
accessed what?” Examples include admin user creation/import, moderation,
participant removal/promotion, classroom authority changes, and repeated token
abuse.

An audit row is not a substitute for an operational error log. Audit metadata
must be minimal and should include `correlation_id` via `auditMetadata(...)`.
Browsers must not insert audit rows directly.

### Browser telemetry

Use `reportCaughtError(...)` for caught browser failures and `reportTelemetry(...)`
for explicit non-exception outcomes. Send board-game failures to `game-server`,
voxel/voice failures to `voxel-server`, and shell/auth failures to `shell`.
Global uncaught errors and unhandled rejections are already installed centrally.

Telemetry is bounded and retried, but remains best-effort. Product correctness
must never depend on telemetry delivery.

### Platform metrics

Use Railway, Supabase, Vercel, and LiveKit dashboards for CPU, memory, bandwidth,
database health, and infrastructure restarts. Do not duplicate those as
application log loops.

## 3. Required operational log shape

Prefer stable, searchable fields:

```ts
logger.error({
  correlationId,
  userId,
  sessionId,
  protocol: "socket",
  message: "Game pause persistence failed",
  context: {
    event: "PAUSE_GAME_PERSIST_FAILED",
    status: "failed"
  },
  err: logError(error)
});
```

- `message`: short human-readable description; do not interpolate payloads.
- `context.event`: stable `UPPER_SNAKE_CASE` identifier used for queries and
  alerts. Use a specific terminal suffix such as `_FAILED`, `_REJECTED`,
  `_COMPLETED`, or `_TIMED_OUT` where appropriate.
- `context.status`: normally `started`, `success`, or `failed`.
- `correlationId`: required when the work originates from HTTP, a socket, or the
  browser. Propagate the existing ID; do not generate a new one mid-flow.
- `userId`, `sessionId`, `roomCode`, `jobId`: include only identifiers that are
  useful and safe for that event. Do not substitute display names.
- `protocol`: use the closest current category: `http`, `socket`, `client`,
  `livekit-webhook`, `webrtc`, `background`, or `internal`.
- `err`: use `logError(error)` for unknown or Supabase/PostgREST failures. Do
  not reduce an error to only `error.message`; codes, details, hints, and stack
  are useful operationally.
- Durations use `duration_ms`. Counts use descriptive names such as
  `failedRooms` or `acceptedLogs`.

Do not dynamically construct event names from user input. Add a new stable
event name when a new observable outcome is introduced.

## 4. Log levels

- `debug`: developer-only details that are disabled at the normal production
  level. Never use it for required incident evidence.
- `info`: successful low-volume lifecycle or business boundary.
- `warn`: expected rejection, denied access, degraded fallback, retryable
  condition, or client-caused invalid request worth observing.
- `error`: operation unexpectedly failed, persistence failed, or a request
  returned 500.
- `fatal`: the process cannot safely continue. Process-level fatal handling is
  installed through `installProcessLifecycle(...)`.

Avoid logging the same failure at every layer. The layer that has the best
context should log it once; callers may convert it into a safe response without
logging it again.

## 5. Use the standard helper for each flow

### Express HTTP

- Mount correlation middleware and `createHttpLogger(...)`/`initObservability(...)`.
- In a terminal catch, call `logHttpFailure(logger, req, error, EVENT, context)`.
- Return a safe, stable client error. Do not return the raw exception message
  for a 500.
- HTTP access logging records method/path/status; the terminal failure log
  records the cause. Both share the correlation ID.

### Socket.io

- Install `attachSocketCorrelation(...)` before authentication and
  `installSocketExceptionGuard(...)` for handler exceptions.
- Add low-volume lifecycle mutations to the appropriate whitelist in
  `socketLifecycle.ts`, then use `withSocketLogging(...)` or the server's
  `wrapAck(...)`/`logSocketEvent(...)` path.
- Keep hot traffic in the explicit hot-event set and out of lifecycle logging.
- Never trust or log a client-supplied user ID; use the verified
  `socket.data.userId`.

### Background and scheduled work

- If the caller cannot `await` the work, wrap it with
  `observeBackgroundTask(logger, promise, EVENT, context)` or add an explicit
  catch that emits the same structured fields.
- Prevent overlapping timer executions when overlap could corrupt state or
  multiply load.
- Log terminal failure; log start/success only for important or long-running
  jobs where those boundaries help operations.

### New Node service or long-running process

- Create its logger with a stable service name.
- Provide `/health` and meaningful `/ready` checks.
- Install `installProcessLifecycle(...)`.
- On shutdown, stop accepting new work, stop timers, flush required state, close
  sockets/server handles, and keep that sequence bounded by a timeout.

### Supabase calls

Most `supabase-js` database calls return `{ data, error }`; they do not throw on
PostgREST failure. Inspect `error` and either handle it deliberately or throw it
to the boundary that logs the failure. A successful client acknowledgement must
not be sent until required persistence succeeds.

If in-memory authoritative state is mutated before persistence, either roll it
back on persistence failure or acknowledge that the in-memory transition was
applied and supervise persistence separately. Never return failure while
silently retaining the state change.

### Edge Functions

Emit single-line structured JSON through `console.log`, `console.warn`, or
`console.error`, because the Edge runtime captures stdout/stderr rather than
the Node Pino package. Apply the same event names, correlation IDs, levels,
privacy rules, and no-duplicate-error rule.

### Browser code

- Report terminal failures that affect loading, saving, synchronization,
  connectivity, media, workers, WebGL, or recovery.
- Include `appArea`, safe identifiers, operation, and fallback outcome.
- Do not report routine user cancellations, expected permission denials without
  diagnostic value, or errors already guaranteed to reach the global handler.
- Do not replace product error handling with telemetry; maintain the UI state,
  retry, rollback, or fallback first.

## 6. Data that must never be logged

Never pass these values to Pino, Edge logs, telemetry, or audit metadata:

- authorization headers, cookies, passwords, JWTs, access/refresh tokens,
  LiveKit tokens, presenter capabilities, conversion tickets, or secret hashes;
- chat/private-message bodies, feedback text, document contents, filenames,
  screenshots, drawing/Yjs state, awareness IDs, viewport coordinates, or raw
  socket/request payloads;
- full game-state blobs, inventory dumps, audio/video data, or WebRTC packets;
- usernames, display names, full names, email addresses, or raw IP addresses
  unless a documented security requirement explicitly needs them and access,
  retention, and redaction have been reviewed.

Prefer opaque IDs, counts, enums, booleans, durations, error codes, and bounded
reason categories. Review new context objects field by field; nested objects can
accidentally carry sensitive values.

## 7. Failure and acknowledgement contract

Logging must not make product behavior inconsistent:

- Required persistence: await it before success acknowledgement.
- Mutation before required persistence: roll back on failure.
- Best-effort persistence: acknowledge the applied state, supervise the write,
  and log failure without pretending the user action failed.
- HTTP 500: log the structured cause, return a generic stable error.
- Socket handler exception: let the shared guard emit a generic `INTERNAL`
  acknowledgement; handle known failures locally with a specific safe code.
- Cleanup failure: log it and preserve retryable state where practical.

The client acknowledgement, authoritative in-memory state, broadcast events,
and durable state must describe the same outcome.

## 8. Merge checklist for a new feature/process

- [ ] Important lifecycle boundaries and terminal failure modes are identified.
- [ ] Operational versus durable-audit destination is chosen deliberately.
- [ ] Stable event names, correct levels, and safe context fields are present.
- [ ] HTTP/socket/browser work propagates the existing correlation ID.
- [ ] Every Supabase result checks `error` where failure matters.
- [ ] Fire-and-forget promises and timers have explicit supervision.
- [ ] Required persistence and acknowledgements cannot diverge.
- [ ] High-frequency paths are excluded, aggregated, or failure-only.
- [ ] No prohibited content or credentials reach logs or audit metadata.
- [ ] Client telemetry targets the backend that owns the feature.
- [ ] Tests cover both success and failure, including rollback/retry semantics.
- [ ] Manual staging verification confirms expected logs and confirms sensitive
      values are absent.
- [ ] A new service/process has readiness, graceful shutdown, and bounded flush.

When adding a new reusable logging pattern, implement it in
`packages/observability`, add focused tests there, and update this guide in the
same change.
