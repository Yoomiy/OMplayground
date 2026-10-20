# Rocket Arena app integration plan

Design and implementation record, 2026-10-18. The initial app adapter, authenticated
launch, native bot controllers, frame bridge, teacher controls, live pause and
30-second reconnect reservation are implemented. The standalone public release
remains the comparison baseline; these changes have not been published there or
deployed to Railway. See [Railway setup and limitations](RAILWAY.md).

## Technical direction

Preserve the working Colyseus/Rapier server, shared physics, bounded prediction
and presentation defaults. Adapt platform policy around that engine. Gameplay
traffic connects directly to its backend; do not send physics through the
existing Socket.io board server or convert Rocket to a turn-based GameModule.

Initially use an isolated game frame inside an app session container. Rocket
currently owns document-wide keyboard handlers, overlays, styles and locale;
the frame gives those a clear lifetime without leaking into the app shell.
Build on the existing mount/dispose/suspend hooks within the frame. Native React
embedding can be reconsidered if removing those global assumptions is worthwhile.

Add explicit runtime dispatch alongside the existing Minecraft special case in
`apps/web/src/pages/PlayPage.tsx`, with a small runtime registry/container boundary.
Keep the current catalog, invitation, profile and session flow. The integrated
client bypasses anonymous lab matchmaking and receives authorized launch data.
Do not expose lab room codes as an alternative app admission mechanism.

Use a validated parent/frame handshake with explicit message schemas, trusted
origins and source-window checks. Send short-lived, backend-scoped admission
credentials after the handshake, not long-lived credentials in URLs. Handle
loading, launch expiry, focus, resize, navigation and complete teardown.

## Platform and engine responsibilities

- The app supplies the existing authenticated identity and session context.
  The backend verifies identity, admission, role, game, capacity, gender and
  recess; it does not trust client-provided names, IDs or teacher claims.
- Resolve a platform session to one authoritative room idempotently. Define
  allocation expiry and ownership before enabling additional backend instances.
- Bind a stable game actor to a verified platform identity independently of its
  current transport connection. The lab currently uses Colyseus session IDs in
  several player paths; reconnect and bot-seat replacement require a deliberate
  binding rather than changing the transport's identity.
- Teacher observation must not consume one of the eight physical car slots.
  Observation and permitted pause/remove/end controls require server enforcement.
- Apply each child's own recess eligibility during play. The board server's
  `apps/game-server/src/recessSweep.ts` evicts affected children individually;
  different class schedules do not imply that the entire room must stop.
  Specify what happens when no eligible human remains and how later resumption
  maps to app session state.
- Persist authoritative lifecycle changes and results at boundaries, with
  idempotent writes and one designated owner. Do not write physics ticks to
  Supabase or accept client-authored results.

## Selected defaults

The user authorized implementation of the proposed defaults and selected a
separate Railway service for production:

| Choice | Proposed initial behavior | Consequence |
| --- | --- | --- |
| Bots | No bots by default; host selects a count in the waiting room | Only human/bot seats are enabled in physics and published to clients; up to eight cars. |
| Teams/start | Host assigns teams and starts with the current roster | Full-team assignments swap occupants; solo practice with zero bots is supported. |
| Friend joining during play | Take an empty slot or replace a bot at the next kickoff | Host sees queued names and can select an empty/bot slot before kickoff; automatic assignment remains the fallback. |
| Temporary disconnect | Continue, reserve the seat for 30 seconds, then empty it | Neutral controls during reservation; bot counts never increase automatically. |

Paused matches now use the app's 24-hour retention policy. Leaving while paused,
losing the final human connection, or reaching a child's recess boundary preserves
the eligible saved roster. Empty rooms hibernate rather than consuming a live
physics-room slot. Server-signed versioned checkpoints retain score, remaining
regulation time, overtime, teams, bot slots, queued assignments and moderation bans.
A recreated room resumes paused at a fresh kickoff; a pause within the existing
live room preserves exact car/ball positions. Graceful shutdown checkpoints first;
an unclean restart loses changes since the last successful checkpoint (normally
about 15 seconds) and must
wait for the old 60-second allocation lease. Keep the ticket secret stable across
deployments. An old match without a valid checkpoint closes explicitly on recovery.
Room creation and asynchronous engine initialization must both succeed before
launch returns a reservation. Startup failure releases only its own allocation:
valid signed saves keep their original expiry and remain resumable; a fresh room
returns to its unallocated state. If the database cannot acknowledge that release,
the durable checkpoint remains behind the existing 60-second lease. Rollback never
overwrites a competing allocation or a session completed by moderation.

