# Wobble Rush 3D multiplayer lab

Public URL: **https://wobble.labs.play-ormenachem.com**

Published 2026-10-18: **20261018-action-21**, protocol **7**, content
**playground-action-4**. This is the authoritative Node engine with all 23 courses.
The server simulates humans/NPCs, checkpoints and finishes. Browsers send controls
and predict movement. See [ACTION.md](ACTION.md) for architecture/build commands
and [STABILIZATION.md](STABILIZATION.md) for validation and remaining engine gates.
The broader review and repair boundaries are in [QUALITY.md](QUALITY.md).

Owner: Playground lab operator, user ubuntu, Oracle ARM64 VPS 84.13.78.187,
checkout /home/ubuntu/OMplayground. This standalone lab has no Playground identity,
catalog, production database or platform session integration.

## Matching source and release

- Upstream: https://github.com/code-yeongyu/wobble-rush-3d
- Pinned base: b395e4a91ebdfb829533b1ae6beda244371658a3; MIT license retained.
- Release: /srv/playground-labs/wobble/releases/20261018-action-21.
- Active link: /srv/playground-labs/wobble/current.
- SOURCE_REVISION records the base plus working-tree snapshot status;
  SOURCE.sha256 identifies exact source. RELEASE.sha256 identifies matching
  browser/backend outputs, package and frozen lockfile. Source is committed
  independently of unrelated app/Rocket changes.
- Previous matching Node release: `20261018-action-20`, retained unchanged.
- Older matching Worker release: 20261015-spiral-09, retained unchanged with
  its old client/dependencies/runtime. Original unit retained at
  ops/labs/playground-lab-wobble.worker.service.
- Historical content/Worker checks: [WORKER-BASELINE.md](WORKER-BASELINE.md).

## Playtest

App integration is developed separately; see [APP-INTEGRATION.md](APP-INTEGRATION.md)
for its contract, development command, save/recovery fidelity and acceptance status.
The following flow describes the standalone comparison lab.

1. Reload the page on every browser to load the new client.
2. Choose a course, **מרוץ יחיד** or **גביע של שלושה מרוצים**, and optional
   **קצב מכשולים משתנה**. Leave the code empty and select **משחק ברשת** to create a room.
3. Share its four-letter code. Another player enters it and selects **משחק ברשת**.
4. Both select **אפשר להתחיל**. Rooms need 2–8 humans; two server NPCs also race.
5. Compare results, use **המרוץ הבא** for the next cup round, then **גביע חדש**.

Desktop controls: WASD/arrows move, Space jumps (hold for height), Shift dives,
R respawns, mouse drag orbits, Q/E rotates and C centres the camera. Leave race
returns to the menu. Touch movement controls are not implemented.

Suggested test: race Spiral Summit using different routes, ride both Lift Lock
elevators, then try a remixed three-race cup. Compare checkpoint recovery,
movement corrections, finish order and shared NPC positions. Refresh or briefly
disconnect: the client should resume the same racer within 30 seconds. The race
continues while disconnected and held controls release. Reconnect reservations
count toward room capacity. A replacement tab takes control and the old tab stops
retrying. Host control transfers after an explicit leave or expired reservation.
Section challenge hints are removed from the HUD; controls/checkpoint pips remain.
Final cup results now prominently announce the winner, including exact ties.

## Placement, collision audit and Hebrew — action-21

Live HUD placement uses validated checkpoint order and normalized distance along
the current section's authored routes. This handles returning roads, different
branch lengths and stacked decks. Party positions follow prediction, while
checkpoint/finish status comes from authoritative frames. Exact self-crossings
use a conservative earlier-segment estimate; placement is a HUD approximation,
never permission to award results. Accepted finish times still decide results.

Fast solid displacement now uses bounded spatial collision steps (at most 32,
half a runner radius per step within that bound), without advancing extra time
or repeating controls. Hazard impulses remain sampled once at the final pose.
Conveyor/ferry carry is checked against nearby obstacles, excluding only its own
supporting carrier; descending elevators continue carrying correctly. Closing
gates push a waiting runner sideways when there is no clearance above the deck,
instead of forcing it through the floor. Movement tuning and obstacle speeds
are unchanged. Authority and prediction use these identical protocol-7 rules.

