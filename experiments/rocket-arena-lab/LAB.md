# Rocket Arena driving lab

Standalone evaluation copy of [EndPx/Rocket-Arena](https://github.com/EndPx/Rocket-Arena),
based on `1aead71579bc988b53cc0d181ab9a4585fd52265`. The upstream MIT notice is
retained in `LICENSE`. This directory does not register a game in The Playground.

## Play

Public playtests use **https://rocket.labs.play-ormenachem.com**. See the release
record below for the active snapshot and verification evidence.

Open forwarded **3000** for a local built preview, or **5173** for development.
Both proxy HTTP matchmaking and WebSockets under `/game` to the loopback server
on 2567. That internal port does not need forwarding. HTTP and HTTPS forwarded
URLs both work; the client selects WS or WSS from its page URL.

Choose **Custom Room → Create Room → Start Match**. A solo room is allowed.
For two people, share the six-character room code; the second person chooses
**Custom Room → Join Code** before the host starts.

For practice, choose **Custom Room → Practice · 1 bot** (two total players), or
**Practice · 7 bots** (eight total players). Wait for the roster to fill, then
press **Start Match**. With seven bots there are three bot teammates and four
opponents. These are simple ball-chasing playtest drivers, not competitive AI.
They use ordinary Colyseus clients on the VPS; your browser runs one renderer
and one prediction worker. Bots leave when no human remains. The supervisor
serves at most two practice rooms concurrently. If opponents do not appear,
leave and retry after another practice room ends.

Static car-body parts now batch by material and shadow settings. The default
URL uses batching; append **`?cars=original`** to compare the previous car draws.
Appearance, moving wheels, transparent canopy, boost effects and physics are
preserved. Telemetry groups the two car-rendering choices separately.

- W/S or arrow keys: accelerate/brake/reverse.
- A/D or arrow keys: steer.
- Shift: boost. Space: jump; another press can double jump or flip.
- Ctrl: powerslide. C: change camera. Esc: match menu.

The top-right selector changes presentation immediately:

| Mode | Behavior |
| --- | --- |
| Local prediction | A dedicated worker runs shared car/ball physics and bounded replay. The browser presents completed results and smooths small corrections. |
| Shorter delay | Server snapshots with a 40 ms interpolation buffer. |
| Original delay | Server snapshots with the upstream 100 ms interpolation buffer. |

All three use the same lab server and sequenced input stream. “Original delay”
compares upstream presentation timing, not a byte-for-byte unmodified server.
For lower rendering cost, choose **Esc → Settings → Lighter graphics**. This
uses 70% resolution per axis, disables shadows and hides exterior decoration.
The preference is saved locally; turn it off to compare standard graphics.

The panel shows WebSocket round-trip time, actual render frame rate and pending
inputs. The mode is remembered locally. Debug details are available from
`window.__drivingLab.getDebugState()` in the browser console.

The client now defaults to Hebrew; append **`?lang=en`** for English. Car labels
show players' names, with a white outline/arrow and **אני** badge on your car.
They follow the displayed car poses, hide behind the camera/off-screen and reduce
overlap by preferring your own/nearer labels. Hebrew/Latin names use isolated
browser text. Labels do not test occlusion against arena geometry. For a direct
comparison, append **`?names=off`**; combine flags with `&`.
See [Hebrew presentation](LOCALIZATION.md) for RTL/font validation and
[retaining practice opponents](BOT-INTEGRATION.md) for the proposed app work.
The [app integration plan](APP-INTEGRATION.md) records the adapter direction,
remaining product choices and acceptance requirements.

## Ceiling rendering comparison

The default ceiling uses plain transparency, retaining its geometry, tint, opacity
and collision behavior while removing its extra refraction render pass. Use
`?ceiling=glass` to restore the preceding refractive effect within the same build.
Combine it with a timing query using `&`, for example
`?timing=buffer&ceiling=glass`. Keep graphics, timing, viewport and similar movement
fixed when comparing. `ceilingEffect` is retained in telemetry and export groups;
older releases without that field remain labeled legacy.

The goal is fewer rendering stalls and prediction/server-presentation handoffs,
with smoothness and small corrections taking priority over average FPS. Prediction
validation, shared physics, clock policy and presentation buffering are unchanged
by this rendering comparison. Collision feel and physical accuracy still need
separate evaluation after the client has rendering headroom.

## Timing comparisons

Smoothness, prediction continuity and small corrections take priority over average
FPS. Ordinary visits now select **buffer**: previous input scheduling plus the
50 ms pose timeline. The autonomous clock remains an opt-in experiment.

| URL query | Input scheduling | Predicted pose presentation |
| --- | --- | --- |
| none or `?timing=buffer` | Previous, render paced | 50 ms timeline |
| `?timing=baseline` | Previous, render paced | Previous filter, no timeline |
| `?timing=clock` | Autonomous worker | Previous filter, no timeline |
| `?timing=combined` | Autonomous worker | 50 ms timeline |

These are independent of the three response modes and the saved graphics setting.
Keep Local prediction, the same graphics setting, viewport and similar play when
comparing timing links. The test name appears beside the build ID. Logs/downloads
include timing profile, actual input clock and pose buffer; exports keep them in
separate groups. Changing timing links reloads the page, so leave the room first.
`baseline` is an in-build timing comparison, not a byte-for-byte old client: it
retains the current telemetry and fixed-tick input sample timestamps. The actual
previous release was also checked separately during this investigation.

Reproduce the isolated worker scheduling comparison against an explicit baseline:

```sh
TIMING_BASELINE_ROOT=/srv/playground-labs/rocket/releases/20261014T164118Z-1caa24996fb4 TIMING_LATENCY_MS=50 npx tsx --conditions=development scripts/benchmark-timing.mts .run/timing-comparison.json
```

Run from the lab directory against its running backend (`LAB_TEST_ENDPOINT`
overrides loopback 19001). The harness creates temporary solo rooms, compares
previous/buffer/combined, and runs both steady input and a 260 ms foreground CPU
stall every 700 ms. `TIMING_REVERSE=1` reverses the case order; `TIMING_SECONDS`
sets each measured period. It measures transport, prediction and control resets,
not WebGL or device FPS. It retains correction sample counts and omitted unaligned
restores so zero measured large corrections cannot be mistaken for full coverage.
The 260 ms stall deliberately exceeds the experimental clock's 200 ms lease;
it reproduces that mechanism, not the exact timing of the human test.

## Run

Node 22+ and npm are required. From this directory:

```sh
npm ci
npm run build
npm run lab
```

This runs the compiled backend and built client on 3000. For live code changes:

```sh
npm run dev:lab
```

This runs the backend and Vite client on 5173. Do not run both commands at once:
they both start the backend on 2567. To serve the built client while the development
backend is already running, use `npm run preview -w client` in a second terminal.

## Scope and current limitations

The `simulation` workspace contains the original arena, grounding, rigid bodies,
controller and boost-pad rules. Server physics imports it too, so handling rules
are shared. The server consumes bounded, sequenced inputs at its own fixed tick
rate and reports acknowledgements, angular velocity and controller state.
Each acknowledgement also carries the server tick where that command first
applied. The browser keeps up to 64 body/controller checkpoints indexed by tick.
When a snapshot agrees with its checkpoint, the live predicted world continues
without restoring and replaying pending inputs. Otherwise it follows the existing
restore/replay path. Scores and match transitions remain authoritative; prediction
cannot award a goal.

Confirmation requires the exact local acknowledgement and application tick,
matching phase/epoch, roster, controls, jump/dodge/wall state and boost-pad timers,
and agreement across every car and the ball. Position tolerance is 2 cm, velocity
5 cm/s, angular velocity .02 rad/s and quaternion chord .0025 (about .29 degrees).
Boost amount tolerance is .05 and recharge/pad timers .001 seconds. Missing
checkpoints or tick metadata, changed remote controls and state mismatches all
trigger reconciliation. Old snapshots without the new tick field remain usable
through that path. The history holds small state objects, not whole Rapier world
snapshots; the solver and server tick schedule are unchanged.

Prediction physics runs in a dedicated worker. Pending inputs remain capped at
24 (400 ms); the main thread owns WebSockets, keyboard sampling, rendering and
foreground telemetry. It permits one worker update in flight, coalesces snapshots
and keeps at most three current input ticks queued. Source/body messages are small
objects; no SharedArrayBuffer or special cross-origin isolation is required.

Replay targets are fixed when a job starts. An 8 ms soft work slice yields only
between complete Rapier steps and resumes the same world/cursor through
MessageChannel tasks. New controls cannot extend unfinished jobs indefinitely.
Already-completed work is published even when its last step exceeds the slice;
unfinished work no longer clears history or starts a one-second CPU cooldown.
This moves expensive work away from rendering rather than making physics cheaper.

Only completed car/ball states are presented. Both result completion age and the
input/snapshot sample age are bounded to 150 ms; server snapshot age is bounded
to 500 ms, and phase/epoch must match. Older results use server
presentation until catch-up succeeds. Initial loading and returning to prediction
can briefly show catch-up while the worker constructs its world. Mode changes,
room departure and neutral controls discard obsolete work; room generations and
control revisions prevent delayed replies affecting another context. If the
worker fails, server presentation keeps a monotonic bounded input stream.
Backlog recovery still waits for discarded commands to be acknowledged. The
server retains four commands at most and consumes the newest two after a batch.
Original/shorter modes perform no prediction physics.

Predicted car and ball presentation keeps up to 12 completed poses and samples
their timeline **50 ms behind the display clock**. This trades display latency
for steadier motion when worker completions arrive irregularly. Each pose carries
its input/snapshot sample time separately from worker completion time. The timeline
interpolates bracketed poses and caps velocity/angular extrapolation at 50 ms;
residual errors blend with exponential rate 18/s instead of restarting a one-step
interpolation when a worker message arrives. Temporary server fallback and return
to prediction retain the display filter. Room/phase/epoch changes, render gaps over
150 ms and position discontinuities of at least 3 m reset or snap appropriately.
Original and shorter server interpolation retain their existing behavior.

Default input generation again follows render updates; shared physics and replay
still run in their dedicated worker. The experimental worker clock is opt-in:
it advances inputs at 60 Hz with a 30 Hz parent heartbeat and immediate keyboard
updates. It keeps the existing
three-input catch-up limit, single-slot mailbox, 24-input pending limit and bounded
physics slices. A 200 ms control lease releases controls when the parent stops
sampling; incoming snapshots cannot extend an old lease. Blur, hidden pages and
menu suspension also neutralize controls. Render FPS still counts rendered frames.

The suspended finite-state/live-metadata micro-optimizations are removed from
this source, matching the previously restored `ce0ebfa` simulation baseline.
History validation again reads complete live state, and finite-state recovery
retains defensive immutable copies. The earlier tuning/grounding caches remain.

Canonical immutable tuning is reused for contact points, throttle/steering curves
and the steering group, rather than rebuilt/revalidated per car per step. Only
canonical object identities take this path; custom/mutable tuning retains its
validation and fallback behavior. The same curves, ray probes, collision world,
solver rate and replay policy remain in use.

Prediction reuses the fixed arena query index during restore/replay. Grounding
only queries fixed colliders; moving or repairing cars and the ball cannot change
those hits. Arena construction and Rapier's normal physics step update the index.
The canonical immutable jump/air tuning group is also resolved once; custom tuning
still takes the existing validation/fallback path. Collision geometry, solver
settings, tick rate and input caps remain shared with the preceding release.

Debug state includes acknowledgement lag, replay time, recovery reason/count and
whether prediction is active. Windowed diagnostics are sent every ten seconds,
and at context changes, under `[DrivingLabV2]`. Previous clients remain readable
under `[DrivingLab]`. These are performance measurements, not input payloads.

Other cars are simulated during replay using their last known server inputs,
while their visible meshes are interpolated. Unexpected remote maneuvers and
collisions can therefore need corrections, especially at high ping. Local ball
feedback is also provisional. This is a playtest prototype, not completed
production networking. Phone controls, authentication, reconnect and classroom
pause are outside this lab's scope. The Esc menu does not pause the match.

## Playtest measurements

Version 2 records actual frame intervals (window FPS, mean, maximum, histogram
p95 upper bound, frames over 33/50 ms), RTT, replay and local physics cost,
snapshot arrival gaps/age, and maximum pending inputs/acknowledgement lag.
Prediction-active percentage weights frame intervals during visible, focused
browser play in `playing`/`overtime`. It measures whether prediction was active
at those frames; it is not an exact wall-clock trace of presentation or CPU time.
Node automation is labelled separately and excluded from foreground comparisons.

Windows also count history checks, confirmed snapshots, skipped replay steps,
actual replay steps, missing checkpoints and mismatches. The panel shows the
confirmation percentage among checked snapshots. Legacy v2 windows without these
counters normalize them to zero. Worker builds also count catch-up yields,
maximum input lag, completed-result age and input/snapshot sample age. Active percentage requires a completed
result within its age/phase bounds; it does not count arbitrary unfinished work
as active. Main-thread render intervals remain separate from worker cost events. These counts help distinguish reduced work from
prediction becoming inactive; compare them alongside active percentage and CPU
fallbacks rather than FPS alone.

Fallback counts distinguish CPU budget, input backlog, stale server state,
controls released, mode changes and errors. Successful reconciliations retain
car/ball position and car rotation correction distributions, car corrections
over 10/50 cm, and hard snaps (at least 3 m). Kickoff/phase rebases are counted
separately and excluded from normal correction measurements. Corrections over
10 cm within 4 m of the authoritative ball/another car have separate proximity
counts; proximity does not prove a collision. Aborted replay has a fallback
reason/cost sample rather than a successful correction sample. In the worker
build, correction comparisons use the same physics tick before and after replay.
An input acknowledgement can remain unchanged while the server advances, so it
cannot establish equal-time poses. When replay does not include the old pose's tick,
`unalignedCorrections` counts the restore rather than inventing a correction distance.
Counts from releases before 2026-10-14 include some ordinary motion and are not
directly comparable with the corrected measurements.

Windows separate mode, phase, player count, focus, visibility and viewport changes.
Each includes client build, run ID, sequence, UTC time, viewport, pixel ratio,
reported CPU cores, graphics quality, render scale and effective shadow setting.
Optional client timing distributions separate scene/effects, presentation,
camera/HUD/audio, WebGL render submission, worker request/reply and pose age;
draw-call maxima help compare graphics settings. Submission time is CPU-side
and does not measure full GPU execution; worker round trip includes queueing
and simulation rather than measuring either alone. Legacy windows remain valid. Server logs add room/session, server build, receive time and
current player count. Metadata describes the device's rendering workload; it
does not identify its model. Histograms use fixed memory with no sample sorting;
p95 values are bucket upper bounds, not exact percentiles. The client retains
120 windows in memory, downloadable with **Download test data**; refreshing
clears local history. The journal retains received windows according to host
journal retention. Context-change logging is rate limited; a disconnected or
closed page can lose its final partial window. Browser export preserves unsent
windows until refresh. The telemetry does not change prediction/authority rules.

Export retained journal samples or summarize a downloaded JSON file:

```sh
sudo journalctl --all -u playground-lab-rocket --since '2026-10-12 00:00:00 UTC' -o json --no-pager > .run/journal.jsonl
python3 scripts/export-telemetry.py .run/journal.jsonl --output .run/comparison
python3 scripts/export-telemetry.py rocket-arena-playtest.json --output .run/device
```

The exporter writes raw window JSON/CSV and a summary JSON. Comparisons include
only focused, visible browser gameplay and group by run, matching builds, room,
mode, player count, graphics settings and timing profile. FPS/active percentage use weighted totals; reported
`frameWindowP95UpperMedianMs` is the median of window p95 bounds, not a pooled
p95. Raw windows retain background/context/recovery information for diagnosis.
For the next test, use two physical devices, play each mode for about a minute,
and deliberately contest the ball and bump cars. Compare correction size and
frequency alongside active percentage and frame spikes, then assess the feel.

## Checks

See [the two/eight-player scaling evaluation](SCALING.md) for six sustained bot
measurements against the preceding lifecycle release, and the subsequent car
batching comparison. One eight-player room held 60 server steps/second without dropping time;
reference prediction activity was 98.04–99.98% on loopback and 99.90% with about
100 ms added RTT at 30 Hz updates. All players moved; sampled manifolds confirmed
car/ball and car/car contacts.
There were no backlog recoveries in these automated runs, so the earlier human
97-recovery case remains unresolved. Normal-graphics draw calls increased
323→596 with eight cars visible; batching now reduces those counts to 286→448.
These are per-room/backend and single-predictor measurements, not eight-device
FPS or simultaneous-room capacity guarantees. Repeatable harnesses and limitations
are documented in that evaluation. The older prediction/server benchmark is
retained separately from the new rendering and practice checks.

```sh
npm run typecheck
npm test
npm run test:lab
npm run test:physics
```

The added integration check uses real Rapier worlds to compare server and client
driving, boosting, jumping and restoration/replay. Input-queue checks cover
duplicates, forged authority, batching and bounded work. Human evaluation should
compare straight driving, quick turns, jump/boost response and ball hits in all
three modes, then repeat with two devices and realistic network conditions.

The query reuse regression compares every car/ball body state against eager query
rebuilds through head-on collisions, ramp/wall teleports and car removal/rejoin.
`scripts/benchmark-prediction.mts` measures a warmed two-car restore plus six-input
replay, with physics/query/raycast timing. To compare against the previous source:

```sh
mkdir -p .run/benchmark-baseline
git -C ../.. archive a6b9e1d experiments/rocket-arena-lab/simulation/src | tar -x --strip-components=4 -C .run/benchmark-baseline
PREDICTION_BENCH_BASELINE=$PWD/.run/benchmark-baseline npx tsx --conditions=development scripts/benchmark-prediction.mts .run/prediction-comparison.json
```

The harness alternates old/new batch order in one process, checks exact final
body-state agreement and retains timing samples' summaries. VPS measurements
describe this replay workload, not total device CPU or browser rendering FPS.

To compare full reconciliation with tick-confirmed history using the same current
physics implementation:

```sh
npx tsx --conditions=development scripts/benchmark-history.mts .run/history-comparison.json
```

This paired two-car harness delays inputs and snapshots by three ticks each and
drives, turns and boosts for 240 ticks, measuring client updates after 60 warmup
ticks. Counter totals cover all 240 ticks; timing covers the remaining 180 updates.
It alternates update order and checks identical final authoritative states. Only
in this harness, the watchdog clock is held fixed during each update so both
algorithms remain active; actual durations use `hrtime`. The old 8 ms watchdog
is held fixed only in that harness; the current worker uses 8 ms soft slices. A cheaper fallback would otherwise give a misleading comparison.
This isolates prediction-update work and does not measure network jitter, browser
rendering, real-device FPS or collision quality.

`npm run test:network` runs two real Colyseus clients against loopback 19001.
Use `LAB_TEST_ENDPOINT=wss://rocket.labs.play-ormenachem.com/game npm run test:network`
for the public proxy. Add `LAB_TEST_WORKER=1` to exercise the production worker
logic through a Node Worker adapter. The adapter alone can inject slow physics for
benchmarks; the public worker exposes no delay/CPU testing control. The smoke test
drives, adds 360 ms round-trip latency, drops inputs for
1.2 seconds, checks recovery and switches comparison modes. It waits for the worker
to finish constructing its world before checking return to prediction and neutral
controls. It does not render.

To reproduce slow-device recovery versus pinned release `aee3443`:

```sh
mkdir -p .run/worker-baseline
for file in prediction.ts telemetry.ts prediction-history.ts; do
  git -C ../.. show aee3443:experiments/rocket-arena-lab/client/src/lab/$file > .run/worker-baseline/$file
done
WORKER_BENCH_BASELINE=$PWD/.run/worker-baseline/prediction.ts npx tsx --conditions=development scripts/benchmark-worker.mts .run/worker-comparison.json
```

This sequential baseline/worker comparison uses the same current physics with
5 ms minimum step cost, an actual Node worker, a 30 Hz foreground update loop and
varying inbound/outbound delay. The authoritative core advances independently.
One warmup second precedes eight measured seconds per variant. It records active
presentation, result age, queues and foreground callback duration. It contains no
WebGL rendering and does not measure total device CPU or prove real-device feel.

## Deployment and operations

Owner: ubuntu / Rocket Arena lab. Published backend allocation: **127.0.0.1:19001**.
Caddy serves `client/dist` directly and strips `/game` for HTTP/WebSocket proxying.
App ports 8080/8081 are reserved. The superseded tunnel's services are retired
after successful direct-host verification. Development backend remains 2567.

Source snapshots and matching builds live under
`/srv/playground-labs/rocket/releases/<release-id>`; `current` selects the active
matching client/backend. `release.json` records the source SHA-256 and upstream
revision. Files in a deployed release are retained for inspection/rollback.

Prepare from this experiment directory (dependencies/build happen in the copy):

```sh
python3 scripts/prepare-release.py /srv/playground-labs/rocket/releases
# Enter the printed release path, then:
npm ci --no-audit --no-fund
VITE_LAB_RELEASE=<printed-release-id> npm run build
```

The maintained system unit is `ops/labs/rocket.service`; install as
`/etc/systemd/system/playground-lab-rocket.service`, then daemon-reload and enable
it. Its explicit Node executable is v24.21.0; update the unit if that runtime moves.
The hostname block is in `ops/labs/Caddyfile`. Validate/install/reload following
`ops/labs/README.md`, preserving other hostnames.

```sh
systemctl status playground-lab-rocket --no-pager
sudo journalctl -u playground-lab-rocket -n 80 --no-pager
sudo systemctl restart playground-lab-rocket
sudo systemctl stop playground-lab-rocket
```

Practice bots have their own persistent unit, maintained at ignored
`ops/labs/rocket-bots.service`, installed as `playground-lab-rocket-bots.service`.
It runs explicit Node v24.21.0, `scripts/lab-bots.mjs`, from the matching current
release, connects only to loopback 19001 and opens no listener. Restart both
Rocket units after switching a release; stopping the bots alone leaves manual
rooms available. Rollback to a release without the bot script also requires
stopping/disabling this unit.

```sh
systemctl status playground-lab-rocket-bots --no-pager
sudo journalctl -u playground-lab-rocket-bots -n 50 --no-pager
sudo systemctl restart playground-lab-rocket-bots
sudo systemctl stop playground-lab-rocket-bots
```

To switch releases, first record `readlink -f /srv/playground-labs/rocket/current`,
then atomically replace `current` with a symlink to the new matching release and
restart only `playground-lab-rocket`. Restarting terminates rooms. If verification
fails, restore the recorded link and restart/verify once before further changes.
The previous matching direct-host snapshot is retained (see the active release
record). Keep Caddy/labs readiness and other games running during rollback.

To reproduce the immutable-tuning optimization against the smoothing release:

```sh
mkdir -p .run/client-load-baseline/src
# Restore all tracked simulation sources at the pinned baseline revision:
git -C ../.. archive 692b91b experiments/rocket-arena-lab/simulation/src | tar -x --strip-components=4 -C .run/client-load-baseline/src
CLIENT_LOAD_BASELINE=$PWD/.run/client-load-baseline/src npx tsx --conditions=development scripts/benchmark-client-load.mts .run/client-load-comparison.json
```

Run the archive command from this experiment's directory. The paired benchmark
interleaves old/new six-step replays including history capture, measures two/eight
cars both separated and in contact, warms 60 batches and measures 120. Entire
car/ball/runtime/pad frames must match exactly after every batch. It excludes
WebGL, worker messaging, network and unpredictable remote-input changes.

Historical suspended-candidate comparison (run from a separate checkout at
`de50379`, whose benchmark and live-metadata API match that candidate):

```sh
mkdir -p .run/state-load-baseline/simulation/src
git -C ../.. archive ce0ebfa experiments/rocket-arena-lab/simulation/src | tar -x --strip-components=4 -C .run/state-load-baseline/simulation/src
CLIENT_LOAD_LIVE_CHECK=1 CLIENT_LOAD_BASELINE=$PWD/.run/state-load-baseline/simulation/src npx tsx --conditions=development scripts/benchmark-client-load.mts .run/state-load-comparison.json
```

On that historical checkout, the extra flag adds one delayed-snapshot validation
after each six-step replay: complete live capture for the baseline versus live
metadata for the candidate. On current source both paths capture complete state.
Complete physical/runtime/pad states must match exactly after every batch.

## Active release — Hebrew UI and player names, 2026-10-17

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261017T181942Z-55b75e8319f2`.
- Source SHA-256: `55b75e8319f2b8304430acc5ea0cb7258f7d047d5b3c9c4f1127a4bffe00bde1`.
- Code commit: `a6f62ad`, branch `dev/rocket-arena-lab`.
- Previous matching release retained: `20261016T003420Z-d36a36046e17`.
  Both releases contain the bot script; restore the matching link and restart
  both Rocket units for rollback. No Caddy, other lab or app service changes.
- Fresh locked install and matching build passed. Type checking, **453 main
  tests**, **56 focused lab tests** (overlapping suites), **3 bot-fleet tests**,
  **7 focused localization tests**, projection/metadata checks and **2 Python
  exporter tests** passed.
- Local built practice passed with one/seven bots in Hebrew with labels and
  English with labels disabled. Literal mixed Hebrew/Latin `<QA>` names remain
  text, labels are bounded to two/eight nodes, and disposal removes the overlay.
- Public page/main/worker bytes match the release. Public Hebrew practice passed
  with one/seven bots; all bots moved and acknowledged commands, eight label
  nodes were bounded, and room/overlay cleanup passed. No console or page errors
  occurred. The first public automation attempt timed out during startup; its
  retry passed with a 60-second setup allowance for this software-WebGL harness.
  Gameplay/prediction assertions were retained. Browser diagnostics were added
  to the QA helper; these helper-only updates do not change the published game.
- Public cached-page/disconnect/fresh-join/lobby/disposal check passed. Terminal
  counts: zero workers, frames, game intervals, resize observers, label layers
  and canvases. Public journal exports retain matching client/server release IDs
  and the new language/labels settings.
- Artifacts: ignored `.run/user-practice-oct17*`, `.run/hebrew-names-qa/*`,
  `.run/english-no-labels*`, `.run/hebrew-names-final-*`, `.run/public-hebrew-names*`,
  and deployed `verification.json`. This handoff follows preparation of the
  source snapshot, whose documentation called this build a candidate.

Human feedback and the complete sustained rendering comparison are recorded in
[SCALING.md](SCALING.md#human-practice-feedback--2026-10-17). Two/eight-player
normal-graphics play averaged about 55 FPS. Original/batched eight-player FPS was
effectively tied; batching had lower submission time, original had lower RTT and
better aggregate prediction continuity. Keep batching and the existing prediction
rules; the logs do not demonstrate a benefit from reverting the renderer.

Player identifiers are a separate HTML overlay with at most eight cached labels.
The camera projects the final displayed car positions each frame using reused
matrix/vector storage. Name/team text updates only when roster values change;
positions update only when their rounded pixel coordinate changes. A resize
observer caches CSS-pixel viewport size, so labels do not require per-frame DOM
measurement. Own-car labels take precedence over overlaps and stay readable near
screen edges; other visible labels favor nearer cars. Behind-camera/off-screen
labels are hidden. There are no extra WebGL meshes/materials/draw calls, physics
work, gameplay network fields, per-car timers, scene raycasts or regenerated text textures.
This is a bounded UI cost, not a promise of zero browser layout/paint cost.

Hebrew is the default with an English URL fallback. System font fallbacks render
Hebrew directly, without web-font downloads; RTL is scoped to text panels.
Key order, scoreboard team order, room codes, sliders and numeric runs remain
LTR/isolate as appropriate. Player names use `textContent`/`bdi dir=auto`; the
nameplate test includes a literal mixed Hebrew/Latin name containing `<QA>`.
HUD translations use a bounded cache of up to 512 dynamic phrases, with shared
patterns, to avoid repeating translation work each render frame. Physics and
protocol identifiers are unchanged.

Labels clear on room changes and disposal; their resize observer disconnects and
the style/overlay DOM is removed on terminal shutdown. Optional `?names=off` and
`?lang=en` are recorded in `playerLabels`/`uiLanguage` telemetry fields and export
groups; older runs retain legacy labels. These are client-only presentation
settings. The exporter also skips journal null/non-text MESSAGE records and the
documented journal command now includes `--all` to preserve long incident traces.

The browser/nameplate practice check passed with one and seven bots, Hebrew
names, eight bounded label nodes, prediction completion, literal text safety,
room cleanup and terminal overlay removal. The focused projection checks cover
clip/behind-camera rejection, local/near overlap priority and local edge placement.
The translation agent verified Hebrew/English lobby, HUD, all settings rows,
mixed-name/code/key direction and actual Hebrew glyphs in Chromium screenshots.
These are functional software-WebGL checks; the next device test assesses the
added overlay's real feel. Practice behavior and the external lab bot service
remain unchanged. [BOT-INTEGRATION.md](BOT-INTEGRATION.md) describes a future
room-owned driver/roster/lifecycle implementation; no app integration is included.

## Previous release — stall diagnostics, batched cars and practice bots, 2026-10-16

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261016T003420Z-d36a36046e17`.
- Source SHA-256: `d36a36046e1739b8cefdafee086bf7b59b08e95777b3c5771f33d7a3d4a420b5`.
- Code commit: `58ffcbe` on `dev/rocket-arena-lab`.
- Previous matching release retained: `20261015T191318Z-8157f8a05b29`.
  Stop `playground-lab-rocket-bots` before rolling back to that release, which
  predates its script; switch the matching link and restart Rocket as above.
- Fresh locked install, matching client/server build and type checks passed.
  **442 main tests**, **55 focused lab tests** (overlapping suites), **3 bot-fleet
  tests**, and the Python journal/download/export regression check passed.
- Public HTTPS page/main/worker bytes match the release. Both persistent Rocket
  services are active; the bot unit is enabled. Caddy and other games were unchanged.
- Public browser checks passed through HTTPS/WSS with one and seven bots, no JS
  errors, completed prediction and correct room/bot cleanup. Seven bots each
  acknowledged 1,206 commands and moved 85–135 m; browser pending maxima were
  6 / 10 in the two/eight-player checks. These are functional software-WebGL
  results, not device smoothness or FPS estimates.
- Public two-client worker smoke passed with added 360 ms RTT and lost inputs:
  maximum pending 24, recovered pending 2, normal-loop prediction activity 100%.
  Its backlog trace contains 18 samples. Public journal export joined seven
  browser incidents to nine windows with matching client/server release IDs.
- An eight-second public two-player sample used 14.0% of one core / 158.5 MiB
  RSS for Rocket and 4.0% / 76.1 MiB for the bot process. A later sample overlapped
  eight-player cleanup and is excluded from active-load claims.
- Additional evidence: ignored `.run/public-bot-practice*`,
  `.run/public-practice-*`, `.run/public-practice-network.log`,
  `.run/release-main-tests.log`, `.run/release-lab-tests.log`, plus deployed
  `verification.json`. This release handoff follows snapshot creation; the
  manifest identifies the copied source, whose documentation called it a candidate.

Adds bounded incident traces for backlog/stale-server recovery and switches
between server and predicted presentation. Each contains up to two seconds of
10 Hz timing samples: sent/acknowledged/completed input sequence, acknowledgement
progress age, snapshot age/tick, worker in-flight/result/sample ages, frame gap,
presentation eligibility reason and server callback/work peaks/dropped time since
its last snapshot. Samples allocate at 10 Hz, not every render frame. Traces are
limited to four per metrics window with per-event cooldowns; renderer handoffs
cannot suppress a backlog incident. Target gaps measure differing presentation
targets, not equal-tick physics corrections. Existing correction metrics retain
their strict tick/ack guards and omission of unaligned comparisons.

Trace packets use integer-millisecond tuples in separate `lab-stall` messages,
preserving the native **4 KB** transport limit. The actual Colyseus encoder is
tested at maximum sample count, identifier lengths and numeric values. Server
validation/rate limits retain only known bounded fields. Journal lines use
`[DrivingLabStall]`; the exporter joins them to `[DrivingLabV2]` windows by run,
window sequence, room and server release. Browser downloads retain readable
objects and sub-millisecond values. No solver, input scheduling, prediction
threshold or recovery guard changes are included.

Car batching merges opaque rigid siblings by material/shadow/order, preserves
negative-scale fender winding and caches merged geometry until the last rig
leaves. Animated/transparent objects retain their original transforms. Fixed
360×240 screenshots with all eight cars, both with/without boost, had **zero
changed pixels** between original and batched draws. Normal no-boost draw calls
fell 323→286 for two cars and 596→448 for eight (11.5% / 24.8%); triangle counts
were identical. These are submission counts, not a device FPS claim.

Built-browser practice checks passed with one and seven VPS bots: human retained
host authority; all bots sent acknowledged controls and moved 56–173 m during
the eight-player scenario; the prediction worker completed with no client errors;
all bots and the room cleaned up after departure. A creation race caught during
QA was fixed by advertising practice metadata only after the human host joins.
The 62.3-second combined functional check (includes loading/lobby/cleanup) used
15.4% of one core / 159.1 MiB RSS for the backend and 11.2% / 248.7 MiB for the
socket-bot supervisor. This shared-VPS/software-WebGL check is not a steady-state
capacity or device smoothness benchmark.

The two-client worker smoke passed with 360 ms added RTT and 1.2 seconds of lost
inputs. Pending commands stayed bounded at 24 and recovered to one. Its backlog
trace distinguished ageing acknowledgements from continuing snapshots; normalized
traces reached the server journal. This validates diagnosis/recovery under a
controlled fault, not the cause of the earlier human 97-recovery run. The next
human practice test supplies that evidence. Raw artifacts: ignored
`.run/car-batching*`, `.run/bot-practice*`, `.run/practice-*`, `.run/trace-packets.log`.

To reproduce locally after building, first verify loopback 19004/19005 are free:

```sh
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs python3 scripts/check-practice-local.py
```

The helper runs only its own isolated built backend, preview and bot processes,
then stops them. It does not mutate public services. On this VPS, Chromium also
uses the existing temporary `LD_LIBRARY_PATH` and `FONTCONFIG_FILE` settings.
`scripts/check-bot-practice.mjs` accepts `LAB_BROWSER_URL` for public verification.

## Previous release — client lifecycle stabilization, 2026-10-15

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261015T191318Z-8157f8a05b29`.
- Source SHA-256: `8157f8a05b296b67cba0c76be8a3a33a5d7ed49c6d2a5574cb4004f54b32e919`.
- Previous matching cleanup release retained: `20261015T190748Z-0c1aef61ec1d`.
  The human-tested ceiling baseline `20261015T142525Z-461106d6140a` remains
  available for rollback/comparison too. Switch the matching release link and
  restart only Rocket using the operations procedure above.
- Fresh locked install and matching client/server build passed. Published page,
  main and worker hashes match the release; HTTPS matchmaking is ready. Only
  Rocket restarted; Caddy, other labs and app services were left unchanged.
- Final two-client public WSS smoke and published Chromium lifecycle check passed.
  The latter verified cached-page events, active-match disconnect/fresh join,
  return to lobby and terminal shutdown during matchmaking, with no JavaScript
  errors and zero remaining workers, animation frames, game intervals or canvases.
  Cache handlers also follow each replacement mount and are removed at disposal.
- Evidence is in ignored `.run/lifecycle-*` and the deployed `verification.json`.
  During the preceding cleanup activation's two-client/browser checks, an eight-
  second backend sample measured 24.0% of one core and 140.8 MiB peak RSS. Its
  server sources match this release; this is operational evidence, not an
  eight-player capacity or before/after performance benchmark.
  This handoff follows snapshot preparation; `release.json` identifies the copied
  source. A first activation used ordinary-user permissions for the root-owned
  release link and failed before switching; the preceding build restarted once.
  The link was then switched with sudo and matching readiness verified. No failed
  release was served.

`client/src/standalone.ts` exports `mountStandaloneClient(container)`, which
supplies the standalone lobby/comparison UI to the shared engine mount in
`client/src/client.ts`. App frames use the engine through `platform/bridge.ts`;
their lobby and results belong to the React container. Both return an idempotent
`dispose()` and reversible `suspend()` / `resume()`. One client may own
a document; mounting a replacement disposes its predecessor. Each mount owns its
page-cache events: a persisted `pagehide` suspends rather than
destroying the scene, and persisted `pageshow` resumes without catch-up input bursts.
Local suspension releases held controls, stops the input clock/render loop and
resets the audio session. The server match continues; this is not a match pause.

Terminal disposal cancels animation and delayed game-over work, terminates the
worker, cancels in-flight matchmaking, leaves the room, invalidates accepted state,
clears keyboard/page/resize listeners, removes UI/styles, releases audio and entity/
arena/light resources and disposes the WebGL renderer/context. Late joins close
their acquired room; older overlapping joins cannot replace a newer connection.
Room changes and disconnects clear stale presentation. Unexpected disconnects
return to a usable lobby with a message and permit a fresh join. Hard disconnect
still removes the car; no slot-preserving reconnect grace was added.

The regression baseline passes type checking, **434 main tests** and **48 focused
lab tests** (the suites overlap). A real Chromium/Vite check exercised cached-page
event suspension/resumption, active-match disconnect and fresh join, stale room
game-over rejection, three same-document mount/join/dispose cycles, and disposal
during real matchmaking. Every disposed cycle had zero workers, animation frames,
game intervals and canvases; remaining global listener/style counts stayed fixed.
Vite's own heartbeat interval is identified separately. No JavaScript errors were
recorded. This uses software WebGL and simulated cache events, not device FPS or
proof of actual browser cache eligibility. Reproduce against a temporary Vite
client (set `LAB_SERVER_PORT` to its backend and use a verified-free loopback port):

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs LAB_BROWSER_URL=http://127.0.0.1:19004 node scripts/check-client-lifecycle.mjs .run/lifecycle-browser.json
```

Playwright is an optional QA installation, outside the game's runtime dependencies.
This pass retains shared physics, prediction/history validation, input scheduling,
pose buffering and simplified-ceiling defaults. It does not claim new FPS gains.

Latest pre-stabilization human feedback: reasonable feel even in normal graphics.
Release `20261015T142525Z-461106d6140a` logged two-player foreground play around
16:40–16:52 UTC: the four-core 1920×958 browser had 573.5 seconds of normal graphics,
38.1 FPS, 99.70% prediction activity, 0.80% frames over 50 ms and two backlog
recoveries. The 12-core 1920×919 browser had 712.5 seconds, 60.0 FPS, 95.66%
prediction activity and 97 backlog recoveries, with RTT up to 2.067 seconds despite
mean worker round trip 2.12 ms. Each browser measured one car correction over
50 cm (67 cm and 119 cm maxima); omitted unaligned restores prevent full coverage.
These different devices are not an FPS comparison and the data does not isolate
the cause of frequent recovery. Evidence: ignored `.run/readiness-*`.

Remaining investigations after this concrete cleanup: diagnose repeated backlog
recovery on the fast browser; classify timing/physical mismatches and improve
correction coverage; test eight actively driving clients and simultaneous rooms.
Reconnect-grace and authoritative match-pause policies still need an explicit
design before integration. Application identity/admission, teacher controls,
localization and touch support remain integration work. No app files were changed.

## Previous release — remove ceiling transmission pass, 2026-10-15

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261015T142525Z-461106d6140a`.
- Source SHA-256: `461106d6140ad9eb571fda1e8125256b8f03fd824e485efdb8b646c1e819b8ea`.
- Ceiling transmission is disabled by default, keeping its transparency, tint,
  opacity, geometry and collision behavior. `?ceiling=glass` restores the preceding
  effect for a same-build comparison. All timing profiles remain; default is
  render-paced input with the 50 ms timeline. Saved graphics preferences remain.
- Compared with the preceding source, `prediction.ts`, `prediction-history.ts`,
  `prediction-worker.ts`, `presentation-filter.ts`, `pose-timeline.ts`, timing
  profiles and all simulation sources are byte-identical. No prediction validation
  thresholds or acknowledgement rules were relaxed. Better physical prediction
  remains a separate investigation; this release targets rendering stalls.
- A fixed-camera, fixed-scene normal-graphics probe reduced draw calls 315→207
  and submitted triangles 71,732→38,258 when toggling transmission alone. Images
  looked effectively the same at that camera. Software WebGL timings are not
  real-device performance measurements, and this does not prove fewer corrections.
- Telemetry now retains optional `ceilingEffect` (`simple`/`glass`); exports separate
  it from timing and graphics settings. Old windows remain readable as legacy.
  The repeatable held-steering diagnostic is in `scripts/benchmark-steady-driving.mts`:
  `npx tsx --conditions=development scripts/benchmark-steady-driving.mts .run/steady-prediction.json`.
  It reports logical snapshot agreement/independent body errors, not device FPS.
- Type checking and **425 full tests** passed. Fresh lockfile installation passed
  in the separate release; the first build was terminated without a compiler error,
  then the matching client/backend build passed on retry. Page/main/worker hashes,
  HTTPS matchmaking and persistent backend readiness matched. Only Rocket restarted.
- Two-client public WSS smoke passed normal driving, 360 ms added RTT, 1.2-second
  input loss, recovery, all modes and neutral controls. Guest received
  421 snapshots; pending remained within 24.
  Normal sampled prediction stayed active throughout; recovered state had
  2 pending inputs and about 17.2 ms result age.
  This validates transport/recovery, not physical-device collision feel.
- Headless Chromium drove the published default, toggled low graphics/restored
  standard, downloaded telemetry and started a room with the glass comparison.
  It verified simple/glass metadata, unchanged timing flags, valid canvas scaling
  and no JavaScript errors. Public moving-camera draw-call counts vary with the
  view and are not the fixed-camera A/B measurement. 11
  browser and 6 Node windows reached
  the matching server; the ceiling labels survived normalization/export grouping.
- Eight-second operational sample during two-client startup/driving: backend
  23.4% of one core, 165 MiB peak RSS. This is not a sustained
  capacity or before/after CPU measurement.
- Previous matching release retained: `20261015T132205Z-1e1b52056180`. Verification
  and detailed evidence are in ignored `.run/ceiling-*` and deployed
  `verification.json`. This handoff follows source snapshot preparation.
- Next user check: use normal graphics, Local prediction and the buffer profile;
  hold the same steering motion for about a minute. Compare the default URL with
  `?timing=buffer&ceiling=glass` while keeping graphics/viewport fixed, then compare
  low graphics if useful. Judge visible corrections, continuity and response delay
  before average FPS. If the issue persists with rendering headroom, collect
  mismatch reasons (timing metadata versus body/runtime drift) and improve input/
  server-tick alignment. Cross-device collisions and eight-player scaling remain
  unverified. App integration remains deferred.

## Previous release — isolate timing and restore input scheduling, 2026-10-15

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261015T132205Z-1e1b52056180`.
- Source SHA-256: `1e1b5205618021cb8c7e62eea97a46cfb9334ffba41b3f48349c940071cc3bd7`.
- Ordinary visits now use previous render-paced inputs plus the 50 ms pose timeline
  (**buffer** profile). Shared worker physics, input/history bounds, server authority
  and graphics settings remain. The independent clock is opt-in. This targets
  repeated control releases/history resets under foreground stalls; it does not
  claim a measured real-device FPS increase or fewer physical corrections.
- Four timing links independently select scheduling and pose buffering; see Timing
  comparisons above. The panel shows the selected test name from startup. Logs and
  downloads include actual clock, buffer duration and timing profile; the exporter
  keeps all four comparisons separate, including legacy windows without metadata.
- Human priority: consistent motion and small corrections before average FPS.
  Start with Local prediction and the same saved graphics setting. Compare normal
  URL versus `?timing=baseline` to isolate the buffer; `?timing=combined` restores
  the preceding independent-clock behavior within the same renderer/build.
  Two-device collisions and physical-device frame pacing still need user judgment.
- Type checking, **425 full tests**, **47 lab tests** and the focused real-worker/
  profile tests passed. The final label adjustment also passed type checking,
  clean build and public browser checks. The simulation/renderer source is unchanged.
- Fresh lockfile installation and matching client/backend build passed in the
  separate release. Main/worker/page asset hashes, HTTPS matchmaking and persistent
  backend readiness matched. Only Rocket restarted; Caddy and other games remained.
- Two-client public WSS smoke passed driving, 360 ms added RTT, 1.2-second input
  loss, recovery, all modes and neutral controls using default scheduling. Guest
  received 425 snapshots; pending stayed within 24.
  Normal sampled driving remained prediction-active throughout; after recovery
  there were 3 pending inputs and about
  16.5 ms result age. This is transport
  validation, not human collision-quality validation.
- Public headless Chromium checked the default profile in gameplay, lighter
  graphics and restoration, JSON download, and all three additional profile URLs.
  Actual clock/buffer values, panel test labels and exported timing metadata
  matched; no JavaScript errors occurred. 9 browser and
  6 Node windows reached the matching server;
  all four timing profiles survived normalization. Software WebGL FPS is unsuitable
  for real-device comparisons.
- Eight-second operational backend sample during two-client initialization/driving:
  15.6% of one core, 142 MiB peak RSS. This is not a sustained
  capacity or before/after CPU benchmark.
- Pre-investigation matching release retained: `20261015T085529Z-71df90ae0d1f`.
  Earlier render-paced baseline `20261014T164118Z-1caa24996fb4` is retained too.
  Intermediate `20261015T131842Z-6bb6997b5219` was briefly activated during checks
  and replaced to correct the startup label on opt-in timing links; runtime policy
  was the same. Activation history is in ignored `.run/timing-*-activation.json`.
- Detailed diagnostic evidence and limitations are recorded in the feedback entry
  below, ignored `.run/timing-*` and deployed `verification.json`. This handoff
  documentation follows source snapshot preparation. Renderer work remains deferred.

## Previous release — pose timeline and independent input clock, 2026-10-15

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261015T085529Z-71df90ae0d1f` (visible in the test panel).
- Source SHA-256: `71df90ae0d1f69388c9eaeec24178e0a89ec6a1a162fc34c31e08faba775696c`.
- Previous matching release retained for rollback:
  `20261014T164118Z-1caa24996fb4`. Matching client/backend switched together;
  only Rocket restarted. Shared Caddy configuration and other games were preserved.
- Predicted car/ball display now samples a bounded 12-pose timeline 50 ms behind
  the render clock. Samples retain their actual physics/input timestamps, not
  worker arrival times. Interpolation and bounded extrapolation handle irregular
  completions; small corrections retain exponential smoothing, with existing
  context resets, hard snaps and stale-result fallback. This deliberately adds
  a display buffer and needs a human responsiveness/collision comparison.
- A deterministic comparison at perfect constant 25 m/s and uniform 33 ms frames
  reproduced old strides of 0.455–1.165 m with delayed worker samples. The new
  timeline produced uniform 0.825 m strides (maximum numerical error 2.3e-16 m).
  This isolates one presentation defect; it does not prove the cause of all
  hitches in the user's uncontrolled solo sessions.
- Input sampling uses a 30 Hz parent heartbeat plus immediate keyboard changes;
  the worker advances its own 60 Hz clock independently of rendering. Work and
  input queues retain their bounds. A 200 ms control lease neutralizes held input
  if parent sampling stops, including cold world initialization; snapshot traffic
  cannot renew stale controls. Actual render intervals still determine FPS.
- **Esc → Settings → Lighter graphics** is saved locally. It uses 70% resolution
  per axis (about 49% of the pixels), disables shadows and hides exterior scenery.
  Gameplay geometry/physics remain unchanged. Standard graphics restores the
  original resolution, scenery and chosen shadow preference.
- New timing windows include scene/effects, presentation, camera/HUD/audio,
  CPU-side WebGL submission, worker round trip, pose age and draw-call maximum.
  Quality, render scale and effective shadows split comparison groups. They are
  optional for legacy telemetry; submission is not GPU time and worker round trip
  includes queueing/physics. Downloaded JSON and journal exports retain the data.
- Restores the previously published `ce0ebfa` simulation/history baseline, removing
  the suspended finite-state/live-metadata changes from source as well. Prior
  immutable tuning/grounding caches remain. Candidate `de50379` stays in Git for
  investigation, without silently reintroducing it into this timing experiment.
- Type checking, **422 full tests**, **44 lab tests** and **seven physics harnesses**
  passed. Regressions cover delayed/irregular presentation, bounded detached pose
  storage, real worker input/movement without renders, control expiry and stale
  snapshot traffic, mailbox bounds, neutral controls and timing normalization.
- Fresh lockfile installation and matching build passed in the separate release.
  Public page/main/worker hashes and HTTP matchmaking matched the release.
  Two-client public WSS smoke passed driving, 360 ms added RTT, 1.2-second input
  loss, recovery, mode changes and neutral controls. Guest received
  420 snapshots; pending inputs stayed at or below
  24. Normal sampled driving was prediction-active
  throughout; after disruption recovery had 3
  pending inputs and about 1.1 ms result age.
- An eight-second sample spanning two-client initialization/driving measured
  23.3% of one CPU core and 176 MiB peak backend RSS.
  This is operational evidence, not a sustained capacity or before/after benchmark.
- Headless Chromium loaded the published worker, drove a solo room, toggled lighter
  graphics and restored standard graphics, downloaded telemetry and reported no
  JavaScript errors. At its 360×240 viewport, canvas resolution changed to 251×168
  and measured draw-call maximum fell from 497 to
  310. This software-rendered check verifies the option,
  not real-device FPS. Seven browser and six Node windows reached the matching
  server journal with quality/timing fields; browser client labels matched too.
- Evidence lives under ignored `.run/timeline-*` and deployed `verification.json`.
  This documentation handoff follows source snapshot preparation.
- Next human check: refresh, keep **Local prediction**, and compare similar solo
  driving for about a minute with standard and lighter graphics; then repeat with
  two devices, including collisions. Assess response delay as well as smoothness.
  Real-device feel/FPS and eight-player gameplay remain unverified.

## Previous release — rollback on 2026-10-14

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261014T164118Z-1caa24996fb4` (immutable tuning reuse).
- Source SHA-256: `1caa24996fb4dd1e278392809bea4a139cebca502000a8107c5ad419cbd42553`.
- Restored after the user reported less smooth solo play on
  `20261014T204509Z-7a994cc98bf2`. The rollback removes the two latest
  finite-state/live-validation changes from the public build, retaining the
  earlier tuning cache and render-clock smoothing. Candidate source and release
  remain retained for investigation. Subsequent timing work restores the baseline
  simulation code too, rather than reintroducing these changes.
- This is a diagnostic comparison, not proof of the regression's cause. There
  are no human foreground samples for this preceding tuning-cache release; the
  earlier smooth human baseline used `20261014T150627Z-024cbf735339`, which is
  also retained. Repeat solo play at the same viewport/device now to separate
  the latest code changes from changed browser/network/runtime conditions.
- Matching client/backend restored together; only Rocket was restarted. Public
  assets, matchmaking and backend readiness verified. Two-client public WSS
  smoke passed normal driving, added latency/input loss, recovery, modes and
  neutral controls; guest received 424 snapshots and pending history
  stayed within 24. The eight-second operational backend sample was
  15.8% of one CPU core and 167 MiB peak RSS, not a performance comparison.
  Rollback evidence is
  retained under ignored `.run/state-load-rollback-*`. Public smoke validation
  is recorded there. Physical-device smoothness is awaiting the user's comparison.

## Suspended candidate — 2026-10-14

- URL: https://rocket.labs.play-ormenachem.com
- Release: `20261014T204509Z-7a994cc98bf2` (visible in the test panel).
- Source SHA-256: `7a994cc98bf2be2bddc1ce98367f8422d9dbb0fc7e8c614984c1572f51827862`.
- Previous matching release: `20261014T164118Z-1caa24996fb4` (immutable tuning reuse).
- Reuses already immutable finite-state fields instead of copying/freezing them
  again, and retains the recovered state when both bounded velocities are unchanged.
  Independent field repair, quaternion normalization, speed limits, signed-zero
  behavior and immutable retained snapshots are preserved. History validation now
  captures only live tick/phase/epoch, roster and controls; complete body/runtime/
  pad comparisons still use checkpoints and authoritative frames. Remote-control
  changes still invalidate history reuse. Physics and presentation policy remain.
- Three interleaved paired runs against pinned simulation source `ce0ebfa` included
  restoration, six physics steps, history checkpoints and one delayed-snapshot
  validation, with 60 warmup and 120 measured batches per case. Whole-world
  car/ball/runtime/pad frames and confirmation decisions matched exactly after
  every batch. Median work fell 3.2–6.0% with two cars, 7.2–9.4% with eight separated
  cars and 5.3–6.3% with eight in contact. A separate replay-only run measured
  4.6% for two cars and 5.4–7.7% for eight. These local Node measurements exclude
  rendering/network/worker messaging and are not browser FPS or total CPU claims.
- The prior tuning optimization is retained. The full collision world, support
  ray probes, solver rate, pending limits, authority and smoothing remain shared
  with the preceding release. Whole-world replay on remote changes still limits
  scaling; phone controls, reconnect and app integration remain deferred.
- Type checking, all 414 full tests, all 36 focused lab tests and seven physics
  harnesses passed. New regressions verify zero body reads for live validation,
  detached controls, rejection of remote input/epoch/roster changes, deep
  immutability, independent field repair and bounded fallback retention.
- Fresh lockfile installation and matching client/backend build passed in the
  separate release. Public HTTPS page, main/worker asset hashes, matchmaking and
  persistent backend readiness verified. Only Rocket was restarted.
- Public WSS smoke used two real clients and the production worker through its
  Node adapter, including normal driving, 360 ms added RTT, 1.2-second input
  loss, recovery, all modes and neutral controls. Normal updates were active
  throughout sampled driving; pending history stayed within 24 and the guest
  received 420 snapshots. Recovered prediction had two pending inputs and
  approximately 16 ms result age.
  This checks transport/recovery; physical-device feel still requires a test.
- An eight-second backend sample spanning initialization/two-client driving
  measured 23.1% of one CPU core and 165 MiB peak RSS. It is
  operational evidence, not a sustained capacity or before/after CPU benchmark.
- Public headless Chromium loaded the real worker, started/driven a solo match,
  downloaded four telemetry windows and reported no JavaScript errors. Browser
  and Node reports reached the journal with the new server release; browser
  client labels matched too. The Node source harness uses `development` for its
  client build. Software-rendered FPS is unsuitable for device comparisons.
- Release build, automated/public verification and resource samples are recorded
  in ignored `.run/state-load-*` and deployed `verification.json`. This handoff
  update follows snapshot preparation; the manifest identifies the copied source.
- Physical-device control feel, FPS and eight-player gameplay require a fresh test.

## Feedback record

2026-10-12, pre-release tunnel build: user reports unusable publication and a huge
pending-input pile. Device/network details were not captured. Automated regression
tests reproduce unbounded replay history, per-packet replay amplification and
six-command render-stall bursts. The new release adds bounded recovery and logging.
Physical-device driving quality, scoring and full match lifecycle remain unverified.
Continue standalone evaluation; app integration is deferred.

2026-10-12, release `20261012T164011Z-495c3532faa9`: live browser journal samples
show 16–25 FPS at roughly 21–68 ms RTT, including original/shorter modes. Pending
history in these samples stays small; prediction repeatedly trips its CPU budget.
Device/browser details are unknown. The queue failure is bounded, but low client
frame rate remains an unresolved playability issue; rendering/physics cost needs
separate measurement on the actual testing devices before an integration decision.

2026-10-12, same release: user reports "wayy better now" and requests a development
branch checkpoint. This is positive playtest feedback; device/network details and
scoring/full-match coverage were not supplied. The next recommended step is to
measure frame time in original/shorter modes and prediction on the testing devices,
then reduce the largest rendering or replay cost while retaining this comparison
release. App integration remains a later decision.

2026-10-12, release `20261012T175623Z-221b11688777`: the user's opponent test
recorded approximately 25–26 FPS across modes. Foreground two-player prediction
was active for about 11% of 257.6 measured seconds, with 221 CPU-budget fallbacks
and two backlog recoveries. Successful reconciliations included nine car position
corrections over 50 cm (maximum 1.8 m); inactive/aborted prediction is excluded.
The opponent browser reported about 1 FPS, limiting healthy multiplayer evidence.
The follow-up optimization removes redundant prediction query rebuilds and caches
canonical immutable jump/air tuning. Three paired two-car six-input replay runs
(300 measured batches each) reduced median time by 15.3–18.1%, with pooled run
medians 5.07 → 4.16 ms (18.0%). Car and ball states matched exactly. This is a
VPS workload comparison; actual device active percentage/FPS needs a new playtest.

2026-10-12, release `20261012T202029Z-e65749e0c650`: the user reports solo
prediction feels stopped almost all the time. The matching foreground browser
run recorded 163.9 seconds, 30.0 FPS, 8.15% prediction active and 147 CPU-budget
recoveries, with no backlog/stale-server/error recoveries. Physics steps averaged
4.93 ms. Only 39 of 180 history checks confirmed, avoiding 103 steps; two typical
steps exceed the 8 ms watchdog and restart its one-second cooldown. The warmed
history benchmark did not reproduce this repeated recovery failure. The next
release moves physics into a worker and retains bounded replay progress.


2026-10-14, release `20261012T215057Z-45c4cd373ced`: the user's solo run
`a8892aa6-8268-46f0-91bf-21585242302f` recorded 299.9 seconds at 29.94 FPS and
93.93% prediction active (1920×958), then 138.25 measured foreground seconds at
38.32 FPS and 99.18% active (1361×958). Neither segment had CPU-budget recoveries.
The user reported rough motion. Several windows contained many reported large
corrections without frames over 50 ms. Inspection reproduced two presentation
problems: ordinary 33 cm motion at the same input acknowledgement but a later
physics tick counted as a correction; irregular worker completion restarted
interpolation and produced alternating short/long movement even with perfect
constant velocity. These logs cannot reliably quantify true correction sizes.
The follow-up compares equal physics ticks and filters completed car/ball poses
on the render clock using sample timestamps. Physical-device feel still requires
a new playtest; no FPS improvement is claimed.


2026-10-14, release `20261014T150627Z-024cbf735339`: user reports the new
build felt better, explicitly in solo testing. Matching browser run
`501807ff-566b-499b-9a33-88b6b542ae88`, room `qHY4FS92-`, reported one player
throughout measured foreground play, viewport 1920×958, DPR 1 and four logical
cores. Windows ended 16:04:30–16:11:36 UTC; 392.05 measured foreground seconds
recorded 30.36 FPS, 99.36% prediction active, zero CPU-budget/error/stale-server
recoveries and three bounded input-backlog recoveries (pending maximum 23).
365 of 11,904 frames exceeded 50 ms (3.07%); maximum frame time was 99.6 ms.
There were 4,440 equal-tick correction measurements: six car corrections over
10 cm, none over 50 cm, maximum 11.6 cm and no measured hard snaps. Another
2,750 active restores could not be aligned to the previous completed tick and
are excluded from correction-distance counts; zero large measured corrections
therefore does not cover every restore. Older correction counts used a different
comparison and cannot establish the improvement's size. At the same viewport,
the earlier Oct 14 solo segment recorded 29.94 FPS and 93.93% active. FPS remains
roughly unchanged; improved subjective feel is consistent with the presentation
fix and sustained prediction, but the runs are not matched control trials.
Evidence is retained in ignored `.run/smoothing-user-solo-*` exports. No gameplay
or hosting changes were made for this feedback review. Next evaluation: two
actively driving players on separate devices/networks, simultaneous ball contests,
car bumps, boost/jumps and goals to expose remote-input corrections and kickoff
transitions. Multiplayer collision feel and integration readiness remain unproven.


2026-10-14, release `20261014T150627Z-024cbf735339`: user reports testing with
two players and requests log review. Room `QikDUL4Vz` contains two browser runs
with matching client/server releases. Foreground playing windows ended
16:18:52–16:23:47 UTC, and both streams report two players. Run
`26bab8a2-8583-4109-b578-bff5df736134` (1707×932, DPR 1.5, eight logical cores)
recorded 286.27 measured seconds, 81.28 FPS and 99.76% prediction active. It had
zero frames over 50 ms, zero CPU-budget/error/stale-server recoveries and six
bounded backlog recoveries (pending maximum 24). Mean forward physics step was
1.45 ms, mean replay slice 2.88 ms. Of 3,630 equal-tick car measurements, none
exceeded 10 cm; maximum 5.3 cm. Another 1,618 restores were unaligned and excluded
from distance measurements.

Run `39aba825-6891-42b6-9961-f96c9179043c` (1920×958, DPR 1, four logical cores)
recorded 299.92 measured seconds, 29.46 FPS and 93.93% prediction active. It had
408 of 8,835 frames over 50 ms (4.62%), maximum 104.1 ms, no CPU-budget/backlog/
error/stale-server recoveries and pending maximum 22. Mean forward physics step
was 3.48 ms and mean replay slice 8.35 ms, versus 1.95 ms and 5.13 ms in the
preceding solo run with the same reported viewport/cores. Prediction sample age
peaked at 813 ms and snapshot arrival gaps at 558 ms. Some early windows were
only 73–76% active, so the five-minute average hides transient degradation.
Of 4,539 equal-tick measurements, six car corrections exceeded 10 cm, none
exceeded 50 cm and maximum was 20.1 cm. Another 1,101 restores were unaligned.
Neither browser recorded measured hard snaps. Both observed goal-reset; an ended
phase was recorded by the second browser. These phase records do not establish
how often players contested the ball or collided, exact scores or restart coverage.

The test supports sustained two-player prediction and small measured corrections,
but does not establish that every collision correction is small or that slower
hardware is fully smooth. Device FPS values are not a before/after comparison.
On the browser matching the solo viewport, activity dropped from 99.36% to 93.93%
and slow frames increased from 3.07% to 4.62%. Higher full-world prediction cost is
consistent with adding a car; network/snapshot delivery and browser scheduling
may also contribute to stale results. Windowed logs cannot identify one sole
cause. Next investigation would separate worker backlog, snapshot gaps and local
physics cost on the slower device under simultaneous ball contests. No game,
deployment or service changes were made. Evidence retained in ignored
`.run/smoothing-user-mp-*`; integration remains deferred pending playability feedback.


2026-10-14, suspended release `20261014T204509Z-7a994cc98bf2`: user reports
solo testing feels less smooth. Matching run
`c4821f01-2015-4dc1-9c9b-8a97585f1229`, room `4Onney8Nc`, reports one player,
viewport 1920×958, DPR 1 and four logical cores. Foreground play measured 164.11
seconds across windows ending 20:53:07–20:55:58 UTC: 32.51 FPS, 93.98% active
prediction and 743/5,335 frames over 50 ms (13.93%), compared with 30.36 FPS,
99.36% active and 3.07% slow frames in the earlier good solo run on the smoothing
release. Median window p95 upper bound rose 45 → 67 ms; latest maximum was
108.1 ms. Seven backlog recoveries all occurred in the first four foreground
windows; pending history remained capped at 24. Prediction/sample age reached
1.318 s, snapshot gap 1.361 s and RTT 1.442 s. There were no CPU-budget/error/
stale-server recoveries, no measured car corrections over 50 cm and no measured
hard snaps. Four equal-tick car corrections exceeded 10 cm, maximum 23.3 cm;
1,012 restores were unaligned and omitted from distance measurements.

Mean forward physics step was 2.33 ms versus 1.95 ms in the earlier solo test,
and mean replay slice was 5.62 ms versus 5.13 ms. A higher average FPS does not
mean smoother frame pacing. The long snapshot/prediction gaps and persistent
render hitches are consistent with the subjective regression, but these runs
are hours apart and do not identify the cause as the two code changes. No human
foreground comparison exists for the immediately preceding tuning-cache release;
its only retained foreground samples are automated software-rendered smoke tests.
The public lab was restored to that preceding matching build for a fresh control
comparison, without reverting source or claiming the issue fixed. Exports are
retained in ignored `.run/state-load-user-solo-*` and `.run/state-load-prior-user-*`.


2026-10-14 UTC (2026-10-15 local), restored release
`20261014T164118Z-1caa24996fb4`: user reports rollback may feel better but remains
insufficient, and notes more intensive play may explain part of the difference.
Run `aedfbfff-5a1c-4d30-9ed2-5aeb2357e1b2`, room `wg8zSdg2t`, solo 1920×958,
DPR 1, four logical cores, measured 300.20 foreground seconds ending
21:03:21–21:08:37 UTC: 32.72 FPS, 94.96% prediction active and 1,295/9,823 frames
over 50 ms (13.18%). This is close to the suspended release's 13.93%, so rollback
did not resolve most frame pacing degradation. One backlog recovery versus seven
in the preceding run; pending maximum remained 24. Mean physics step 2.26 ms,
mean replay slice 5.73 ms, snapshot gap maximum 376 ms and pose age maximum
327 ms. No CPU-budget/error/stale-server recoveries, measured corrections over
50 cm or measured hard snaps. Thirteen aligned car corrections exceeded 10 cm,
maximum 25.6 cm; 1,819 unaligned restores were excluded. Intensity is not controlled
between these sessions, so the logs do not isolate the last optimizations' effect.

An isolated presentation probe at constant 25 m/s, uniform 33 ms render intervals
and irregular ordered worker arrivals reproduced uneven display strides with
sample ages 64–99 ms, inside the 150 ms active allowance. Actual displayed strides
varied 0.357–1.066 m instead of uniform 0.825 m despite perfect constant-motion
poses and no authoritative correction. The filter advances display velocity then
pulls towards a target whose extrapolation is capped at 50 ms; an older still-active
pose can therefore repeatedly pull display behind ordinary motion. Evidence is
retained in `.run/presentation-age-probe.mts` and `.json`. This demonstrates a
presentation failure mode, not proof of its contribution to the human run.
Next work should address render/prediction timing with a consistent pose timeline
and bounded buffering/extrapolation, separate input/prediction scheduling from
render pacing, and measure render/UI/worker costs with a lighter graphics option.
Those changes involve responsiveness and collision-presentation tradeoffs and
need physical-device comparisons. No game or deployment change was made in this
review; the restored release remains active. Feedback exports are in ignored
`.run/rollback-user-feedback-*`.


2026-10-15, release `20261015T085529Z-71df90ae0d1f`: user reports solo play
felt pretty smooth with lighter graphics and horrible with normal graphics.
Journal run `4fc61606-da55-423b-8f1e-3076aba11ec7`, room `mOyJu7RSw`,
12:40–12:47 UTC, used local prediction, one player, viewport 1920×958, DPR 1,
four reported cores and shadows off in both settings. The order was standard →
low → standard, including overtime; this is a within-run comparison, not matched
camera/input playback. Focused visible playing/overtime windows show:

| Measurement | Standard | Lighter graphics |
| --- | ---: | ---: |
| Measured render time | 164.3 s | 282.3 s |
| Render FPS | 24.32 | 44.88 |
| Frames over 50 ms | 979 / 3996 (24.50%) | 44 / 12669 (0.35%) |
| Prediction-active interval share | 83.22% | 99.21% |
| Mean CPU-side WebGL submission | 23.32 ms | 14.54 ms |
| Mean scene/effects | 0.121 ms | 0.070 ms |
| Mean presentation | 0.153 ms | 0.091 ms |
| Mean camera/HUD/audio | 0.514 ms | 0.348 ms |
| Mean pose age at render | 81.84 ms | 28.05 ms |
| Mean measured replay batch | 7.92 ms | 7.37 ms |
| Input-backlog recoveries | 14 | 6 |
| Controls-released events | 59 | 2 |

Neither setting recorded CPU-budget/error fallbacks, measured car corrections
over 50 cm or hard snaps. Unaligned restores remain excluded from correction
distances. Maximum measured car correction was 25.2 cm standard and 22.6 cm low.
Normal's worse pacing returns after switching back from low. Rendering is the
clearest measured cost; prediction also becomes less available under normal
render load. This supports targeting rendering next, while not proving separate
CPU versus GPU saturation. Submission time includes WebGL/driver work and stalls,
not full GPU execution. The controls-released counter combines intentional
neutralization and worker control-lease expiry; its large normal-mode increase
warrants separating those causes before altering the lease.

Low graphics changes resolution and exterior visibility together, so this test
cannot attribute the benefit to either one independently. Both modes had shadows
off. Source inspection finds one concrete optimization candidate shared by both:
`arena.ts` creates the ceiling as a transmissive MeshPhysicalMaterial. The installed
Three renderer (`renderTransmissionPass`) renders opaque scene objects into an
additional multisampled, mipmapped target whenever visible transmissive objects
exist. A simpler ceiling material could remove that pass, but savings and appearance
must be measured before publication. Remaining exterior mesh batching and an
independent resolution/detail comparison are further candidates. No game code,
settings defaults or deployed release changed during this feedback review.

Evidence: ignored `.run/timeline-user-feedback-{journal.jsonl,windows.json,
summary.json}` and CSV export. Lighter graphics is the current human-tested solo
baseline; two-device collision feel and eight-player performance remain unverified.


2026-10-15, timing investigation following the user's priority of smooth gameplay
and low corrections over high FPS: compared pinned previous release
`20261014T164118Z-1caa24996fb4` with current prediction using render-paced inputs
and current prediction using the autonomous clock. Arena and exterior presentation
sources match the previous snapshot; renderer optimization was deliberately deferred.

A six-second steady localhost run had 100% sampled prediction availability in all
three cases, but received 737 worker messages previously, 738 with buffer/current
manual scheduling and 1,108 with the clock. Total process CPU samples were 827,
810 and 901 ms respectively; these are short operational measurements, not a
reliable device CPU benchmark. With an identical 260 ms parent-thread stall every
700 ms, only the autonomous clock sent neutral commands: eight automatic releases,
versus zero in either manual-scheduling case. Each expiry calls neutralize, which
clears prediction history/work. The stalls exceed the configured 200 ms lease;
this confirms the failure mechanism without proving that all 59 human-run control
releases were timeouts rather than intentional releases.

With 50 ms added latency each way, the six-second stalled cases measured 65.4%
sampled prediction availability for previous/manual-buffer versus 54.0% with the
clock; the latter again had eight automatic releases. Reversing case order with
four-second measurements produced 67.2% manual versus 55.9% autonomous, and zero
versus five automatic releases. Steady availability remained about 100%. These
Node samples include deliberately blocked foreground intervals and no WebGL;
they describe availability under that constructed load, not human smoothness.

Aligned car correction samples were small but varied in count/coverage and
omitted different numbers of unaligned restores. The delayed manual-buffer run
had one measured correction over 10 cm (13.3 cm maximum), while its reverse run
had none. No case recorded a measured correction over 50 cm or a hard snap.
This does not establish that either scheduling policy reduces physical corrections.
Resets can change the population of measurable corrections, so lower counts are
not a sufficient success criterion. Continued comparisons should consider active
intervals, frame pacing, resets, aligned correction distributions and missing
coverage together.

A matched 240×160 normal-graphics Chromium check separately loaded the actual
previous release and current variants with clock/buffer toggled. All used the same
canvas size and shadows off, and reported no JavaScript errors. Only the clock
case recorded automatic-control-release behavior. Software WebGL was severely
bottlenecked (roughly 1.7–3.8 FPS), with few frames and variable compilation/camera
costs, so those FPS differences cannot rank the implementations on a real device.
The unbuffered current-filter diagnostic did not recreate every previous-filter
parameter; the published baseline profile restores the previous 50 ms render-dt
cap as well. A separate constant-motion probe retains the demonstrated benefit of
the 50 ms pose timeline. Its local pure-filter cost was about 0.0007–0.0014 ms per
pose after warmup; this is not a device benchmark or proof of collision feel.

Decision: restore render-paced input scheduling as the normal/default path while
retaining the 50 ms timeline and saved graphics choice. Keep the autonomous clock
opt-in, with independent timing links and telemetry grouping, rather than extend
its lease or mix a renderer optimization into this comparison. Real-device
smoothness and correction behavior remain the deciding checks. Evidence is retained
under ignored `.run/timing-compare-*`, `.run/timing-delayed-*`,
`.run/timing-browser-*` and `.run/presentation-cost.*`; the scheduling comparison is
now reproducible using tracked `scripts/benchmark-timing.mts`.


2026-10-15, release `20261015T132205Z-1e1b52056180`: user reports repeated visible
corrections during sustained motion, including circles, and uncertain benefit from
timing comparisons. The user clarified that these runs used **normal graphics
only**. Preserve the earlier rendering direction while investigating prediction;
smooth gameplay and low corrections remain the primary goals.

Three foreground solo runs on the same 1920×958, DPR 1, four-core-reported browser
included two baseline-filter runs and one buffered run, all with render-paced input
and shadows off. They measured 23.58–23.90 FPS, 86.20–93.77% prediction activity,
22.7–24.8% frames over 50 ms and mean CPU-side render submission 19.23–19.61 ms.
There were no automatic/control-release, backlog, CPU-budget, stale-server or error
recoveries. Measured car corrections over 10 cm were 8, 2 and 2, with maxima
19.0, 16.1 and 16.7 cm; none exceeded 50 cm. However, 531, 476 and 519 restores
could not be aligned for correction measurement. Mean measured rotation corrections
were 0.16–0.32 degrees, with maxima 6.3–13.8 degrees. Pose ages averaged 64–83 ms
and exceeded 300 ms at maxima. These windows do not establish whether each visible
jerk is a physical correction, pose extrapolation error, camera motion or fallback
handoff. They also do not compare low graphics in this build.

A deterministic real shared-physics probe used constant throttle/steering with
three-tick input delay and three-tick snapshot delay. At correctly timed 24 Hz
render updates (alternating two/three server ticks), the original production
prediction confirmed 474/478 snapshots across a 20-second simulation, with about
1.6 mm maximum same-tick position error after the warmup in that probe. Changed
steering, boost and jump inputs still required reconciliation. A tracked
`benchmark-steady-driving.mts` repeats held-steering checks at 60/30/24/20 Hz,
parks the ball away from the car to isolate local motion, excludes 180 warmup
simulation ticks and reports independent checkpoint position errors. This logical
simulation test freezes the work-slice clock and is not a device CPU/FPS or
multiplayer collision benchmark.

Regular three-input batches at 20 Hz can disagree on acknowledgement/application
timing even when physical states are close, causing unnecessary-looking restores.
A narrowly guarded redundant-input prototype helped that constructed case, but
showed no benefit in the correctly timed 24 Hz comparison. Earlier alternating-
interval prototype files accidentally used the next interval as the elapsed delta;
those results are discarded. Corrected evidence is
`.run/circle-equivalent-corrected.*`; no acknowledgement guards, collision checks,
body tolerances, physics or input scheduling were changed. Do not infer that the
larger prototype replay savings apply to the human run. A future prediction task
should distinguish timing-only mismatches from body/runtime drift and address
clock/application alignment before considering broader physics prediction changes.

The independent ceiling probe used the same fixed scene/camera at 360×240 and
alternated refractive/simple/simple/refractive rendering after warmup. Disabling
only transmission reduced submitted draw calls from 315 to 207 (34.3%) and
triangles from 71,732 to 38,258 (46.7%) in every measured case. Geometry, tint,
opacity and lighting were held fixed. CPU-side submission samples were lower with
the simple effect, but software WebGL and the small sample cannot predict device
FPS, GPU time or correction improvements. The optimization removes redundant
rendering work and provides a clean same-build comparison via `?ceiling=glass`.
It does not replace the separate prediction investigation.

Evidence is retained under ignored `.run/circle-user-*`,
`.run/circle-drift-probe-canonical.*`, `.run/circle-equivalent-corrected.*`,
`.run/ceiling-steady-prediction.*` and `.run/ceiling-render-*`.

2026-10-15, release `20261015T142525Z-461106d6140a`: user reports the simplified
ceiling was "way better" and did not look worse. Four consecutive solo runs
alternated simple/glass/simple/glass, all at normal graphics, 1920×958, DPR 1,
four reported cores, shadows off, render-paced input and the 50 ms buffer. The
foreground playing windows span approximately 16:00–16:06 UTC. No multiplayer
performance conclusion follows from these solo runs.

| Foreground metric | Glass ceiling | Simplified ceiling |
| --- | ---: | ---: |
| Measured play time | 117.1 s | 209.5 s |
| FPS, total frames / measured time | 27.0 | 44.3 |
| Frames over 50 ms | 20.82% | 1.49% |
| Sampled prediction activity | 88.44% | 99.57% |
| Mean CPU-side render submission | 18.84 ms | 9.55 ms |
| Mean predicted pose age | 72.03 ms | 38.88 ms |

Both simplified runs improved: 43.6/46.9 FPS and 99.56/99.60% prediction activity,
versus 26.0/27.6 FPS and 83.60/91.52% activity with glass. Lower render load is
consistent with fresher prediction and fewer fallback handoffs; this is a plausible
explanation for improved feel rather than proof of each visible correction's cause.
Playback/actions were not controlled, and measured RTT also varied (glass means
76.7/105.1 ms versus simple 60.9/57.1 ms). Render submission is not a GPU timer.

There were no recovery events in any run. Aligned car corrections over 10 cm
totalled six with glass and four with simple across unequal play durations; none
exceeded 50 cm and no hard snaps were recorded. Correction coverage remains
incomplete: 666 glass restores and 1,239 simple restores were unaligned, versus
1,376 and 2,510 aligned measurements. Do not claim improved physical prediction
accuracy from these correction counts. Physics and prediction guards were unchanged.

Decision: retain the simplified ceiling as the existing default. The combination
of user feedback, the fixed-scene workload probe and repeated same-build solo
comparisons supports this change. Further evaluation should prioritize multiplayer
smoothness and remaining correction behavior. No new game code or deployment was
needed for this feedback. Raw journal, exported windows and grouped summaries are
retained under ignored `.run/ceiling-user-feedback*`.
