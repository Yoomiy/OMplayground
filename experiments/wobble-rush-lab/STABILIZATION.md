# Wobble engine stabilization

Started 2026-10-15. This work precedes Playground integration. It preserves the
MIT upstream engine and the 23-course pack. The authoritative milestone is now
published with follow-up fixes as `20261015-action-14`; see `LAB.md`. The stage records below describe
checks before publishing. The previous Worker comparison remains retained.

## Pass 1: mechanics and a headless race tick

Development compatibility identifier: `playground-engine-1`. Old content-7
clients and this engine must not share a room. The existing version handshake
rejects mismatches when matching client/backend outputs are used.

Implemented:

- Crowd collision checks vertical overlap. Racers on stacked roads or jumping
  clear of another racer do not receive horizontal pushes. Partially overlapping
  spheres use their horizontal cross section; there are still no vertical crowd
  impulses, preserving the arcade controller.
- A checkpoint can advance only to the next index. Overlapping triggers select
  the next eligible checkpoint. Finish detection requires the last mandatory
  checkpoint. These are simulation rules, not proof of network authority.
- `src/shared/race-simulation.ts` owns the shared `stepRace` orchestration, used
  by the browser: prepare inputs, move all active racers, resolve crowd contacts,
  repair crowd displacement against the world, then capture progress. Manual
  respawns and falls cannot capture progress during their respawn tick. The
  caller excludes paused/finished racers. Rosters have a stable contact order;
  duplicate IDs are rejected before mutation.
- `LocalRunner` and `NpcPack` prepare inputs and consume results; rendering and
  effects remain outside the headless tick. `stepRunner` remains a convenience
  for independent physics pilots, using the same motion and progression rules.
- Countdown/menu/finished phases no longer run a crowd solver behind the UI.
- Disposal removes the resize listener, pending countdown timer, owned debug
  handles and directional-light shadow resources. Fatal errors dispose the
  running game before displaying the error. Focus loss also clears queued
  respawn and orbit input.

Validation commands (run from this directory; use the Bun/Node paths in LAB.md):

```sh
bun test
bun run typecheck
bun run lint
bun run scripts/qa/course-pack.ts
bun run scripts/qa/course-pack.ts --crowd
bun run build
WRANGLER_SEND_METRICS=false node node_modules/wrangler/bin/wrangler.js deploy \
  --dry-run --config wrangler.lab.json --outdir worker-output
```

The course audit's default mode runs independent physics pilots. `--crowd`
uses the headless race tick with four colliding racers, rather than treating
four independent successful runs as evidence of group physics.

### Completed validation

- 478 tests passed across 46 files, including the height/cross-section regressions,
  ordered checkpoints, required finish progression, post-contact finish ordering,
  wall repair, respawn exclusion, stable roster order and controller equivalence.
- Full client/Worker typechecks and lint passed; client build and local Worker
  dry-run passed. No dependency changes.
- 736/736 independent actual-physics pilot runs finished and captured every
  checkpoint: 23 courses × classic/remix × four seeds × four pilots.
- 736/736 four-racer runs through `stepRace` finished and captured every
  checkpoint, using the same matrix with live crowd contacts.
- The isolated two-browser remixed cup passed all 14 harness checks on
  Spiral Summit, Ribbon Ridge and Vault or Wait. Both clients completed every
  course, agreed on results and final 28/26 points, reset the cup and left.
  Zero page errors. See `evidence/engine-stabilization/summary.json` and
  `browser.txt`.
- `scripts/qa/engine-lifecycle.mjs` verified a real solo finish remains frozen,
  repeated page-exit disposal is safe, fatal errors dispose before painting,
  RAF rendering stops, and owned resize/debug handles are removed. This test
  counts render calls without GPU draws. See `lifecycle.txt`.
- Staging used only loopback port 19003 with separate local state under
  `.wrangler/engine-stabilization`; that process is stopped. Public port 19002,
  the immutable comparison release and Playground services were not changed.

Course and unit logs are retained under `evidence/engine-stabilization/`. The cup
uses QA pixel ratio 0.125, disabled shadows and at most one GPU draw every ten
seconds to fit this VPS's software GPU. These checks do not establish physical
device frame rate, school-network quality or simultaneous-room capacity. They
also do not validate authoritative finishes: the backend remains a relay.

