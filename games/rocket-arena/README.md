# Rocket Arena

The Playground's multiplayer car-ball game. Players enter through authenticated
app sessions; there is no standalone lobby, anonymous matchmaking or room-code
service. A dedicated Colyseus/Rapier server owns physics and match outcomes; an
isolated Three.js frame presents the game inside the React app.

Adapted from [EndPx/Rocket-Arena](https://github.com/EndPx/Rocket-Arena), revision
`1aead71579bc988b53cc0d181ab9a4585fd52265`. The upstream [MIT license](LICENSE) and
[asset provenance](docs/asset-provenance.md) are retained.

## Development

From the repository root, use the existing development commands:

```sh
npm run dev:server &
npm run dev:minecraft &
npm run dev:rocket &
npm run dev:web
```

Open the app on port 5173 and choose Rocket Arena. The dedicated Rocket service
uses port 3000; it installs its dependencies when needed and builds matching
client/server artifacts before starting. Stop the old Rocket background job
before restarting it. Restarting the web frontend does not restart Rocket.

The runner reuses server-only Supabase and LiveKit settings from
`apps/game-server/.env`. Optional Rocket overrides live in the ignored
`games/rocket-arena/.env.app.local`; shell variables take precedence. Defaults
allow `http://localhost:5173` and `http://127.0.0.1:5173`. Use `APP_ORIGINS` for
other exact app origins and `ROCKET_PORT` for a different local service port.
The stable local signing secret is `.run/app-ticket-secret`; keep it across
restarts so existing saves remain readable. On first use of the new source path, the runner reuses the former local signing
secret and falls back to the former settings file only when the new one is absent.
It never overwrites an existing new-path secret/settings file.

## Layout

- `server/src/platform`: authenticated launch, admission/policy, bot controllers,
  host controls, lifecycle, persistence, logging and diagnostics.
- `server/src/rooms`, `server/src/systems`: authoritative fixed-step engine,
  snapshots, rosters, scoring, kickoffs and match rules.
- `simulation`: shared Rapier physics used by the server and prediction worker.
- `shared`: contracts, geometry, constants and immutable tuning snapshots.
- `client/src/prediction`: bounded worker replay/history confirmation and smooth
  presentation. These are production gameplay code, with regression tests.
- `client/src/platform`: validated parent/frame bridge and authenticated reservation.
- `scripts`: build and app integration/runtime verification only.
- App UI: `apps/web/src/game/RocketSessionContainer.tsx` and `useRocketSession.ts`.

This is an independent npm workspace with its own lockfile. It keeps the game's
Colyseus/schema dependency versions isolated from the main app workspaces and
supports a small separate Railway image. It is production source under `games/`,
not a lab package enrolled in the root `apps/*` workspace glob.

## Gameplay and ownership

One to eight humans, optional server-owned bots, two teams with four car slots
each. Hosts choose bots/teams and start, pause, resume, end or offer a consented
rematch. Late arrivals wait for kickoff; the host can assign them to an empty
or bot slot. Staff can observe/moderate without consuming a car. Names, chat,
opt-in voice and fullscreen use app session UI.

Verified identity, invitations, membership, gender and per-child recess policy
are enforced on the server. Transport connection IDs are separate from stable
car slots and durable session membership. Transient loss reserves a seat for
30 seconds. An empty/paused room saves a signed checkpoint in Supabase for
24 hours and releases live simulation capacity. Recovery starts paused at a
fresh kickoff; a live pause preserves the exact physical state. Rematches keep
the platform session but rotate room/allocation/transport lifetimes.

The shipped presentation uses prediction, render-paced inputs, a 50 ms pose
buffer, batched car bodies and a simple ceiling. The lighter-graphics setting
remains available. There are no comparison selectors, old timing clocks or
local-storage overrides for experimental driving modes.

## Verification

With Node 24 and dependencies installed in this directory:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:app
python3 scripts/check-app-runtime.py
python3 scripts/check-app-dev.py
python3 scripts/check-local-settings.py
```

The integration harness uses isolated Supabase HTTP fixtures and real
Colyseus/Rapier, not the actual database. It covers two/eight humans, staff,
bots/teams, rematches, reconnect/retention, allocation fencing and injected save
failures. Unit/property tests include the production prediction/physics engine.

For the actual React/game browser fixture, install Playwright Chromium, then:

```sh
ROCKET_TEST_HOOKS=1 npm run build
npm run test:app -- --browser
npm run build
```

`PLAYWRIGHT_MODULE` can point to an existing Playwright module. The test build
exposes room/prediction handles only for the browser fixture. The final ordinary
build removes those handles; it is the artifact to run/deploy. Software WebGL
checks verify behavior and cleanup, not a device performance target.

See [deployment and operations](DEPLOYMENT.md) for Railway, logging, saves,
known limits and the remaining dependency review.