Hibernation reports `SESSION_SAVED` only after the database acknowledges the write.
A failed or ambiguous response reports `SAVE_UNCONFIRMED` and
`ROCKET_ROOM_SAVE_UNCONFIRMED`, without a saved-success log. The app explains that
recent progress may be missing and offers retry; it does not claim the game was
saved or mark it completed. The last confirmed checkpoint remains the recovery
fallback. The `save-outcomes` capability prevents an old backend from silently
using the former success-only outcome.

Explicit stop records completion, stopped_by, ended_at, closed joining and an
empty connected roster; the session record is retained. A completed live room can
start a consented rematch as described below. The main app server's existing
cleanup ages out paused sessions after 24 hours.

Chat now uses the shared persisted feed and moderation RPCs; voice uses the shared
panel and canonical LiveKit microphone token helper, with explicit join. Both
require live authenticated room membership.

Operational logs default to lifecycle/actions at `info`: room readiness/disposal,
joins, actual socket closures, saves, completed rounds and rematches. Socket
closures carry numeric close codes and connection IDs; server-driven closure
records its cause, including `rematch`, even after the old room is fenced off.
Abnormal closure and authentication/join failures remain visible. Detailed
performance windows/stalls, room samples and membership leave receipts require
`LOG_LEVEL=debug`. Routine client initialization messages are removed. See
`RAILWAY.md` for fields and retention. Client disposal skips `leave()` when the
transport is already closing/closed, so rematch frame replacement cannot send a
second leave packet to a dead socket.

## Implementation sequence

The initial implementation follows this order. Backend adapters live under
`server/src/platform/`, the frame protocol under `client/src/platform/`, and the
app entry in `apps/web/src/game/RocketSessionContainer.tsx`. Deployment artifacts,
completed verification and remaining acceptance gaps are recorded in `RAILWAY.md`.

1. Retain the tested bots using room-owned typed controllers and explicit bot
   roster identities, as described in [BOT-INTEGRATION.md](BOT-INTEGRATION.md).
   Preserve driving behavior first; make fill/join policies configurable. Compare
   the new path with the existing loopback-client practice harness.
2. Define and test admission, actor binding and allocation boundaries. Build the
   authenticated backend adapter before exposing the app launcher. Keep the
   standalone lab available as a separate mode without app credentials.
3. Implement lifecycle enforcement: eligibility, teacher observation/controls,
   pause with frozen physics and clocks, neutral inputs and fresh prediction
   baselines on resume; then the selected reconnect/late-join rules.
4. Add the frame bridge and app runtime container, verified profile labels,
   Hebrew loading/errors, invitation launch and reliable navigation cleanup.
5. Add bounded persistence, operational readiness and capacity limits. Validate
   the integrated release against the standalone baseline before catalog rollout.

Hosting is separate from engine choice. Use an isolated development deployment
for integration first. Select the production service and room limit from measured
concurrent-room CPU/tick behavior and school-network latency. The lab VPS is not
established production capacity. Do not enable replicas without room routing.

## Acceptance evidence required

- Two authenticated humans and one human with seven bots: contacts, goals,
  balanced capacity, completion and rematch; distinguish automation from physical
  devices on different networks.
- Reject invalid/expired credentials, wrong session/game, unauthorized roles,
  disallowed membership/gender/recess and full rooms. Enforce revocation in play.
- Verify the chosen reconnect/late-join rules, host departure, individual recess
  expiry, zero-human cleanup, teacher observation and authorized moderation.
- Pause freezes simulation and clocks; resume cannot replay stale inputs or apply
  pre-pause worker results. Disposal leaves no frames, workers, listeners or rooms.
