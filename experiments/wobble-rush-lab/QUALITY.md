# Current performance review — 2026-10-20

See [PERFORMANCE-READINESS.md](PERFORMANCE-READINESS.md) for the current graphics,
collision-cost, integrated-host capacity measurements and remaining device gates.
The action reviews below are historical; current app behavior is described in
[APP-INTEGRATION.md](APP-INTEGRATION.md).

# Wobble Rush quality review — action-21

The operator reports action-20 working flawlessly. Its shared predicted world is
retained. The remaining scoped engine tasks are now implemented: checkpoint and
route-aware live placement, targeted collision hardening, and Hebrew UI without
mirroring game coordinates or controls.

Placement uses authoritative checkpoints/finishes in party mode, predicted
positions and normalized section distance across different branches. Height
separates stacked roads. Exact self-crossings conservatively choose the earlier
segment; this remains a live HUD estimate. Official results still use accepted
finish times and cup tie-breaks.

Demonstrated collision failures covered thin-surface path skipping, terminal
falls onto thin decks, unchecked carry into walls, and closing gates pressing
players through the floor. Bounded solid-path subdivisions, carry queries that
exclude only their own carrier, and a sideways gate escape repair those cases.
Descending elevator movement, hazard impulse depth/one-response behavior,
authoritative prediction and all authored routes are regression checked. No
extra simulation time, obstacle-speed changes or controller retuning were added.

The authored motion audit samples 783,000 bar/runner combinations across classic
and four remix seeds at rest and maximum run+dive relative speed. It finds zero
complete endpoint misses with midpoint contact. Maximum per-tick bar-tip, mover
and gate displacements are 0.4545/0.2381/0.2299 m. This tests shipped bounds and
is not a general swept-collision guarantee for arbitrary faster/thinner content.

Hebrew covers menus, all course display names/descriptions, HUD, results/winners,
control hints, accessibility labels and common failures. Proper names/brand,
internal identifiers and technical diagnostics remain intact. RTL is scoped to
UI text; room codes, timers, key names and physical HUD layout stay LTR. Names
are isolated, with canvas direction following the first strong letter. Native
browser checks pass for mixed Hebrew/English names, bilingual search, computed
text directions, actual keyboard movement, menu reachability and screenshots.

Verification evidence is in `evidence/public-action-21/`. Automated browser QA
suppresses GPU game drawing; it does not certify physical-device frame rates.
Production admission, recess/teacher policy, durable accepted results and a
restart/deployment policy still belong to the app integration adapter.


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

# Earlier shared-world repair — action-20

The remaining phantom-impact problem came from two separate scene times and
solo-only local replay. Action-20 replaces both with a shared predicted actor
world. The controller, courses and authoritative collision engine are retained.
`actor-world.ts` now steps humans, deterministic NPC brains and world/crowd
contacts identically on host and browser. Protocol 6 snapshots replicate NPC
state and bounded server-queued future controls. Forecasts use known actions
first, then hold active peer controls within the 48-tick world horizon. They do
not fabricate action edges or revive expired controls.

All meshes and obstacles interpolate that same world/RAF clock. The former
remote timeline/buffer is removed, alongside its obsolete tests. Corrections
remain visual and bounded; remote offsets decay in 40 ms. Self-finished clients
continue predicting the remaining racers. Server input validation, authoritative
results and native WebSocket liveness are unchanged. Reading finishers no longer
allocates full replicated frames each server tick.

## Action-20 evidence and limits

- Delayed symmetric/asymmetric head-on, crossing, shove and constant-bar cases:
  predicted positions agree with later server truth below 1e-7 m after controls
  are known; contact ticks agree and runners remain separated.
- Exact NPC brain/state replay, future remote jump/release/dive edges through
  the decoded wire schema, and 48-tick whole-world freeze all pass.
- Two native browser contexts, real delayed WebSockets and actual mesh transforms:
  approximately 45/250 ms RTT, 210/211 settled-contact draws, minimum displayed
  separation 0.896985/0.897643 m, zero pass-through frames or socket closures.
- Native jump checks: eight short/held jumps on each fast/jittery client, four
  more after jittery-client refresh; zero vertical corrections or retimed ticks.
