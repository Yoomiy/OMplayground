# Voxel rewrite checkpoint: staging handoff

This checkpoint contains the replacement game, school adapters, React HUD,
independent classroom service, eight voxel migrations, CI and local dev tooling.
It is ready for local testing and staging preparation. It is not a claim that
hosted gameplay, actual SFU media or deployment has been qualified.

## Test locally

From the repository root with Node **24.21.0**:

```sh
npm run dev:app -- --check
npm run dev:app
```

Open http://localhost:5173; forward only 5173 from a remote workspace. Ctrl+C
drains the services. This uses the configured Supabase/LiveKit project, so school
actions and saves persist there. See [local development](local-development.md)
for environment-file selection and individual commands. `dev:minecraft` has
been replaced by `dev:voxel-server`.

## Build a fresh checkout

Install the pinned Rust **1.99.1** toolchain and `wasm32-unknown-unknown` target;
the game installs wasm-pack **0.15.0**. Follow the [engine toolchain](../games/voxel/UPSTREAM.md)
when provisioning the build host. From the root:

```sh
npm ci
npm ci --prefix games/voxel
npm run build:voxel
npm --prefix games/voxel run verify:release
npm run build --workspace @playground/voxel-server
npm run build --workspace @playground/classroom-server
npm run build --workspace @playground/web
```

Supply the target's browser environment before the last command. Browser and
server must come from the same game build; preserve `artifacts/`, `dist-server/`
and the other generated game build outputs through packaging. These outputs,
dependencies and credentials are intentionally ignored by Git. Do not deploy
only the TypeScript source and expect startup to rebuild missing artifacts.
The production web build and service startup reject mismatched artifacts.
Keep the repository-relative layout for the initial source-based deployment.
For a smaller deployable directory, run `npm run package:voxel-server` after the
game build, then follow [production packaging](../apps/voxel-server/docs/packaging.md).
It includes a Dockerfile and fixture-only image smoke test. The isolated native
package passes locally; Docker validation awaits CI or a Docker-equipped host.
Hosting/routing still needs qualification on the selected platform.

The committed default world is 512×512×256. Change the
[shared world profile](../games/voxel/docs/world-profile.md) before building both
sides, never on one side of an existing release. Different-size checkpoints are
refused without resizing or deleting data.

## Configure distinct services

| Process | Binding and routing |
| --- | --- |
| Web | Deploy `apps/web/dist`; retain SPA fallback and static Wasm/worker assets. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GAME_SERVER_URL`, `VITE_VOXEL_RUNTIME_SERVER_URL`, `VITE_CLASSROOM_SERVER_URL` at build time. |
| Board | Retain the existing board service and its environment. Build `@playground/game-logic` and `@playground/observability` before its normal build/start. |
| Voxel | `npm start --workspace @playground/voxel-server`; default port 3001. Route `/api/voxel/*`, gameplay WebSocket `/voxel`, and voice signaling `/voxel-media/*` to it. Expose `/health` and `/ready` to operational probes. |
| Classroom | `npm start --workspace @playground/classroom-server`; default port 8083. Route classroom HTTP and `/webhooks/livekit` to this service. Repoint the LiveKit webhook destination when cutting over. |
| LiveKit | Retain the configured SFU. Voxel signaling passes through the voxel service; WebRTC media connects to LiveKit directly. An HTTP proxy alone does not qualify media connectivity. |

Use HTTPS endpoints and exact browser origins in production. Set
`NODE_ENV=production`, voxel `VOXEL_ALLOWED_ORIGINS`, and classroom/board
`CORS_ORIGIN`. Vite's local proxies are development-only. Server bindings include
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`; never expose secret keys as `VITE_` settings. Classroom
converter and board-signing settings must retain their existing shared contract.
See the service `.env.example` files, [production entry](../apps/voxel-server/docs/production-service.md)
and [classroom service](../apps/classroom-server/README.md).

The target database needs all eight `20261025010000`–`20261025080000` voxel
migrations in order. The user's configured project already passed their
read-only readiness checks; a separate staging project needs its own migration
installation and school data. The additional main-branch migration
`20261026162928_add_kindergarten_and_grade_nine.sql` is included in this branch;
its application was not performed or independently verified by this checkpoint.
Do not reapply already-installed migrations or reset old data as part of the
build. Check target migration history separately from local file presence.

## Evidence and remaining checks

The current game build is
`c293fe5e2511d2bc656ea33756509e834b8761fc743a9d2d8a4e83cebd2ad799`.
Local validation includes the full engine/domain/source/packaged suites, 51
voxel service tests, 168 web tests, strict types, web production build, trusted
desktop survival input, and actual React/local SQL school workflows. Three dev
tests cover graceful shutdown, typed workers and HTTP/binary WebSocket routing.
Hosted read-only startup checks all eight schemas and allocates zero rooms.
Detailed limitations and historical build identities are in the
[progress record](voxel-runtime-rewrite-progress.md) and immutable evidence
archives; older archives do not qualify the current source automatically.

Before production cutover, verify these on the actual staging deployment:

- Teacher/student admission, outside-recess rules, observer/play mode, chat,
  pause/resume, closure, moderation and immediate access revocation.
- A natural survival session on a school PC: pointer lock, keyboard/mouse,
  inventory/crafting, equipment, sound, visibility, acceptable frame pacing.
- Two actual users' proximity voice, teacher mute/revocation, reconnect and
  classroom media/presentation/board/attendance through the real SFU.
- Save, disconnect/reconnect, process restart/crash recovery, graceful drain,
  provider failure and clear saved/failed acknowledgements. Review the proposed
  recovery loss window of at most 30 seconds against actual behavior.
- Product acceptance of world size, survival/equipment balance and deferred
  weather-driven block simulation; verify the chosen school PC/browser floor.
- Platform-specific artifact packaging, TLS/WebSocket routing, readiness,
  shutdown grace of at least the service's 60-second drain deadline, and
  coordinated web/voxel/classroom rollback.

No larger synthetic player-count run or mobile/tablet matrix is required for
this private-school checkpoint. No headcount caps are introduced. Keep the old
deployment available until the replacement workflows pass; the old source and
assets are recoverable from Git history. Do not send new-format saves to the
old service or overwrite checkpoints while reverting application versions.

This checkpoint does not apply SQL, change provider settings, start a normal
hosted-backed stack, push Git commits or deploy. The prepared automated hosted
journey creates temporary Auth users and school records; that exact mutation
still requires the user's explicit authorization after automatic approval
review rejected the earlier request. Manual tests with the user's own accounts
can proceed through the local/staging app.
