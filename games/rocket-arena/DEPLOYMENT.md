# Deployment and operations

## Dedicated Railway service

Use the repository root as build context and
`/games/rocket-arena/railway.toml` as the config file. The Dockerfile is
`games/rocket-arena/Dockerfile`. Watch `/games/rocket-arena/**`,
`/packages/observability/src/logger.ts` and
`/apps/game-server/src/gameVoiceToken.ts`.

Run one replica. `ROCKET_MAX_ROOMS=2` is an initial admission ceiling, not a
measured capacity guarantee. Do not enable multiple active room owners or
horizontal replicas. The service serves the authenticated API, game frame and
WebSockets from one HTTPS origin. Anonymous create/join/list routes are blocked.

Use [.env.example](.env.example) for runtime settings: Supabase URL/service key,
a stable `ROCKET_TICKET_SECRET` of at least 32 random characters, exact
comma-separated `APP_ORIGINS`, room cap and the shared LiveKit server credentials.
Railway supplies `PORT`; Docker sets `HOST=0.0.0.0` and `NODE_ENV=production`.
There is only one runtime mode, so no lab/app mode switch or developer-tuning
flag is required. Never set `ROCKET_TEST_HOOKS=1` for a deployed build.

Set `VITE_ROCKET_SERVICE_URL` to the dedicated HTTPS origin on the app frontend
and rebuild it. The app requires the `platform-only` capability, so a stale
pre-promotion backend produces a restart/update prompt before joining. Client
and server build identifiers appear in `/health`, `/ready`, config and logs.

Coordinate the frontend/service rollout before applying catalog migrations:

- [Initial catalog entry](../../supabase/migrations/20261018120000_add_rocket_arena_catalog.sql)
  creates/enables an active game. This migration was already applied to the
  user's development DB; do not edit it or reapply it as a repair.
- [Catalog thumbnail](../../supabase/migrations/20261019060000_add_rocket_arena_thumbnail.sql)
  fills only an empty thumbnail field, preserving custom artwork.

The catalog migration exposes the game in its target database. Apply schema changes through the normal reviewed migration process.

## Saves, shutdown and recovery

Supabase stores session boundaries/results and signed checkpoints, not physics
ticks. Saved score/time/roster/team/bot state remains resumable for 24 hours;
restoration creates a fresh kickoff and pauses until resumed. The main app's
cleanup expires old paused sessions. Runtime rooms and sockets live only in
process memory.

Keep the ticket secret stable across releases/rollbacks. Graceful SIGTERM/SIGINT
stops new allocation, checkpoints live rooms and closes their sockets. An
unclean restart can lose changes after the last acknowledged checkpoint
(normally about 15 seconds) and waits for the old 60-second allocation lease.
Use the matching previous client/server image for rollback; a signed save must
remain compatible with that release's checkpoint schema.

Failed initialization releases only its own allocation and preserves the last
usable save. A failed/ambiguous database acknowledgment never claims a successful
save: the app shows an explicit retryable error and the service logs
`ROCKET_ROOM_SAVE_UNCONFIRMED`. Concurrent moderation/new room owners are fenced
from stale writers. A naturally completed/stopped live room retains rematch
controls for five minutes; a rematch requires current participant consent and
fresh eligibility checks.

## Logs

The canonical Playground Pino logger is built into the service; local development
uses the same pretty formatter as other services.

- `info`: service/room readiness, joins, actual socket closes, room disposal,
  accepted controls/rematch votes, completed rounds and saves.
- `warn`/`error`: denied admission/controls, eviction, abnormal close code 1006,
  startup, persistence and service failures.
- `debug` only: validated performance windows, stall samples, room samples and
  membership leave receipts. Use `LOG_LEVEL=debug npm run dev:rocket` while
  diagnosing performance; normal `info` skips report validation/formatting.

Lifecycle records carry loaded release, platform session, room/allocation,
connection and verified user/correlation IDs where available. Socket close
records include numeric WebSocket code, duration and server closure reason
(e.g. `rematch`); room disposal can precede the socket's final close callback.
Detailed diagnostics remain bounded, client-reported observations. No per-frame,
input or snapshot logging. Chat content stays in the moderated chat table;
credentials, voice audio and free-form socket close text are not logged.
Process/hosting retention governs logs; `.run/` reports are local ignored evidence.

## Dependency review and acceptance

The server uses explicit Colyseus core 0.15.57/WS transport 0.15.3 and installs
only the server workspace at runtime. Compiled test/harness files and browser
test handles are excluded from the runtime artifact. Unused authentication/Redis umbrella
branches have been removed. The reviewed production audit reports one high
Nano ID finding and two inherited moderate entries. Core uses Nano ID 2.1.11
with fixed default length nine for its IDs; no client-controlled length was
identified. Launch credentials use independent cryptographic randomness. This
narrows the observed exposure without clearing the finding. Avoid forcing
Nano ID 3 into the old CommonJS API; upgrade Colyseus/client/schema together and
rerun transport/recovery/browser checks. The exposure review was recorded on
2026-10-20; framework migration is a separate compatibility task.

Before production, verify real Supabase admission/policies and two-device
microphone delivery in the configured environment. Fixture/browser tests check
behavior and the voice panel/token contract; they do not establish microphone
transport or eight-device performance. Docker runtime contents/install/startup
are checked by `check-app-runtime.py`; that check is not a Docker image build.
