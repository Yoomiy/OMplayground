# Wobble Rush app integration

Current PR branch: `dev/wobble-app-pr`, based on `origin/main` at `8904ff9`.
The Wobble implementation and cleanup are carried from `bae544e`; newer Rocket
and classroom/security changes remain as they are on main. Branch/worktree and
artifact identifiers in the dated entries below record their original validation.

Started 2026-10-18. This is the implementation handoff, not a production-readiness claim.
Implementation commit: `57c1d6c`, initially prepared in `/tmp/wobble-app-integration`.
Merged into the shared `/home/ubuntu/OMplayground` checkout on 2026-10-19;
that checkout remains on `dev/rocket-arena-lab`, with existing Rocket edits preserved.
The public standalone lab remains `20261018-action-21` (source `a88ddc8`).
No production migration, catalog activation, hosting change or lab publication is part of this pass.

## Baseline and runtime

MIT upstream: https://github.com/code-yeongyu/wobble-rush-3d at
`b395e4a91ebdfb829533b1ae6beda244371658a3`; retain `LICENSE` and the course-pack provenance in `LAB.md`.
23 courses, classic/remix, single race or three-race cup, keyboard controls.
The platform adapter wraps the existing `ActionRoom` and `AuthoritativeRace` in
`src/platform/`; it preserves native Node/WebSocket transport, the 60 Hz simulation,
15 Hz frames and shared-world prediction. There is no Colyseus migration or board-server tick loop.
Two to eight human racers, plus the existing two server NPCs. Teachers observe without a racer slot.
This is a game-specific adapter, not a universal action runtime or registry.

## Product flow and authority

| Boundary | Behavior |
| --- | --- |
| Create/join | Existing Playground catalog, open/private session and invitation routes. No lab name/code/online menu. |
| Lobby | Profile names, one app-styled roster with color indicators, each racer chooses from the existing eight-color palette, player host configures course, race/cup and remix. All courses remain available in a simple dropdown without search. Loaded clients report readiness automatically. Host starts with at least two connected, loaded racers. |
| Race | Existing engine, Hebrew HUD, controls and authoritative results. App toolbar retains fullscreen, invitations, roster, social controls, pause and exit. |
| Cup transition | Race results and accumulated standings; host advances to the next course without completing the platform session. |
| Match completion | Winner and results; connected participants opt into a rematch. At least two accept. Refusers remain waiting observers of gameplay. Rematch clicks show immediate pending feedback, suppress duplicate submissions, then confirm the authoritative vote and count unanswered participants. |
| New late arrival | Named waiting participant; watches now and joins the next match after rematch consent. A cup is one match: no partial-cup entrant. Host sees waiting names in the roster. No teams/assignments are needed for this free-for-all racer. |
| Refresh/tab takeover | Same authenticated user owns the same actor. New socket fences the old socket. A normal reconnect retains the renderer. Retry creates a new iframe and bridge generation. |
| Disconnect | Controls neutralize immediately. A disconnected racer is reserved for 30 seconds while other humans continue. After grace it waits for the next match. If the final human leaves, freeze and save the room immediately instead of consuming the grace in an empty simulation. |
| Recess | Backend rechecks each child's current class/gender eligibility at most every 15 seconds. Only affected children leave. Final eligible human leaving saves/pauses, including simultaneous expiry. Staff bypass recess. |
| Pause | Freeze physics, NPC decisions, obstacle time, countdown and race clocks. Clear queued/held human inputs. Resume rebases clients and clocks from the authoritative state. Original active racers must return/load before resume. |
| Host leaves | Preserve host authority through the reconnect grace, so refresh does not hand the room to somebody else. After grace, transfer to a connected active participant, then a connected waiting participant; retain the prior host if none remain. Host display/grade metadata follows the new host. |
| Teacher | Authorized observation, pause/resume/stop and removal. Observing staff cannot configure, start or advance races, or vote on rematches. Staff joining as players follow normal player/host rules for race decisions. Ordinary host control does not grant moderation. Removal blocks rejoining this room and is persisted in the signed save. Observers have read-only social access and no microphone token. |
| Explicit stop | Completed record, `stopped_by`/`ended_at`, closed joining and empty connected-player lists. Broadcast the saved ended state, close participant/observer sockets and clean up voice immediately. Clients stop reconnecting. Keep saved roster/results for the record. |

