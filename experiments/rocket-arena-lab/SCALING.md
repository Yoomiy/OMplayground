# Two-player and eight-player evaluation

Measured on 2026-10-15 against published release
`20261015T191318Z-8157f8a05b29`, source SHA-256
`8157f8a05b296b67cba0c76be8a3a33a5d7ed49c6d2a5574cb4004f54b32e919`.
No production engine code or public deployment changed for these tests.
The later batching/practice checks below are a separate pass on 2026-10-16.

## Method

Six 90-second measured periods, each following 15 seconds of driving warmup plus
initial kickoff: 2 → 8 → 8 → 2 players at nominal 60 Hz client updates over
loopback, then 2 → 8 at nominal 30 Hz with 50 ms added delay each way for the
reference client. Measured reference RTT in the delayed cases averaged 105.4 and
111.9 ms, with maxima 160.9 and 202.0 ms. Delay queues preserve TCP order.
The delayed cases change cadence and latency together; they compare player count
under that combined condition, not the separate effect of either setting.

Every player uses a real Colyseus connection and sends sequenced input at about
60 commands/second. Bots chase the live ball, steer, boost, powerslide, periodically
jump and reverse if stuck. All eight cars were moving: every player in every
measured case travelled at least 749 m, excluding kickoff teleports. Actual Rapier
contact manifolds were sampled every fourth server callback; the eight-player
cases recorded 35/84/78 car–ball contact-pair samples and 1,405/1,590/1,701 car–car
samples. These count sampled contacts, not distinct collision episodes. Goals and
kickoff resets occurred in all eight-player measurements.

The backend runs in a separate process on temporary loopback 19004, importing the
published compiled server and its dependencies. Test wrappers observe original
callback results without changing simulation, solver, queues or watchdog clocks.
Server timings/CPU include observation overhead; outer callbacks include contact
sampling and actual broadcasts. The port was released after testing. Public Rocket,
other labs and app ports were left running.

One reference client runs the production prediction worker through the existing
Node adapter, predicting the entire room. Other clients are active socket bots
without their own prediction/rendering. This measures server load and the work
seen by one player's predictor, with all other cars present and changing controls.
It does not run eight browser renderers on the two-core VPS. Client and backend
share this VPS, and unrelated services can contend. There is no WebGL/camera/HUD
in this live networking benchmark; update cadence is not measured render FPS.

## Matched live results

Ranges below are the two separate 60 Hz, low-latency runs for each roster. No
pooled p95 is implied by the ranges of per-run percentiles.

| Metric | Two players | Eight players |
| --- | ---: | ---: |
| Server simulation rate | 60.00 Hz | 60.00 Hz |
| Dropped simulation time | 0 ms | 0 ms |
| Instrumented backend CPU, % of one core | 10.5–11.4% | 19.3–20.2% |
| Mean server core callback | 1.02–1.07 ms | 1.92–2.90 ms |
| Server callback including broadcast, per-run p95 | 1.89–3.98 ms | 4.82–9.75 ms |
| Mean reference forward-physics step | 0.878 ms | 1.54–1.94 ms |
| Reference prediction activity during active play | 100% | 98.04–99.98% |
| Maximum pending inputs | 3–4 | 6–13 |
| Backlog / CPU-budget / stale-server / error recoveries | 0 | 0 |
| Aligned car corrections over 10 cm / over 50 cm | 0 / 0 | 0 / 0 |
| Maximum aligned car correction | 4.1–4.5 cm | 8.0–8.3 cm |
| Aligned / omitted unaligned correction counts | 2,365 / 114 | 4,371 / 184 |

The lower eight-player availability coincided with a 182 ms reference update gap,
up to 371 ms result age and an 85 ms maximum server callback interval. The backend
still completed about 60 fixed steps/second without dropping accumulated time.
Server wall-clock work increased while measured process CPU stayed similar to the
other eight-player run. Scheduling contention is consistent with these observations,
but this test does not identify a sole cause. Preserve this outlier in the result.

| At 30 Hz reference updates and about 100 ms added RTT | Two players | Eight players |
| --- | ---: | ---: |
| Prediction activity | 100% | 99.90% |
| Server simulation rate / dropped time | 60.01 Hz / 0 ms | 60.00 Hz / 0 ms |
| Maximum pending inputs | 11 | 14 |
| Backlog / CPU-budget / stale-server / error recoveries | 0 | 0 |
| Aligned car corrections over 10 cm | 2 | 9 |
| Maximum aligned car correction | 45.7 cm | 20.6 cm |
| Maximum aligned rotation correction | 5.6° | 8.4° |
| Aligned / omitted unaligned correction counts | 1,413 / 264 | 2,027 / 281 |