Lifecycle check command against a locally staged matching build:

```sh
LAB_URL=http://127.0.0.1:19003 node scripts/qa/engine-lifecycle.mjs
```

On this VPS, use the browser library/font environment documented in `LAB.md`.

## Pass 2: authoritative multiplayer

Implemented a separate Node + native WebSocket host, server-owned 60 Hz human/NPC
physics, validated sequenced controls, bounded input/traffic queues, authoritative
checkpoint/finish/cup results, full snapshots with acknowledgements, local
prediction/reconciliation and remote interpolation. Online physics and accepted
times are independent of the renderer. The retained public Worker is unchanged.

See [ACTION.md](ACTION.md) for the runtime decision, source boundaries, exact
commands and limitations. Compatibility: protocol 2 / `playground-action-1`.
Completed validation:

- 489 tests passed across 48 files; all client, Worker and Node typechecks,
  full lint, matching client/Node builds and frozen-lockfile install passed.
- 736/736 authoritative actor runs finished across all 23 courses, classic/remix,
  four seeds, with two control-only human pilots and two host-owned NPCs per race.
  All required checkpoints were reached before accepted finishes.
- 736/736 independent pilots and 736/736 colliding pilots also passed after the
  spinner recovery change. The initial 735/736 authority failure and its focused
  32/32 Pendulum rerun are retained as evidence.
- Initial two-browser authoritative cup passed on Spiral Summit, Lift Lock and
  Terrace Tangle. The final post-recovery cup, seeded 424242, passed on Pendulum
  Pier, Ribbon Ridge and Tidal Twist with 60 ms artificial delay in each direction
  on the guest (120 ms added round trip). Both browsers agreed on all results
  and final 28/26 points. All 17 harness checks passed, including control-only
  traffic, acknowledged host-owned human/NPC state, next-round/new-cup and leave.
  Zero page errors and zero host overload stops or command rejections.
- At the delayed cup's end the host reported 96,083,968 bytes RSS and 7.64 CPU
  seconds cumulatively across about 301.5 seconds of host ticks; maximum observed
  scheduler pulse gap was 33.1 ms. This is one two-human/two-NPC room on the VPS,
  with infrequent software-GPU draws, not a concurrency guarantee or device FPS
  result. No physical devices were evaluated in these automated checks.
- Final-build lifecycle QA passed finish freezing, repeated disposal, stopped
  RAF rendering, listener/debug-handle removal and fatal-browser cleanup.
- Final Node readiness returned protocol 2 / ready. Real invalid-config startup
  emitted a structured process failure, completed cleanup and exited 1. Normal
  SIGINT shutdown logged completion and exited 0 within the five-second bound.
- Production dependency audit: no known vulnerabilities found in 17 checked
  packages after patching the retained Hono dependency to 4.13.7. Pino 9.14.0 and
  ws 8.21.0 are pinned; this is a dated audit result, not a future guarantee.
- Staging port 19003 is stopped. Public Worker port 19002 still reports protocol
  1 and its process was not restarted. No app, catalog, database or hosting
  configuration was changed.

Evidence: `evidence/authoritative-latency-cup/` contains the summary, browser,
unit, three course audits, dependency audit, lifecycle, fatal-startup and shutdown
records. `ACTION.md` gives the exact reproduction commands and remaining gates.

## Historical remaining engine work — action-14

This checklist records the action-14 state. Later entries implement shared-world
prediction, placement and collision hardening; the app adapter adds durable
lifecycle recovery. See [PERFORMANCE-READINESS.md](PERFORMANCE-READINESS.md) for
the current status and the remaining physical-device checks.

1. **Network quality and capacity.** Authority/prediction are implemented for
   the Node runtime. Evaluate correction feel on physical devices, varied RTT,
   jitter/loss, long outages and background tabs, and measure simultaneous
   eight-player rooms. Tune buffering/quality from those measurements. The
   retained Worker release remains available for comparison/rollback.
2. **Solo timing and server-stall recovery.** Online physics/results are
   independent of renderer catch-up. Solo still uses a capped local frame loop;
   review its long-stall policy. The action host cancels races after a long
   server scheduling stall; it does not recover a lost process.
3. **Networking lifecycle and limits.** Reconnect/grace, duplicate connections,
   bounded messages and input queues, per-client/room admission limits, stale
   room cleanup, pause semantics and restart recovery remain to implement.
   The action host is in-memory. Design boundary persistence and idempotent
   accepted results when a durable store/platform adapter is introduced.