Parent React container: `apps/web/src/game/WobbleSessionContainer.tsx`.
Hook: `apps/web/src/hooks/useWobbleSession.ts`.
The shared persisted chat UI is `SessionChatPanel`; Rocket keeps its compatibility export.
Light/dark shell, mixed Hebrew/Latin names, local-player label and physical LTR controls are preserved.
Color selection is a player-owned, server-validated lobby action. It updates both
the saved roster and engine roster, is broadcast to the room, and is retained on
refresh/reconnect and durable recovery. Local and remote meshes update their color;
observers cannot change racer colors and changes are rejected during a race or pause.
Chat/voice panels release game input without pausing the room.
The full container enters fullscreen, including toolbar and panels.

## Admission, allocation and isolation

`POST /api/wobble/launch` verifies a Supabase access token, active profile, game/session,
gender, membership/open admission/private invitation or accepted challenge, recess and capacity.
Short-lived, single-use HMAC tickets bind user/session/allocation/observer role.
Tickets travel through the origin/source/session/bridge-validated parent messaging channel,
then the first WebSocket message; long-lived credentials never enter iframe URLs.
The socket join rechecks profile and admission. Anonymous lab matchmaking is absent.

One allocation per session is coalesced in process and claimed through bounded
Supabase revision/status/roster/host conditions. A 60-second lease fences stale processes;
15-second lease refreshes do not renew paused-game activity. No replicas are supported
without a room-routing design. Default limit is two rooms; this is a conservative
configuration, not a measured school-concurrency guarantee.

The REST gateway is a Wobble-specific adaptation of the Rocket platform boundary.
Recess uses canonical `packages/game-logic/src/recessSchedule.ts`, logging uses
`packages/observability`, and microphone tokens use the canonical game voice helper.
No maintained copy of the recess algorithm or voice-token policy is introduced.
Voice cleanup recognizes LiveKit's structured `not_found` code as an already-absent
room/participant; it does not depend on message wording. Other cleanup errors retain
structured error details and RPC code/status in `WOBBLE_VOICE_REVOKE_FAILED`.
A completed-session launch still returns HTTP 409 / `SESSION_COMPLETED`; it is an
expected lifecycle response logged at debug level as `WOBBLE_LAUNCH_REJECTED`. Both HTTP and frame completion
stop client recovery timers and pending launches, and show the normal ended screen
even when reopening an old session URL.

## Save/resume and accepted results

`game_sessions.game_state` holds a versioned, HMAC-signed checkpoint. It includes
course/seed/remix, phase/countdown remainder, current tick and all actor positions,
velocities/NPC brains, cup progress, roster, removals, and the latest 16 accepted
race outcomes keyed by race ID. Duplicate save attempts replace the same outcome,
not award points again. This bounded history is not a new long-term leaderboard product.

Live pause is exact. Durable recovery restores checkpoint positions, velocities,
NPC state and tick, with human controls neutralized and all clients freshly rebased.
Active rooms checkpoint every 15 seconds, so an abrupt crash can lose progress since
the last successful checkpoint. Graceful service shutdown saves before closing sockets
and releases leases. An unexpected crash may require the prior 60-second lease to expire.
The app retries recovery for up to 90 seconds; the in-race disconnect reservation remains 30 seconds.

Final-human departure saves the roster while clearing connected fields; a saved empty
room may release memory after 30 seconds. The Home saved-games query uses the existing
roster/status/connected fields, not a separate Wobble save list. Paused saves expire after
24 hours of activity under the existing hourly cleanup. The adapter also rejects expired
paused saves on launch. Operational heartbeats do not extend `last_activity`.

Canonical JSON signing survives JSONB key ordering. CAS uses a bounded revision,
never the full checkpoint in a filter URL. Keep `WOBBLE_TICKET_SECRET` stable across
service restarts/releases. Returning users are reauthorized; removed roster entries
cannot be resurrected by a stale save. A failed replacement preserves the prior checkpoint,
freezes the room and reports an unconfirmed save; it is retried rather than claiming success.
Unrecoverable/incompatible saves are reported and retained for investigation.