No measured correction exceeded 50 cm and no measured hard snaps occurred in any
case. Omitted unaligned restores prevent a claim about every correction. Eligible
active-play durations differ because eight-player goals caused more countdowns;
raw counts are not equal-duration correction rates. More corrections over 10 cm
in the delayed eight-player run do not mean every correction became larger.

The prediction history confirmed roughly 48–61% of checks with two players but
only 2–4% with eight in low latency. Changing remote states/controls cause more
reconciliation; the history fast path saves much less work as the room grows.
The mean JSON prediction-frame representation grew from about 2.46 KB to 8.41 KB,
roughly 3.4× per frame. These are JSON size estimates for one stream, not measured
wire bytes; V2 state traffic, encoding, WebSocket headers and TLS are excluded.

## Rendering workload

A separate fixed-camera probe used the actual arena, car, ball and pad renderers,
normal graphics, simplified ceiling, shadows off and all cars in view. Cases
alternated 2/8/8/2 after warmup, with repeated counts matching exactly. Software
Chromium at 360×240 supplied submitted draw/triangle counts, not device timings.
Screenshots were inspected to confirm all eight models were visible.

| Normal graphics | Two visible cars | Eight visible cars | Increase |
| --- | ---: | ---: | ---: |
| Draw calls, no boost effects | 323 | 596 | 84.5% |
| Draw calls, all boost effects visible | 335 | 644 | 92.2% |
| Triangles, no boost effects | 45,738 | 63,270 | 38.3% |

Lighter graphics reduced the fixed-scene no-boost counts to 303/576 draw calls
and 17,458/34,990 triangles, plus 70% raster resolution per axis. It retains the
same detailed car models, so it does not remove the extra per-car submission work.
Shared car geometry/material allocation avoids duplicate buffers but does not
automatically batch the separate mesh draws.

## Comparison with the earlier human baseline

The post-ceiling two-device room on this same physics/prediction implementation
recorded 99.70% prediction activity, 38.1 FPS and two backlog recoveries over 573.5 s
in normal graphics on the four-core-reported browser. The other browser recorded
95.66% activity, 60 FPS and 97 backlog recoveries over 712.5 s, with RTT up to
2.067 seconds. Those remain the real-device baseline; this automated harness does
not reproduce that device's GPU, network spikes or full presentation loop. Its
100% two-player result therefore does not resolve the earlier backlog problem,
and an eight-player device FPS forecast would be unjustified.

The results support one eight-player room's server/prediction feasibility on this
VPS. Client rendering, heavier reconciliation and intermittent scheduling/delivery
stalls deserve attention before freezing the engine. Simultaneous-room capacity
has not been measured. Seven automated opponents can support a later single-human
device check; eight manual testers are not a prerequisite.

## Reproduction

From the lab directory, verify 19004 is unoccupied, then run:

```sh
npx tsx --conditions=development scripts/benchmark-multiplayer.mts .run/multiplayer-scaling
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/benchmark-render-scaling.mjs .run/render-scaling
```

`SCALING_RELEASE_ROOT`, `SCALING_PORT`, `SCALING_SECONDS`,
`SCALING_WARMUP_SECONDS` and `SCALING_CASES` can override the benchmark configuration.
The case format is `players:reference-cadence:reference-one-way-delay-ms`.
Defaults reproduce the order and conditions above. Playwright is an optional QA
installation; this VPS uses its existing temporary Chromium libraries/font config.

Raw data is retained under ignored `.run/multiplayer-scaling*` and
`.run/render-scaling*`; pilot data is under `.run/multiplayer-pilot*`.

## Subsequent car batching and practice checks — 2026-10-16

The same fixed scene now compares original and batched static car parts, using
the production materials, geometry and moving rig hierarchy. Normal graphics,
simple ceiling and shadows off:

| Submitted draw calls | Two cars | Eight cars |
| --- | ---: | ---: |
| Original, no boost | 323 | 596 |
| Batched, no boost | 286 | 448 |
| Original, all boost | 335 | 644 |
| Batched, all boost | 298 | 496 |

No-boost savings are 11.5% / 24.8%; all-boost savings are 11.0% / 23.0%.
Triangles remain 45,738 / 63,270 without boost. Low-graphics no-boost calls fall
303→266 / 576→428. Repeated 2/8/8/2 counts agree. Decoded screenshot comparisons
for both eight-car normal cases produced zero changed pixels, including boost.
This does not measure hardware GPU duration or real-device frame pacing.