The authored bar-motion audit samples 783,000 stationary/max-dive relative
contacts across all classic/remix courses and four remix seeds: zero complete
between-tick pass-through cases. Maximum sampled/analytic displacement per tick:
bar tips 0.4545 m, movers 0.2381 m, gates 0.2299 m. This is bounded evidence for
the shipped content, not a continuous-collision guarantee for arbitrary content.

Menus, all 23 course names/descriptions, HUD, results, winner announcements,
controls hints and common connection messages are Hebrew. Internal IDs, proper
names/brand and technical diagnostics remain compatible. English course-name
search still works. RTL is scoped to text/menu overlays; canvas, movement axes,
HUD layout, room codes, timers and key names stay LTR. Player names use direction
isolation; mixed Hebrew/English name labels follow their first strong letter.
Hebrew/RTL browser checks include screenshots, real native keyboard movement,
bilingual search, mixed names and a short desktop viewport. No touch support or
platform authentication/session/recess integration is added.

The operator reported action-20 working flawlessly. This release preserves its
shared-world prediction and adds the scoped fixes above. Reload every browser
and create a fresh room; matching action-20/protocol 6 remains rollback.
Evidence: `evidence/public-action-21/`. Physical-device GPU FPS and production
capacity acceptance remain separate from functional software-GPU QA.


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

## Shared collision prediction (action-20)

The previous build predicted only your runner while displaying other racers on
an older buffered timeline. That made obstacle hits and player pushes appear
late. All humans, NPCs and moving obstacles now share one predicted world tick,
using the same actor/collision step as the authoritative host. Snapshots include
NPC decisions and validated future controls already queued by the server. Known
peer actions replay exactly; unknown future steering holds the latest active
controls. There is no separate remote playback delay. Crowd contacts now produce
local feedback immediately, and finished racers continue watching the live world.

The whole world freezes at the existing 48-tick snapshot horizon. Forecasts
cannot know unreceived decisions; major loss and abrupt peer actions can still
need authoritative corrections. The server still owns checkpoints, finishes,
control expiry, results and security bounds. Matching protocol 6 is required:
reload every browser and create a fresh room. Action-19/protocol 5 is rollback.

Delayed head-on, crossing, shove and constant-speed-bar tests match authoritative
positions/contact ticks once controls are known. Real browser contact checks at
roughly 45/250 ms RTT retain at least 0.8969 m displayed separation (0.9 m runner
diameter, with existing contact slop) and no pass-through frames during settled
contact. Future action edges, NPC brains and bounded outages have dedicated
regressions. Native fast/jittery clients each complete eight jumps, plus four
refreshed-client jumps, with zero vertical correction. Evidence and current
remaining gates are in QUALITY.md and evidence/public-action-20/.

Full replay averages 1.50/3.34 ms per snapshot for 4/10 actors at 300 ms RTT lead
on this ARM64 VPS. The old self-only prediction cache is removed. Browser QA
suppresses GPU work and does not establish physical Windows/Linux smoothness.
Final source checks: 550 tests / 99,987 assertions, all three TypeScript
configurations and Biome over 202 files pass. All 736 course-matrix racers finish.
Twelve browser recovery checks pass, including 32 seconds without app writes.
A complete remixed Spiral Summit → Sunrise Scramble → Lift Lock cup passes with
80 ms guest delay each way, refresh/outage recovery, matching 30–24 standings,
winner announcement and tab takeover. Constant-speed bars never reverse; their
same-draw collision-clock error is zero. A five-second Node/ws comparison with
32 sockets in four rooms measures 77.71% less wire traffic using compression;
all remain connected, with zero rejected commands or overload stops. This is
scoped transport evidence, not a general capacity claim.
The earlier Wobble work was preserved in dedicated commit `de47444` before this
change; unrelated work and hosting are left untouched.

## Timing and quality repair (action-19)