## Local workflow and build identity

Prerequisites: existing root npm install, Node with `util.parseEnv`, and Bun on PATH
(or `WOBBLE_BUN`). `npm run dev:wobble` installs the isolated frozen dependencies,
builds a matching optimized client/server pair and starts the native app service.
It reuses only Supabase/LiveKit settings from the main server's local `.env`, with
Wobble overrides in ignored `.env.app.local`; no secret values belong in this handoff.
The dev command stores a stable local signing key in ignored `.run/app-secret`.

Set `VITE_WOBBLE_SERVICE_URL` for the web app. Development default: `http://localhost:3000`.
Forward port 3000 alongside the frontend port. Exact `APP_ORIGINS` must include the actual
frontend origin, including its forwarded URL where relevant.

From the repository root, add Wobble alongside the existing background services:

```sh
(npm run dev:server) &
(npm run dev:minecraft) &
(npm run dev:wobble) &
npm run dev:web
```

No extra environment file is required for localhost testing when
`apps/game-server/.env` already contains the backend credentials. The board server,
Minecraft and Wobble keep their separate ports (8080, 8081 and 3000).
Rocket also defaults to 3000; run either Rocket or Wobble at a time. Wobble's
optimized build is served by Node, with the existing development logger. The
standalone lab is a separate deployment and is not used by app sessions.

The catalog migration is at
`supabase/migrations/20261018210000_prepare_wobble_rush_catalog.sql` in this checkout.
It inserts an **inactive** game and was reported applied on 2026-10-19.
The follow-up `supabase/migrations/20261019144000_activate_wobble_rush_catalog.sql`
enables the existing row and adds `/games/wobble-rush.png`, a clean promotional
cover generated with the built-in image tool using the game screenshot as a visual
reference. The prompt is retained in `docs/media/catalog-cover.prompt.md`.
Apply that new migration to the database used for testing; it preserves the game ID, names and session references.
Starting the dev server never changes database rows. Production deployment still
requires the acceptance gates below.

For another local port, run `WOBBLE_PORT=3002 npm run dev:wobble` and set
`VITE_WOBBLE_SERVICE_URL=http://localhost:3002` for Vite. For remote browser access,
forward the Wobble port too, set that variable to its forwarded origin and set
`APP_ORIGINS` to the exact frontend origin. Restart Vite after changing its env file.

Restart `dev:wobble` after game-frame/backend changes. Restarting Vite does not restart
this service. The command detects occupied ports before building. Direct build/start:

```sh
cd experiments/wobble-rush-lab
bun run build:app
node app-dist/server.mjs
```

`scripts/build-app.ts` fingerprints sources and canonical helpers. Build identity is
compiled into the running server and frame; `/health` and `/api/wobble/config` expose
the loaded server build, and the frame rejects a mismatched release.
`/ready` is unavailable during drain. Retain the immutable standalone action-21 release
for gameplay comparison. Production host, resource limits, release storage and rollback
procedure remain to be selected and verified before deployment.

## Validation and outstanding acceptance

Targeted tests and the isolated browser harness are in `tests/platform-integration.test.ts`
and `scripts/qa/app-integration.ts`. The browser harness uses fixture identities and a local
Supabase REST implementation, real React StrictMode, real iframe/Node/WebSocket connections,
and actual native keyboard input. It suppresses GPU game drawing on this software-rendered VPS;
screenshots of the app UI still render normally. It does not certify physical-device FPS,
real database RLS/Realtime behavior or microphone audio delivery.

Before production rollout: real Supabase integration/RLS and saved-game discovery,
actual two-device microphone audio/moderation, intended physical-device graphics/context
recovery, a full cup in rendered app clients (the control-only adapter cup already passes), sustained multi-room capacity,
production deployment/drain/rollback and retained observability evidence. Touch remains
unsupported pending a product decision. Graphics context loss currently provides an explicit
retry that reconstructs the frame and reconnects; it does not promise seamless GPU recovery.