4. **Route-aware placement.** Live placement still compares Z coordinates.
   Replace this with validated checkpoint progress and section/route progress;
   define how intersections and unequal branches are approximated. Final
   placement must continue to use accepted finish order/time.
5. **Fast collision audit.** World resolution is discrete and ignores the
   supplied previous position. Check fast relative motion, thin barriers,
   gate closure and post-carry displacement. Introduce swept queries or
   bounded collision substeps where measured cases require them.
6. **Target devices.** Add measured rendering quality presets and context-loss
   recovery. Validate camera, readability, failure recovery and controls on
   physical school devices. Touch remains unsupported. Reduced-resolution,
   infrequently drawn software-GPU QA does not establish normal frame rate.

Keep the standalone comparison release until the new host passes full cups,
adversarial result/input tests, refresh/reconnect, host departure, pause/resume
and simultaneous-room measurements. Playground identity/catalog/recess/teacher
adapters follow this engine work, using the platform integration guide.


## Pass 3: real network bursts and firmer crowd contacts (2026-10-15)

Operator feedback on action-10: repeated invalid-command disconnects across
browsers, plus a request to retain shoving but make contacts firmer. The old logs
confirmed repeated rejections but did not identify their cause. A targeted
manual-keyboard two-browser regression reproduced the same error when a 600 ms
network hold delivered 36–37 valid controls against the old 24-command queue.

Inputs now occupy one coalesced pending sample: latest held state, latched
jump/dive/respawn, and newest acknowledged sequence. Sampling still occurs only
once per host tick. Strict schema/sequence/rate validation remains; a valid-ping
flood test confirms that 121 messages still closes the offending connection.
Bounded rejection reasons and schema field paths improve future diagnosis.

Crowd/world constraints alternate for at most 12 position passes. Each pair
transfers momentum once per tick, and each obstacle responds once during these
passes. This preserves shoving, vertical bridge separation and horizontal-only
crowd impulses. The first audit exposed a Sky Hop pilot failure when repeated
passes also repeated impacts; restricting impacts to once per pair resolved it.
Audit pilots also now use actual respawn events instead of a distance heuristic.

Validation: 497 tests / 50,461 assertions; all typechecks and lint; 736/736
authoritative actor runs and 736/736 crowd-course runs; both manual browsers
survived eight 600 ms input batches with zero errors/disconnects/backlog. The
focused browser test ran after the input fix, before the final once-per-pair
collision refinement/content bump; the final action-2 transport smoke and course
matrices cover that final build. Software-GPU render throttling is QA-only.
Evidence: input-bursts-before/after and public-action-11 under evidence/.
Protocol 2 / pack playground-action-2 is published as 20261015-action-11.
Remaining gates above still apply; no physical-device or capacity result is claimed.


## Pass 4: burst-aware connection traffic budget (2026-10-15)

The operator reported a later invalid_command after the first improvement. The
new reason log identified message_rate at 16:59:48 UTC: the fixed one-second
120-message window could reject clumped normal 60 Hz traffic independently of
the already-fixed input queue. A two-socket reproduction with alternating 108
and 36 input batches (600 ms / 1.8 s spacing) fails on action-11 and passes with
the monotonic token bucket. Each client receives acknowledgement 576; simulation
still advances only once per host tick. The engine/courses are unchanged.

Traffic allowance has capacity 240, replenished at 120 messages/sec; it is finite
after idle and does not reset at window boundaries. Tests model ten minutes of
60 Hz traffic plus heartbeats and repeated 1.8-second holds, and verify sustained
flood rejection. Flood errors now use rate_limited and explain the reconnect
step. The in-game error screen no longer calls connection failures load failures.

501 tests / 87,311 assertions, all typechecks/lint and matching builds passed.
This is targeted networking validation; no repeated course matrix, full cup,
physical-device or capacity test is claimed. Published as 20261015-action-12,
protocol 2 / pack playground-action-2. Evidence: evidence/public-action-12/.


## Pass 5: reconnect, winner announcement and discovery (2026-10-15)

