# Historical Worker deployment record

This describes the lab before action-10. The old release and unit are retained
for rollback. The public hostname now serves the Node runtime in [LAB.md](LAB.md).
References to current/published below describe that historical deployment.

# Wobble Rush 3D multiplayer lab

Public URL: **https://wobble.labs.play-ormenachem.com**

Engine development: [stabilization work and remaining acceptance gates](STABILIZATION.md).
These development changes are not the published release described below.

Current source: [authoritative Node runtime, commands and acceptance gates](ACTION.md).
Use `bun run build:action` / `bun run start:action` (or `bun run dev`) for current
development. The published Worker below retains its matching old client. The
current client requires the action-host handshake and cannot use that Worker.

Owner: Playground lab operator, user `ubuntu`. This standalone experiment belongs
to Oracle ARM64 VPS `84.13.78.187`, checkout `/home/ubuntu/OMplayground`. Source and
playtest only: Playground identity, catalog, registry and production data are separate.

## Source and releases

- Upstream: https://github.com/code-yeongyu/wobble-rush-3d
- Pinned base: `b395e4a91ebdfb829533b1ae6beda244371658a3`.
- License: MIT; original `LICENSE` retained.
- Content release: `20261015-spiral-09`, pack `playground-content-7`.
- Release directory: `/srv/playground-labs/wobble/releases/20261015-spiral-09`.
- Active link: `/srv/playground-labs/wobble/current`.
- Previous matching release retained: `20261015-docks-08`; older packs are also retained.
- Exact published source: `e0a59f43d152e8a2ead52519b206db8e97e983ad`, also in `SOURCE_REVISION`.
  Later QA/documentation commits do not alter that matching client/backend snapshot.
- `RELEASE.sha256` identifies built assets/Worker/lockfile; `SOURCE.sha256` identifies
  the independent source snapshot. `UPSTREAM.json` records provenance and adaptation.

Spiral Summit's first ground route now ends at the elevator. The former direct
ground exit is removed; take the lift four metres up and leave on the upper pier,
joining the spiral's descent. The alternate spiral route still climbs continuously.

The preceding release corrects the moving-floor interpretation: arrow-marked sideways and
reverse conveyors push at least three times harder (minimum 9.43 m/s before
remix), while forward boosts keep their speed and physical moving tiles return
to their earlier travel rhythm. Shutter Shuttle's gate challenge now uses an
arrow-marked sideways conveyor. Docking gaps, separate ferry tracks and raised
roadblock bottoms remove moving-tile interpenetration. Pendulum Pier's branches
now join a single approach before a full-width shutter. The catalog remains
23 courses; earlier countdown, camera and shared-junction paint fixes remain.
See [CONTENT.md](CONTENT.md) for the concrete mechanics and authoring checks.

The native Worker/Durable Object runs locally through Wrangler/Miniflare/workerd.
There is no remote Cloudflare publishing, binding or account credential. Billing cron
triggers are omitted; empty local budget KV leaves the service open. Telemetry and
Request.cf metadata fetching are disabled. Room/KV state and logs persist under
`/var/lib/playground-lab-wobble`. The original `wrangler.jsonc` and upstream README
are retained for provenance; use the lab configs below instead of upstream deploy.

## Playtest

1. Reload the public page on both computers to get the new content version.
2. First player chooses a course, **Single race** or **Three-race cup**, and optionally
   **Remix obstacle rhythms**. Leave the room code empty and select **Play Online**.
3. Share the four-letter code. The second player enters it and selects **Play Online**.
   The room's choices take precedence over the joining player's menu selection.
4. The host can adjust settings before the first race. Changes reset everyone's ready
   check. Both select **I'm ready**. Online rooms require 2–8 human racers.
5. Finish and compare round results and cup standings. **Next race** moves everyone
   to the next ready lobby; the cup route stays locked. **New cup** clears standings.

Suggested human test: on **Spiral Summit**, choose the ground route on the right
from the starting camera. Follow its end to the lower pier, ride the elevator and
leave at the upper pier. Compare against the spiral route with a second player.
Then race **Lift Lock** and ride both essential elevators.
Then try **Shutter Shuttle**: its arrow-marked floor pushes sideways while the
shutter is closed; countersteer and hop until green.
On **Sky Transfer**, split between the diagonal ferry and the jump islands; on
**Pendulum Pier**, compare the wide ferry against the narrow elevated causeway.
Use Q/E and C through the reverse bends and try the lower Terrace Tangle braid
to assess whether the lower bridge view is comfortable. Finally run a remixed
three-race cup, compare scores and test checkpoint recovery and New cup.