The original inactive catalog migration `20261018210000_prepare_wobble_rush_catalog.sql`
was reported applied on 2026-10-19 and is retained unchanged. The follow-up
`20261019144000_activate_wobble_rush_catalog.sql` is prepared for the user to apply;
it enables the existing Wobble row and fills an absent thumbnail, matching the
Rocket catalog activation/thumbnail pattern. Existing custom thumbnails are preserved.

## Executed acceptance — 2026-10-19

Matching integrated artifact: `wobble-app-06def52717cde651` (action protocol 7, platform protocol 1).

| Check | Result |
| --- | --- |
| Complete Wobble unit/integration suite | 573 tests, 100,624 assertions, zero failures (including 12 new platform tests). |
| Strict TypeScript | Client, retained Worker/test configuration, native action host, new platform host and web app pass. |
| Game lint | Biome over 225 files, zero warnings/errors. |
| Web production build | Pass. Existing Browserslist-age and large-chunk advisories remain. |
| Existing app protocol smoke tests | 3 tests pass. |
| Actual control-only three-race cup through the adapter | All racers finish; per-round lifecycle, once-only results, 54 combined points and consent rematch pass. |
| Native HTTP/WebSocket integration | Authenticated two-racer join/start, stable actor takeover, abandoned first-launch recovery, graceful drain and fresh-service paused restoration pass. |
| Save failures and concurrent roster edits | Last usable checkpoint remains; retry and bounded CAS protection pass. |
| JSONB and recovery | Canonical signature round trip, exact paused tick/poses/NPC state, compatibility/expiry and tampering checks pass. |
| Recess/moderation/host policy | Per-child expiry, last-human save, teacher observation/removal, blocked rejoin, host refresh/grace expiry and initial-lobby seat recovery pass. |
| Actual React/iframe browser flow | Two racers, late arrival and teacher observer pass. StrictMode, profile names, Hebrew, real keyboard movement, paused physics, refresh, offline reconnect retaining canvas, disposal and foreign-message rejection pass; zero page errors. |
| App presentation/social | Persisted chat send/reload, microphone opt-in UI, light/dark screenshots, container fullscreen, teacher moderation UI and 640×480 panel navigation pass. Actual microphone audio is untested. |
| Loaded server identity | Built native Node process reports the compiled release despite a rewritten manifest, `/ready` succeeds, SIGTERM exits cleanly. Readable canonical development logger also verified. |

Browser checks use real clients and sockets but suppress GPU game drawing on this VPS.
The teacher's view receives and predicts the live four-actor world without taking a racer seat.
The browser test caught and fixed immediate host transfer on refresh; authority is now retained
through grace. The successful final run uses unchanged acceptance thresholds. Earlier fixture
startup/fullscreen/waiting-order failures were corrected and are not counted as passing runs.

Reproduction from the experiment directory:

```sh
NODE_ENV=production bun test
bun run typecheck
bun run typecheck:app
bun run lint
bun run build:app
node --import tsx scripts/qa/app-integration.ts
```

On this VPS, browser QA uses the already-installed local Chromium libraries/fonts:
`LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu` and
`FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf`. The harness binds only
loopback ports 19106–19108, uses fixture credentials, removes its temporary app entry files,
and closes its service/browser processes afterward. It never connects to the production DB.
Raw logs/screenshots/reports are ignored under `evidence/app-integration/`; this table is the
durable handoff. Browser/network diagnostics currently retain bounded incident reports;
complete periodic performance windows and production log retention remain rollout work.

The app integration is implemented for local/staging review. It is not a production
acceptance or catalog-activation claim; the physical-device, real database/social and
hosting gates above remain open.

## Lobby follow-up — 2026-10-19

Matching artifact: `wobble-app-677a7168d22a91a6`. Added player-owned eight-color
selection and roster color indicators, removed course search, and kept all courses
in the existing selector. Restart `npm run dev:wobble` and refresh app clients to
load the matching server/frame pair; no catalog migration is needed.

Validation: 15 targeted platform/remote-roster tests, 121 assertions, pass. This
includes reconnect/checkpoint/race color retention, observer/identity/range/phase
rejection, save-failure recovery, and real Three material updates without replacing
unaffected NPC views. Client/platform and web TypeScript checks pass; changed game
files pass Biome. The real two-client browser harness also passes with zero page
errors: host/guest choose colors, the host selection survives refresh, authoritative
race actors retain both selections, and the course-search field is absent. Its
existing GPU-drawing and microphone limitations still apply.