The operator confirmed a physical two-player cup worked on action-12 and requested
reconnect, an explicit winner announcement and removal of section challenge copy.
Protocol 3 / pack playground-action-3 adds room/player-bound cryptographic tickets,
30-second reservations, neutral disconnected controls, authoritative restoration,
old-socket fencing, explicit revocation and reserved-slot capacity accounting.
The same traffic budget follows replacements. Lobby readiness clears on loss;
expiry/leave transfers host control. Restarted processes cannot recover rooms.

The browser keeps a per-tab refresh ticket, visibly retries within a deadline,
clears tickets on leave/terminal failure and cancels owned timers/promises on
exit. Delayed rendering timers allow queued messages to arrive before declaring
a disconnect. The final build was checked separately after this liveness cleanup.

The finish screen announces round/cup winners and exact ties using the official
points/finishes/time tie-breaks. All-DNF cups do not name a winner. The race HUD
no longer renders checkpoint challenge labels; input controls and pips remain.

510 tests and all typechecks/lint passed. Real socket cases cover restore/acks,
stale controls, wrong-room/invalid/expired/revoked tickets, takeover fencing,
reserved capacity, host transfer and idempotent finished-result restoration.
A real three-race two-browser cup passed with refresh and temporary offline
recovery, stable IDs/checkpoint 1, 28–26 matching scores and a visible LabGuest win.
A new tab then restored the final standings and stopped the old tab retrying.
Earlier engine matrices remain valid for unchanged normal physics; not repeated.
Evidence: reconnect-cup, reconnect-liveness and public-action-13 under evidence/.


Final heartbeat follow-up: a timer independent of requestAnimationFrame now owns
one-second pings and is disposed with the game. The final browser regression
passed a seven-second stopped render loop without reconnecting, alongside the
6.5-second blocked-event-loop check. A public action-13 software-GPU refresh
attempt exceeded the 30-second grace window; it is retained as failed QA evidence,
not a passed reconnect claim. Cold-start/render performance remains a device gate.
The final action-14 public smoke uses real sockets to verify identity/ack restore,
takeover fencing and control acceptance without depending on GPU startup latency.


## Pass 6: obstacle clock jitter and avoidable lag (2026-10-15)

Reported frequent spinning-bar corrections on action-14. Each authority frame
replaced the presentation clock's anchor with server time plus the latest raw
half-RTT. Varying packet age/RTT therefore rewound or jumped deterministic
obstacles even though the shared kinematic formulas were correct. Comparing
archived action-14 to the fix under identical simulated 20 Hz jitter produced
100 backward frames in ten seconds before, zero after. Old 60 Hz world increments
ranged from -93.33 to +126.67 ms; corrected increments stayed between 15 and
18.33 ms. This is controlled timing evidence, not an Internet latency measurement.

NetworkTimeline filters timestamp offsets and absorbs phase error with at most
±10% clock speed adjustment. Draws sample it independently of the fixed physics
loop, including at 144 Hz. Initial/reconnect anchors still establish current
world time; ordinary updates never re-anchor the rendered scene. Server and
prediction collisions still use the existing integer-tick world.

Remote playback now buffers 80 ms normally rather than 120 ms, adding up to
120 ms during jitter and recovering gradually. Buffer increases cannot rewind
actors. This removes 40 ms of configured presentation delay on a steady link;
it does not change network RTT. Manual party play also avoids two unused
collision-world constructions per local tick. No geometry or movement tuning
changed. Several course bars intentionally surge; Sunrise's first bar is one.
The browser check explicitly selects constant-speed sweep-2 instead.

Focused browser QA also exposed a pre-existing slow-boot defect: the first RAF
timestamp could predate FrameLoop.start(), creating a negative accumulator that
suppressed physics/input until it caught up. Elapsed frame time now clamps at
zero, preserving the existing stall catch-up cap. Two regressions cover stale
startup timestamps and long-stall recovery.

519 tests / 93,356 assertions pass. Targeted timing regressions cover jitter,
changing RTT, batched delivery, convergence, phase/reconnect resets, 144 Hz draws,
legacy playback and normal/adaptive remote buffering. Prior course matrices and
full-cup runs were not repeated for these presentation/startup changes.


