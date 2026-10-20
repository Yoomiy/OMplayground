# Engine performance and readiness — 2026-10-20

Matching app artifact: `wobble-app-4419da186e15d66c`.
Baseline: `192b297`. Work branch: `dev/wobble-performance-readiness`.
The planned graphics controls and bounded server/prediction measurements are implemented.
The measurements support retaining the current shared-world architecture; no further
engine rewrite or speculative optimization is scheduled. Physical-device acceptance
and real Supabase/voice/hosting acceptance remain open before production rollout.
This pass changes no live service, catalog migration, or public lab release.

## Graphics and runtime changes

The app toolbar offers Hebrew graphics presets, saved per browser. The standalone
start screen offers the same presets. Balanced is the default; invalid/restricted
local storage safely falls back to it. The parent sends the preference through the
existing origin/source/session/bridge-validated channel, so it survives iframe retry
across distinct app/game origins. Changes apply immediately without restarting a race.

| Preset | Maximum device pixel ratio | Maximum render pixels | Sun shadow map |
| --- | --- | --- | --- |
| חסכונית / Low | 1 | 1280 × 720 | Disabled |
| מאוזנת / Balanced | 1.25 | 1920 × 1080 | 1024 × 1024 |
| גבוהה / High | 2 | 3840 × 2160 | 2048 × 2048 |

Actual ratio is the minimum of device DPR, preset DPR, and the pixel-budget limit.
Large viewports can therefore render below DPR 1. Resizing preserves the preset.
MSAA, materials, geometry and controller tuning are unchanged. Old shadow targets
are disposed when switching; repeated switches do not accumulate GPU textures.

Obscured embedded lobby, paused, results and ended views skip ordinary GPU draws;
hidden documents also skip draws. Prediction, server authority and network servicing
remain independent of this presentation choice. Mesh/camera updates still run, and
initial environment setup can still do offscreen GPU work. This does not promise
zero background CPU or a faster initial shader compile.

`window.wobble.performance()` in the game iframe returns a bounded 600-sample
active-draw RAF interval window, percentiles, frames over 33/50 ms, render settings,
last-draw calls/triangles, and geometry/texture counts. Skipped menu/background gaps
are excluded. This is opt-in local inspection, with no periodic console output or
upload. RAF intervals include scheduling/CPU effects; they are not GPU timer queries.

## Measured physics optimization

Node CPU profiling identified detailed sphere/box queries for distant obstacles as
the leading replay cost. A conservative, allocation-free local-space bounds check
now rejects those boxes before contact geometry is calculated. Detailed collision
responses, contact order, moving-platform carry tolerance, substeps and simulation
clocks are preserved. Both host and browser use the same change.

The existing replay benchmark used 300 ms RTT lead and 599 reconciliation samples
per roster on the shared 2-core ARM64 Neoverse-N1 VPS, Node v24.21.0. Two unprofiled
runs of each bundle were alternated before/after/after/before. CPU profiling was a
separate run and is excluded from these timings.

| Actors (humans + NPCs) | Previous mean, two-run average | New mean, two-run average | Reduction | Previous p99 range | New p99 range |
| --- | --- | --- | --- | --- | --- |
| 4 (2 + 2) | 1.677 ms | 1.026 ms | 38.8% | 4.191–4.315 ms | 3.073–3.454 ms |
| 10 (8 + 2) | 3.693 ms | 2.122 ms | 42.5% | 6.010–6.250 ms | 4.456–4.878 ms |

These are synthetic reconciliation costs, not whole-frame FPS or a guarantee for
all courses/devices. The improvement does not require prediction caching, physics
pooling, protocol changes or more extrapolation.

Validation includes 50,000 seeded geometry comparisons: every detailed-query hit
must survive cheap rejection. Exact per-tick authoritative frame hashes also match
the baseline on all 23 courses, classic/remix, four NPCs, seed 42. All 184 racers
finish within 180 simulated seconds. Both complete JSONL outputs have SHA-256
`fc265c6e36e55580f68710fd58dc28754c95ef3605a7785112b9e83448681a8b`.
This establishes equivalence for those trajectories, not every possible player input.

## Integrated-host load

The Node soak runs the actual integrated service in a child process and native
Node/ws clients in the parent. Each of two rooms contains eight moving/jumping/
diving human-input clients plus two NPCs. Courses are remixed Sunrise Scramble and
Spiral Summit. Warmup is four seconds, followed by 120 seconds of measurement.
Authentication/session storage use an isolated in-memory fixture with admission,
revision conditions, signed saves and periodic checkpoints; no real Supabase or
media is contacted. Compression and ordinary WebSocket handling remain enabled.