## Explicit-stop cleanup follow-up — 2026-10-19

Matching artifact: `wobble-app-10643307c4aae1d5`. Fixed cleanup of absent LiveKit
participants, immediate end-of-session socket/voice cleanup, and terminal handling
for ended frame state and HTTP `SESSION_COMPLETED`. Expected completed launches
retain HTTP 409 (now logged at debug level); other request failures retain their
existing severity. Real voice failures now include structured diagnostic details.

Validation: 16 targeted platform/voice tests with 121 assertions pass, along with
client/platform and web TypeScript checks, changed-file Biome checks and the
matching app build. The real-browser harness passes end-screen delivery, cleanup
of all three connected participants, no relaunch after a stale disconnect/watchdog,
and a completed-session refresh with no error overlay or retry loop; zero page
errors. A first browser run stopped at the existing reconnect readiness check
before reaching termination. The harness now requires loaded racers and a fresh
frame before its next control, and resumes a legitimately paused recovered room.
The final run passes all prior checks and the new shutdown assertions.

Read-only checks against the configured LiveKit endpoint accepted the room-admin
credentials and reproduced `not_found` / `participant does not exist` for an absent
participant. No live room or participant was changed. Actual microphone audio
remains a separate acceptance item.

## Operational logging — 2026-10-20

Normal `LOG_LEVEL=info` output focuses on room allocation/restoration, player joins,
reconnects/disconnects, countdown/race start, pause/resume, removals, rematches,
explicit stops, saved race/game completion and room hibernation. Disconnects include
verified user/session/correlation IDs, close code, a bounded reason and connection
duration, including replaced tabs and service restarts. Socket-provided free-text
close reasons and player display names are not logged.

`WOBBLE_RACE_COMPLETED` is emitted once after each successful result checkpoint;
`WOBBLE_GAME_COMPLETED` marks a completed race or full cup, with winner IDs and
counts. Failed saves and lease-only updates never claim result completion. An
explicit stop is `WOBBLE_GAME_STOPPED`, distinct from finishing a race normally.

Correction/frame/RTT reports (`WOBBLE_CLIENT_NETWORK`), configuration detail and
expected completed-session launch refusals are debug-only. To inspect them:
`LOG_LEVEL=debug npm run dev:wobble`. An ignored `.env.app.local` can also set
`LOG_LEVEL`; the default remains `info`. Real socket, database, voice and save
failures retain warning/error severity and simulation stalls remain visible.

Validation for this logging change: 17 targeted platform/logging/voice tests,
152 assertions, pass. A real Pino subprocess verifies normal info output hides
correction diagnostics while debug shows them. Native HTTP/WebSocket checks cover
reconnects and disconnections during tab replacement, service restart and explicit
stop. The cup fixture uses real physics and control inputs to verify one saved completion per round,
one game completion, no completion after a failed save or lease-only write, and no
duplicates on retry. Strict platform TypeScript, changed-file Biome and the matching
app build pass (`wobble-app-b7bef5282e52d874`).

## Rematch feedback — 2026-10-20

`WobbleRematchControls` immediately acknowledges a click with a pending label and
spinner, locks repeated submissions until the authoritative vote arrives, and then
shows accepted/refused status rather than asking an accepted player to accept again.
Pending responses are counted separately from accepted votes. Errors release the
pending state; after eight seconds without confirmation, the control offers retry.
Late confirmation clears that delay message. Too few connected players or votes
receive an explicit explanation. No optimistic acceptance or game-state mutation is
introduced; this is an app UI update and does not need a Wobble server rebuild.

Web TypeScript passes. A temporary real-browser UI preview with delayed/manual
confirmations verified immediate feedback, duplicate-click suppression, accepted
and refused votes, error/cancel recovery, timeout/retry and late confirmation, with
zero page errors. This check used UI fixtures rather than replaying a full match.

## Engine performance follow-up — 2026-10-20

