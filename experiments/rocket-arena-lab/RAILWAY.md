# Rocket app service

The app adapter is implemented separately from anonymous lab matchmaking.
`ROCKET_MODE=app` serves the matching client, authenticated launch API and
Colyseus WebSockets from one origin. The existing lab remains unchanged until
an explicit release is published. Use a staging app/database before catalog rollout.

## Railway configuration

Create a dedicated service from this repository/branch:

- Repository root directory: `/` (the build also uses the canonical platform logger).
- Config file: `/experiments/rocket-arena-lab/railway.toml`.
- Dockerfile: `experiments/rocket-arena-lab/Dockerfile`.
- One replica. Do not enable horizontal replicas or overlapping active room owners.
- Public HTTPS domain; `/ready` is the configured readiness route, `/health` is liveness.
- Watch paths: `/experiments/rocket-arena-lab/**`, `/packages/observability/src/logger.ts`
  and `/apps/game-server/src/gameVoiceToken.ts`.

The config-file path is relative to the repository, independently of a service's
root directory. See [Railway monorepo configuration](https://docs.railway.com/deployments/monorepo).
No Railway service, domain or production database has been changed by this work.

Set runtime variables using [.env.app.example](.env.app.example):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | The app's Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service credential |
| `ROCKET_TICKET_SECRET` | At least 32 random characters, separate from Supabase credentials |
| `APP_ORIGINS` | Comma-separated exact HTTPS app origins; no paths, wildcards or trailing slash |
| `ROCKET_MAX_ROOMS` | Starts at 2 as an admission ceiling; measure concurrent rooms before raising |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Same server-only voice configuration as the main game server |
| `PORT` | Railway supplies it; do not force the local test port |

Docker sets `ROCKET_MODE=app`, `NODE_ENV=production`, `HOST=0.0.0.0` and disables
development tuning. The API has no anonymous create/join/list routes in app mode.
Root visits show an instruction to open the game through The Playground.

On the app frontend hosting service, set `VITE_ROCKET_SERVICE_URL` to the Rocket
HTTPS origin, then rebuild the app. Browser launch credentials are transferred
through a checked frame handshake, never a long-lived token in a URL.
The frame initializes its renderer before requesting a short-lived reservation;
reconnects reuse that renderer. Experimental lab response controls stay hidden.

Apply the [Rocket catalog migration](../../supabase/migrations/20261018120000_add_rocket_arena_catalog.sql)
through the project's usual Supabase migration flow. It creates an active
multiplayer entry with one to eight human players, or enables an existing hidden
Rocket row. Applying this migration exposes the game in that database's catalog;
configure the service and frontend before applying it to production.
No catalog SQL has been executed here.

## Behavior and data ownership

- The app's profile names, roles, invitations, gender and per-class Jerusalem
  recess rules are verified by the backend at launch/join and during play.
- Eight stable car slots exist independently of connection IDs. Rooms start with
  zero bots. In the waiting room the host/staff can choose 0–7 bots (subject to
  human occupancy) and assign teams, including occupant swaps when a team is full.
  The host can start with the current roster, including solo practice without bots.
  Bots use the evaluated controller directly in the authoritative input loop,
  with no extra sockets, prediction workers or supervisor. Unused slot bodies
  are disabled, skipped by car simulation, and absent from rendering, snapshots
  and prediction frames. Slot identities and kickoff placements remain stable.
- Friends join immediately in the lobby/countdown, otherwise wait for the next
  kickoff, taking an empty slot or replacing a bot if necessary. The host sees a queued-player notice and may choose an exact team/empty/bot slot before kickoff; the fallback stays automatic. Temporary
  disconnects reserve the same car for 30 seconds with neutral input; expiry
  empties the slot while other humans keep playing. Ordinary departures preserve historical DB membership even after releasing their car. Paused departures and the final human connection retain occupied seats and save the match. Bot counts never increase automatically.
- Teachers/admins can observe without a car slot and use verified controls.
  Moderation bans re-entry for that session, including saved rooms and rematches. Recess eviction permits a future
  authorized join; it is not a moderation ban.
- Pause freezes physics and match clocks. Resume clears pending inputs and
  rebases the client worker. Local Esc/settings still affects only that client.
- The backend serializes lifecycle writes and uses conditional updates on
  status, allocation metadata and roster. Supabase stores session boundaries and
  the accepted terminal result, not per-tick physics. Humans alone populate the
  platform player roster; bot/controller details travel in separate room metadata.
- The existing canonical Pino logger is compiled into the isolated app artifact.
  Privileged staff observation/control requests are recorded in `audit_log` before
  execution with correlation IDs; request records do not claim a successful effect.
  Validated, bounded client telemetry uses `ROCKET_CLIENT_WINDOW` /
  `ROCKET_CLIENT_STALL`; standalone journal prefixes stay unchanged.
- Chat uses the existing `chat_messages` table, Realtime feed and teacher/admin
  moderation RPCs. Authenticated sends require a currently admitted player;
  names come from verified profiles, messages are limited to 500 characters and
  throttled. Observers read/moderate but cannot send. Voice reuses `GameVoicePanel`
  and the main server's compiled canonical microphone-only LiveKit token helper.
  Tokens require fresh authorization and live room membership; joining voice is
  explicit. Concurrent token requests coalesce, tokens are reused for 30 seconds, and a 20-request/minute/user ceiling replaces the old 3-second debounce. Authorization runs on every request. No extra schema or catalog migration is needed for these features.

## Local verification

For a real-account playtest inside the local app, apply the catalog migration to
the Supabase project used by your local app, then run from the repository root:

```sh
( npm run dev:server ) &
( npm run dev:minecraft ) &
( npm run dev:rocket ) &
npm run dev:web
```

Open the app at `http://localhost:5173` and forward both `5173` and `3000` when
working on the remote VPS. Rocket is a separate origin on loopback port `3000`,
serving its built client, API and WebSocket transport. The root `dev:rocket`
command installs its isolated dependencies if missing, builds a matching app
artifact on every start, and starts the service. Wait for `ROCKET_SERVICE_READY`.
Restart the command after editing Rocket sources; this uses the built client,
not Vite hot reload. Ctrl-C drains the owned service and shuts down its process.
When Rocket runs as a background job, stopping/restarting the foreground web
command does not restart Rocket. Stop that Rocket job explicitly before running
`npm run dev:rocket` again. The runner now fails early with a clear message if
its port is occupied, rather than building a new client while leaving an old
backend in charge of the port.

Local runtime logs use the same canonical `pino-pretty` development transport as
the other services; build artifacts stay optimized and development tuning stays
explicitly disabled. `LOG_LEVEL=warn npm run dev:rocket` filters out routine info
and telemetry. Rejected controls show action, phase, error code, room/session,
user and correlation IDs; unexpected exceptions include their stack. Database
failures identify the operation, resource, HTTP status and bounded Postgres code,
without logging credentials, query parameters or response bodies.

The startup log, `/health`, `/ready` and `/api/rocket/config` expose the release
loaded by that process at startup. Rebuilding files on disk does not change it.
The app checks required capabilities before joining and asks for a server restart
when an older process lacks required waiting-room, social, rematch or save-outcome support.

The runner reuses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `LIVEKIT_*` from
`apps/game-server/.env`; the main server's port and CORS settings are not reused.
Shell variables override the gitignored `experiments/rocket-arena-lab/.env.app.local`,
which can supply `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ROCKET_TICKET_SECRET`,
`ROCKET_MAX_ROOMS`, `ROCKET_PORT`, `LIVEKIT_*` and `APP_ORIGINS`. By default the ticket secret
is generated once in the ignored `.run/app-ticket-secret` file and reused across
local restarts; keep it to retain access to local saves. Allowed parents are `http://localhost:5173` and
`http://127.0.0.1:5173`. Existing profile, invitation and recess checks still apply.

The frontend defaults to `http://localhost:3000` only in development. If your
browser uses a different dev hostname or forwarded port, set
`VITE_ROCKET_SERVICE_URL` in `apps/web/.env.local` and the exact app origin(s) in
`APP_ORIGINS` for the Rocket runner, then restart both commands. An HTTPS app
needs an HTTPS Rocket URL. Never put the service-role key in a `VITE_` variable.

From the lab directory in a full repository checkout:

```sh
npm ci
npm run build:app
npm run typecheck
npm test
npm run test:app
python3 scripts/check-app-runtime.py
```

The HTTP/Colyseus integration harness starts its own local Supabase fixture on
19007 and backend on 19006. It uses no production database or real accounts.
`--browser` additionally starts Vite on 19008 with the actual React session
container and built game frame. It creates/removes two temporary QA entry files
under `apps/web`; it refuses to overwrite pre-existing files. Playwright is an
optional external QA tool selected by `PLAYWRIGHT_MODULE`, not a runtime dependency.
The runtime packaging check uses 19009 and an isolated production dependency install.
`python3 scripts/check-app-dev.py` exercises the root development runner on 19010
using fixture credentials: readable startup/failure logs, capability/release
reporting and graceful shutdown. It does not contact the real database.
Do not run these checks against ports owned by another task.

To run manually, build the app artifact, supply the environment from the example,
then run `node server/dist/index.js`. App mode requires `build:app`, including the
shared logger artifact; standalone lab releases still use `npm run build`.

## Current limits and rollout checks

This is an initial integration, not a production capacity claim. Real Supabase
PostgREST filters/triggers/RLS behavior, Railway ingress, two physical devices,
school-network latency and simultaneous-room performance still need deployment
acceptance. Docker is not installed on this VPS; the separate runtime check
reproduces the runtime copies, clean production install and compiled startup,
but does not constitute an image build or Railway deployment.

Paused games follow the app's existing 24-hour retention policy. The shared
`cleanupStalePausedSessions` job completes old DB records; a live paused Rocket
room also enforces that deadline. Paused heartbeats never advance `last_activity`
or extend the checkpoint expiry. Explicit stop completes the round and records
`stopped_by`, `ended_at`, `is_open=false` and empty connected-player arrays, while
preserving the historical roster. There is no session deletion here.

Empty paused rooms save a server-signed checkpoint and release physics/room
capacity. The next authorized roster member can reopen them. Restored rooms keep
score, remaining regulation time, overtime, teams, bots, pending assignments and
moderation bans, but resume paused at a kickoff. A live manual pause keeps exact
car/ball positions. Fresh profile, invitation/roster, role and recess checks still
apply on return. A graceful SIGTERM checkpoints before disconnecting. An unclean
restart recovers the most recent successful 15-second checkpoint after the old
allocation's lease expires (up to 60 seconds); it can lose recent play. Old or
invalid/expired checkpoints close explicitly. Keep `ROCKET_TICKET_SECRET` stable
across releases: it signs both admission tickets and saved checkpoints. Local dev
stores its generated secret with mode 0600 in gitignored `.run/app-ticket-secret`.

The 30-minute bound applies to active room age, not paused retention. At most eight
staff observers share a room with eight human drivers. These are resource bounds,
not measured capacity. A room without its first human has a 90-second startup grace.
Natural completion and explicit stop retain a live end panel for at most five
minutes while humans remain. The host may propose a same-session rematch; connected
humans accept/decline, then accepted participants and observers load a fresh room
and iframe in a waiting lobby. Scores/clock and stop timestamps reset; teams, bot
slots and bans survive. A rotating allocation ID fences old writes. Fresh policy
checks are required, and a completed session still refuses ordinary gameplay joins.
Offers/votes are in memory only; session completion persists without a rematch.
Fresh and restored rooms both get the first-join startup grace, and in-flight seat
reservations prevent idle disposal during authentication. The app retries bounded
transient failures automatically. Test with a new room if an older DB record
already lost a former participant's membership; this release does not repair it.
Deployment and two-device acceptance remain necessary.

## Initial integration verification recorded 2026-10-18

Initial app artifact: `app-9628974be609c90e`. Client and server telemetry share a
source-derived app build identifier; the backend manifest lives in
`server/dist/platform/build.json`. Upstream MIT notices ship in the runtime and
at the client `/LICENSE` path.

Completed locally:

- Main Rocket suite: 462 tests passed; lab/simulation suite: 56 plus 3 fleet tests
  passed. Native bot controls matched the evaluated driver over 12,600 samples.
- Focused platform/input/connection checks: 24 passed. App frontend type check,
  two protocol tests and production build passed; shared observability build passed.
- Real HTTP/Colyseus/Rapier fixture: two/eight human connections, teacher observation,
  permissions, private invitations, pause/resume, reconnect, removal/re-entry denial,
  capacity and teacher-first waiting-roster preservation passed.
- Actual React container + built game in Chromium: Hebrew mixed-text names,
  authoritative controls, pause/resume, late-join waiting, reconnect preserving
  the renderer, frame disposal and rejection of foreign-window messages passed,
  with zero page errors. Software WebGL timings are not device-performance evidence.
- Clean production dependency install and compiled entrypoint: readiness, canonical
  Pino startup, static frame policy, denied anonymous matchmaking and graceful
  shutdown passed. This is not a Docker image build or a Railway deployment.

Raw local evidence is under `.run/app-tests.log`, `app-lab-tests.log`,
`app-final-focused.log`, `app-integration-report.json`, `app-browser-report.json`
and `app-runtime-report.json`. These use fixture identities and database responses;
real Supabase and hosting acceptance remain outstanding. Run timing-sensitive lab
checks separately from large frontend builds on this two-core VPS: an initial
concurrent run had one replay-timing failure; the unchanged test and full lab suite
passed when run separately.

## Waiting room and social validation, 2026-10-18

The user-tested local workflow and catalog migrations were committed first as
`4ec2678`. The subsequent waiting room/social app artifact is
`app-3d362d40919d0cf1`.

- Engine suite: 465 passed. Lab/simulation: 56 plus 3 fleet checks passed.
- Real HTTP/Colyseus/Rapier fixture: optional bot counts, host team assignment,
  permission checks, one-car practice with zero bots, two/eight human drivers,
  scoped microphone-only voice tokens, persisted chat and observer read-only
  enforcement, pause/resume, reconnect, private invitations and staff removal passed.
- Actual React container in Chromium under StrictMode: waiting-room controls,
  Hebrew names, chat send/read, shared opt-in voice panel, gameplay input,
  pause/resume, late join, reconnect preserving the canvas, retry replacing the
  frame, disposal and foreign-message rejection passed. Zero page errors and none
  of the reported fullscreen/origin/missing-message-handler warnings remained.
- App frontend type check, protocol checks and production build passed. Clean
  production dependencies and compiled entrypoint readiness/shutdown passed.

Evidence: `.run/app-lobby-tests.log`, `app-lobby-lab-tests.log`,
`app-lobby-browser.log`, `app-browser-report.json`, `app-lobby-runtime.log` and
`app-lobby-light.png` / `app-lobby-dark.png`. Browser fixtures stub identity,
Supabase Realtime subscriptions and database responses; they verify actual UI,
HTTP and physics behavior, not production RLS or delivered microphone audio.
Real-device voice/chat acceptance remains necessary. Software WebGL FPS is not
a gameplay performance comparison. No catalog migration was changed or applied
for these features. Restart `npm run dev:rocket` and refresh the local app to
load the new server and frame together.

## Logging recap and retained-room checks

The app service emits canonical structured logs (pretty printed locally):

- Startup/readiness and matching loaded release; launch/join/leave/disposal;
  accepted and rejected controls; eviction; saved/closed lifecycle events;
  15-second room samples with humans, bots, observers, phase, pause and tick.
- Request failures: operation, bounded error code and correlation ID. Database
  failures: resource, method, status and bounded Postgres code; no query or body.
- Allocation/startup failures: `ROCKET_ALLOCATION_FAILED`; a failed lease release
  also emits `ROCKET_RECOVERY_RELEASE_FAILED`. Valid checkpoints retain their
  original expiry. Failed or ambiguous hibernation writes emit
  `ROCKET_ROOM_SAVE_UNCONFIRMED` and tell the player the save was not confirmed;
  only an acknowledged write emits `ROCKET_ROOM_SAVED`.
- Validated client windows: FPS/frame times, visible/focused/graphics context,
  render/prediction timings, prediction active time, input backlog, RTT/snapshot
  gaps, correction sizes and hard snaps. Bounded stall incidents retain surrounding
  diagnostic samples. These are diagnostics reported by clients, not trusted results.
- Staff observation/control requests also enter the existing audit table.

Logs contain session, connection and user IDs for correlation. Chat text remains
in the existing moderated chat table; it is not copied into Rocket telemetry.
Tokens, service credentials and voice audio are not logged or recorded. There is
no new log-storage/retention backend: the process runner/hosting log retention
still determines how long runtime output is available.

Local regression coverage now includes duplicate voice requests, queued names and
host bot-slot plans, unchanged paused timestamps, release of empty-room capacity,
restoration into a new room with score/time/bots/actor identity, overtime recovery,
checkpoint tampering/scope/expiry and Postgres jsonb key reordering, and stop fields matching the main game server.
The actual React container also includes an entire-room fullscreen toggle and a
roster with host/self/disconnected, waiting-player and teacher-observer indicators.

### Follow-up verification, 2026-10-18

App artifact `app-2e8b43a2b0012e0b`: 471 main tests, 56 lab/simulation tests and
3 fleet tests passed. The final 27 focused platform/core checks include signed
checkpoint JSON ordering, scope, tampering, expiry and regulation/overtime kickoff
recovery. Main app type checking, protocol tests and production build passed.

The real HTTP/Colyseus/Rapier fixture and actual StrictMode React/game browser run
passed: simultaneous voice token requests mint once; host queued-player notice and
bot-slot selection; fullscreen; room roster; empty paused room release/reopen;
unchanged pause timestamps; explicit stop fields; expired-save closure; saved
waiting-room start; staff presence; per-class recess continuation and whole-roster
retention when all become ineligible; fresh service-instance recovery after drain.
The browser reported no page errors or the previously reported startup warnings.

The isolated compiled production runtime and root dev-runner checks passed.
Evidence: `.run/app-retention-tests.log`, `app-retention-lab-tests.log`,
`app-retention-focused.log`, `app-social-browser-check.log`,
`app-browser-report.json`, `app-retention-runtime-check.log` and
`app-retention-dev-check.log`. Fixtures simulated Supabase JSONB key ordering;
these checks did not mutate the real database or deploy a service. Real microphone
and two-device voice acceptance still needs a user playtest.

### Dependency review, 2026-10-19

Compatible lockfile updates move Express to 4.22.3, body-parser to 1.20.8,
proxy-addr to 2.0.8 and qs to 6.16.1. The production audit drops from 16 findings
(including one critical) to 12: zero critical, one high, nine moderate and two low.
The [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
describes the patched trust-subnet issue. Rocket uses its own authenticated HTTP
handler rather than mounting Colyseus's bundled Express authentication routes.

The remaining high finding is Nano ID 2.1.11 via Colyseus 0.15.57. Its
[size-related advisories](https://github.com/advisories/GHSA-xwg4-73v4-xw9w)
require reviewing call sites: the installed Colyseus core uses the fixed default
length of nine for process, room, connection and reconnection IDs. The app does
not expose an arbitrary length parameter, and uses cryptographic random launch
credentials independently. This narrows the observed exposure; it does not clear
the audit. Other legacy auth/UUID dependencies also retain audit findings.

Upgrading the transport framework is a separate compatibility task. Do not force
Nano ID 3 into Colyseus 0.15: its default CommonJS function API differs. Track the
remaining dependency review before production approval, preserving the current
physics/prediction baseline and rerunning transport, recovery and browser checks.

### PR preparation verification, 2026-10-19

Source progress is checkpointed as `d22cc0c` on `dev/rocket-arena-lab`.
`dev/rocket-app-integration` is the focused PR branch, based on current
`origin/main` (`37df5a0`) in a separate worktree. It excludes Wobble source,
dispatch and configuration; legacy catalog migration reconciliation has its own
commit. No SQL was applied, no service deployed and no branch pushed.

Focused game artifact `app-1059433a7e2ae035` passed a fresh dependency install,
game build, real HTTP/Colyseus/Rapier integration and isolated compiled production
runtime readiness/shutdown. The source checkpoint passed 474 engine/client tests,
web type checking, three protocol checks and a production frontend build. Focused
branch type checking, protocol checks and the production frontend build also passed.

The final focused-branch browser run used the actual React container and built
game with two clients. Rematch, host arrival ordering, reconnect preserving the
renderer, direct roster assignment, fullscreen, chat, voice panel, visible save
failure and manual retry passed. It reported zero page errors and none of the
previous startup warnings. Backend fixtures also covered eight humans plus a
teacher, restored memberships, pause/sweep ordering, startup/world failures,
failed lease release, ownership fencing and failed/ambiguous save writes.

Focused-worktree evidence: `.run/app-clean-build.log`, `app-clean-integration.log`,
`app-clean-runtime.log`, `app-clean-browser.log`, `app-browser-report.json` and
`app-runtime-report.json`. Fixtures used no real database; software WebGL provides
functional rather than performance evidence. Real-device microphone delivery,
real Supabase policy/trigger acceptance, Railway setup and the dependency review
above remain production acceptance items. The Docker image itself was not built.