Protocol 5 replaces arrival-timed control coalescing with tick-addressed future
inputs and exact replay. The same jump/release now runs on the same ticks on
both sides. Admission RTT seeds refreshed clients; countdown pongs calibrate
lead. Matching complete physical states reuse prediction instead of rebuilding
collision worlds. Party sampling polls every 8 ms and shares the bounded fixed
stepper with solo. Catch-up retains nominal physics timestamps.

Local mesh/camera and moving obstacles interpolate the same physics timeline;
a frozen prediction no longer leaves its bars running ahead. Remote respawns
clear stale interpolation samples. Changes/actions upload immediately; unchanged
held controls refresh at 10 Hz instead of 60 identical writes per second.
Backpressure skips replaceable snapshots, and nonce-matched pongs include slow
replies. Server protocol ping/pong liveness replaces the old 30-second JavaScript
silence timeout, accommodating live backgrounded browsers. Stale controls still
release after 250 ms. Remaining UI timers are disposed and fatal text is escaped.

The repeated-jump comparison at 200/300 ms RTT previously produced 32/48 vertical
corrections above 5 cm across eight jumps, up to 1.139 m; the revised comparison
produces zero. Native-browser acceptance separately measures fast/jittery jump
arcs and refreshed clients. The full reconnect cup uses Spiral Summit → Sunrise
Scramble → Lift Lock with 80 ms guest delay in each direction. Software rendering
is skipped for functional acceptance; see evidence and limitations in QUALITY.md.
The first rendered attempt finished round one but missed its reconnect injection
while blocked on software-GPU capture; it is not counted as reconnect acceptance.

542 tests / 95,722 assertions, static checks and matching builds pass. All 736
authoritative racers finished the 23-course classic/remix matrix. Thirteen final
browser recovery checks pass, including 32 seconds without application writes
on the same socket and a real race with matching 68.900/69.033 second results.
The constant-speed bar check has no reversals/spikes and zero same-frame phase
error within numerical precision. Four refreshed-client jumps also have zero
vertical corrections. Evidence: evidence/public-action-19/. These are functional
checks with GPU work suppressed, not physical-device performance acceptance.

This build requires every browser to return to the menu and reload, then create
a fresh room. It retains matching action-18 for rollback. Physical Windows/Linux
acceptance remains the integration gate; real crowd impacts and severe packet
loss can still require authoritative corrections.

## Transport traffic (action-18)

The latest physical session showed one client's reported RTT at 70–299 ms with
input acknowledgement stalls, compared with 30–81 ms on the other. Frame timing
was healthy on both. The affected socket had one abnormal 1006 close; no host
kick, overload or command rejection explained it. TCP counters also showed
retransmissions. This narrows the issue but does not establish the device's
Wi-Fi/browser/VPN cause; device details and another physical comparison are needed.

Snapshots now negotiate bounded compression; the measured 32-socket/four-room
Node comparison reduced bytes per frame by 74.76%. CPU was 21.61% versus 33.69%
of one core, including the test clients; no overload/rejections/disconnects.
The short stationary-human benchmark is not full capacity acceptance. Finished
races stop broadcasting unchanged snapshots; pongs and explicit final/resync/
reconnect state remain. Gameplay and protocol/content stay unchanged.

531 tests / 93,427 assertions, static/build checks and eleven native-browser
transport/recovery checks pass, including compression negotiation on both browsers.
No full cup or repeated course matrix. Evidence: evidence/public-action-18/ and
evidence/transport-compression/. Action-17 is retained for rollback. Return to the
menu, reload both browsers and create a new room to test the new matching release.
This reduces pressure on an unstable link; it is not proof that the physical
connection's underlying fault is resolved.

## Prediction and connection recovery (action-17)

Replay now uses simulation ticks, not the number of unacknowledged messages.
A 100 ms control delay on flat ground previously introduced an artificial 0.82 m
forward correction and a 0.68 m pullback; the fixed comparison introduces zero
error. Local prediction caps at 200 ms beyond the last frame and resumes from
fresh truth without reconnecting just because 120 inputs lack acknowledgement.
The controls/physics pump now runs independently of GPU drawing, alongside the
already independent heartbeat. Genuine closed sockets retain same-racer recovery.