- Full-world replay cost at 300 ms RTT lead, 599 snapshots per roster on this
  2-core ARM64 VPS: mean 1.50/3.34 ms, p99 4.72/5.06 ms for 4/10 actors.
  This supports removing the self-only cache; no new cache is needed yet.

- Full verification: 550 tests / 99,987 assertions, all TypeScript configs,
  Biome over 202 files, matching builds and all 736 course-matrix racers pass.
- Constant-speed bars: no reversals, p99 2.2435/1.7453 rad/s against 1.7453
  intended speed (existing <1.3× threshold retained), same-draw clock error zero.
- Twelve native-browser recovery checks pass, including bounded snapshot loss,
  clumped controls, backpressure, three-second render pause, 32-second application
  silence on the same socket, respawn and actual socket restoration.
- Complete remixed three-race cup with 80 ms guest delay each way: matching
  30–24 standings/winner, refresh and offline recovery, finished-cup restoration,
  fenced replacement tab, next-round/new-cup lifecycle; no page errors.
- Native Node/ws transport comparison: four rooms/32 sockets, five seconds each
  plain/compressed, compression saves 77.71% per-frame wire traffic; zero command
  rejections or overloads. CPU 19.0%/33.6% of one VPS core, RSS 124/174 MB.
  Humans are stationary and NPCs move; this is not general capacity acceptance.

Evidence: `evidence/public-action-20/`. These are deterministic and functional
browser checks with software GPU work suppressed, not physical-device FPS or
Internet-capacity acceptance. Unreceived human decisions, abrupt direction
changes and major outages can still require server corrections. Retest the
actual Windows/Linux pair before platform integration: sustained player contact,
crossing paths, moving bars, short/held jumps, background/return and a full cup.

The action-19 review below is historical; its self-only cache and independent
remote playback were superseded by action-20.

# Earlier timing repair — action-19

The core controller and course simulation are worth retaining. The main defect
was the contract between client prediction and authoritative time, compounded by
connection and presentation policies. Replacing the entire physics engine would
not address those defects. This review keeps server-owned collision, checkpoint,
finish and cup rules, and replaces their network timing contract.

## Findings and resulting design

| Area | Finding | Change |
| --- | --- | --- |
| Input timing | Arrival-time coalescing could move a jump or its release onto a different tick from local replay. The old 12-tick prediction ceiling also stalled ordinary delayed play. | Controls name an exact simulation tick. The server queues at most one second of future ticks; normal bursts retain short press/release sequences. Truly late inputs merge once at the next server tick. |
| Reconciliation | Tick replay lacked a shared application tick, and local held input could replace the snapshot's actual held controls. RTT changes could add simulation time. | Snapshots include held controls and their application tick. Replay uses the same input/world ticks. Lead calibrates before play, seeded from admission RTT on refresh; ordinary snapshots do not retime an ongoing jump. |
| Replay cost | Restoring and replaying every snapshot repeats collision queries even when prediction already matches. | Compare every physical field at the snapshot tick and the current cached tick. Reuse matching prediction; only divergent states replay. Histories cap at 48 ticks. |
| Local display | Independent 60 Hz physics and RAF displayed repeated positions, particularly above 60 Hz. | Interpolate one fixed step for the local mesh and camera. Collision state remains exact. An older segment handles RAF timestamps preceding the latest timer step; respawns reset interpolation and correction offsets stay visual. |
| Obstacle display | A display clock estimating current server time could show a different bar/platform phase from the local future collision world. | Anchor presentation to the local collision timeline, using nominal fixed-step timestamps, the same RAF timestamp and interpolation. It stops when prediction stops. |
| Upload traffic | The client wrote identical held controls 60 times a second. | Send changes and action edges immediately; refresh held state at 10 Hz. Local simulation remains 60 Hz; an 8 ms poll and nominal step timestamps accommodate coarse timer callbacks. |
| Downstream congestion | Queued snapshots became obsolete; a single large backlog could close a recoverable connection. | Skip replaceable frames above 64 KiB; recover with the next current frame. Bound other writes at 256 KiB and close sustained congestion after ten seconds. |
| Socket liveness | Thirty seconds without JavaScript writes was treated as a dead socket, including timer-throttled background tabs. | Host sends protocol pings every ten seconds. Automatic browser pongs establish transport liveness; controls still expire after 250 ms. |
| RTT diagnostics | Replies arriving after the next one-second ping were ignored. | Match each pong to its nonce, retaining a bounded twelve-sample RTT history and jitter headroom. |
| Remote respawn | Interpolation could draw a racer travelling across the course after respawning. | Clear that racer's interpolation samples when the authoritative respawn revision changes. |
| UI cleanup | The controls-hint timer outlived game disposal, and fatal error text entered an HTML template without escaping. | Dispose the remaining UI timer and escape fatal text. |
| Error handling | Application callback exceptions were labelled invalid server protocol. | Catch decoder failures at the decoder boundary; let application failures reach the runtime error reporting path. |