Final focused two-browser QA passed seven checks with real manual controls and
ordered 35–159 ms inbound delays. Both constant-speed bar tracks had zero reverse
steps; display/server world-time errors at the same draw were -1.25 ms and +30.03
ms. Zero page errors. Initial QA chose a deliberately surging bar and then compared
stale fixed-step state with later network time; those failed harness runs are
retained under evidence/timing-jitter*/ and are not engine failures or acceptance
claims. Final evidence: evidence/timing-jitter-accepted/summary.json. No full cup
or physical-device FPS test was repeated.

Published as 20261016-action-15. Public readiness, exact asset bytes and six real
WebSocket race/reconnect checks passed; source/build manifests verified. Service
active with zero restarts, overload stops or rejected messages; staging stopped.
Prior matching action-14 retained. Evidence: evidence/public-action-15/.


## Small follow-up (2026-10-17, action-16)

Human-only roster updates no longer remove/recreate authoritative NPC views and
interpolation buffers. Authority frames still remove missing NPCs; departed
humans are removed immediately. The HUD skips unchanged placement/checkpoint
updates. Scoped to two cheap fixes; no physics, packet cadence or geometry change.
520 tests / 93,364 assertions, three type configurations, lint and matching builds
pass. Regression uses real Three meshes with only label rasterization stubbed.
No full cup/browser or course matrix repeated. Prior action-15 retained.


## Prediction/recovery pass (2026-10-17, action-17)

The operator reported repeated reconnects and position readjustment on one of two
clients using the same network. In room EXMR, one racer resumed six times while
the other remained connected. The host recorded no rejected commands or overload
stops; the old closure logs omitted causes, so the historical trigger cannot be
proven. A deterministic flat-floor reproduction identified a separate real bug:
100 ms of delayed controls gave zero initial simulation error, but replay by
unacknowledged count introduced +0.82 m, followed by -0.683 m at the next snapshot.
The new tick-based replay gives zero artificial displacement; the next snapshot
advances by the legitimate single tick (+0.1367 m).

Prediction history is capped, with a maximum 12-tick lead from the last snapshot.
Ack backlog does not close a healthy socket. Fresh frames repair state in place;
resync pings are limited to once per second. Brief outbound congestion coalesces
to a single latest control and latches action edges; only a persistent ten-second
backlog closes. Sequence gaps are bounded to 4096, while message token buckets,
strict schemas, payload limits and one-physics-step-per-tick are retained.

Party control/prediction timing is now independent of requestAnimationFrame.
Browser QA showed multi-second software-GPU draw gaps even while messages and
heartbeats arrived normally; these should not also interrupt control sampling.
The monotonic party timer retains fixed 60 Hz slices and the five-step catch-up
cap, stops on disposal and retires when returning to solo. Hidden/blurred input
release and the host's 250 ms held-control expiry remain.

Explicit respawn revisions reset stale replay and visual offsets. Small drift,
large drift and contacts use distinct smoothing decay, with a 1.25 m visual-offset
bound and snaps for respawns/large individual errors. Physics remains authoritative.
Network reports carry bounded reasons/measurements and are host-limited to five
seconds per client; closure logs classify known reasons instead of raw strings.
They will distinguish device/render stalls, congestion and genuine loss in the
next physical playtest. Protocol 4 / pack playground-action-4 fences old clients.

530 tests / 93,415 assertions, all type configurations and lint pass. No normal
course physics was changed, so the 736-run geometry matrices were not repeated.
Targeted browser and public release evidence are recorded separately. Crowded
contacts remain server-authoritative and can still require legitimate corrections;
perfect recovery from every device/network disruption is not claimed.


Final two-browser QA passed eleven checks. A 140-input acknowledgement backlog,
missing snapshots and three seconds of outbound backpressure recovered without
replacing the socket. Controls continued through three seconds of stopped draws.
Only the intentional actual socket close reconnected; actor identity was stable.
Both racers completed Sunrise Scramble with matching 37.583/37.850 second results.
Zero page errors, rejected commands or overload stops. Software GPU draws were
skipped; physical-device FPS/capacity is not established. Final evidence is under
evidence/reconciliation-recovery-accepted/ and evidence/public-action-17/.
An initial harness run held simulated backpressure until a presumed input-frame
count; headless draw throttling stretched this beyond the actual ten-second
backlog bound. That failed harness run is retained as intermediate QA evidence.


## Connection-path follow-up (2026-10-17, action-18)