- Compare matched two/eight-car scenarios: frame-time stalls, prediction activity,
  correction frequency/size, queue bounds and server tick load. Smoothness and
  small corrections take priority over average FPS.
- Validate result retry idempotency, explicit restart behavior, multiple-room
  overload handling, matching client/server builds, drain and rollback.

Reference: [platform integration guide](../../docs/multiplayer-game-integration.md).

## Recovery failure handling, 2026-10-19

Startup now waits for the engine before returning a reservation. Allocation,
asynchronous initialization and fatal world-initialization failures release the
room and preserve valid saves without extending their expiry. Recovery rollback
respects allocation ownership and external completion. A failed rollback write
keeps the checkpoint behind the original lease timeout.

Hibernation distinguishes acknowledged saves from failed/ambiguous writes at the
server, iframe and React boundaries. Fault-injection fixtures cover fresh-room
retry, saved-room retry, engine startup, failed lease release, ownership changes,
moderator completion, rejected writes and successful writes whose acknowledgement
is lost. The browser checks the visible save error and manual retry path.

Real Supabase policies/triggers, delivered microphone audio on devices, hosting
and simultaneous-room capacity also retain the acceptance gaps in `RAILWAY.md`.

## Sparse-roster host ownership fix, 2026-10-18

A user reported a fatal V2 snapshot after switching a solo player's team. The app
moves ownership between permanent car slots and disables unused slots. Native
host metadata had remained attached to slot zero; when that slot became empty,
the published nonempty roster contained no host. Existing full-room team tests
kept slot zero occupied by a bot and therefore missed this case.

The core now maintains a represented host when enabling/disabling actors, and
provides trusted `setHostActor` metadata transfer. The app maps its verified
platform host to that actor after seat/controller changes and submits start
through the current engine host. Physical bodies, slot/team identity and input
controllers keep their existing lifetimes. Snapshot host validation stays intact.

The new Rapier regression failed before the fix and passes after it, including
empty/solo projections, several different slots, unchanged body handles and match
start. App regressions cover solo team changes, removing bots while the host is
in another slot, full-room reassignment, and host departure without replacement.

Validation: 22 focused core/Rapier tests and all 472 main tests passed. The actual
StrictMode React container plus built game frame passed solo team changes before
adding bots, subsequent play, reconnect and cleanup, with no page errors or the
previously reported startup warnings. The HTTP/Colyseus/Rapier fixture passed all
existing admission, social, capacity, retention and fresh-service recovery cases
alongside the new sparse-host cases. `npm run build:app` passed; tested artifact:
`app-370e55a8c1f5985a`. Evidence: `.run/solo-team-host-before.log` (expected failure),
`solo-team-host-focused.log`, `solo-team-host-suite.log`,
`solo-team-host-browser.log` and `app-browser-report.json`. Tests used fixture
identity/database responses and did not repair or mutate the reported DB session.


## Rematches and departure recovery, 2026-10-19

Natural completion and explicit stop show the Hebrew end panel. The host can
propose a rematch; connected human players accept or decline, and a departing
player does not block the remaining respondents. Solo rematches need only the
host. Observers cannot vote and follow the participating players. Fresh account,
roster, gender, game-active and recess checks apply to consent and the transition.
This never authorizes an ordinary join into a completed session.

After responses, the same DB session returns to a waiting lobby with the accepted
roster, zero scores, a full match clock, preserved teams/bot slots and moderation
bans. A previously queued recruit takes their planned slot, replacing that bot as
usual. The host can change configuration before starting. The allocation ID
rotates, the old room disconnects without writing over the new state, and accepted
app clients replace their iframe and physics/transport lifetime. Ended live rooms
wait at most five minutes for a rematch, and release capacity when humans leave;
the durable session remains completed if no rematch starts. The in-memory offer
and votes do not survive a backend restart.