## Authority and limits

Protocol 5 requires matching browser/backend builds. A control's tick selects
when a validated action is applied, never how many physics steps run. The host
still advances the entire room once per 60 Hz tick. It rejects impossible future
claims, duplicate/old sequences, forged transforms/results and foreign race IDs.
Late bursts cannot buy extra movement or repeat an action edge on every tick.
Disconnect clears queued controls. Reconnect still reserves the same actor for
30 seconds and fences a replaced socket.

Client lead is RTT plus a six-tick jitter margin, capped at 36 ticks from the
received frame. It calibrates during countdown or initial restore. Missing
snapshots freeze prediction by 48 ticks beyond the last frame; recovery rebases
from truth on the same socket. This intentionally does not promise smooth play
through arbitrary packet loss or multi-second stalls.

## Evidence

- The previous empty-floor reproduction at 200/300 ms RTT produced 32/48
  corrections over 5 cm across eight jumps, maximum vertical correction 1.139 m.
  The revised model produces zero in the identical comparison.
- Deterministic acceptance covers seven symmetric/asymmetric delay and jitter
  profiles, each with fifteen seconds of short/held jumps, releases, dives and
  steering. Ordinary reconciliation changes neither the simulation tick nor the
  position (error below 1e-8 m). Scheduled packet batches preserve brief releases.
- Native-browser jump QA uses real controls and WebSockets on both a fast path
  and an approximately 200–260 ms jittery path. Each performs eight short/held
  jumps. Evidence is in `evidence/quality-jumps-accepted/`; software drawing is suppressed using the inspection hook, so this measures timing and reconciliation,
  not physical GPU performance. The refreshed jittery client performs four
  additional jumps with no vertical correction; its polling is quantized to
  16 ms to exercise coarse scheduling.
- Display acceptance samples 60 Hz movement at 144 Hz and checks continuous
  position, correction translation and respawn reset.
- Complete regression/static/build, cup and connection evidence is recorded in
  `STABILIZATION.md` and `evidence/public-action-19/` when the release is activated.

## Remaining integration gate

Replay the actual Windows/Linux pair on the matching release before integrating.
Use ten alternating short/held jumps, then a minute around moving bars and other
racers. Keep one client connected in the background for over 30 seconds, return,
and verify movement resumes without a reconnect overlay. Finish a two-player cup.
Record any failure with its course/time and whether it was a correction, delayed
badge or actual reconnect; these now have distinct diagnostics.

Crowd contacts remain server-owned and locally unpredicted. A real shove, unknown
remote input or severely late packet can still require correction. That is a
separate acceptance case from an unobstructed jump. Rendering still needs normal
physical-device FPS/context-loss checks; software GPU screenshots are not a
performance measurement. The bar fixture verifies no reversals or angular-speed spikes under ordered
35–159 ms inbound jitter, with mesh/collision-clock error below 1e-6 s.

The existing renderer inspection hook is available before offscreen environment
work, so functional fixtures can suppress all GPU drawing without stalling refresh.
This is not a physical rendering acceptance check. The previous abnormal 1006 close does not by itself
identify a Windows/Wi-Fi/VPN cause, and this review does not claim it does.

The lab still lacks pause/recess, platform identity/membership/teacher controls,
durable process recovery and a measured simultaneous-room capacity limit. Keep
those platform concerns outside this standalone engine repair. Existing Worker
files remain only for the documented matching rollback, not as a second runtime
path for this build.