[PERFORMANCE-READINESS.md](PERFORMANCE-READINESS.md) records the completed graphics
presets, background/overlay draw suppression, measured collision-query optimization,
exact trajectory comparisons, two-minute integrated-host load and remaining device
acceptance. The toolbar's Hebrew quality selector persists per browser and updates
the frame without replacing the race. Balanced is the default. Context-loss retry
preserves the selected quality and authoritative paused race. No new database
migration or deployment is part of this change; restart the matching Wobble service
and refresh clients when testing this branch. The default port remains 3000.

The historical worktree/branch references at the top describe the original handoff.
This follow-up lives on `dev/wobble-performance-readiness` in
`/tmp/wobble-engine-readiness`; the shared checkout's current Rocket branch is
preserved. Functional browser integration and a separate real WebGL smoke pass;
physical Windows/Linux FPS and real Supabase/microphone/hosting gates remain open.

## Cleanup before PR — 2026-10-20

Based on `e9f0b98`, branch `dev/wobble-cleanup`. Matching app artifact:
`wobble-app-e8f034978d4523db`. Runtime entrypoints, TypeScript references and
repository callers were checked before removing code.

- `Game` now supplies `PartyEvents` directly; the forwarding-only `party-wiring.ts`
  layer and never-emitted `onClosed` callback are removed. Uncalled manual recovery
  methods and no-op transport error callbacks are removed. Actual automatic
  reconnect, connection rejection and close/error handling remain in their owners.
- Removed unconsumed getters, unused network/course/protocol constants, obsolete
  iframe query flags, unused particle spin data, and redundant menu CSS.
- Removed the unused random picker, standalone closest-point utility, crowd wrapper
  and old external-body argument to `stepRace`. The active collision/contact solver
  and shared-world prediction rules remain unchanged. Crowd tests call the production
  contact pass; interpolation tests call the same `renderAt` entrypoint as the game.
- Ten tests specific to deleted utilities are removed. QA-used course/geometry
  helpers, local inspection, standalone play and the documented Worker comparison
  entrypoint are retained; these are deliberate consumers rather than dead code.

Validation: 571 tests / 109,193 assertions, all four game/platform TypeScript
configurations, web TypeScript, Biome over 235 files and all three builds pass.
The 23-course classic/remix trajectory digest remains exactly
`fc265c6e36e55580f68710fd58dc28754c95ef3605a7785112b9e83448681a8b`.
The native-service/React browser integration passes all existing assertions, including
movement, graphics presets/context-loss retry, pause/resume, late joining, reconnect,
teacher observation, explicit stop and completed-session recovery; zero page errors.
Its existing software-GPU and microphone limitations still apply.
No database migration, publication or deployment is part of this cleanup.

## PR base verification — 2026-10-20

Prepared on `origin/main` (`8904ff9`) without carrying old Rocket or classroom
changes from the experiment branch. Current matching artifact:
`wobble-app-b91918842803f181`. The Wobble runtime source matches cleanup `bae544e`;
PR preparation refreshes the entry documentation/provenance and teardown fixtures.

572 tests / 109,200 assertions, all four game/platform TypeScript configs, web
TypeScript, game Biome, app/standalone/action builds and the web production build
pass. The web build retains its Browserslist-age and large-chunk advisories.
The final native-service/React browser integration passes all assertions with no
page errors, including preset/context-loss recovery, native movement, reconnect,
paused physics, teacher/late-join flows, explicit stop and terminal recovery.

An initial browser run stopped at a strict voice-RPC call-count assertion; a
separate diagnostic run passed. A targeted fixture reproduces maintenance asking
for the same disconnect again while close handlers are still pending. Voice
removal is idempotent, so acceptance now verifies each participant's revocation
since stop and zero remaining game connections, records raw revocations, and
waits for the teacher's departure before the offline fixture. The new regression
checks durable completion through pending disconnects and subsequent detachment.
No product behavior or thresholds were changed to make the fixture pass.

Physical-device FPS, real Supabase/RLS and microphone delivery, deployment and
hosting/drain/rollback acceptance remain rollout checks. No service was published
and no migration was applied during PR preparation.


## Observer race permissions — 2026-10-21