WASD/arrows move, Space jumps (hold for height), Shift dives, R respawns, mouse drag
orbits; Q/E rotates and C centres behind the runner. **Leave race** returns to the menu and leaves the online room. Desktop keyboard
is supported; there are no touch movement controls. Each online race ends after three
minutes; unfinished racers receive DNF and zero cup points. Missing/old content-version
clients receive a reload message before joining.

## Build and local checks

This section reproduces the **published Worker snapshot**; use its matching
source release. For the current checkout, follow the Node commands in `ACTION.md`.

Independent `bun.lock` pins Bun-compatible dependencies: Three 0.185.1, Zod 4.4.3,
Wrangler 4.114.0 and workerd 1.20260722.1. On this VPS, Node is
`/home/ubuntu/.local/share/fnm/node-versions/v24.21.0/installation/bin/node`.

```sh
cd /home/ubuntu/OMplayground/experiments/wobble-rush-lab
export PATH=/home/ubuntu/OMplayground/ops/labs/tools/bun-1.4.3/package/bin:/home/ubuntu/.local/share/fnm/node-versions/v24.21.0/installation/bin:$PATH
bun install --frozen-lockfile
bun test
bun run typecheck
bun run lint
bun run scripts/qa/course-pack.ts
bun run scripts/qa/route-tradeoffs.ts
bun run build
WRANGLER_SEND_METRICS=false node node_modules/wrangler/bin/wrangler.js deploy \
  --dry-run --config wrangler.lab.json --outdir worker-output
```

The dry run bundles locally without uploading. Verify port ownership with `ss -ltnp`
before starting an isolated development worker; 19003 was used temporarily for this
release's staging checks and is stopped after handoff:

```sh
WRANGLER_SEND_METRICS=false CLOUDFLARE_CF_FETCH_ENABLED=false \
node node_modules/wrangler/bin/wrangler.js dev --local \
  --config wrangler.runtime.json --no-bundle --ip 127.0.0.1 --port 19003 \
  --inspector-port 0 --persist-to .wrangler/docks-qa \
  --show-interactive-dev-session false
bun run scripts/qa/ws-integration.ts http://127.0.0.1:19003
bun run scripts/qa/cup-integration.ts http://127.0.0.1:19003
```

## Hosting and rollback

Published backend: **127.0.0.1:19002**, owned by enabled persistent system unit
`playground-lab-wobble.service`. Unit source: `ops/labs/playground-lab-wobble.service`;
installed: `/etc/systemd/system/playground-lab-wobble.service`. It uses explicit Node,
read-only release/source/dependencies and writable `.wrangler` scratch/systemd state.

Caddy serves `/srv/playground-labs/wobble/current/dist` and proxies `/api/*` and `/ws/*`
unchanged. HTTP/WSS endpoints use the browser's origin. Caddy source is local ignored
`ops/labs/Caddyfile`; installed config `/etc/caddy/Caddyfile`. The existing Caddy routes were retained; no Caddy/DNS/firewall
change was needed for this content release. Workerd internal/inspector ports are dynamic
loopback listeners. Rocket owns 19001; app 8080/8081 and forwarded 3000/5173 are reserved.

```sh
systemctl status playground-lab-wobble.service --no-pager
sudo journalctl -u playground-lab-wobble.service -n 100 --no-pager
sudo systemctl restart playground-lab-wobble.service
sudo systemctl stop playground-lab-wobble.service
curl -fsS https://wobble.labs.play-ormenachem.com/api/health
```

Create future releases in separate directories, install from the frozen lockfile,
build matching outputs and create `.wrangler` scratch. Switch the link atomically,
then restart only the Wobble unit. A restart disconnects active rooms. Verify assets,
health, room creation and two WSS clients; restore the previous release on failure.

To roll back this release:

```sh
sudo ln -s /srv/playground-labs/wobble/releases/20261015-docks-08 \
  /srv/playground-labs/wobble/current.rollback
sudo mv -Tf /srv/playground-labs/wobble/current.rollback /srv/playground-labs/wobble/current
sudo systemctl restart playground-lab-wobble.service
curl -fsS https://wobble.labs.play-ormenachem.com/api/health
```

Reload clients after a rollback. To unpublish, stop/disable only this unit and remove
only its Caddy hostname block, using `ops/labs/README.md` to validate/install/reload.
Preserve shared hosting and other games. Persistent local state is retained on rollback.

## Validation evidence

- Spiral-09 passed all 32 actual-physics Spiral runs (classic/remix × four seeds ×
  four pilots), capturing every checkpoint with zero falls. A regression traces
  a ground-route runner boarding low and riding above 3.5 metres before the first
  checkpoint in classic and remix; the old direct exit and shaft have no static
  floor. Evidence: `evidence/spiral-physics.txt`, `evidence/spiral-rides-test.txt`.
- Its immutable snapshot passed 465 tests, client/server typecheck, lint, frozen
  install, client build and local Worker dry-run. All 185 source hashes and eight
  release hashes verify. The continuous audit still finds zero intersections for
  all 30 moving tiles. Evidence: `evidence/spiral-frozen-*.txt`,
  `evidence/spiral-source-verify.txt`.
- Six render-only lower/middle/upper frames from two viewpoints were inspected;
  the ground approach ends at the lower pier, the elevator remains separate, and
  the upper pier joins the descent. Zero page errors. Evidence:
  `evidence/spiral-render/summary.json`, `evidence/spiral-docks/summary.json`.
- Staging and public native two-WebSocket lifecycle checks passed (protocol
  finishes are synthetic). HTTPS health and all four public client files match
  the immutable release. Missing-version and pack-6 clients get `content_update`
  and close 1008. Evidence: `evidence/spiral-staging-protocol.txt`,
  `evidence/spiral-public-protocol.txt`, `evidence/spiral-public-assets.json`,
  `evidence/spiral-old-clients.json`. The staging process on 19003 is stopped.
- The actual public two-browser cup passed all 14 checks on Spiral Summit,
  Pendulum Pier and Vault or Wait. Both racers finished all rounds and agreed on
  results and final 30/24 points, then reset the cup and left. On Spiral the
  ground/elevator pilot finished in 53.330s, versus 49.965s for the spiral pilot.
  Zero page errors. Backend samples across 256.6s used 3.50 CPU seconds (1.37% of
  one core), 257.8–280.9 MiB RAM, 375.75 MiB service peak and zero restarts.
  Evidence: `evidence/public-spiral-v2/summary.json`,
  `evidence/spiral-public-resources.json`, `evidence/public-spiral-browser-v2.txt`.
  The first browser closed unexpectedly during round one; its evidence is
  retained at `evidence/public-spiral-browser.txt`. The isolated repeat drew at
  most once per ten seconds to reduce software GPU load, retaining normal
  inputs/physics and the existing clock tolerance. These browser checks do not
  establish physical-device performance or multiplayer capacity.

Preceding docks-08 validation:

- 464 unit tests passed, along with client/server typecheck.
- All 736 actual-physics races finished and captured every checkpoint:
  23 courses × classic/remix × four seeds × four pilots. Evidence:
  `evidence/docks-physics-final.txt`, `evidence/docks-unit-final.txt`.
- The continuous clearance audit found zero deck/skirt or mover-track
  intersections across all 30 moving tiles, for their complete travel segments.
  It includes an independent between-endpoint collision regression. Evidence:
  `evidence/docks-clearance-final.txt`.
- Actual run/jump physics confirms a player cannot simply run through reverse
  flow, while jumping gains forward progress. Tests verify diagonal forward
  boosts retain speed and the Pendulum shutter blocks every supported column
  across the reunited road, then clears them when raised.
- The immutable snapshot installed from the frozen lockfile and passed the same
  464 tests, typecheck, lint, continuous clearance audit, client build and local
  Worker dry-run. Its 185 source files and eight release-manifest entries verify;
  all four client outputs exactly match the staging assets used below.
- Actual solo browser races finished on Lift Lock (40.47s), Shutter Shuttle
  (12.23s), Sky Transfer (28.03s) and Pendulum Pier (42.38s), using ordinary
  collision, checkpoints, jump inputs and finish triggers. Countdown mutations
  and Q/E/C camera checks also passed; zero page errors. These are simulation
  times, separate from public wall-clock race times. Evidence:
  `evidence/docks-controls/summary.json`, `evidence/docks-controls.txt`.
