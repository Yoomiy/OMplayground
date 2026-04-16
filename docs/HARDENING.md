# Hardening checklist (Railway + Supabase)

Operational notes aligned with the implementation plan.

## Rate limiting

- **HTTP:** `express-rate-limit` on the game server (120 req/min per IP in the current default).
- **Auth / messaging / reports:** Add stricter limits on dedicated routes or Edge Functions when those surfaces grow.

## Logs and metrics

- **HTTP:** `morgan` combined logs on the game server.
- **Structured JSON logs:** Prefer a JSON logger (e.g. `pino`) in production and ship to Railway log drains.

## Health and readiness

- `GET /health` — process up.
- `GET /ready` — required Supabase env vars present (JWT secret, URL, service role).

## WebSocket scaling

- Single instance: in-memory rooms only.
- **Multi-instance:** sticky sessions + **Redis** adapter for Socket.io pub/sub (documented in `ARCHITECTURE.md`).

## Load / soak

- Run soak tests against Railway WS and Supabase Realtime before high-traffic windows; record connection counts and reconnect behavior.

## Audit logs (optional)

- Log teacher/admin destructive actions (chat clear, bans) to an append-only table or external audit sink.
