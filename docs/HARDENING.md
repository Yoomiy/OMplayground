# Hardening checklist (Railway + Supabase)

Operational notes for production. Aligned with `ARCHITECTURE.md` and `tmp/logging_coverage_prototype.md`.

**Last updated:** June 2026.

## Auth signup

- **Supabase Auth public signup must stay disabled** in the Supabase dashboard. Kids and teachers are created only via admin Edge Functions (`import-bulk-kids`, `admin-create-user`). Self-service `kid_profiles` INSERT is not relied on for onboarding.

## Rate limiting

- **HTTP:** `express-rate-limit` on both Node servers (120 req/min per IP default).
- **Telemetry ingest:** Stricter per-IP limits on `/api/telemetry` (see `packages/observability`).
- **Auth / messaging / reports:** Add stricter limits on dedicated routes or Edge Functions as surfaces grow.

## Logs and metrics

- **Shared package:** `@playground/observability` — Pino JSON logs, correlation IDs, whitelisted socket event logging (no per-tick spam).
- **game-server:** `initObservability` wired (replacing raw `morgan` + scattered `console.*`).
- **minecraft-server and document-converter:** Package wired with Pino, correlation IDs, and structured lifecycle events.
- **Production:** Ship stdout to Railway log drains (Axiom / Datadog / BetterStack). Query by `service`, `correlationId`, `level`, `protocol`.
- **Client crashes:** Buffered telemetry → server `/api/telemetry` → Pino (`protocol: client`).
- **Do not log:** raw socket payloads, chat bodies, JWTs, LiveKit tokens, per-tick voxel `INPUT`/`SNAPSHOT`.
- **Drawing boards:** all networked boards use the server-owned canonical Yjs protocol, while `boardMode` (`game` or `classroom`) selects lifecycle and authorization policy. Classroom events also carry the classroom UUID and room code. Log terminal initial/recovery sync results, bounded rejection summaries, clears, and checkpoint results; never log Yjs deltas, snapshots, awareness IDs, viewport coordinates, image/file data, or board contents. Routine solo saves are not logged.
- **Classroom board capabilities:** only the classroom RTC service may mint the signed capability that bypasses the ordinary child recess connection gate. The game server verifies its classroom, participant identity, expiry, and active status, rejects it for ordinary games, and excludes the matching room from recess-end eviction. Self-declared `guest:*` game-server identities are not accepted; classroom guests receive the same signed, scoped capability as authenticated participants. Never log the capability itself.

## Health and readiness

- `GET /health` — process up.
- `GET /ready` — required Supabase env vars present (URL, service role; JWT secret where applicable).

## Admin stats (app-level)

- `GET /api/admin/stats` per server — requires `admin_profiles` bearer JWT.
- **On-Demand Live Flushing**: When `/api/admin/stats` is requested, the servers run `onAdminStatsQuery` to flush all active rooms' in-memory launches and FPS telemetry to the database before returning the stats snapshot.
- **Polling Optimization**: The Admin UI pauses polling `/api/admin/stats` requests when the tab is hidden, preventing background tabs from generating redundant REST requests and database writes.
- **Historical stats**: Admin UI displays a grid of catalog games with aggregated launch counts and details on player history/multiplayer sessions.

## Audit trail

- Privileged admin/teacher actions → Supabase `audit_log` via `append_audit_log` RPC.
- Optional `correlation_id` in metadata (logging spec).

## WebSocket scaling

- Single instance: in-memory rooms only.
- **Multi-instance:** sticky sessions + **Redis** adapter for Socket.io pub/sub (documented in `ARCHITECTURE.md`).

## Load / soak

- Run soak tests against both Railway WS endpoints and Supabase Realtime before high-traffic windows.
- Record connection counts, voxel snapshot rates, and reconnect behavior.
- Validate: 60 s of voxel play produces **zero** log lines for `INPUT` / tick `SNAPSHOT`.

## Platform dashboards (infra — not in-app)

| Signal | Where |
|--------|-------|
| Node CPU, memory, restarts | Railway per-service metrics |
| HTTP 5xx, latency | Railway / Vercel |
| Postgres, RLS | Supabase dashboard |
| WebRTC / voice | LiveKit dashboard |