- Staging and public native two-socket lifecycle and three-round protocol cups
  passed. These protocol finishes are synthetic. HTTPS served four byte-exact
  client assets; missing-version and pack-5 clients received `content_update`
  and close 1008. Evidence: `evidence/docks-public-protocol.txt`,
  `evidence/docks-public-cup.txt`, `evidence/docks-public-assets.json`,
  `evidence/docks-old-clients.json`.
- The public two-browser cup passed on Shutter Shuttle, Twin Turbo and Cloudline
  Fork: both racers finished all rounds, agreed on results and 28/26 final points,
  then reset the cup and left. All 14 lifecycle checks passed with zero page errors.
  Backend samples across 258.3s used 2.18 CPU seconds (0.84% of one core),
  278.3–294.6 MiB sampled RAM, 393.9 MiB service peak and zero restarts.
  Evidence: `evidence/public-docks/summary.json`, `evidence/docks-public-resources.json`.
- Eighteen render-only endpoint/midpoint and open/closed frames passed across
  Lift Lock, Harbor Hoppers, Sky Transfer, Pendulum Pier, Shutter Shuttle and
  Clockwork Crossing, with zero page errors. Representative images were
  inspected for dock seams, separated ferry tracks and full-width gates.
  Evidence: `evidence/docks-render/summary.json`.

Previous mechanisms-07 passed 459 tests, all four new solo browser races and a
public two-browser cup on Lift Lock, Terrace Tangle and Pendulum Pier, including
matching results/standings, New cup reset and leave. It remains retained alongside
docks-08. The operator clarified that moving floor meant conveyors, reported
moving-tile interpenetration and identified the partial Pendulum merge shutter.

Release 06 completed all 19 solo rendering checks, the rendered junction pixel
comparison, byte-exact public assets, native two-socket lifecycle, old-client
rejection and a complete public two-browser cup on Spiral Summit, Canyon Choices
and Twin Turbo. Both clients agreed on results and standings; no page errors.
Evidence: `evidence/public-balance/summary.json`, `evidence/balance-previews/summary.json`,
`evidence/balance-rendering/summary.json`, `evidence/balance-public-assets.json`.
Its 608 race runs and 156 equal-skill route comparisons informed the retained
tradeoffs; Spiral Summit averaged 25.36/25.91 seconds for ground/spiral plans.
These bot averages guide tuning, not human difficulty or precise parity.

Prior release `20261012-content-02` passed 408 unit tests, 192 actual-physics bot runs
and a complete public two-browser cup; the operator confirmed multiplayer and gave
feedback requesting faster platforms, wider bars and more branching courses.

Browser harness `scripts/qa/lab-smoke.mjs` uses two separate contexts and actual
course autopilot: no teleporting, collision bypass or forged finishes. The host uses
the mixed path and the guest uses the skill path on winding courses. It checks
catalog search, host selection, guest controls, readiness reset, a full three-round
cup, local/remote movement, matching results/standings, next-round/new-cup behavior
and leaving. `LAB_PREVIEWS=skip` leaves solo rendering to the separate
`scripts/qa/course-previews.mjs` check. On this VPS:

