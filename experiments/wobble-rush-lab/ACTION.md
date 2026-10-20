# Authoritative Wobble development runtime

Protocol 7 / pack `playground-action-4`. Published as `20261018-action-21` at the
public URL in `LAB.md`. The old Worker snapshot remains available for rollback.

## Runtime decision

Preserve Wobble's native WebSocket transport and pure lobby/cup reducers. Move
continuous physics to a separate Node host using pinned MIT-licensed `ws`
8.21.0, rather than the comparison Worker's one-second alarm. `ws` and its type
package are pinned in the independent Bun lockfile. Colyseus remains an option
for the platform's future shared action runtime; this standalone decision does
not change ADR 001 or the existing board/Minecraft services.

This host owns its protocol, scheduler, snapshots, prediction and room allocation.
Upstream simulation/controller/course data remain reusable. A later platform
adapter or transport migration must preserve the engine invariants tested here.

## Engine and protocol

- `src/shared/authoritative-race.ts` runs humans and NPCs together at 60 Hz and
  owns checkpoint progression and tick-derived finish times. Clients submit
  controls, never transforms, checkpoints, scores or finish claims.
- `src/shared/action-protocol.ts` validates strict versioned commands and full
  simulation snapshots. Client messages are capped at 4096 bytes, controls and
  sequences are bounded, unknown fields are rejected, and every input names the
  current host-generated race ID. Stale-round inputs cannot affect a rematch.
- Inputs name their intended host simulation tick. A bounded queue retains
  individual future press/release samples, at most 60 ticks ahead. Each host
  tick applies that tick's sample once; genuinely late samples coalesce onto the
  next host tick with latched jump/dive/respawn edges. Held controls expire after
  15 ticks. Message count never buys physics time. Strict sequence/race checks
  and the 240-capacity/120-per-second token bucket remain.
- Crowd separation alternates up to 12 position passes with world contact repair,
  stopping early when settled. Momentum transfers once per pair per tick;
  obstacle responses also occur at most once per obstacle during these passes.
  Shoving remains, with firmer pack/wall separation and no added impact energy.
- `src/action/room.ts` feeds only simulated finishes to the existing lifecycle
  reducers. A final full snapshot precedes accepted race/cup results.
- `src/action/host.ts` allocates process-owned rooms and schedules monotonic
  fixed ticks with bounded catch-up work. A scheduling interruption over one
  second explicitly stops affected races. Snapshots are sent about every 50 ms,
  independently of browser rendering using elapsed monotonic time. Congestion
  skips replaceable frames above 64 KiB instead of growing a stale queue. Periodic frames stop after the race ends;
  final state still goes out with results and on resume/resync. Pongs keep idle
  connections alive. Hot state is not persisted per packet.
- Full snapshots negotiate permessage-deflate with no context takeover, a 2 KiB
  server deflate window, level 1, memLevel 4 and a global concurrency limit of 2.
  Only frame messages are compressed and only above the 1024-byte threshold;
  control/ticket messages remain uncompressed. Plain clients retain the same
  protocol and behavior. Join/resume logs record whether compression negotiated.
  A Node/ws transport comparison measured 74.76% less wire traffic per frame;
  four rooms/32 sockets remained connected with no overload/rejections. Its five
  seconds of stationary-human traffic are not general capacity acceptance.
- The host bounds room/connection count, traffic and outgoing backlog; checks
  browser Origin; expires unjoined connections after five seconds, transport-dead
  connections after 30 seconds without automatic WebSocket pong replies, empty reservations after 30 seconds, and
  occupied idle rooms after 15 minutes. This anonymous lab permits non-browser
  clients; those controls do not establish Playground admission/identity.
- `src/shared/actor-world.ts` is the shared 60 Hz actor step: human controls,
  deterministic NPC decisions, obstacle/crowd constraints, respawns and finishes.
  Authority and prediction call this same function. The host never accepts
  browser physics or results.
- `src/shared/prediction.ts` restores the whole actor world and replays it to the
  local tick. Snapshots include held controls, NPC decision state and validated
  future controls already queued by the host. Replay uses those exact edges;
  beyond known peer samples it holds their latest active controls, without
  inventing new jump/dive/respawn edges. Expired/released controls stay neutral.
  Lead calibrates during countdown/restore, using RTT plus six jitter ticks,
  capped at 36 ticks. The entire world stops by 48 ticks beyond the last frame.
  Self-finished clients keep predicting the remaining racers as observers.
- Every racer and obstacle shares that predicted tick and RAF timestamp. Meshes
  interpolate one fixed step; remote playback's separate 80–200 ms delay is
  removed. Respawns/recovery reset poses; ordinary correction offsets remain
  visual and bounded, with 40 ms decay for remote corrections. Unreceived human
  decisions and long outages can still require corrections.
- Replay deliberately rebuilds the full world each snapshot. The old self-only
  cache could not establish that peer decisions/queued controls also matched.
  At 300 ms RTT lead, an ARM64 measurement averaged 1.50 ms per reconciliation
  for 2 humans/2 NPCs and 3.34 ms for 8 humans/2 NPCs (599 snapshots each).
  This is a scoped replay-cost measurement, not physical-device FPS acceptance.
  The host reads human finishers without allocating a full snapshot every tick.