Outbound congestion keeps one latest input with latched actions, resumes when TCP
drains and closes only if that congestion persists over ten seconds. Missing
snapshots show Connection delayed and can request a fresh frame over the live
socket. Explicit respawn revisions snap presentation and drop pre-respawn replay;
ordinary/contact corrections use bounded visual smoothing. RTT estimates filter
jitter. Server movement, obstacle geometry and crowd physics remain unchanged.

530 tests / 93,415 assertions, typechecks/lint and matching builds pass. Targeted
browser QA passed 11 checks: delayed acknowledgements/snapshots, congestion,
three seconds without drawing, respawn, real socket recovery and a completed race.
Both clients showed the same 37.583/37.850 second finishes, with zero page errors.
Browser evidence is in evidence/reconciliation-recovery-accepted/; release and
public transport evidence is in evidence/public-action-17/. No full cup/course
matrix or physical-device FPS acceptance was repeated. The lab still needs a
physical-device replay of the reported case; this change removes confirmed false
reconnect/replay causes but does not identify every past socket loss.

Logs now record known close-reason classifications, close codes, snapshot/ack
backlogs, correction size, frame intervals and RTT, bounded to one client report
per five seconds. Raw controls, close text and reconnect tickets stay out of logs.
Reload every browser and create a new room for protocol 4. Rollback restores the
matching protocol-3 action-16 client/backend together.

## Small follow-up (action-16)

Human roster updates preserve NPC meshes and interpolation buffers; authoritative
frames still own NPC removal. This avoids brief NPC blinking and texture/mesh
recreation during reconnect/roster changes. The HUD skips unchanged placement
text and checkpoint styles. No movement or networking rules changed.

520 tests / 93,364 assertions, all type configurations, lint and matching builds
pass. A focused regression checks preserved mesh identities and correct human/NPC
removal using real Three objects. No full browser cup or course matrix repeated.
Publication evidence: evidence/public-action-16/. Action-15 is retained for rollback.

## Timing and lag follow-up (action-15)

Spinning bars now use a continuous presentation clock: ordinary snapshot/RTT
jitter gently adjusts clock speed instead of jumping their position. Drawing
samples this clock every frame. Some bars intentionally surge; that remains.
Remote-player playback buffers 80 ms normally (40 ms less than before), adding
buffering during jitter. Manual party play avoids two unused collision-world
snapshots per local tick. A stale first animation timestamp can no longer delay
input/physics after slow startup. Server movement/collision rules are unchanged.

519 tests / 93,356 assertions, all three type configurations, lint and matching
browser/Node builds pass. Controlled comparison with archived action-14 produced
100 backward clock steps in ten seconds before, zero after. Targeted browser QA
uses actual constant-speed bar transforms and delayed, ordered inbound packets;
both clients had zero backward bar steps and errors of -1.25/+30.03 ms against
the server at the same draw. See evidence/public-action-15/ and
evidence/timing-jitter-accepted/ for results.
No full cup/course matrix was repeated; prior engine/cup evidence below remains
historical. Software-GPU QA does not establish physical-device FPS or Internet
latency. Presentation buffering changes do not reduce network RTT.
Public readiness, exact matching asset bytes and six real WebSocket
race/reconnect checks passed. The persistent unit has zero restarts; staging
19003 is stopped. Rollback retains action-14 unchanged.

## Build and hosting

Use explicit Bun/Node paths and commands in ACTION.md. Bun is installed at
/home/ubuntu/OMplayground/ops/labs/tools/bun-1.4.3/package/bin/bun; Node is
/home/ubuntu/.local/share/fnm/node-versions/v24.21.0/installation/bin/node.
Frozen install, tests, typecheck, lint and build:action produce matching outputs.
Temporary staging uses ACTION_PORT=19003; that staging host is now stopped.

Enabled persistent playground-lab-wobble.service runs explicit Node 24.21.0 on
**127.0.0.1:19002**, working from current, with restart-on-failure and a seven
second stop timeout. Maintained unit: ops/labs/playground-lab-wobble.service;
installed: /etc/systemd/system/playground-lab-wobble.service.