```sh
FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu \
LAB_COURSE=spiral-summit LAB_PREVIEWS=skip LAB_PIXEL_RATIO=0.125 LAB_DRAW_MS=10000 \
LAB_EVIDENCE=evidence/public-spiral-v2 \
node scripts/qa/lab-smoke.mjs > evidence/public-spiral-browser-v2.txt 2>&1

FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu \
LAB_COURSE=shutter-shuttle LAB_PREVIEWS=skip LAB_PIXEL_RATIO=0.125 LAB_DRAW_MS=3000 \
LAB_EVIDENCE=evidence/public-docks \
node scripts/qa/lab-smoke.mjs > evidence/public-docks-browser-v2.txt 2>&1

FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu \
LAB_URL=https://wobble.labs.play-ormenachem.com LAB_EVIDENCE=evidence/mechanisms-previews \
node scripts/qa/course-previews.mjs > evidence/mechanisms-previews.txt 2>&1

FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu \
LAB_URL=https://wobble.labs.play-ormenachem.com LAB_LAYOUT=overview \
LAB_COURSES=lift-lock,shutter-shuttle,sky-transfer,pendulum-pier \
LAB_EVIDENCE=evidence/mechanisms-layouts \
node scripts/qa/course-previews.mjs > evidence/mechanisms-layouts.txt 2>&1

FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu \
LAB_URL=http://127.0.0.1:19003 LAB_EVIDENCE=evidence/balance-rendering \
node scripts/qa/rendering-fixes.mjs > evidence/balance-rendering-final-v2.txt 2>&1

FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu \
LAB_URL=http://127.0.0.1:19003 LAB_EVIDENCE=evidence/docks-controls \
node scripts/qa/mechanism-controls.mjs > evidence/docks-controls.txt 2>&1

FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu \
LAB_URL=http://127.0.0.1:19003 LAB_EVIDENCE=evidence/docks-render \
bun run scripts/qa/docks-render.mjs > evidence/docks-render.txt 2>&1

bun run scripts/qa/docking-audit.ts > evidence/docks-clearance-final.txt
```

QA-only pixel ratio 0.125, disabled shadows and at most one GPU draw per three
seconds (ten for Spiral-09's repeat) reduce load for two SwiftShader contexts on this two-core VPS. The
solo check uses 0.25/one second; the posed render check uses 0.35/three seconds.
The cup harness waits for each course's first actual paint before readiness.
Shared-clock samples are timestamped inside the render wrapper before a GPU call
can block, and still use the same one-second tolerance and matching-round check.
The initial public attempt completed Pendulum with both clients (48.815/93.546s),
then failed the old sampling assertion after a long Festival load. The corrected
sampler changes QA observation only; live physics and networking are unchanged.
Evidence: `evidence/public-docks-browser.txt`.

Screenshots and `summary.json` record actual checks; service CPU/memory samples
exclude browser GPU/processes. This does not establish
physical-device performance, precise network synchronization or multiplayer capacity.

Camera obstruction checks cover static decks and skirts. A lower clear angle keeps
full viewing distance where possible; very tight cover can still require zoom or
a manual orbit. Q/E and C avoid having to drag while negotiating reverse turns.

The operator confirmed the original release worked. Physical devices on different
networks still need a content playtest: keyboard response, camera, difficulty, gate
synchronization, checkpoint recovery, finish order, scoring and replay. Refresh/rejoin
during a race remains unsupported. Unfinished stale racers are removed after 30 seconds;
active unfinished racers now reach the three-minute deadline. Local stored room records
are retained. NPCs use client-local fixed-step simulation and can diverge under dropped
frames; server cup standings include human racers only. Mid-race placement uses forward Z,
so it is approximate on backtracking or unequal-length branches; final results and
cup ordering use finish times.

App integration remains a later task: identity/room authorization, movement/results
validation, pause/recess, reconnect, teacher controls, Hebrew/RTL, touch and observability.

## Feedback by release

| Release | Evidence/feedback | Next test |
| --- | --- | --- |
| 20261012-b395e4a91ebd-01 | Original multiplayer worked; needed more content | Retained baseline |
| 20261012-content-02 | Operator liked expanded pack; requested quicker movers, platform-wide bars and branching courses | Retained immediate rollback |
| 20261012-routes-04 | Operator found the roads too parallel and similar; requested intersections, reverse turns, heights, stronger skill incentives and narrower arrows | Retained immediate rollback |
| 20261014-creative-05 | Operator liked the creative courses; reported intersection flashing, unfair short/long route costs and braided camera obstruction | Retained immediate rollback |
| 20261014-balance-06 | Operator requested triple sideways/backward speed, essential elevators, moving waits, camera help and countdown flicker fix | Retained immediate rollback |
| 20261014-mechanisms-07 | Operator clarified moving floor means conveyors; reported merging tiles and a partial Pendulum merge gate | Retained immediate rollback |
| 20261015-docks-08 | Stronger conveyors, corrected conveyor wait, restored tile pace, clear docks/tracks and full-width Pendulum shutter | Human belt challenge, docking appearance and gate coverage |
| 20261015-spiral-09 | Ground exit removed from Spiral's first half; elevator required for its ground route | Compare elevator wait and spiral climb with two players |