Saved membership and live car occupancy are now separate. An ordinary active
leave releases the car but preserves historical DB membership, so the first
leaver can return after the last leaver saves the room. Explicit moderation or
policy removal still removes membership. A restored roster no longer counts as
having joined the new instance: a fresh/restored room gets a 90-second first-join
grace, and outstanding Colyseus reservations protect an in-flight authentication.
Restored waiting rooms give their saved host 30 seconds to return, so another
participant finishing the rematch reload first does not steal hosting. The
reservation clears on host arrival; later departure/removal transfers immediately,
and timeout publishes the fallback host even without another join.
Transient launch/connection failures retry for up to 30 seconds; policy denials
remain explicit. No membership repair is attempted for old records that already
lost a player under the previous behavior.

The pending-player banner is informational; host assignments live directly in
the roster sidebar. The desktop header shows a noninteractive player count, while
small screens keep the roster toggle needed to open the hidden sidebar. The end
panel closes mobile drawers so rematch controls remain accessible. The required
`rematch` service capability rejects a stale running backend before joining.

Validation: `npm run build:app` produced `app-a194a520992b2cc6`;
all 473 main tests, the three web protocol tests and the web typecheck passed.
The isolated HTTP/Colyseus/Rapier fixture passed rematch acceptance/decline,
observer follow, preserved bans, fresh allocation/core, pending bot replacement,
natural completion/result, eight humans plus a teacher, ordinary active departures
by both players, delayed first restoration and existing retention/recess/restart
cases. The actual StrictMode React container and built game frame passed a
multiplayer rematch, final score visibility, desktop assignment focus when the
sidebar was already visible and on repeated clicks, and stable connection identity
after an action error. Reconnect, pause/resume and frame disposal still pass, with
no page errors or the previous startup warnings. Software-rendered browser checks
are functional coverage, not device performance measurements. Evidence:
`.run/app-rematch-build.log`, `app-rematch-suite.log`, `app-rematch-browser.log`
and `app-browser-report.json`. Only fixture database/identity responses were used;
no real session records were repaired and no migration is needed for these changes.


Policy sweeps now share the host-control queue and await preceding lifecycle
writes before reading session state. A revision guard skips reconciliation if
joins or departures changed seats during that read. This prevents a stale paused
DB snapshot from undoing Resume and denying a subsequent recruit. The HTTP fixture
holds an old paused response while Resume is queued, then verifies the resumed
state survives another sweep; it also reloads the non-host first for rematch
ownership coverage.

## Catalog and PR preparation, 2026-10-19

The app catalog reuses the existing original Rocket emblem, copied unchanged from
`client/src/assets/generated/rocket-arena-mark.png` to
`apps/web/public/games/rocket-arena.png`. See [asset provenance](docs/asset-provenance.md).
Its blue/orange card uses contain sizing to preserve the emblem's silhouette.
HomePage metadata supplies the image immediately for existing catalog rows with
an empty thumbnail. Follow-up migration
`20261019060000_add_rocket_arena_thumbnail.sql` records the same URL in the DB
without rewriting the already-applied catalog migration or replacing a custom
thumbnail. The migration is prepared only; no real DB write was performed.

Before a focused Rocket PR, resolve the two recovery failure paths above and add
failure-injection checks. The current branch also contains Wobble changes against
local `main`; separate that scope when preparing the PR. Real Supabase/device
voice delivery and production Railway acceptance remain distinct from the fixture
and software-rendered browser checks recorded here.

Validation of this cleanup: web typecheck and production build passed; the built
web output contains the unchanged 512×512 emblem. All 474 main tests passed with
host-arrival, timeout and departure coverage. The HTTP/Colyseus/Rapier fixture
passed the delayed pre-resume snapshot regression, non-host-first rematch reload,
existing two/eight-player checks and recovery cases. The actual app browser flow
passed direct sidebar assignment, absence of redundant desktop shortcuts, mobile
roster access, rematch and reconnect. Its transport now matches the real app's
16 KiB message limit; post-rematch assertions wait for a live room rather than
inspect a connection during recovery. No production transport limits were changed.
Tested game build: `app-fbf62cbfdd1db757`. Evidence:
`.run/app-catalog-web-build.log`, `app-host-arrival-suite.log`,
`app-resume-ordering.log`, `app-catalog-game-build.log`, `app-catalog-browser.log`
and `app-browser-report.json`. No real DB records were changed.