Room TWQZ showed a device-specific difference after action-17. In diagnostic
reports, one client had RTT 70–299 ms (median 178 ms) and two 120-input ack stalls;
the other reported 30–81 ms (median 46 ms). Both drew near 60 Hz. One affected
socket closed abnormally with 1006, last-message age 110 ms and zero host buffered
bytes. Server maximum pulse was about 23 ms, with no overload/rejected commands.
The reporting is issue-triggered, so those medians are not whole-session RTT
averages. TCP counters showed retransmissions. Device/browser/VPN details were
requested; the underlying physical path cause is not proven.

Transport work is limited to negotiated snapshot compression and removing idle
finished-race snapshot broadcasts. No prediction, smoothing or input behavior
changes. Compression uses no context takeover, window 11, level 1/memLevel 4,
concurrency 2, threshold 1024; only full frames opt in. Uncompressed fallback and
explicit final-state/reconnect/resync delivery are retained.

Actual Node/ws comparison: 3264 frames per case, 32 sockets/four rooms over five
seconds. Wire bytes were 16,330,600 plain and 4,121,432 compressed; 74.76% saved per
frame. Combined server/test-client CPU was 21.61% and 33.69% of one core, RSS 124
and 175 MB, p99 event-loop lag 15.04 and 11.59 ms. No overload, rejected messages
or socket loss. These are short transport measurements, not capacity acceptance.
531 tests / 93,427 assertions and native-browser transport/recovery checks pass.
The browser run skipped the already-tested full race/cup; eleven checks include
compression on both peers, brief ack/snapshot/congestion stalls and real resume.
Bun's test WebSocket client does not offer the compression extension; actual
negotiation is validated using Node/ws and Chromium, with unit plain fallback.
Evidence: evidence/public-action-18/ and evidence/transport-compression/.


## Broader quality repair — action-19 (2026-10-18)

User feedback: Windows connectivity was still unreliable and ordinary Linux
jumps appeared to correct twice. The narrower action-17/18 acceptance missed
that case. Review and architecture boundaries are documented in QUALITY.md.

The old empty-floor eight-jump comparison at 200/300 ms RTT reproduced 32/48
vertical corrections over 5 cm, maximum 1.139 m. Tick-addressed controls with
bounded future scheduling and replay from authoritative held controls produce
zero in the identical comparison. This preserves the headless controller/course
physics while replacing their ambiguous network application-time contract.

Snapshot validation reuses fully matching cached prediction, avoiding redundant
collision replay. Local mesh/camera and bars/platforms share one-step interpolated
physics time. Independent 8 ms polling and nominal step timestamps handle
coarse/batched timers; solo/party use the same bounded accumulator. Admission
round trips seed refresh latency before the first restored frame. Regular pongs
are nonce-matched with a bounded jitter-aware history. Held upload refresh is
10 Hz; changes/actions remain immediate. Remote respawns clear old samples.

The host skips obsolete snapshots under congestion and uses transport ping/pong
liveness instead of closing after 30 seconds of JavaScript message silence.
Control expiry and reconnect fencing remain. Diagnostic reports now add received
input age, scheduled tick lead and whether the race is current; raw controls,
bearer tickets and client addresses remain excluded. UI disposal clears the
last hint timer, fatal text is escaped, and protocol decoding no longer catches
and mislabels unrelated application callbacks.

The first GPU-rendered cup completed round one but blocked on a software-GPU
capture long enough to miss its requested in-race reconnect injection. Its
requested reconnect assertion failed; no acceptance is claimed for that run.
A subsequent functional run skipped drawing/captures and completed all three
races, refresh, temporary outage, matching scores/winner, replacement tab and
new-cup reset. QA source now explicitly distinguishes those modes.

Final validation and activation evidence: evidence/public-action-19/.
Functional browser checks do not establish physical GPU FPS, a Windows network
root cause, or smooth recovery through arbitrary loss. Normal isolated jumps,
bar phase, real crowd shoves and actual socket recovery are distinct cases.

The first final refresh fixture exceeded its resume window during software-GPU
startup; the existing inspection hook now precedes offscreen environment work so
functional runs can suppress that work too. Two bar checks exposed timestamp
noise: they sampled wall time after variable CPU work, while drawing used an
earlier time. The repaired runner, camera and obstacle presentation share the
RAF timestamp; QA pairs the mesh angle with that exact same-frame timestamp.
Failed attempts remain in evidence rather than being counted as acceptance.

