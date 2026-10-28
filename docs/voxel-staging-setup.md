# Staging setup: dev/staging

The user will configure/create hosting services manually. Use branch
**`dev/staging`** for the staging environment. Keep `main` unchanged; create its
PR after staging works. The current release uses the existing 512×512 world,
visual/audio weather and snapshot recovery defaults.

## Current staging backends

Both services were deployed from `dev/staging` and returned HTTP 200 from
`/health` and `/ready` on 2026-10-28:

| Service | Public origin / frontend variable |
| --- | --- |
| Voxel | `VITE_VOXEL_RUNTIME_SERVER_URL=https://voxel-server-dev.up.railway.app` |
| Classroom | `VITE_CLASSROOM_SERVER_URL=https://classroom-server-dev.up.railway.app` |

Use the intended staging frontend origin in the shared `CORS_ORIGIN`, referenced
by voxel's `VOXEL_ALLOWED_ORIGINS`. The user selected
`https://o-mplayground-game-server-git-dev-staging-yoomiys-projects.vercel.app`.
Both backends returned HTTP 204 with that exact `Access-Control-Allow-Origin`
on 2026-10-28. The frontend redirects to Vercel sign-in for unauthenticated
requests. A generated per-deployment preview hostname is a different origin
and was not allowed by either backend's CORS.

For local development, use [`apps/web/.env.example`](../apps/web/.env.example)
and [`npm run dev:app`](local-development.md), with local frontend URL overrides
left empty so Vite routes to the local services.

The [voxel CI run for staging commit `0fcf84a`](https://github.com/Yoomiy/OMplayground/actions/runs/40757368780)
passed both runtime and image jobs on 2026-10-28. This includes source/packaged
integration, PostgreSQL, web tests/build, browser journeys, desktop survival over
a delayed connection, and clean image startup/readiness/graceful shutdown with
fixture providers. The selected staging frontend origin passed its CORS check;
the manual teacher/student staging journey in step 4 is still pending.

## 1. Railway: voxel service

Create or repoint the staging voxel service in the existing Railway project.
Use repository root `/`, branch `dev/staging`, and Dockerfile path
**`apps/voxel-server/Dockerfile`**. It restores the source-matched checked-in
Wasm release, builds shared packages and installs production runtime dependencies;
no Rust installation or prebuilt local directory is required on Railway.

Use `/ready` for the healthcheck. Set
`RAILWAY_DEPLOYMENT_DRAINING_SECONDS=90` to allow the service's 60-second graceful
shutdown to finish before Railway sends SIGKILL. Leave any custom start command
empty so the image's Node command runs.
The image starts Node directly, listens on `0.0.0.0`, and defaults to port 3001;
an injected `PORT` is honored. Generate a public HTTPS domain, then set:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Staging's selected Supabase project URL |
| `SUPABASE_SECRET_KEY` | That project's server-only `sb_secret_…` key |
| `VOXEL_ALLOWED_ORIGINS` | Exact staging web origin, e.g. `https://your-staging-web.vercel.app` |
| `LIVEKIT_URL` | Staging's selected `wss://…` endpoint |
| `LIVEKIT_API_KEY` | Matching server API key |
| `LIVEKIT_API_SECRET` | Matching server API secret |

Referencing a shared `CORS_ORIGIN` from `VOXEL_ALLOWED_ORIGINS` works when its
resolved value includes the actual staging web origin. Multiple entries are
comma-separated exact HTTPS origins, without paths, trailing slashes, wildcards
or localhost entries in production.

Use these watch paths so changes to shared runtime dependencies also deploy:

```text
/apps/voxel-server/**
/games/voxel/**
/packages/game-logic/**
/packages/observability/**
/package.json
/package-lock.json
```

The selected Supabase project needs all eight voxel migrations
`20261025010000`–`20261025080000`. Startup fails before listening if a schema or
private bucket is missing. The already-configured project has passed this check;
a new project needs its own migrations and school accounts/catalog data.

## 2. Railway: classroom service

Create a separate staging service from the same repository/branch. Root `/`,
Dockerfile **`apps/classroom-server/Dockerfile`**, healthcheck `/ready`, default
port 8083 and at least 60 seconds termination grace. Generate its HTTPS domain.

Set `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LIVEKIT_URL`,
`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and `CORS_ORIGIN` to the exact staging web
origin. Set `CLASSROOM_CLIENT_IP_SOURCE=railway` for Railway's actual ingress.
Retain the existing document-converter URL/shared secret and classroom/board
signing configuration from the current environment. See the service's
[environment example](../apps/classroom-server/.env.example).

Classroom webhooks belong at this service's `/webhooks/livekit`, not voxel.
For the user's self-hosted LiveKit, add
`https://classroom-server-dev.up.railway.app/webhooks/livekit` to the existing
`webhook.urls` list. Use the existing `webhook.api_key` when it matches classroom's
`LIVEKIT_API_KEY` and matching `LIVEKIT_API_SECRET`. Apply the configuration through
the normal LiveKit deployment process. Keep the current production URL during
staging. This is the same signed webhook implementation formerly mounted in the
old Minecraft service; its destination moves to the independent classroom service.
See [LiveKit's self-hosted webhook configuration](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/).

Use the provider projects intended for staging: these are normal services with
background room/checkpoint maintenance, not provider-free test fixtures.
Keep the board service's CORS and shared classroom signing settings aligned.

## 3. Vercel: web

Use the staging project/environment that tracks `dev/staging`:

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Node | `24.x` |
| Install command | `npm --prefix ../.. ci --include=dev` |
| Build command | **`npm --prefix ../.. run build:staging:web`** |
| Output directory | **`dist`** |

These commands and the existing SPA rewrites are recorded in
`apps/web/vercel.json`; they run from that project's root directory. The root
package script builds `apps/web/dist` using the same published game release as
the voxel image.

Configure these build-time variables for the staging branch/environment:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Same project URL as the backend services |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | That project's browser publishable key |
| `VITE_GAME_SERVER_URL` | Existing staging board-service HTTPS origin |
| `VITE_VOXEL_RUNTIME_SERVER_URL` | New staging voxel-service HTTPS origin |
| `VITE_CLASSROOM_SERVER_URL` | New staging classroom-service HTTPS origin |

Do not use the old `VITE_VOXEL_SERVER_URL`. Browser URLs have no trailing API
path. Rebuild the web deployment after changing these values. Copy Vercel's
actual staging origin into both backend origin lists, then redeploy those
services. Use the web app's existing SPA rewrite configuration.

## 4. Open staging

First check each backend's `/health` and `/ready` returns 200. Sign in through
the staging web URL with a staging teacher, create/open a fresh voxel session,
and test joining, walking/mining/building, inventory/crafting, voice, chat,
pause/resume, exit/rejoin and a backend restart. Student admission still follows
the configured recess and school rules; teacher testing works outside recess.
Teachers initially observe without editing. For mining/building, choose
**הצטרפות כשחקן/ית** to enter as a player in the teacher's configured partition.
Also open a classroom to check media/presentation and the board service route.

Current automated evidence includes the approved actual hosted Auth/Storage
save/restart/revocation journey and the current-build React/native/local-SQL/
configured-SFU browser flow. The latter uses generated audio, measures near and
distance behavior, enforces mute/ban, and verifies room/resource cleanup. These
are launch-candidate checks, not a claim that your staging URLs are deployed.

Once the actual staging deployment works, create the PR from `dev/staging` to
`main` and carry over the corresponding production service configuration.
The agent has not created or changed Railway/Vercel services.