Race configuration, starting and cup advancement now require the connected player
host. Observing teachers/admins retain pause/resume/end and participant removal,
but cannot make race decisions or vote on rematches. Staff who explicitly join as
players follow the same player/host rules. The server enforces these permissions;
`canControl` describes player-host race authority and `canModerate` describes staff
moderation. Player colors, input, chat and microphone access remain player-only.

Validation: 576 tests / 109,247 assertions, client/platform and web TypeScript,
game Biome and the matching app build (`wobble-app-74b908dd62732ba0`) pass. The real
three-race cup test rejects the teacher's advancement command at both transitions,
and teacher/admin tests reject configuration/start/next while retaining moderation.
The native-service/React browser check passes with zero page errors: lobby and cup
menus use projected UI states with real teacher capabilities; teacher pause/resume
runs against the native service. The existing reconnect, removal, stop and terminal
recovery checks also pass. Existing software-GPU/microphone limits still apply.
Validation used an isolated build; no live dev service was restarted, deployment
published, migration applied or PR opened. Restart `npm run dev:wobble` and refresh
clients to test the changed backend permissions.


## Remote contact presentation and spectators — 2026-10-21

The previous headless prediction checks covered valid collision bodies, but did
not catch independently smoothed meshes overlapping during an unexpected remote
steering change. A delayed-snapshot probe reproduced that visual gap from both a
third player's viewpoint and the teacher's followed-player viewpoint.

- Active players keep the shared predicted actor world and obstacle timeline.
  Before drawing, a bounded contact pass repairs overlapping display positions,
  including the local mesh. It removes offending smoothing offsets where possible,
  checks motion between drawn poses so a fast correction cannot skip through
  another character, and falls back to shared-world positions for an unresolved
  dense pack. These positions never affect simulation,
  input scheduling, checkpoints, finish results or server authority.
- Remote corrections distinguish normal steering errors from respawns/resyncs.
  Large accumulated remote errors ease out rather than snapping at the local
  runner's former 2.5 m threshold; small contacts and local corrections retain
  their fast response. Remote offsets remain bounded. Explicit respawn/resync
  boundaries still reset presentation.
- Teachers and pending participants now use a 100 ms snapshot buffer, in addition
  to transport delay. Players, NPCs and obstacles are sampled on the same buffered
  fractional tick. The view never extrapolates beyond the latest received frame,
  reverses time under packet jitter, or interpolates across a respawn. A long TCP
  backlog rebases to the buffered live edge. Pause/resume, reconnect and cup-race
  boundaries reset the buffer. A disconnected observer freezes the last drawn
  scene, including the followed character, until fresh snapshots arrive.
- The followed character retains a stable identity while racing and uses that
  racer's name/color. The inspection API exposes the buffered frame count and
  uses its displayed tick for observers. The former observer prediction path and
  the unused local rendering wrapper are removed.

Validation: 595 tests / 127,195 assertions pass. New real-Three mesh regressions
exercise glancing contacts and rapid steering with 15 Hz snapshots, 50/100 ms
snapshot delay, bunched delivery and 60/120 Hz drawing. In those contact scenarios, active body centers remain
at least 0.895 m apart (0.9 m diameter, with solver tolerance), and assertions also
bound frame displacement and verify presentation does not mutate prediction.
Additional coverage checks a ten-actor pack, jump/finish exclusions, remote
correction continuity, fractional obstacle time, bounded buffers, stale batches,
respawn/removal/finish boundaries and lifecycle resets. All four game/platform
TypeScript configurations and Biome over 240 files pass. Matching app artifact:
`wobble-app-0da4f1be7cde683a`.

The native-service/React browser integration passes with zero page errors,
including a buffered teacher world with no uploaded racer controls, teacher-only
connection loss/re-admission, retained teacher permissions, pause/resume, player
reconnect, context-loss recovery, explicit stop and completed-session recovery.
Browser integration uses isolated REST fixtures and skips GPU draws; physical
cross-device feel, real microphone delivery and production hosting remain manual
acceptance. Validation used an isolated checkout/build; restart
`npm run dev:wobble` and refresh clients in the shared checkout to test this change.
No migration, deployment or PR was created.