The final bar check identified the remaining ordering edge: a timer can step
physics before a draw whose compositor timestamp is slightly older. Clamping
that draw to the newest interpolation segment caused periodic 3–6 ms forward
phase changes. Retaining the older pose segment preserves the frame's actual
interpolation time. The verified check has zero reversals; p99 angular speed is
1.773/1.749 rad/s around the intended 1.745 rad/s, and same-draw collision-clock
error is below 1e-6 seconds. The acceptance threshold was not relaxed.

Final source checks: 542 tests / 95,722 assertions, all three TypeScript configs,
Biome over 198 files, matching frozen browser/backend builds and whitespace
checks pass. All 736 authority-matrix racers finish. Thirteen final native-browser
recovery checks pass, including 32 seconds without app writes (1,923 pending
sequences, same session), congestion/snapshot recovery, real socket loss, fenced
identity and a completed race with matching 68.900/69.033 second results. No page
errors, command rejections or host overloads. Native fast/jittery browsers each
complete eight jumps with zero vertical correction; a refreshed jittery client
completes four more with zero correction. The functional cup has matching 28–26
standings and winner announcement. Physical Windows/Linux acceptance remains.


## Shared collision prediction — action-20 (2026-10-18)

Action-19 still displayed remote racers 80–200 ms behind snapshots while local
physics ran ahead. Depending on RTT, the two scene times differed roughly
197–463 ms, enough for a fast runner to be 1.6–3.8 m away from the displayed
contact. Local replay also omitted player/NPC contacts. Those were architectural
causes of phantom bar hits and delayed shoves, beyond correction smoothing.

Action-20/protocol 6 restores/replays one complete actor world using the same
`stepActorWorld` as the host. Snapshots carry NPC decision state and bounded,
validated future input queues. Known peer controls/actions apply exactly;
unknown controls hold their latest active state within the existing 48-tick
world limit. Expired/released controls remain neutral. All actors and obstacles
share fixed-step presentation and the same RAF timestamp. The old independent
remote playback/buffer and self-only state cache are removed. Remote corrections
remain bounded visual offsets, decaying over 40 ms; respawns/recovery reset them.
Finished humans keep observing the predicted live world. Crowd feedback now
runs immediately and uses the cue guard's seconds unit.

The earlier Wobble changes, identical to published action-19 source, were saved
in dedicated commit `de47444` before implementation; unrelated app/Rocket work
was preserved. Full-world replay is deliberately simple: mean 1.50/3.34 ms,
p99 4.72/5.06 ms per snapshot for 4/10 actors at 300 ms RTT lead on this ARM64
VPS. Server lifecycle checks no longer allocate replicated frames every tick.

550 tests / 99,987 assertions, all three TypeScript configurations, 202-file
Biome check and matching builds pass. All 736 authority-matrix racers finish.
Delayed head-on/crossing/shove/bar regressions match server truth below 1e-7 m
once controls are known. Exact NPC decisions, remote future jump/release/dive
edges through wire decoding, and bounded whole-world freezes pass. Actual mesh
positions in two native browsers at about 45/250 ms RTT show no pass-through
frames and minimum settled separation 0.896985/0.897643 m (0.9 m diameter with
existing contact slop). Native jump QA preserves zero vertical corrections for
eight jumps each and four refreshed-client jumps. Constant bars never reverse
and have zero same-draw collision-clock error; their speed threshold is unchanged.

Twelve recovery checks pass, including 32 seconds without application writes,
bounded missing snapshots, backpressure and actual socket loss. The full delayed
remixed Spiral Summit → Sunrise Scramble → Lift Lock cup passes with matching
30–24 results/winner, refresh/outage recovery and tab takeover. A five-second
four-room/32-socket plain/compressed transport comparison saves 77.71% wire
traffic with zero rejections/overloads. Evidence: `evidence/public-action-20/`.
Functional QA suppresses software GPU work. Physical Windows/Linux experience,
unknown human input and severe network loss remain explicit limits; this does
not claim universal smoothness or platform integration readiness. Matching
`20261018-action-19`/protocol 5 remains rollback.


## Placement, targeted collision audit and Hebrew — action-21 (2026-10-18)