| Server-only measurement | Baseline | Optimized |
| --- | --- | --- |
| CPU, percent of one core | 15.74% | 12.82% |
| Final RSS | 175.23 MiB | 167.09 MiB |
| Event-loop p99 (10 ms monitor resolution) | 11.60 ms | 11.68 ms |
| Maximum observed event-loop interval | 108.20 ms | 20.91 ms |
| Client disconnects / rejected commands | 0 / 0 | 0 / 0 |
| Overload pauses / skipped snapshots | 0 / 0 | 0 / 0 |
| Third-room admission | 503 SERVICE_BUSY | 503 SERVICE_BUSY |

Both runs retain two rooms and all 16 connections. The optimized run processes
19,264 controls and delivers 27,808 frames including warmup/startup. Client JSON
byte counts are decoded payload sizes, not compressed wire traffic. CPU excludes
the load generator, and RSS is not total machine memory. Event-loop percentiles
include the monitor's resolution floor. The shared VPS has unrelated activity;
individual latency maxima and memory differences should not be treated as stable
percentage improvements. A two-minute run is a bounded soak, not long-term leak
proof, school-network capacity, database-latency acceptance or permission to raise
the existing two-room cap. That cap is retained.

## Verification and reproduction

- 581 tests, 109,422 assertions, zero failures; all four engine/platform TypeScript
  configurations and app TypeScript pass. Biome passes over 236 game files.
- Matching app, standalone browser and native action-host builds pass.
- Real React/native-service browser integration passes with no page errors:
  preferences survive refresh; live preset changes preserve the race; lobby/pause
  skip draws; forced WebGL context loss shows retry, replaces the iframe and keeps
  the paused race/tick and selected preset. Existing color, movement, reconnect,
  late-join, teacher, chat, explicit-end and stale-retry assertions also pass.
  This functional integration fixture suppresses game GPU drawing and microphone audio.
- A separate real WebGL smoke renders the actual Sunrise Scramble course using
  SwiftShader. At 480 × 270 CSS pixels / DPR 2, low/balanced/high produce buffer
  widths 480/600/960 and shadow sizes 0/1024/2048. Repeated low/high switches keep
  texture counts at 4/6; resize retains settings. No page or GL errors. These
  software-renderer checks establish rendering behavior, not physical GPU speed.

Run from this directory with existing dependencies and Bun/Node available:

```sh
bun test
bun run typecheck
bun run typecheck:app
bun run lint
bun run build:app
node --import tsx scripts/qa/app-integration.ts
WOBBLE_BUN=bun node --import tsx scripts/qa/graphics-smoke.ts
bun build scripts/qa/platform-soak.ts --target=node --external=ws --external=pino --outfile=.run/platform-soak.mjs
WOBBLE_SOAK_SECONDS=120 node .run/platform-soak.mjs
bun build scripts/qa/world-replay-cost.ts --target=node --outfile=.run/replay.mjs
node .run/replay.mjs
bun build scripts/qa/physics-digest.ts --target=node --outfile=.run/physics.mjs
node .run/physics.mjs
```

Create `.run/` before bundling. Build identical benchmark entrypoints with baseline
and candidate shared modules and compare their outputs; the baseline digest used
`world.ts` and `collision.ts` from `192b297`, with other shared code unchanged.
On this VPS use the Bun/Chromium paths and browser library/font environment described
in `APP-INTEGRATION.md`. Browser and soak harnesses use loopback fixtures and stop
their processes afterward. Raw evidence is ignored under
`evidence/performance-readiness/` and `evidence/app-integration/`.

## Remaining acceptance

On the physical Windows/Linux pair, record device/GPU, browser, resolution, chosen
preset and the iframe performance snapshot after warmup and during a full cup.
Check short/held jumps, player contact, moving bars, course transitions, rematch,
resize/fullscreen, and a background/return after more than 30 seconds. Aim for
consistent 60 Hz play on 60 Hz desktops; try low if balanced misses the device's
budget. Repeated corrections on unobstructed jumps or unintended reconnects need
investigation regardless of average FPS. Unknown peer controls and real packet
loss can still require legitimate corrections.

The software work and available server checks are complete. This environment
cannot certify the physical machines or school network. Optimize further only
when these measurements identify a remaining bottleneck. Real database/social,
service restart/lease routing and deployment acceptance remain the integration
rollout tasks in `APP-INTEGRATION.md`, rather than reasons to redesign physics.
