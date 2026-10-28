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
- chat/private-message bodies, feedback text, document contents, filenames
  (except document names in the document-converter's conversion lifecycle logs),
  screenshots, drawing/Yjs state, awareness IDs, viewport coordinates, or raw
  socket/request payloads;
- full game-state blobs, inventory dumps, audio/video data, or WebRTC packets;
- usernames, display names, full names, or email addresses
  unless a documented security requirement explicitly needs them and access,
  retention, and redaction have been reviewed;
- raw IP addresses outside the school access-security policy below.

Prefer opaque IDs, counts, enums, booleans, durations, error codes, and bounded
reason categories. Review new context objects field by field; nested objects can
accidentally carry sensitive values.

### School access-security policy

The school operates online, with students normally connecting from home
networks. School staff need evidence to investigate unauthorized account use
and unknown people entering classrooms through guest access. For this purpose,
server-side security records may include the full client IP address alongside
the existing identity and correlation fields. Opaque IDs alone do not provide
the network evidence needed for these investigations.

- **Covered events:** successful and rejected account authentication and
  classroom entry attempts, including guest entry and access-token issuance or
  rejection. Distinguish token issuance from actual entry; a token being issued
  does not prove the person joined a class.
- **Record shape:** include timestamp, stable event name, client IP when
  reliably available, verified account ID or server-issued guest participant
  key when available, classroom identifier when relevant, authentication method,
  outcome, bounded rejection reason, and correlation ID. Preserve identity
  fields alongside the IP. For unauthenticated attempts, leave verified identity
  absent rather than treating a submitted account ID as verified.
- **Trusted source:** derive the IP at the server boundary using the deployed
  platform's documented proxy configuration. Accept forwarding headers only
  through trusted proxies. Never use a browser-submitted IP or an arbitrary
  forwarded-header value as authoritative evidence. If a client IP cannot be
  established reliably, omit it and record that limitation instead of presenting
  a proxy address as the visitor's IP.
- **Interpretation:** siblings or other household members may share a public
  IP, and addresses can change or be shared through VPNs and other networks.
  Correlate IPs with identities, times, and classrooms. An IP match is evidence
  for staff investigation, not proof of a specific person's identity or grounds
  for automatic exclusion by itself.
- **Access and use:** these records are for authorized school staff conducting
  school access and account-security investigations. Restrict both application
  access and hosting/log-drain access accordingly. Any search results or exports
  containing these fields must have the same access restrictions.
- **Retention:** the hosting platform and configured log destinations manage
  retention and deletion. Classroom IP evidence stays in operational logs;
  do not create a database copy with a separate retention lifecycle.
- **Scope:** this exception permits IPs in the covered server-side security
  events, including durable security audit records where appropriate. It does
  not enable blanket HTTP access logging of IPs, browser IP telemetry, or IP
  logging in the document converter. MAC address collection is outside scope.
  Credentials, tokens, and user content remain prohibited.

This section defines the approved purpose and scope. It does not imply that IP
collection, proxy validation, staff access restrictions, or retention enforcement
have already been implemented or verified.

### Classroom security event contract

Account login IPs are already available in Supabase. The application records
classroom admission and connection evidence through the shared Pino logger.

- `CLASSROOM_RTC_TOKEN_ISSUED`, `CLASSROOM_RTC_TOKEN_DENIED`, and
  `CLASSROOM_RTC_TOKEN_FAILED`: one terminal admission record per POST request,
  including rate-limit/body-parser rejection and connection closure. Fields:
  `context.admissionId`, `clientIp` when available, `ipSource`, `ipStatus`,
  `httpStatus`, `reason`, `duration_ms`, `accountTokenProvided`, and resolved
  identity when available. `roomCode` and `correlationId` are top-level fields.
  Requests rejected before body parsing may have no room or identity.
  Classroom body-parser failures use bounded reasons such as `invalid_json` or
  `body_too_large`; never log the parser error itself, which can contain submitted
  content. The outcome record replaces Express's default parser-error reporting
  for these requests.
- Resolved identity fields: `context.accountId` is a verified account identifier;
  `participantIdentity` is the LiveKit identity; `participantKey` is the attendance
  key; `authenticationMethod` is `account`, `guest`, or `delegate`. Also retain
  `role` and `isHost`. `accountTokenOutcome` distinguishes `absent`, `accepted`,
  and `unverified`. The last includes invalid credentials and authentication
  lookup failures: it must not be interpreted as proof of a bad password.
  Existing guest fallback behavior is preserved and visible in these fields.
- Guest attendance keys can be supplied by the browser and reset. They are
  correlation hints, not verified personal or device identities.
- `CLASSROOM_PARTICIPANT_JOINED` and `CLASSROOM_PARTICIPANT_LEFT`: LiveKit
  presence evidence with `context.evidenceSource` (`webhook` or `reconciliation`),
  `context.admissionId`, `participantIdentity`,
  `participantKey`, `roomSid`, `participantSid`, `webhookEventId`, and `occurredAt`.
  The admission ID is server-generated and placed in issued token metadata;
  IPs and credentials are never put there. It links to the IP observed when the
  token was requested, not a measurement of the later media connection's IP.
  Existing tokens may have no admission ID (`admissionLink: unavailable`).
  Webhook retries can repeat records; deduplicate by `webhookEventId`. Verified
  connection evidence is logged before attendance persistence so a database
  failure does not hide the connection.
  The independent 30-second reconciliation also logs observed transitions,
  including departures when the last participant or the whole room disappears.
  It emits no per-poll logs for unchanged participants and does not interpret
  failed LiveKit reads as departures. Reconciliation evidence is logged before
  attendance database access, so database failures do not hide observations.
  For departures recovered from stored open visits after a restart, only room
  and participant SIDs may be available. Follow earlier logs by those SIDs.
  Reconciliation departure `occurredAt`/`observedAt` is detection time
  (`timeAccuracy: detection_time`), not an exact departure timestamp. Observed
  joins use LiveKit's join time. Different sources may report the same visit;
  correlate by room SID, participant SID, and event type. A visit entirely
  between polls can be missed if no webhook arrived and no visit was recorded.
  Webhook delivery is required for complete coverage of short visits.
  Join/leave records also repeat `context.clientIp`, `ipSource`, and `ipStatus`
  from the matching admission, with `ipObservation: admission`. This is the
  address seen at token issuance, not a new measurement at disconnect or the
  webhook sender's address. The association is held only in server memory,
  bound to admission ID, classroom and participant identity. It is limited to
  10,000 entries, expires after five hours of inactivity, and is refreshed by
  observed activity. After a restart, expiry, eviction or when an admission ID
  is missing, leave records explicitly report `ipStatus: unavailable` and
  `ipUnavailableReason: admission_not_cached`; earlier retained admission logs
  can still be searched. IPs are never copied into participant metadata or
  attendance tables.
  These records belong to `service=classroom-server` after the independent
  service cutover (historical records use `minecraft-server`); a drawing socket's
  `DISCONNECT` record in `game-server` is not a classroom departure.
- `CLASSROOM_PARTICIPANT_BLOCKED` and `CLASSROOM_PARTICIPANT_REMOVED`: successful
  moderation boundaries, with actor and target identities, classroom and
  correlation IDs. Block records also include the durable target participant
  key. A block can succeed even if the subsequent removal fails; each completed
  boundary remains visible. Existing durable moderation audits continue.

Investigate by filtering `context.clientIp` plus a time range, then following
`context.admissionId` to connection events. Filter `context.accountId` for an
account, `context.participantKey` for attendance continuity, or `roomCode` for a
classroom. Use `context.participantSid` to distinguish individual connections.
Token issuance alone does not establish attendance. No automatic IP blocking is
introduced by this logging contract.

For deployment configuration and manual IP verification, see the classroom
deployment notes in `docs/virtual_classrooms.md`.

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