Environment: NODE_ENV=production, LOG_LEVEL=info, ACTION_PORT=19002,
ACTION_MAX_ROOMS=4, ACTION_STATIC_ROOT=dist,
ACTION_ORIGIN=https://wobble.labs.play-ormenachem.com. No QA seed is configured.
Intermediate action-13 is also retained; action-14 moved heartbeat traffic out
of the render loop. Action-15 adds continuous presentation timing and startup fixes. The current build embeds development in the log environment label despite the
service setting; protocol/content and runtime health identify this release.

Caddy serves current/dist and proxies /api/* and /ws/* unchanged to 19002.
Existing configuration was validated and retained without reload. DNS, firewall,
other games and app ports were unchanged. Rocket retains 19001; app 8080/8081
and forwarded 3000/5173 remain reserved.

```sh
systemctl status playground-lab-wobble.service --no-pager
sudo journalctl -u playground-lab-wobble.service -n 100 --no-pager
sudo systemctl restart playground-lab-wobble.service
sudo systemctl stop playground-lab-wobble.service
curl -fsS https://wobble.labs.play-ormenachem.com/api/health
curl -fsS https://wobble.labs.play-ormenachem.com/api/ready
```

Restarting cancels in-memory rooms. The four-room ceiling is not a capacity
measurement. Reconnect is supported within the same live process. Pause/resume,
durable recovery and deployment drain are not implemented. Long server stalls explicitly cancel affected races. Physical
network/device feel, simultaneous-room load, route-aware placement, swept
collision checks and rendering quality remain acceptance work before integration.

## Deployment checks and rollback

Action-14 passed **510 tests**, all three type configurations, lint and matching
browser/Node builds. New socket tests cover actor/ack restoration, stale controls,
ticket isolation/revocation/expiry, duplicate fencing, host transfer, reserved
capacity and results replay without duplicate scoring. No movement tuning or
course geometry changed; the earlier 736-run engine matrices were not repeated.

A complete two-browser cup on Spiral Summit → Lift Lock → Terrace Tangle passed
with a guest refresh at checkpoint 1 and a temporary offline/retry at checkpoint
1. Both restored the same identity/progress. Matching final standings were 28–26;
LabGuest wins the cup appeared on both screens. A replacement tab restored the
finished cup while the old tab stopped retrying; New cup and Leave also passed.
The run had zero page errors. Software-GPU draws were deliberately limited; this
does not measure physical-device FPS or multiplayer capacity.

The final build also checks renderer-stall liveness, a seven-second paused render
loop with independent heartbeats, lobby refresh, cancelled
retries, cleared refresh tickets, invalid-ticket errors and burst-safe traffic.
Evidence: evidence/reconnect-cup/, evidence/reconnect-liveness/ and
evidence/public-action-14/. The operator separately confirmed a two-person cup
worked on action-12. No physical-device reconnect acceptance is claimed yet.
The completed action-14 public HTTPS/WSS smoke passed same-racer/race restoration,
preserved acknowledgements, duplicate takeover with code 4001 and resumed control
acceptance. Public readiness and matching asset bytes passed; staging is stopped.

Rollback to the preceding Node release (same matching systemd unit):

```sh
sudo systemctl stop playground-lab-wobble.service
sudo ln -s /srv/playground-labs/wobble/releases/20261018-action-20 /srv/playground-labs/wobble/current.rollback
sudo mv -Tf /srv/playground-labs/wobble/current.rollback /srv/playground-labs/wobble/current
sudo systemctl start playground-lab-wobble.service
curl -fsS https://wobble.labs.play-ormenachem.com/api/health
```

Reload every browser after rollback as well. For the older Worker fallback, both
its matching release (20261015-spiral-09) and the retained Worker unit must be
restored, followed by daemon-reload/start; the action-10 snapshot's LAB.md retains
those exact commands. Worker health returns version 1. Do not pair clients across
these content/protocol versions. No Caddy reload is needed for either backend.