The public practice feature uses one or seven VPS-controlled ordinary socket
clients, so a human can exercise the two/eight-player cases with one device.
A real software-WebGL browser exercised both built UI flows, driving, host start,
completed prediction, moving/acknowledged bots and departure cleanup. Seven bots
each acknowledged 899 commands and travelled 56.5–172.6 m during active play,
excluding kickoff teleports. No JavaScript errors occurred. Browser timing here
is intentionally not compared with the earlier physical-device baseline.

Bounded stall traces and public practice are documented in [LAB.md](LAB.md).
The earlier human backlog case still needs a new device run with this release's
trace capture. No prediction/physics guards were relaxed in this pass.
Evidence: ignored `.run/car-batching*`, `.run/bot-practice.json` and
`.run/practice-processes.json`; reproduce rendering with the command above, or
practice/loss checks using `scripts/check-practice-local.py` after building.

## Human practice feedback — 2026-10-17

The user found practice fun and playable on their machine, including eight
players, while still noticing imperfections. The logs contain three foreground
playing groups from release `20261016T003420Z-d36a36046e17`: one bot, seven bots
with batching, and seven bots with the original car draws. All used normal
graphics, 1920×958 CSS pixels, four reported logical cores, simple ceiling,
shadows off, render-paced controls, local prediction and the 50 ms pose buffer.
These are separate sessions, with different play and network conditions.

| Sustained measurement | 2 players, batched | 8 players, batched | 8 players, original |
| --- | ---: | ---: | ---: |
| Foreground playing time | 300 s | 414 s | 229 s |
| Overall render FPS | 54.93 | 55.28 | 55.36 |
| Median longer-window FPS | 54.80 | 55.19 | 55.15 |
| Frames over 50 ms | 0.206% | 0.205% | 0.276% |
| Prediction activity | 99.49% | 98.13% | 99.45% |
| Median longer-window prediction activity | 100% | 100% | 100% |
| Mean render submission time | 6.71 ms | 7.25 ms | 7.79 ms |
| Mean prediction forward step | 2.19 ms | 3.11 ms | 3.08 ms |
| Median window replay p95 upper bucket | 10 ms | 11 ms | 11 ms |
| Mean RTT | 70 ms | 86 ms | 71 ms |
| Backlog recoveries per minute | 0.80 | 2.61 | 1.05 |
| Aligned car corrections over 10 cm per minute | 1.40 | 5.22 | 6.02 |

Overall FPS uses total frame time; event rates use foreground playing duration.
Longer-window medians use windows containing at least five seconds of eligible
play (30 / 41 / 23 windows). Histogram p95 upper buckets are not exact pooled
percentiles. The table retains all eligible playing data, without deleting
unfavorable windows or foreground spikes. Two >50 cm corrections occurred in
the batched eight-player run, none in the other groups; there were no ≥3 m hard
snaps. Ordinary aligned corrections averaged 1.5 / 2.6 / 2.0 mm. These metrics
do not include unaligned comparisons or directly measure all visible filter
adjustments and presentation handoffs.

The original rendering is not a demonstrated improvement: FPS and typical replay
cost are effectively tied, while batching lowers measured scene submission time
by about 7% in these sessions. Original rendering had better aggregate prediction
continuity and fewer recoveries, alongside lower RTT; it did not lower the rate
of >10 cm aligned corrections. This unpaired comparison cannot attribute the
continuity difference to rendering. Keep batching as the default and retain the
A/B URL. Further rendering experiments should preserve appearance and use paired
conditions; there is no basis here for another prediction-threshold change.

Incident traces were recovered using **`journalctl --all -o json`**. Without
`--all`, journalctl emits null MESSAGE fields for sufficiently long records,
which hides full incident histories. The exporter now skips non-text journal
records safely, but only `--all` preserves their data. Four / fourteen / four
backlog traces survived context/window/rate limits. Typical peaks within those
two-second histories showed acknowledgement/snapshot delivery gaps around
0.15–0.26 s, with frame gaps around 39–42 ms and worker requests around 29–33 ms.
Server callback-gap peaks were typically 17–18 ms, callback work 2–4 ms, and all
captured traces reported zero dropped simulation time. This points to intermittent
delivery/acknowledgement delay as a useful next investigation; the data does not
separate network-path delays from browser transport delivery and cannot prove
the cause of every recovery.

Raw journal, windows, summaries and incident traces are in ignored
`.run/user-practice-oct17*`. Playback time ranges were 17:42–17:59 UTC on
2026-10-17. This feedback review does not change physics, prediction safeguards
or rendering defaults.