- Party controls poll every 8 ms independently of drawing, preserving nominal
  step timestamps through catch-up. Held state refreshes at 10 Hz; changes and
  action edges upload immediately. Missing snapshots freeze and later rebase on
  the same connection; authority/liveness/queue bounds are unchanged.

## Operations

The independent host uses pinned Pino 9.14.0 and a small process-lifecycle adapter
following `docs/LOGGING.md`. The production workspace logger has a closed service
list and platform dependencies, so this lab does not import that workspace.
Logs use stable event names, room/request correlation IDs and structured errors;
they exclude names, IPs, payloads and per-input/tick output. Readiness is exposed
at `/ready` and `/api/ready`, health at `/health` and `/api/health`. Shutdown stops
admission/timers, closes owned handles, flushes logs and has a five-second bound.
Startup/fatal failures are supervised and exit nonzero.
Command rejections record bounded reason codes (schema, rate, binary, join or
sequence gap) and schema field paths, without raw command values.

## Build and run

Use the explicit Bun/Node paths and browser-library environment in `LAB.md` on
this VPS. Check port ownership first. No Playground/Cloudflare credentials.

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run lint
bun run build:action
ACTION_PORT=19003 node action-dist/main.mjs
```

`bun run dev` builds and starts the same host. It binds loopback and serves the
matching `dist` client and `/api/*`, `/ws/*`. Browser URLs use the page origin.
Ctrl-C stops the test host. Configuration: `ACTION_PORT` (19003),
`ACTION_STATIC_ROOT` (`dist`), `ACTION_MAX_ROOMS` (4, an admission ceiling, not a
capacity measurement), optional exact `ACTION_ORIGIN` when proxied. Optional
`ACTION_QA_SEED` sets a repeatable uint32 seed for isolated QA; normal rooms use
host randomness. The protocol supports 2–8 humans plus two host-owned NPCs.

Do not pair the current client with the retained Worker adapter. The required
authority handshake rejects that pairing. Upstream README/Worker files remain
for provenance; the package's former Worker deployment shortcut was removed.
The public lab now uses a matching immutable Node release and persistent Node
service. The previous Worker release and unit remain retained for rollback.

Hono is retained only for the baseline Worker adapter. Its development lockfile
entry was patched to 4.13.7 after the production audit reported advisories in
4.12.32. The Node action host does not import Hono. The immutable public baseline
was not modified by that source dependency update.

## Reproducible checks

```sh
bun run scripts/qa/authority-pack.ts
bun run scripts/qa/course-pack.ts --crowd
bun run scripts/qa/course-pack.ts
ACTION_PORT=19003 ACTION_QA_SEED=424242 node action-dist/main.mjs
```

In a second shell, with the VPS browser library/font environment from `LAB.md`:

```sh
LAB_URL=http://127.0.0.1:19003 LAB_COURSE=pendulum-pier \
LAB_GUEST_DELAY_MS=60 LAB_PREVIEWS=skip LAB_PIXEL_RATIO=0.125 LAB_DRAW_MS=10000 \
LAB_EVIDENCE=evidence/authoritative-latency-cup node scripts/qa/lab-smoke.mjs
```

The delay harness adds 60 ms before guest sends and 60 ms before guest message
delivery, preserving order. It asserts control-only client traffic, host-owned
human/NPC frames and accepted finishes for each round. This is controlled delay,
not packet-loss or physical-network evidence. Software GPU draws are deliberately
infrequent; the run does not establish normal frame rate or server capacity.

## Reconnect lifecycle

The host issues a random 256-bit bearer ticket after a successful join. Tickets
are bound to one room/player and kept only in process memory on the host. The
browser keeps its ticket in sessionStorage for this tab, so refresh can resume.
They never appear in URLs or logs. This is anonymous lab admission, not platform
identity. Storage-denied browsers can recover in the same page but cannot resume
after refresh.

A closed connection reserves membership for 30 seconds. Controls and pending
action edges release immediately; physics, hazards, race deadlines and other
racers keep running. Resume restores the same actor/ack, checkpoint and cup
state. Welcome, phase, authoritative frame and any finished results are replayed
without scoring again. A replacement socket fences the old socket immediately;
the old tab receives 4001 and stops retrying. The same message budget follows
the actor across replacements. Closing handshakes have a one-second bound.

Disconnecting in the lobby clears readiness and shows Reconnecting. The host
slot stays reserved during grace; expiry or explicit leave removes it and the
next racer becomes host. Reservations still count toward the eight-player cap.
Invalid, expired, wrong-room or revoked tickets cannot create actors. Active-race
fresh joins remain rejected. Process restart revokes every ticket/room; the UI
explains when a previous session is no longer available.

The browser retries visibly within a bounded 30-second window and can cancel to
the menu. Normal leave clears the ticket; page disposal preserves it for refresh.
An event-loop stall alone does not prove connection loss. A one-second heartbeat runs independently of requestAnimationFrame and is disposed
with the game. A five-second lack of messages on an otherwise running client triggers recovery; the server uses ten-second protocol pings and automatic browser pong replies,
closing after thirty seconds without transport liveness rather than JavaScript
message silence. Neutral controls expire independently after 250 ms.

An acknowledgement backlog no longer tears down the socket. A ping may request
an immediate fresh frame (host-limited to once per second). During outbound
backpressure over 64 KiB, the browser holds one newest input with latched action
edges instead of filling TCP with obsolete controls. It resumes on drain; only
persistent backpressure beyond ten seconds closes that channel. Missing snapshots
show Connection delayed while bounded prediction holds. Genuine socket loss still
uses the existing reconnect policy.

Pings may include bounded diagnostic fields: ack backlog, snapshot age, correction
size, peak frame interval and nonce-matched RTT. The host adds received-input age,
its scheduled tick lead and whether its race ID is current. Client and host limit reports to one
per five seconds. Events use ACTION_CLIENT_NETWORK; closures log code, a known
reason classification, last-message/pong ages and buffered bytes. Raw close text, bearer
tickets and control payloads are excluded. Health includes clientReports and
resyncRequests. These measurements distinguish client stalls, transport congestion
and actual socket loss in the next physical-device test.

## Remaining gates

Live route-aware placement, the targeted fast-collision audit and Hebrew UI are
implemented in action-21; see LAB.md/QUALITY.md for evidence and bounds. Placement
is approximate at ambiguous route crossings; accepted results remain exact.

Pause/resume, durable result storage, a deliberate server-restart policy and
match-preserving deployment drain remain platform/lifecycle work. Physical GPU
performance/context recovery, touch if required and sustained active-room
capacity remain acceptance work. The lab currently cancels rooms on restart and
rejects fresh active-race joins. Teacher roles are not available. Prediction is
bounded through outages rather than promising arbitrary loss recovery.

Playground identity, membership, gender/recess policy, catalog and teacher
controls follow engine acceptance. There are no platform sessions or production
credentials in this implementation. See `STABILIZATION.md` for staged progress and `QUALITY.md` for the broader
review, replacement boundaries and explicit physical-device acceptance case.


## Shared presentation timing

During an active party race, the predicted actor world supplies the obstacle,
local-runner and remote-runner timeline. Each draw uses the same RAF timestamp
and interpolated fixed-step phase. Timer catch-up retains nominal timestamps;
three pose samples accommodate a compositor timestamp preceding the newest
simulation step. Frozen prediction stops every actor and obstacle together.
The filtered continuous clock remains for countdown/HUD/solo timing, without a
second remote playback buffer. Course specs, constant bar speeds and server
collision decisions are unchanged.

`scripts/qa/contact-quality.mjs` samples actual Three mesh transforms while native
keyboard controls drive two racers into sustained contact on fast and delayed
sockets. `scripts/qa/timing-jitter.mjs` checks constant-speed bar transforms and
the same-draw collision clock under ordered jitter. `tests/world-prediction.test.ts`
covers delayed head-on/crossing/shove/bar contacts, exact NPC replay, replicated
future action edges and bounded whole-world outages.


Transport-only comparison (bundle with Bun, run with real Node/ws/zlib):

```sh
bun build scripts/qa/transport-bandwidth.ts --target=node --external=ws --external=pino --outfile=action-dist/bandwidth-qa.mjs
node action-dist/bandwidth-qa.mjs
```

Bun's test WebSocket client does not negotiate this extension; negotiation is
verified by the Node comparison and actual Chromium WebSockets. Plain fallback
and quiet finished-room behavior are covered in the unit suite.


## Action-21 completion details

`race-progress.ts` precomputes checkpoint-bounded route polylines and compares
normalized section progress, with height included for stacked roads. Party HUD
progress combines predicted positions with server-accepted checkpoint/finish
state. Solo uses the same estimator. This does not alter scoring or NPC brains.

`world.ts` checks long solid displacements in at most 32 spatial subdivisions;
there are no additional simulation ticks or NPC/input decisions. Dynamic hazard
impulses preserve their final-pose depth and one-response contract. Carry queries
exclude only their supporting mover/belt, preventing self-collision from stopping
a descending elevator. A closing gate over a deck uses a horizontal exit only
when vertical clearance is impossible. Focused reproductions are in
`tests/fast-collision.test.ts`; shipped motion rates are sampled by
`bun scripts/qa/fast-collision-audit.ts`.

Hebrew display copy lives in the existing UI and `client/hebrew.ts`, separate
from course IDs/specs. UI sections are RTL; the canvas/document's physical layout
and input basis are unchanged. Codes, clocks, key names and HUD positions are
explicitly LTR. User names use HTML/Unicode isolation and first-letter direction
for canvas labels. `scripts/qa/hebrew-ui.mjs` checks computed directions and
native movement, with screenshots in ignored release evidence.
