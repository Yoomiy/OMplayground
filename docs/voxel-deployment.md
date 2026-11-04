# Voxel and classroom deployment

Deploy the web app, voxel service and classroom service with the same reviewed
release/configuration. Use `dev/staging` for the staging environment; production
cutover follows acceptance and the PR to `main`. Provision services and apply
migrations through the normal manual deployment process.

## Services and configuration

| Service | Build / binding | Routing |
| --- | --- | --- |
| Web | Vercel root `apps/web`, Node 24.x; commands below | Static app with SPA fallback |
| Voxel | Repository root, `apps/voxel-server/Dockerfile`; default port 3001 | `/api/voxel/*`, WebSocket `/voxel`, `/health`, `/ready` |
| Classroom | Repository root, `apps/classroom-server/Dockerfile`; default port 8083 | Classroom HTTP and signed `/webhooks/livekit` |
| Board | Existing `apps/game-server` service | Existing board HTTP/socket contract |
| LiveKit | Existing self-hosted SFU or configured provider | Browser-reachable signaling and WebRTC media |

The Dockerfiles restore the committed source-matched release, build the shared
packages and install runtime dependencies. Hosting needs no Rust toolchain.
Use `/ready` for health checks and allow at least the services' 60-second drain
deadline. On Railway, set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=90` and leave custom
start commands empty so the image's direct Node entry runs. Bind to `0.0.0.0`;
injected `PORT` values are honored.

Voxel requires `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`VOXEL_ALLOWED_ORIGINS`, `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
Classroom requires the same provider settings and `CORS_ORIGIN`, plus the existing
converter/board signing contract. Set `CLASSROOM_CLIENT_IP_SOURCE=railway` only
behind that trusted ingress. Templates are in
[voxel](../apps/voxel-server/.env.example),
[classroom](../apps/classroom-server/.env.example) and
[web](../apps/web/.env.example).

Origin settings are comma-separated exact HTTPS origins without paths, trailing
slashes or wildcards. A shared `CORS_ORIGIN` referenced by `VOXEL_ALLOWED_ORIGINS`
works when its resolved value includes the actual frontend origin. Each generated
preview hostname is a distinct origin. Keep Supabase and LiveKit secrets on servers.

Watch paths for the voxel service include `/apps/voxel-server/**`, `/games/voxel/**`,
`/packages/game-logic/**`, `/packages/observability/**`, `/package.json` and
`/package-lock.json`. Classroom uses its own workspace, observability and root
manifests. Shared changes must trigger the affected service builds.

## Frontend

The settings in `apps/web/vercel.json` use:

| Setting | Value |
| --- | --- |
| Root | `apps/web` |
| Install | `npm --prefix ../.. ci --include=dev` |
| Build | `npm --prefix ../.. run build:staging:web` |
| Output | `dist` |

Set these public build variables: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GAME_SERVER_URL` (board),
`VITE_VOXEL_RUNTIME_SERVER_URL` (voxel) and `VITE_CLASSROOM_SERVER_URL`.
Use HTTPS service origins without API paths. Rebuild after changing values.
No frontend LiveKit API credential is required; voice tokens contain the endpoint.
`VITE_VOXEL_SERVER_URL` is retired. Development proxies do not provide hosted routing.

## Database migrations

Check migration history on the intended project; local file presence is not proof
of installation. Preserve applied migration files and apply missing versions in order.
A new project also needs its normal school schema, catalog and accounts.

| Version | Purpose |
| --- | --- |
| `20261025010000` | Private checkpoint objects, metadata, leases and bucket |
| `20261025020000` | Session projection and presence |
| `20261025030000` | Trusted lifecycle controls and receipts |
| `20261025040000` | Self-roster departure and admission generations |
| `20261025050000` | Audited staff commands |
| `20261025060000` | Remove/ban/unban policy |
| `20261025070000` | Private persisted chat |
| `20261025080000` | Historical media-policy migration; unused by direct voice |
| `20261029160000` | End without a final checkpoint |
| `20261029220000` | Durable unique world seeds |

The files are under [supabase/migrations](../supabase/migrations). Startup verifies
required gameplay schemas and the private bucket. The historical media policy is
not a voice startup dependency. Readiness does not independently prove every
function body or a successful end-user journey. Keep unrelated main-branch school
migrations aligned with their own deployment requirements; avoid resets or broad
reapplication of already installed migrations.

## LiveKit and classroom cutover

Browsers connect directly to `LIVEKIT_URL`. An HTTP health check does not establish
WebRTC connectivity through the actual network. Test microphone capture and both
directions of audio on the intended school PCs.

Classroom's signed webhook belongs at its `/webhooks/livekit`, using the matching
LiveKit API key/secret. For self-hosted LiveKit, add the classroom URL to
`webhook.urls` and keep the existing destination during staging. Voxel needs no
webhook or signaling proxy. Align the existing classroom/board signing secret and
converter shared secret. See [classroom service](../apps/classroom-server/README.md).

## Acceptance and rollback

Verify the exact deployed frontend/server release together. Check teacher/student
admission and recess closure, observer/player permissions, movement, inventory and
crafting, game sound, two-user voice/chat, pause/resume, end, rejoin and backend
restart recovery. Check a classroom's media, presentation, board and attendance.
Confirm that save failure is visible and forced restart restores committed progress.

Keep the previous compatible images/frontend and their environment configuration
available. Drain the outgoing voxel service before replacing it. Roll back the
frontend and service versions together only after checking their checkpoint/content/
engine compatibility. Compatibility transitions are directional: an older server
may reject saves written by a newer engine. Do not erase worlds or reverse database
migrations as an automatic rollback step. A data rollback requires its own reviewed
backup/recovery procedure. Observe `/ready` and structured lifecycle/save errors
through deployment and drain.