The operator reports action-20 working flawlessly. The shared-world prediction
architecture and movement tuning are preserved. Live HUD placement now compares
accepted checkpoint order and normalized section distance along authored routes,
including returning branches and stacked decks. Party positions are predicted;
checkpoint/finish status comes from authoritative frames. Ambiguous same-height
crossings conservatively use an earlier segment, so live placement is an estimate.
Final race/cup results still use server-accepted times and existing tie-breaks.

The focused collision audit reproduced a thin-surface query skipping the deck,
unchecked conveyor carry into a wall, terminal falling through a thin deck and a
closing gate pushing a waiting player through the floor. Solid-path queries now
use bounded spatial subdivisions (maximum 32); controls, timers, NPC decisions
and obstacle time are not advanced again. Dynamic hazard depth/one-response
behavior stays at the final pose. Carry is collision-checked while excluding
only its supporting carrier, so descending elevators do not collide with their
own movement. Closing gates over decks choose a horizontal exit when vertical
clearance is impossible. Regression fixtures cover these cases and ordinary dives.

All 736 authority-matrix racers finish across 23 classic/remix courses and four
seeds. The shipped bar-motion audit samples 783,000 stationary/max-dive relative
cases and finds zero complete between-tick pass-throughs. Maximum bar-tip/mover/
gate displacement is 0.4545/0.2381/0.2299 m per tick. This audits the shipped
bounds; arbitrary faster/thinner content still needs its own collision review.

Hebrew covers menus, all 23 course names/descriptions, HUD, results/winners,
control hints, accessibility labels and common connection failures. Proper names,
branding, diagnostics and internal IDs remain intact. Hebrew/English course-name
search works. UI overlays are RTL; the canvas, movement basis, physical HUD
layout, clocks, room codes and key names remain LTR. User names use HTML/Unicode
isolation; canvas labels choose direction from the first strong letter. Native
browser checks verify mixed names, computed directions, native keyboard movement,
short-desktop reachability and actual menu/lobby/HUD screenshots.

Source verification passes 561 tests / 100,539 assertions, all three TypeScript
configs and Biome. The full delayed remixed Spiral Summit → Sunrise Scramble →
Lift Lock cup passes with matching 30–24 standings, Hebrew winner display,
refresh/offline recovery, fenced replacement tab and next/new-cup lifecycle.
There are no page errors, host overloads or rejected commands in acceptance.
Evidence: `evidence/public-action-21/`; software GPU game drawing is suppressed
in functional checks, so physical-device GPU FPS remains a separate gate.

Contact QA initially included a later fall/respawn rather than just sustained
contact. The fixture now waits until NPCs earn checkpoint 1, records a measured
60-frame settled-contact window before releasing controls, and separately
asserts no respawn in that window. Its existing separation/pass-through bounds
are unchanged. Fast/delayed native clients show minimum 0.897635/0.897886 m
separation with zero pass-through frames. Earlier failed fixtures remain in
ignored evidence rather than being counted as passes.

Protocol 7 requires matching browser/backend physics. All browsers must reload
and start a fresh room. Matching action-20/protocol 6 is retained for rollback.
No app catalog, identity, admission, database or teacher/recess changes were made.

Final action-21 acceptance: 561 tests / 100,539 assertions, all three TypeScript
configs, Biome over 208 files and matching builds pass. The complete delayed
three-race cup has matching 30–24 standings and Hebrew winners, including
refresh/outage recovery and fenced tab takeover. Final native jump diagnostics
show zero vertical corrections and zero retimed ticks for eight fast, eight
jittery and four refreshed-client jumps. An earlier refreshed run recorded six
recovery rebases and two vertical corrections during the software-browser run;
it is retained as failed evidence, not counted as acceptance. The final rerun
kept the correction thresholds unchanged. These checks do not certify physical
GPU performance or eliminate expected recovery rebases through major stalls.

A short active-load comparison runs four rooms, 32 moving/jumping/diving input
clients plus eight NPCs, ten seconds each plain/compressed: all sockets stay
connected, over 12,000 controls are generated, and there are zero command
rejections, skipped snapshots or overload stops. Combined host/client CPU is
31.9%/49.8% of one ARM64 core, RSS 162/202 MB, event-loop p99 19.82/13.15 ms;
compression saves 77.02% per-frame wire traffic. This measures a short synthetic
profile, not sustained school-network or physical-device capacity. Reproduce
with LAB_ACTIVE_LOAD=1 and the existing Node-bundled transport-bandwidth harness.
