# Voxel rewrite implementation record

Updated 2026-10-26. The user requested implementation of the
[full rewrite proposal](voxel-runtime-rewrite-proposal.md). The objective remains
the complete game replacement and its release/cutover gates. The implementation
below is progress toward that objective; it is not a finished game or approval
to deploy or delete test data.

## Current implementation

`games/voxel` is an isolated native game package. It contains the pinned compute
fork, semantic content source/compiler, versioned Uint16 formats, authoritative
creative/survival room workers, a dedicated gateway, and a rendered desktop/touch client.
It does not import the legacy voxel server or NOA client. The existing catalog/
invitation/play route now lazy-loads the rewritten React adapter for voxel sessions.
Classroom HTTP/RTC now runs from `apps/classroom-server`; its routes/helpers and
background jobs are removed from the old game process. The legacy voxel game
source remains until the full cutover/retirement gates pass.

- The complete production registry is loaded once per engine instance, without
  a reserved upstream block range/custom pool. Stock IDs remain private
  generator/test fixture details. Air is zero and 65535 is the unloaded/keep
  sentinel. Generation translates its private palette before stamping authored
  Uint16 blueprints.
- Sparse sections, edits, shape IDs, mesh neighborhoods and Wasm state arrays
  use Uint16. Texture layers, light levels, bounds and packed vertices retain
  their appropriate independent widths. Column/neighborhood/edit frames are
  versioned and validated before installation.
- The compiler deterministically assigns IDs and hashes canonical content. It
  checks references, recipes, variant syntax, shape/texture bounds and air
  invariants. There are now 112 authored families/123 states, 172 items, 130 recipes
  and 149 procedural texture layers. Item stacks use one `itemType`/`count`/optional-instance
  representation. Durable instances and equipment slot metadata are validated;
  all 197 legacy declarations have explicit checked decisions; final balance
  and extended natural progression remain open.
- Room time is fixed at 30 Hz with two 60 Hz movement substeps. Socket receipt
  never steps physics. Controls have no client position, dt or timestamp.
  Queues have 12 frames, 200 ms maximum age, an explicit resync result, and a
  100 ms held-control deadline. Transient jump presses clear on reuse.
- Epoch resets invalidate queued controls. The ordered action rejection
  boundary survives eviction of cached results. Creative actions wait for the
  referenced input to be consumed, then validate capabilities, authoritative
  eye/ray reach, collision/support and chunk revisions. Single-block mutations
  commit once and fan out revisioned patches. Inventory/crafting/chest commands
  share the same replay ledger and rejection boundary. Survival placement consumes
  one owned item in the same synchronous operation as the world edit; failure
  leaves inventory unchanged. Food consumption and death item drains also commit
  through owned room state. Melee damage/weapon/armor wear also commit through
  this authority. TNT ignition, blast terrain/container changes and drops also
  commit through owned room state.
- Room-owned inventories implement 36 bag slots, five typed equipment slots,
  personal 2×2 crafting, reachable workbench 3×3 crafting and 27-slot shared chests.
  Moves/splits/merges/swaps and batch crafting commit atomically; failed capacity,
  ingredient, equipment or revision checks do not partially consume/install items.
  Owner revisions and chest identity/revisions reject stale/concurrent intents,
  including an old chest replaced at the same cell. No whole-window chest lock is
  held. Nonempty chests cannot be mined; explosions drain contents and close viewers.
  Container access checks authoritative
  eye/reach/occlusion and closes on disconnect, removal or loss of access.
- The Hebrew inventory dialog sends only public runtime intents and displays
  authoritative views. Native dialog focus/Escape, keyboard E, pointer/touch
  controls, recipes and a capability-checked creative catalog are implemented.
  Opening inventory freezes the local body and rotates the input epoch while
  room time continues. Contents/grids/equipment remain in room memory across
  reconnect; old-epoch mutations are never silently resubmitted. Workbench
  ingredients remain retrievable without another table. The first nine owned bag
  slots form the survival hotbar; selection is authoritative and revisioned.
- `GameRoom` supports server-owned creative/survival modes. Survival rejects
  catalog grants, participant flight and instant removal. Authorized hidden
  observers can fly in survival. Held mining starts from consumed
  authoritative controls, a validated target/revision and owned tool. Progress
  advances only on fixed world ticks; bursts cannot buy time. Tool requirements,
  tiers, speeds and wear come from content. Completion removes the block, wears
  the tool and creates canonical dropped stacks once. Releasing, expired input,
  changed target/tool, focus/epoch boundaries, permission loss or room pause
  cancels the job. Per-cell edit stamps distinguish replacement at the same cell
  without resetting mining for unrelated edits in that column.
- Drops use the engine's validated small-body shape sweeps, authoritative
  occlusion/reach, pickup delay and capacity-aware partial pickup. Uncollected
  remainders stay in the world. The five-minute lifetime uses room ticks. Nearby
  replication is split into bounded messages; growable per-item render batches
  use camera-relative coordinates and release absent batches. Held/dropped tool
  models are local primitives using the existing procedural texture arrays.
  `GameRoom.setPaused` rotates epochs/cancels mining and freezes simulation/drop
  timers; trusted school lifecycle controls use this boundary.
- Private health/food/air use fixed room ticks for hunger, regeneration,
  starvation, breath, lava, eating cooldown and respawn wait. Falls use actual
  native motion and retain their peak through focus and room pause. Environmental
  block queries still run when an individual's inventory freezes movement.
  Food consumes one owned stack item only after the effect is accepted, with the
  same replay/revision protections as other inventory transactions. Death rotates
  epochs, freezes the body, closes storage and drops private bag/grids/equipment
  once. Respawn requires a supported spawn and fresh collision readiness. Health
  and food survive reconnect and restore through coherent durable checkpoints.
- Authored trail boots replace the earlier leather prototype and are craftable
  from four planks at a workbench. Equipped movement/fall modifiers come from
  content, compose within bounds and wear/break on damaging landings. Movement
  profiles and hunger-based sprint permission are shared by prediction/replay
  and authority, with a new epoch/baseline when they change. Apple drops from
  natural foliage complete the representative food source. Current tuning and
  timer policy are recorded in
  [survival-rules.md](../games/voxel/docs/survival-rules.md); full balance/content
  decisions remain open. Equipped armor now affects melee through a craftable
  heavy shield, with accepted-hit wear and a movement cost; environmental damage
  does not use armor.
- Survival melee uses a separate combat capability for both parties and an
  attack intent containing epoch/sequence, consumed-input dependency and owned
  inventory revision. The server chooses the nearest eligible native body on
  the consumed view ray, checks actual shape occlusion/reach and applies
  authored damage, fixed cooldowns, hit recovery and respawn protection. Bursts
  cannot buy attack time; cached/retired requests cannot repeat effects. Weapons
  and armor wear once on accepted hits, including their final use. A nonfatal
  impulse changes velocity without stepping movement and installs a new
  prediction epoch/profile. New baselines clear queued local interactions.
  Nearby monotonic hit events drive bounded sparks, positional impact audio and
  Hebrew feedback; clients never apply gameplay damage. Inventory-open targets
  remain vulnerable. Respawn search also avoids water/lava body cells. See
  [combat-rules.md](../games/voxel/docs/combat-rules.md) for tuning and boundaries.
- TNT is craftable from obtainable logs/planks, stone and sand. Owned placement
  and a durable firestarter lead to server-validated ignition with separate
  explosive/build permissions, consumed aim and revision/replay checks. Primed
  bodies sweep native shapes, retain independent terrain interest and use fixed
  fuses; room pause freezes them and owner disconnect does not cancel them.
  Due work is scheduled in batches without an entity-count admission limit.
  Material/native-shape blast planning precedes atomic multi-column terrain
  changes, chest drains/closure and authored drops. Chains create short fuses.
  Damage samples pre-blast occlusion, checks both combat grants and uses the
  existing armor/death/epoch path. Revoked explosive/build permission fizzles
  an already primed body. Nearby body snapshots and monotonic events drive
  growable flashing instances, bounded sparks and positional audio. See
  [explosive-rules.md](../games/voxel/docs/explosive-rules.md).
- The remaining legacy equipment capabilities now have authored owned items and
  natural recipes: a selected Swift tool speed bonus, explicit fall immunity,
  Helios sunlight healing, native helium jump power and local glow visibility.
  Native takeoff outcomes govern boot wear, including stale body flags when
  terrain changes. Fall outcomes retain prevented impact for immunity wear.
  Solar/visibility durations use room time and owned instances; local visibility
  changes no world light. New domain/Wasm scenarios and the expanded shared
  prediction trace are implemented. The natural night route obtains and crafts
  all five items, verifies the authoritative profile and actual touch takeoff/wear,
  and measures real Glow shader output. The matched full check and all eleven
  browser commands pass; [equipment evidence](../games/voxel/evidence/equipment/README.md)
  retains reports, source and earlier failures. This closes the special equipment
  milestone while content disposition/balance and the full survival stage remain open. See
  [equipment-rules.md](../games/voxel/docs/equipment-rules.md).
- Protocol 10 adds server-derived public held/worn item identities, discrete
  appearance deltas and articulated, growable third-person item batches. Private
  counts, durability, bags, grids and containers stay out of those messages.
  Creative catalog selection is validated separately and changes no ownership,
  action replay boundary, movement time or held-input freshness. The matched
  release passes 54 domain/rendering, 79 native, 51 actual-Wasm and six source/packaged
  gateway scenarios plus all eleven final browser commands. Natural day/night
  two-client gear and creative shape/origin checks cover actual UI changes,
  private vision, reconnect and disposal. Earlier desktop render samples missed
  an authoritative jump under multi-second GPU stalls; passive wire tracing proves
  authority reached height 69.30. Offscreen first-person GPU preparation now
  completes before admission/input; two independent unchanged desktop jump routes
  pass. The final trace still has a 950 ms frame gap, so performance qualification
  remains open. [Appearance evidence](../games/voxel/evidence/appearance/README.md)
  retains matched sources, reports, images and the earlier failures. See
  [avatar appearance](../games/voxel/docs/avatar-appearance.md).
- The gateway compiles the engine once and supervises one independent simulation
  worker per active room. Admission is injected; tickets are short-lived,
  single-use and sent in the first socket message. Role/capability checks,
  hidden noncolliding observers, build matching, reconnect baselines, worker
  heartbeats and explicit failure/disconnect paths are implemented. The current
  launcher injects loopback development admission; actual school policy and
  durable ownership are not integrated yet.
- The imperative desktop client predicts the same 60 Hz movement and replays
  unacknowledged controls; remote actor deltas are interpolated with a bounded
  extrapolation window. The interpolation clock prefers the least delayed
  observation; paused actors do not extrapolate residual velocity. Input focus,
  reconnect and flight changes rotate epochs. Nearby collision readiness gates
  movement. Main-thread generation/meshing is replaced by a bounded worker pool
  with exact world/content/generator/incarnation/subscription/revision tags,
  bounded retries and explicit recovery state.
- Client controls, prediction, streaming and networking run on a separate 60 Hz
  timer from animation/GPU submission. Mining starts wait for a newly sampled
  control and retry transient rejections while held. Liveness uses the latest
  accepted input; consumed controls remain the authority for aim/movement.
  Duplicate, invalid and old-epoch packets do not renew it. Focus baselines
  reassert the latest local intent, so rapid resume/pause and resume/inventory
  gestures survive epoch rotation without resubmitting inventory mutations.
- Three.js consumes packed chunk geometry through shared procedural texture
  arrays and opaque/cutout/translucent passes. It retains voxel light/AO and
  section/cave culling, uses camera-relative GPU coordinates and articulated
  instanced avatars, and disposes owned resources. Avatar heading retains the
  last consumed look direction across pause/epoch changes. A Hebrew development harness
  exercises pointer lock, hotbar, targeting, build/remove, flight and fullscreen.
  An optional Hebrew touch adapter calls the same runtime controls, with joystick,
  multi-touch look/jump/flight/build buttons, cancellation and pause. Compiled
  block shapes/textures drive first-person held blocks; bounded edit particles
  follow accepted contiguous world patches. Remote held equipment/tool models
  are implemented; the React session/HUD remains open.
- A shared versioned room clock drives a 20-minute day/night cycle, seeded
  weather, sun/moon/stars/clouds, skylight/fog and local ambience. Rain presentation
  hides under overhead terrain; it does not simulate block changes. Late joins
  and reconnects observe the existing room time; clients cannot override it.
  Protocol 12/environment version 1 are part of the current matched build identity;
  owned inventory views use format 2 and private vitals use format 2.
  Coherent checkpoint capture/recovery now retains room time through injected
  gateway persistence ports; the actual Supabase backend remains pending.
- Gesture-unlocked Web Audio synthesizes ambience, footsteps and material edit
  sounds. Its listener/panners use absolute world coordinates independently of
  the GPU origin; focus/recovery/mute silence the actual gain graph. Audio closes
  on disposal. This local game audio is separate from pending LiveKit voice.
- Worker ownership tracks actual live workers. Startup/script/transfer failures
  use finite retries and freeze movement on terminal failure, without installing
  empty fallback terrain. Reconnect creates a fresh world/job epoch after repair.
- Node/Rust/wasm-pack versions, lockfiles, optimizer settings, Wasm/binding/content
  hashes and build IDs are recorded, with matched client/server release inventories.
  Root build/check/development/browser commands and a CI workflow
  exist. [UPSTREAM.md](../games/voxel/UPSTREAM.md) records imported paths,
  licenses, procedural asset provenance and the upstream update procedure.
- [ADR 002](adr/002-voxel-native-websocket.md) records the voxel-only transport
  exception. Other game/classroom services retain their current architecture.

No player, observer or room-count admission caps have been introduced. Input,
catch-up, message and work budgets are separate concerns.

## Verified evidence

The latest release is `bedd62f9b37b2a071c498413c7352033ccd97e94f2bd976101259481c789d3f8`.
Protocol 13 and engine/content/checkpoint formats remain unchanged. The complete
core gate passes 86 domain, 80 native (three ignored upstream helpers), 84 actual-Wasm
and 40 source plus 40 packaged integration scenarios. Service gates pass 38
SDK/policy/startup, seven school gateway and 50 actual PostgreSQL/SDK/native-worker
cases. All 94 web tests, affected types and the production web build pass; its
browser boundary reports 43 game modules and zero forbidden modules.

Persisted chat now has a Hebrew owned dialog, bounded keyset history pages,
stable-request send/retry, literal text rendering and teacher/admin delete/clear
controls. Private SQL tables are separate from gameplay/checkpoints and legacy
browser-writable chat. Fresh identity and a live participant proof bind sends to
owner epoch and admission generation. Hidden observers remain read-only even if
still rostered; staff can inspect/moderate without a worker. Audit and tombstones
commit together. Retrying an old clear cannot erase later messages. No message
body/name enters operational logs. See [chat](../apps/voxel-server/docs/chat.md).

The final built three-context React fixture checks lost committed response/retry,
reopen persistence, escaped text, hidden-staff read-only access and delete/clear,
plus remove/ban/unban, preserved nonempty inventory, distant staff teleport,
failed save/retry, pause/resume/end, fullscreen mouse/touch Exit and nine mobile
controls. All tracked GPU/worker/audio resources return to zero; final mouse
dispatch is acknowledged. The retained earlier mouse Exit timeout has an unproven
cause. The final diagnostic hit target is Exit, with all dialogs closed and no
pointer lock. Software rendering and fixture Auth/PostgREST/Storage keep these
functional checks separate from actual hosted school and hardware qualification.

All seven installed schemas/private bucket pass read-only readiness at
2026-10-26 14:56 UTC. The user reported applying migration seven; its five function
bodies/grants, two private RLS tables and visible-history index match the tested
file. Linked history lists 001–007 and SDK/CLI targets match. Guarded startup of
packaged chat release `bedd62f9b37b` allows only seven status calls, passes
health/readiness, allocates zero rooms and closes with no remote application
writes. The [installation record](../games/voxel/evidence/chat-installation/README.md)
verifies 15 unchanged service-policy inputs and all twelve packaged release bytes.
The immutable [chat archive](../games/voxel/evidence/chat/README.md) preserves its
correct earlier missing-seventh-schema observation; the preceding moderation
archive remains unchanged. No agent migration/deployment or hosted application
writes occurred. Client voice work below is in progress and is excluded from
this packaged-release startup qualification.

The current classroom increment passes 69 independent service tests, 32 shared
observability tests, 120 legacy game regressions, 19 drawing/capability tests,
90 web tests and all affected typechecks. The actual production web build passes
with separate classroom/voxel origins and its 41-module/zero-forbidden boundary.
The classroom compiled entry passes native-process admission/SIGTERM and its
module graph contains no game imports. Read-only checks of the actual configured
classroom base table and LiveKit API pass. These do not qualify hosted classroom
browser/media/delegate/restart journeys or a container deployment.

The preceding roster release `34251aac77af` and its immutable
[roster archive](../games/voxel/evidence/roster-departure/README.md) record the fourth
schema as absent at their earlier capture time; it has since appeared externally.
The agent made no hosted schema/object/application-row writes in this phase.

The earlier React-session archive captures release
`133667cb44e78b62cd57286267288fd201154cd0901a37066f75d40fed5cdb39`.
Its React integration record is in
[React session evidence](../games/voxel/evidence/react-session/README.md).
It retains protocol 12 and the same engine, bindings and content identities.
That archived complete core gate passes 80 domain, 80 native (three ignored upstream
helpers), 80 actual-Wasm and 36 source plus 36 packaged integration scenarios.
The service passes 32 SDK/policy/startup, six school gateway and 23 real local
PostgreSQL/SDK scenarios; all 87 web tests and the production application build
pass. The build boundary reports 40 rewritten game modules and no forbidden
legacy-renderer/server modules. The three-context built React fixture passes
StrictMode cancellation, owned fullscreen inventory, save failure/stable-ID retry,
paused teacher flight, explicit resume/end, nine reachable mobile controls,
mobile joystick movement and zero tracked GPU/worker/audio resources on exit.
This is software-browser functional evidence using fixture school/Storage
transports, separate from the hosted read-only schema/startup checks.
Fullscreen mouse-dispatch timeouts remain an unresolved qualification issue;
keyboard exit while fullscreen and real touch exit pass. A retained inventory
assertion race was fixed by waiting for the actual server frozen-body baseline.
The final verification stopped its isolated PostgreSQL cluster.


Reproduce with the commands in [the game README](../games/voxel/README.md).
Historical foundation evidence is under `games/voxel/evidence/foundation/`.
Historical desktop creative evidence is under
[`games/voxel/evidence/creative/`](../games/voxel/evidence/creative/README.md),
including the matched release inventory, successful rendered two-client result,
zero teardown resource counts, compute parity and full check output.
The subsequent source-matched desktop/touch lifecycle record is under
[`games/voxel/evidence/input/`](../games/voxel/evidence/input/README.md).
Its timed desktop run passed after exposing severe software-GPU/frame stalls
during reconnect. Subsequent rendering submits at most 60 Hz by default,
30 Hz in the low profile and 10 Hz for paused/preparing views, independently of
input/prediction/streaming scheduling. Hardware performance and genuine window/OS
focus remain unverified.
The earlier source/release-matched pacing checks and successful desktop/tablet
scenarios are under
[`games/voxel/evidence/pacing/`](../games/voxel/evidence/pacing/README.md).
The subsequent presentation milestone is recorded under
[`games/voxel/evidence/presentation/`](../games/voxel/evidence/presentation/README.md),
with fresh source/content/release verification and browser reports. Historical
evidence retains its own build identity and is not relabeled as current.
The first presentation-build desktop run timed out on reconnect amid severe browser
stalls; an unchanged repeat passes after roughly 53 seconds in reconnect. Both
logs are retained. This is functional evidence with an unresolved latency and
software-rendering qualification concern, not an unconditional all-green gate.
That presentation record is historical after the inventory change. The subsequent
source-matched inventory milestone is under
[`games/voxel/evidence/inventory/`](../games/voxel/evidence/inventory/README.md).
Its first touch run cleared input but failed the displacement assertion; the
diagnostic repeat passed with the same bound. The final test waits for grounded
rest before measuring that bound, matching intentional airborne momentum. Both
earlier logs are retained; the first failure's precise cause is not proven.

The subsequent owned survival intro is recorded under
[`games/voxel/evidence/survival/`](../games/voxel/evidence/survival/README.md).
Build `37a9e3788edd` passes the full check and all eight browser commands. The
natural-world scenario starts empty, mines and collects logs, crafts and consumes
an owned workbench, then crafts and displays a wooden pickaxe. Fixed-time mining,
tool wear, partial pickups, permission revocation and competing commands also
have actual-Wasm room checks. Historical input-liveness, rapid-focus, browser-route
and snapshot-comparison failures are retained with their fixes explained. These
functional checks do not close hardware, load, persistence or school-service gates.

The subsequent private-vitals/food/equipment milestone is under
[`games/voxel/evidence/vitals/`](../games/voxel/evidence/vitals/README.md).
Build `0f33682a9fc3` passes the full check with 34 domain, 79 native and 24 actual-Wasm
tests plus five source/packaged gateway scenarios. The natural browser intro now
harvests four logs and an apple, crafts/equips trail boots and consumes the apple
after actual room-time hunger with inventory open. Selecting food before hunger
also verifies its button refreshes without reselecting. Fall/pause retention,
equipment breakage, private vitals, frozen-body hazards, food replay/eviction,
lava death/item drains and respawn have actual-Wasm room checks. The first creative
placement timeout and a later outer batch termination are retained. An independent
creative repeat passes, but takes roughly 119 seconds with severe software-browser
stalls; reconnect readiness takes about 41 seconds. This remains an open latency
qualification concern. Final browser reports and their terminal exits are recorded
against the matched release rather than treating a state file as proof of completion.
All eight final browser commands finish with exit code 0 and no signal. Earlier
failed/interrupted runs retain their original identities and do not become passes.

The subsequent authoritative melee milestone is under
[`games/voxel/evidence/combat/`](../games/voxel/evidence/combat/README.md).
Build `a3db04da64a3` passes the full check (38 domain, 79 native, 30 actual-Wasm
tests and six source/packaged gateway scenarios) and all nine final browser
commands, each with exit code 0 and no signal. The natural route crafts/equips
both boots and the heavy shield. Two real built clients exercise a touch attack,
server-selected hits against an inventory-open target, actual death and the same
client's normal respawn UI/readiness/protection. A direct real-hit prediction trace
stays within one centimeter under quantized snapshots delayed 100 ms. The initial
early-readiness fixture failure is retained; the server correctly required new
collision data. A retained browser probe establishes exact float32 panner
conversion after a stricter double-coordinate assertion failed. The final audio
assertion checks that exact absolute-coordinate conversion. The final creative
scenario still takes roughly 122 seconds, with about 40 seconds from reconnect
request to readiness. Hardware and latency qualification remain open.

The authoritative TNT milestone is under
[`games/voxel/evidence/tnt/`](../games/voxel/evidence/tnt/README.md).
Build `059ee0d9b858`, protocol 8, passes the full check: 42 domain, 79 native,
38 actual-Wasm tests and six source/packaged gateway scenarios. All ten final
browser commands exit 0 with no signal. The capture matches its milestone source,
engine/content and all 12 packaged files, retaining 65 artifacts and 23 scenario
hashes. An empty natural survival client gathers six logs, shore sand and river
stone, crafts its workbench/pickaxe and TNT materials, places an owned TNT,
ignites it through actual touch input and observes its fuse/crater, accepted
damage, one explosion effect plus the hit effect, audio and complete teardown.
Historical driver failures and the initial creative movement assertion remain
separate from final results. The final creative scenario takes about 138 seconds,
including roughly 44 seconds from reconnect request to readiness; the final
natural TNT route takes about 160 seconds. This remains software-browser
functional evidence, with hardware and latency qualification open.

The subsequent special equipment milestone is under
[`games/voxel/evidence/equipment/`](../games/voxel/evidence/equipment/README.md).
Build `97603656240f`, protocol 9, passes the full check with 48 domain, 79 native,
46 actual-Wasm tests and six source/packaged gateway scenarios. All eleven final
browser commands exit 0 without a signal. A natural empty-inventory night route
crafts all five special items, observes speed 1.5/jump 1.6, rises 3.30 blocks from
actual touch takeoff with exactly one boot use, and measures local Glow output at
the same night viewpoint. It takes about 122 seconds; the final TNT route takes
about 76 seconds. Source snapshots, reports, screenshots and earlier failures or
interruptions remain separate and hash verified.

Severe software-browser stalls motivated a zero-timeout GPU completion fence:
skip new render submission while the prior frame is pending, without changing
input/prediction timing or native authority. The creative route passes in about
32 seconds and disposes both fences with no synchronization errors. Its trace
still records a 3.75-second frame gap and 4.63-second receipt age. This proves
functional backpressure and cleanup, not acceptable latency or hardware FPS.

The subsequent public-appearance/startup record is under
[`games/voxel/evidence/appearance/`](../games/voxel/evidence/appearance/README.md).
Build `70127a28adf5`, protocol 10, passes 54 domain/rendering, 79 native and 51
actual-Wasm tests, six source/packaged gateway scenarios and all eleven final
browser commands. Its capture verifies 108 artifacts, 30 scenario hashes and
158 archived source files. Natural day/night routes add independent viewers,
owned visible gear, UI changes, private vision, origin shifts and reconnect.
Creative clients observe validated catalog shapes. Earlier render-sampled jump
failures retain accepted authoritative jumps and their original terminal results.
Offscreen first-person startup now precedes admission/input; two independent
unchanged creative jump routes pass. The final 950 ms frame gap still leaves
device/input latency qualification open. Full content, durable services, school
integration and cutover remain required.

The authored-content candidate is build `e4f100782c69`, protocol 11. Its
complete check passes 61 domain/rendering, 79 native and 58 actual-Wasm tests
plus six gateway cases against source and packaged servers. All 197 legacy
entries now have explicit checked decisions. Tagged mixed woods, full palettes,
weighted committed forage, tool tiers/refining/food, body armor and reusable
water buckets are implemented. A controlled empty-inventory native route earns
this progression through mining/pickup/crafting; a 332-column three-seed survey
finds essential resources and all three wood/leaf species. Neither establishes
final balance or extended natural cave travel. All eleven final browser commands pass; their reports, screenshot run times,
retained failures and source archive are captured in the [content evidence record](../games/voxel/evidence/content/README.md).
The unchanged creative route passes with zero catalog-node replacements after
unique-state palette/stable-text fixes. Its 4.25-second software-render frame gap
leaves hardware/input latency qualification open. Pre-alias and pre-palette
missed jumps, native axis-to-stone fallback and earlier strict fixture failures
are retained separately from the final candidate's results.

Durability work has now started with a private immutable schema-1 vitals
checkpoint and exact reconstruction of every timer, effort and fall phase.
An 8,100-tick interrupted/uninterrupted comparison passes, including strict
corrupt-state rejection and precise fall/respawn continuation. Build
`6b2d7e865026` passes 64 domain/rendering, 79 native, 58 actual-Wasm and both
six-scenario gateway suites. This is a local state primitive; coherent room
checkpoints, storage commits, owner leases and platform recovery remain pending.
The eleven-browser evidence above belongs to the archived `e4f100782c69` content
build. See [checkpoint state](../games/voxel/docs/checkpoint-state.md).

The subsequent checkpoint-parts build `889cbe37a09e` passes 72 domain/rendering,
79 native and 63 actual-Wasm tests plus both six-case gateway suites. Private
capture/reconstruction now covers inventories/chest incarnations, drops/TNT
body/timer order and lazily restored terrain/cell revisions. Corrupt suffixes
fail before installation; failed native replay discards its partial column and
can retry; wire revision exhaustion cannot wrap or partially clear a blast.
These are verified components, not a durable room recovery path. Coherent actor/
clock capture, fresh authorization, asynchronous immutable-object/pointer commits
and ownership leases remain pending. Current details are in
[checkpoint state](../games/voxel/docs/checkpoint-state.md).


The subsequent whole-room build `afd3a9b33e5e` passes 72 domain/rendering,
79 native and 74 actual-Wasm tests, plus 17 integration scenarios against both
source and packaged servers. One worker-boundary checkpoint now captures actors,
ownership, terrain and all timers. Fresh admission/readiness creates new command
epochs; saved capabilities never grant authority. Immutable column objects and a
coherent manifest precede a fenced pointer commit. The gateway coalesces saves,
pauses immediately while IO is blocked, retries ambiguous commits identically,
saves/releases empty rooms and restores after a real worker crash. Lease deadlines
stop both gateway publication and worker simulation, including a blocked gateway
event loop. Fractional reservation milliseconds survive long saved pauses.
These cases use a fault-injectable storage/metadata contract fixture. Actual
Supabase transactions/private storage, retention and school lifecycle integration
remain pending. The live 15-second autosave test proves the injected path's timer,
not service/network durability lag. See [checkpoint state](../games/voxel/docs/checkpoint-state.md).
The new build's two-client creative and inventory browser regressions also pass,
including reconnect and complete teardown. The creative sample still has a
700 ms frame gap on software Chromium, so hardware/input latency remains open.
These two regressions do not replace the prior complete eleven-scenario browser
capture or prove real-backend browser recovery. See the
[room recovery evidence](../games/voxel/evidence/room-recovery/README.md).


The subsequent production-adapter core build `3113f0b34e9f` passes 72 domain,
79 native, 74 actual-Wasm and 18 integration cases against both server forms.
`apps/voxel-server` adds a pinned Supabase SDK adapter with request deadlines,
create-only uploads/duplicate-byte checks, complete reference-graph commits and
retention cleanup. Six SDK and twelve actual PostgreSQL/SDK tests pass, including
real native worker recovery through the SDK/SQL layer. Physical Storage bytes in
that combined test remain a fixture. Target PostgreSQL 17 accepted the exact
migration in a rollback-only validation. Persistent remote installation was not
executed: automatic review requires explicit approval, which has been requested.
Read-only Supabase access now succeeds with the updated key name. Main's existing
key migration was merged; the voxel work and research evidence were retained.
That core build has no new browser capture; previous captures retain their
original identities. See [checkpoint details](../games/voxel/docs/checkpoint-state.md).

The subsequent school-authority build `784ee64fa87c` passes 73 domain, 80 native
(three upstream debug helpers ignored), 75 actual-Wasm and 24 integration cases
against both source and packaged servers. School admission now obtains current
identity/profile/session/invitation/recess policy through the SDK, revalidates
tickets before allocation, and renews short actor deadlines enforced independently
in gateway and worker. Staff observation remains hidden and permits survival
flight; toggling or revoking flight stays off across native ticks and reconnect.
The browser trace exposed an upstream spectator step that forced flight on;
the fork now applies ghost movement only when flight is enabled. Ordinary player
fingerprints were not changed. See the
[school boundary and remaining lifecycle work](../apps/voxel-server/docs/school-admission.md).
The platform adapter passes 19 SDK/policy tests, four real-gateway school scenarios
and twelve actual PostgreSQL/SDK cases. The rebuilt observer, creative and inventory
browser scenarios pass, including the exact off/on/off observer flight socket trace,
live revocation and resource disposal. Node, Chromium and browser workers match an
explicit spectator flight/fall trace for both production and high-ID content.
These remain fixture-school and software-browser checks. The creative jump sample
has a 4,149.8 ms maximum frame gap despite functional success; device/input latency
is unresolved. The earlier complete eleven-browser content capture retains its
original engine and build identity. See
[school authority evidence](../games/voxel/evidence/school-admission/README.md).

| Gate | Evidence and limits |
| --- | --- |
| Native invariants | 80 passed; three upstream image/map debugging helpers remain ignored. Includes high-state native generation/storage/mesh and spectator flight authority tests. |
| Content/time/replay/inventory/vitals/combat/explosive/equipment/pacing tests | Eighty tests cover bounded/coalesced session projection and retryable terminal writes, lifecycle/clock/private-policy boundaries, bounded complete owner-policy IO, private authorization validation, deterministic/canonical content, >255 assignment and invalid content; strict gameplay/chunk/environment/inventory/mining/drop/vitals/attack/hit/ignite/body/explosion protocol; burst-time invariant, input expiration/epochs/liveness, consumed-look preservation, catch-up bounds, replay after cache eviction, shared environment clock/weather and delayed interpolation. Inventory tests exercise stack/instance validation, conservation, equipment constraints, shaped/batch crafting, full-output rollback, chest conflicts/identities, owned placement, final-use tool/igniter breakage, partial pickups and retained ingredient retrieval. Vitals/combat tests cover exact timers, food/cooldown/rollback, body-ray edge cases, hit recovery/protection, accepted-strike wear and bounded profiles. Explosive tests include atomic native-write rollback, fixed fuses through unavailable terrain and rejected forged strength/timers/positions. Equipment adds selected-only activation, protected impact/wear, room-time solar/vision timers and strict modifiers; GPU cases cover pending-frame exclusion, zero-timeout polls, context loss, completion failure and disposal. Appearance cases validate public-only item identities, owned selection, content/slot checks, discrete interpolation, joint/origin matrices, 129-avatar growth and shared-texture/buffer ownership. |
| Actual release Wasm/socket tests | Eighty tests cover paused observer readiness/motion and terminal state, unknown/expired/offline owner permission, connected observer restrictions, persistent spectator flight authority, widened formats/shape/light invariants, semantic liquids/ladders, real-socket time budgets, generation/edit and stale-neighbor races, natural-world movement/culling, observers, flight and delayed prediction. Survival checks include mining/placement/replay, competing miners/pickups, tool wear, capacity/occlusion, pause/expiry, small-body sweeps, permission revocation, falls, equipment epochs, private vitals, frozen-body hazards and food replay. Combat checks include owned weapon/shield breakage, consumed aim/dependencies, partial-shape LOS, reach, separate permissions/modes, burst cooldowns/replay eviction, melee death/item drains, same-connection respawn/protection and safe spawn across column readiness. Explosive checks cover ignition/replay/last-use wear, room-time pause, chains/revocation, source disconnect, queued due work, high-state cross-column batches, native partial shapes/material/wet shielding, pre-blast actor occlusion/armor/frozen damage and shared chest draining/old identities. The unchanged-world, equipment/hunger, boosted jump/speed and real hit-impulse prediction traces stay within one centimeter with quantized 15 Hz snapshots delayed 100 ms. Appearance rooms also cover quiet wear/count changes, final-use gear breakage, late join/reconnect, hidden observers, creative catalog validation and exact motion-trace equality with or without palette traffic. |
| Creative/survival gateway | Thirty-six scenarios run against both source and packaged server, including serialized lifecycle control/disconnect-save races, membership-before-welcome, rejected membership IO and final-presence failure before lease release. Central session-policy expiry, pause/end, terminal denials and cancelled/concurrent/retiring admissions also have real-worker/socket checks. Due TNT also waits through owner-policy outages and independent worker expiry during a blocked supervisor; an explicit fresh denial can fizzle it. Fresh ticket/capability renewal, actor expiry under a blocked supervisor and ownership expiry join the original gameplay and durability cases. The durability cases exercise actual worker capture/restart, autosave, last-player save/rejoin races, coalescing, commit-response loss, drain failure and lease loss. The persistence cases use an injected contract backend, not Supabase. They cover authoritative shared edits, replay, late joins/reconnect, single-use admission, forged movement/time rejection, capabilities, room time and private inventories/chests. Survival starts empty, mines natural terrain on room time, replicates a real drop and collects it into the owned hotbar. Real melee sockets verify server-selected targets, private vitals, cached effects, burst cooldowns and combat permission independent of building. Movement-burst comparisons use the same authoritative room tick, avoiding unrelated snapshot receipt times. |
| Browser/worker parity | Same release Wasm runs in Node, Chromium and browser module workers. Production content and the >255-state synthetic manifest pass matching generation/edit/mesh hashes, fixed movement traces and the small-body sweep trace. The separate two-client rendered scenario checks desktop movement, targeting, shared edits, reconnect and teardown; captured results must match the release inventory. Software-rendered Chromium does not establish hardware FPS. |
| Touch/input failure path | An emulated-tablet Chromium scenario uses actual multi-touch events for joystick, simultaneous look, jump, flight and cancellation; dispatches the normal blur event and verifies the authoritative body freezes; loses/restores the actual WebGL context, verifies recovery cannot be bypassed, and disposes all owned resources. Headless shell keeps tabs focused; genuine OS/window focus, hardware touch ergonomics and frame budgets remain device gates. |
| Presentation/audio | Two built clients use public controls and server-authorized flight to cross a real chunk origin. Assertions inspect submitted avatar instance coordinates, consumed heading across pause, held slab/stair/ladder/torch/plant/glass/water geometry, geometry plateau, absolute audio listener coordinates and actual mute gain. The creative scenario checks particles and positioned sounds from accepted edits. Night/weather scenarios render stars/moon/clouds/rain. All dispose owned resources; physical audio output and hardware rendering remain unqualified. |
| Actual worker failures | Browser asset interception injects real worker-script errors. Two transient failures recover on the third start; permanent failure exhausts two restarts, leaves zero live workers, freezes movement, installs no empty terrain and cannot be bypassed by resume. Repair plus ordinary reconnect restores loaded terrain in a fresh epoch; resources/audio close. |
| Inventory browser | The built Hebrew dialog receives normal pointer/touch actions for 2×2/3×3 crafting, equipment and actual placed chest transfers; it freezes the local body while room time continues. Reconnect retains identical owned contents, closes the window and does not resubmit mutations. Tracked GPU/worker/audio resources and inventory DOM/listeners dispose. This is software-Chromium functional evidence; hardware inventory ergonomics remain open. |
| Survival browser | A natural empty-inventory world uses actual held touch mining and public look/movement to harvest/collect five logs and an apple. Normal dialog actions craft planks, a workbench and sticks, owned placement consumes the workbench, and its 3×3 grid crafts a selected pickaxe, equipped trail boots and a heavy shield. The already-selected apple becomes edible after real room-time hunger with inventory open, consumes once and restores food. Drops/held tool render and all tracked resources dispose. No grants, clock overrides or test-only world mutations are used. |
| Combat browser | Two natural empty-inventory built clients use normal movement/look, an actual touch attack and public attack intents. An inventory-open target receives server-selected hits and reaches actual death; the same client uses the respawn UI, observes frozen collision preparation and combat protection, then explicitly resumes. Accepted hit events produce sparks and positional impact audio; its panner coordinates use the exact measured float32 conversion of the absolute hit point. Both clients dispose GPU/worker/audio/UI resources. This is functional software-browser evidence, not hardware or latency qualification. |
| TNT browser | An empty natural survival client gathers six logs, shore sand and river stone using normal look/movement/held touch mining, crafts its workbench/pickaxe and charcoal/powder/firestarter/TNT, consumes owned placement, and uses actual touch ignition. A 120-tick primed body renders; accepted explosion terrain changes produce a crater, damage, one explosion effect plus the hit effect, audio and complete resource teardown. No creative grants, world/position injection or clock overrides are used. The equipment-release route takes about 76 seconds on software Chromium. |
| Special equipment browser | A natural empty-inventory night route gathers nine logs, foliage/apple, shore sand and river stone, then crafts all five items through the ordinary workbench. The server issues speed 1.5/jump 1.6; actual touch takeoff rises 3.30 blocks and wears boots once. Glow changes real framebuffer luminance from 24.13 to 76.71 at the same frozen night viewpoint, without changing world lighting. The final route takes about 122 seconds and disposes all tracked resources. |
| Remote appearance/browser startup | Independently admitted day/night viewers observe naturally crafted gear, actual UI unequipping, selection, camera-relative instance coordinates, owner-only Glow, reconnect and complete disposal. Creative clients observe validated catalog shape changes. Tiny offscreen first-person preparation completes before admission/input. The unchanged desktop jump route passes twice after warmup; its final 950 ms frame gap still leaves hardware/input latency qualification open. |
| Native fingerprint disposition | The observed failing upstream Linux ARM hash and fork hash were identical. The original hard-coded fingerprint remains on its documented Apple-silicon target; every target checks the before/after physics/ray trace plus analytic shape/collision invariants. No replacement hash was introduced. See UPSTREAM.md. |
| Types/import boundaries | TypeScript/static import checks and main/worker bundle graph checks enforce separation from simulation, admission, Node and platform-service modules. |

The historical foundation compute benchmark uses Node 24.21.0 on two ARM Neoverse-N1 cores, seed
4242, 81 generated columns and 49 complete mesh neighborhoods. Mean generation
is 2.25 ms (p95 2.98 ms); mean lighting/meshing is 3.10 ms (p95 4.86 ms).
Mean column data is 37,137 bytes; mean extracted neighborhood data is 320,531
bytes; mean mesh data is 38,774 bytes. Wasm is 536,643 bytes. Wasm memory high
water reaches 8,585,216 bytes; all 81 columns unload and the loaded-column count
returns to zero. High-water retention remains after freeing objects; this is
not a long-session leak/plateau result. The reduced content differs from the
upstream research world, so these numbers do not isolate the cost of widening
storage and do not establish frame rate, capacity or school hardware support.

## Remaining delivery scope

| Proposal stage | Status and next required evidence |
| --- | --- |
| 0. Foundation/decisions | Engine/time/content core, compute gates and matched client/server artifacts implemented. Early real-device baseline and release product defaults remain unratified; supported school devices/workloads have been requested. |
| 1. Authoritative creative slice | Functional exit checks pass: protocol, supervised workers, command authority, prediction/interpolation, revision-safe streaming and rendered terrain. Captured checks cover two-client walking/jumping/shared edits/reconnect/disposal, late joins, stale jobs and forged/burst inputs. This closes the desktop creative milestone, not the complete rewrite. |
| 2. World/presentation | Partial: bounded natural preset, packed shape/light rendering, culling, camera-relative terrain/avatars, articulated avatars, held blocks, edit effects, spatial material sounds/footsteps, ambience, day/night/basic weather, bounded jobs/uploads, touch controls and teardown exist. Origin-shift avatar/audio, terminal worker failure/reconnect, touch cancellation, blur-handler authority and actual WebGL loss/recovery have functional browser checks. Pending: complete seam/travel/memory qualification, real-device quality/budget/input/audio verdict and complete app input lifecycle. |
| 3. Complete survival | Partial: authoritative inventories/equipment effects, crafting/chests, owned hotbar/placement, fixed-time mining/tool wear, drops/pickups, health/hunger/food/air/fall/lava, melee/armor/knockback, death/respawn, TNT ignition/fuses/chains/blasts, simulation-time timers/pause and a functional Hebrew dialog are implemented. Natural empty-inventory play reaches an owned workbench, pickaxe, trail boots, heavy shield, an apple eaten after room-time hunger, and craftable/placed/ignited TNT with a rendered crater. A night route obtains all five special equipment items and checks server-issued profiles, boosted touch takeoff/wear and actual Glow shader output. Two built clients exercise touch combat, death and same-connection UI respawn. All 111 legacy blocks, 44 items and 42 recipes now have explicit checked decisions (174 retain, ten replace, eleven combine, two remove). Expanded palettes, three wood varieties/tagged recipes, deterministic forage, four tool tiers, refining/foods, body armor and reusable water buckets are implemented. A controlled actual-Wasm route starts with empty ownership and obtains the progression resources through mining/pickup/crafting; a 332-column sample across three seeds finds essential materials. These do not establish extended natural cave travel or final balance. A natural seed-4242 browser route now earns/refines iron and crafts/reuses a bucket with touch and trusted OS desktop input, reconnect and zero-resource teardown. Pending: balance/natural extended progression across seeds, actual device presentation, actual service recovery and full survival scenarios/presentation. The full survival game remains incomplete. |
| 4. School integration/saves | Coherent checkpoints, fenced metadata, autosave/retirement/restart, renewable school/owner policy, roster/status/presence, host reassignment, trusted pause/resume/end and an independent voxel entry are implemented. The Hebrew RTL React session/HUD and self-roster removal are locally qualified with real SDK/SQL/packaged workers. Protocol 13 adds audited staff mode/self-teleport with fresh authority, epoch/deadline fencing and no new-save claim. All eight hosted schemas/private bucket and guarded zero-room startup pass. Audited removal/bans/unban, old-admission revocation and persisted moderated chat are locally qualified; the seventh chat schema is installed and read-only verified. Classroom HTTP/RTC is extracted with 69 independent service tests and separate frontend routing. Media moderation and the product proximity/mute mix are separately qualified with local SQL, fixture Auth and a configured SFU. Pending: actual authenticated catalog and hosted school/recovery journeys, actual Auth/game/SFU composition, full recess/reconnect journeys, provider failure qualification and hosted classroom rollout/browser/media/restart qualification. |
| 5. Qualification | Initial direct survival profiles at 16–128 actors and packaged loopback profiles through 1×128 and 4×16 are recorded in `games/voxel/docs/server-scaling.md`; they are samples, not admission limits or release signoff. Pending: agreed device/browser/network matrix, further increasing players/concurrent rooms and sustained richer survival workloads, p95/p99 latency/frame/tick/readiness gates, backpressure and stalls, memory plateau, actual Supabase outage/crash/deployment-overlap/drain qualification, healthy service durability lag and school UI save acknowledgements. Injected-backend crash/lease-loss/drain/commit-before-save checks pass. Operational metrics/audit must follow LOGGING.md. |
| 6. Cutover/retirement | Pending: independently operable new app path, fresh scoped test worlds, service routing and matching releases, healthy classroom split, then remove the old NOA/socket/content runtime, unused dependencies/assets and obsolete docs/instructions. Rollback targets the new stack or disabled admission. |

## Product decisions

The proposal's 256-block height is implemented. Its 512×512 bounds, basic-weather
scope and up-to-30-second crash recovery-loss target remain development
assumptions awaiting product ratification. Actual laptop/tablet/browser floor
and typical/peak room/player workloads are also outstanding. Those workload
numbers will guide profiling and scaling, never become join restrictions.

These questions do not block building the remaining game. They do block claiming
release qualification or completion of the overall objective.


On 2026-10-25 the user applied the reviewed checkpoint migration. The live read-only
installation check now passes with schema 1 and a private bucket. A single random
qualification JSON object passed create-only upload, duplicate rejection, exact-byte
verification, anonymous/public denial and deletion verification. This does not
qualify hosted checkpoint transactions, real school authorization or crash recovery.
The earlier `NOT_READY` captures remain historical.

The subsequent offline-owner build `2a953cea1c40` passes 75 domain, 80 native
(three upstream debugging helpers ignored), 78 actual-Wasm and 26 integration
scenarios against both source and packaged servers. Private TNT-owner proofs
renew on five-second monotonic deadlines even after disconnect and during pause;
unknown/expired policy holds earned due bodies instead of cancelling or applying
them. Explicit current denial can fizzle; connected observation remains stricter
than passive eligibility. Four concurrent policy reads are an IO budget, not an
owner-count admission limit. The SDK school adapter installs both admission and
owner ports. Its 19 SDK/policy, five real-gateway school and twelve PostgreSQL/SDK
cases pass. Built natural-survival TNT and observer regressions also pass.
The installed hosted SQL functions pass nine rollback-only checks with fixture
object metadata and no residual fixture session. This is separate from the live
Storage byte check; full hosted recovery, room-wide recess/paused/ended policy,
fenced status projection, abandoned cold-allocation cleanup and the complete
school React/voice/chat/classroom flows remain pending. See
[offline-owner evidence](../games/voxel/evidence/offline-owner/README.md).


The subsequent central-lifecycle build `32f0fda71111` uses protocol 12 with the
unchanged `cafaedd1659c` engine/content formats. Its complete gate passes 78
domain, 80 native (three upstream debugging helpers ignored), 80 actual-Wasm and
33 integration scenarios against both source and packaged servers. Fresh private
session leases and current participant authority pause room time independently
of a stalled parent. Staff alone cannot advance timers, but can prepare and move
through paused worlds on a separate bounded observer scheduler. Session/manual/
unknown/no-participant pause cannot be bypassed by resume; completion is terminal
through either room policy or actor revalidation. Cancelled unjoined allocations
stop/release, concurrent valid admissions survive, and revalidation reacquires a
worker after retirement. The built two-client school browser passes pointer-lock
release and cleared input on pause, frozen world time with teacher touch flight,
explicit child resume, terminal/no automatic readmission and disposal. These
remain fixture-school and software-browser checks. Fenced platform projection,
new participant roster/presence persistence, host reassignment/control endpoints,
production entry, React session/HUD, voice/chat, classroom split, hosted recovery
and device/capacity qualification remain unfinished. See
[room lifecycle](../games/voxel/docs/room-lifecycle.md).
The protocol-12 observer, creative, inventory and natural-TNT browser regressions
also pass, along with 22 SDK/school-policy, six school gateway and twelve actual
PostgreSQL/SDK cases. The creative jump reaches 1.303 blocks and records an
816.6 ms maximum sampled frame gap on software Chromium. That is functional
evidence with unresolved hardware/input/capacity qualification, not a release
performance verdict or replacement for all eleven earlier browser scenarios.


The subsequent session-projection build `717c40042171` keeps protocol 12 and the
same engine/bindings/content identities. Its complete gate passes 80 domain,
80 native (three upstream debug helpers ignored), 80 actual-Wasm and 35 scenarios
against each source/packaged server. The service passes 25 SDK/policy, six school
gateway and eighteen actual PostgreSQL/SDK cases. The isolated cluster was stopped
after testing. Accepted members are committed before worker welcome; observer
cameras never enter the roster or public presence. Ordered per-epoch projection
uses fresh database-clock checks after world, platform-session and control locks.
It derives profile names, reassigns a departed host to a remaining connected roster
member, expires crashed-owner presence and separates desired intent from public
paused status. Final empty presence follows the saved checkpoint and precedes
lease release; failure retains retryable retirement. Browser writes, including
legacy definer RPCs, are denied only for allocated new-stack sessions.

The real worker/SDK/database school workflow proves a newly accepted guest remains
a member through paused authorization renewal and a fresh paused reconnect;
Auth/PostgREST transport is a fixture backed by those real database rows. The
built two-client lifecycle browser also passes with the same release identity,
records fresh backward input in epoch 8, teacher ascent while world time is frozen,
terminal/no automatic readmission and complete disposal. One launch lacked the
existing temporary Chromium libraries; another run's evictable recent-input-tail
assertion failed. Both logs are retained. The final test records a separate fresh
epoch input receipt and keeps the real key held until that receipt, before testing
movement. This remains software-browser functional evidence, not a hardware or
performance verdict; earlier rendered archives retain their own build identities.

At the session-projection capture, migration `20261025020000` was locally tested
and not yet installed. The later React phase below verifies its user-applied
hosted installation; the archived capture retains its original scope.
The readiness tool now requires both schemas. Validated teacher/host commands and
audit, production entry, React session/HUD, moderation/chat, LiveKit, independent
classroom service, full hosted recovery and device/capacity qualification remain
open. No player, observer, object or room admission cap was introduced. See
[session projection](../apps/voxel-server/docs/session-projection.md).


The subsequent lifecycle-control release `faeeb224e6ce` passes the complete core
with 80 domain, 80 native (three ignored debug helpers), 80 actual-Wasm and 36
source plus 36 packaged integration cases. The service passes 31 SDK/policy/
startup tests, six school gateway cases and 22 actual PostgreSQL/SDK/native-worker/
production-composition cases. The shared lifecycle helper has two explicit
success/timeout tests. Startup now verifies packaged bytes and all three schemas
before listening, composes fresh school admission, projection and trusted
pause/resume/end APIs, supervises bounded cleanup and drains idempotently. It
uses shared Pino/lifecycle code and no prototype launcher or classroom routes.

Lifecycle commands serialize per room, recheck school/host/staff authority after
queueing/allocation and repeat fenced SQL checks under current database locks.
Stable request UUIDs preserve idempotence and ordered intent revisions. Pause/end
only report saved after a committed checkpoint and completion receipt. Staff
audit is transactional, cannot duplicate under retry, and completion rolls back
if an audit-row wait outlives the owner lease. Upload failure stays unconfirmed;
retry completes the same intent, and a completed end receipt replays after
terminal retirement without allocating a worker. A disconnect cannot retire a
room during its control/save acknowledgement. Shutdown timeout now exits with
failure through the shared helper. All new migrations remain local; there was
no deployment or remote schema/object/row write in this phase.

The built lifecycle browser passes with the same release identity and fresh
wire-epoch backward input, paused teacher flight, terminal/no automatic readmission
and resource disposal. A retained failed run showed valid backward motion with
a changed camera heading while the assertion assumed positive world Z. The final
test projects displacement onto the actual backward direction from its recorded
wire yaw, instead of requiring a particular world axis. This changes the test,
not physics or player state. It remains software-browser functional evidence.

At the lifecycle-control capture the production entry was locally qualified, not
deployed, and the projection/control migrations were not installed. The later
React phase verifies installation and implements the session/HUD. Remaining teacher teleport/mode/moderation,
chat, LiveKit/media enforcement, independent classroom service, hosted recovery,
survival/balance and real-device/network/capacity/cutover gates remain open.
There are no player, observer, object or room admission caps. See
[lifecycle controls](../apps/voxel-server/docs/lifecycle-controls.md) and
[production service](../apps/voxel-server/docs/production-service.md).


## React session and hosted installation

Release `133667cb44e7` wires the rewritten browser runtime into the existing voxel
catalog/play route through a new lazy React container and browser-only entry.
There is no old-runtime fallback. `VITE_VOXEL_RUNTIME_SERVER_URL` configures the
independent voxel service; the old classroom/RTC address remains separate until
extraction. Service-side scoped metadata and minimal diagnostic APIs use fresh
identity/profile/session reads without allocating rooms. Completed-session reads
require existing roster or staff authority. The browser makes no lifecycle,
roster or presence writes. Expired voxel presence displays empty, and voxel joins
no longer use the old game headcount field.

The Hebrew RTL surface owns abortable loading, low-frequency HUD delivery,
fullscreen/inventory/touch lifetimes, explicit input resume and save confirmation.
Staff observation stays hidden and participation switches require fresh admission.
A failed save stays unconfirmed and reuses its request UUID on retry. Terminal
state cannot trigger automatic admission. Mobile vitals follow the measured
header and clear every visible action; the fixture checks all nine touch controls
and real joystick motion. Keyboard exit while fullscreen and touch exits close
all three owned contexts. An earlier fullscreen mouse click timed out after the
browser reported a focused visible page; its cause is unproven. Its failure is
retained alongside the successful keyboard/touch result, without a general
pointer/hardware qualification claim.

On 2026-10-25 the user applied all three voxel migrations. Migration history
contains `20261025010000`, `20261025020000` and `20261025030000`; the configured SDK
and linked CLI target the same project. All three schema checks and the private
bucket check pass. Local loopback production composition against those hosted
schemas returns 200 for health/readiness, allocates no rooms and closes cleanly.
The agent made no remote schema, object or application-row writes in this phase.
These checks do not qualify hosted school admission, full checkpoint/worker
recovery, deployment or a live school journey. Historical evidence remains
unchanged. See [React integration](../apps/web/src/game/voxel/README.md).

At the React capture, trusted self-roster removal was the next exposed gap:
paused-card dismissal still reached a denied legacy RPC. The subsequent roster
phase below replaces that voxel path.
Remaining staff teleport/mode/moderation, chat, LiveKit/media enforcement,
independent classroom service, survival balance/bucket UI, hosted recovery,
real-device/network/capacity qualification and cutover/removal remain required.
The full rewrite goal stays active, with no player, observer, object or room-count
admission caps.


## Trusted roster departure

Release `34251aac77af` implements `POST /api/voxel/leave` and home rejoin-card
integration. Fresh identity determines the only removable actor. Departure works
outside recess and for a member's old partition without granting play authority.
Connected presence returns busy. A last member must wait for the normal saved
retirement and owner release; its later roster receipt has no saved claim. Empty
membership becomes terminal, while a nonempty host transfer derives aligned
names/grade from platform profiles. Missing-world removal creates guarded
metadata without a worker. Browser roles cannot read departure receipts, invoke
these RPCs or undo the revision through legacy writes.

Each successful departure increments a private roster revision. SQL membership
acceptance checks the owner, revision and short authorization proof after locks.
Old tickets cannot restore departed membership; actor and passive TNT-owner
renewals require accepted membership even in an open room. Eligible explicit
fresh admission can rejoin. An old idempotent departure receipt cannot remove a
later rejoin. Real socket checks verify revocation under the existing five-second
authority deadline. A policy-only TNT fixture initially lacked its active guest
in the accepted roster; that failed run is retained. The corrected fixture models
an already accepted guest, and separate real SQL/native-worker tests continue to
verify actual membership acceptance.

The final built browser passes trusted physical mouse press/release Exit,
fullscreen release, touch Exit, all nine mobile controls, stable save retry,
paused teacher flight, explicit resume/end, last-owner retirement and terminal
roster dismissal. Three contexts dispose their tracked GPU/worker/audio resources.
Earlier locator-click failures included both a delivered click with complete
teardown in about 40 ms and a run with no click events. A standalone DOM fullscreen
removal probe had no acknowledgement timeouts in eight attempts, so it does not
establish the cause. The harness now uses browser-level physical dispatch and
requires trusted events, one callback and disposal; protocol acknowledgement is
recorded separately. The final run acknowledges it. General hardware/OS-focus/
input performance qualification remains open; no product fix is inferred from a
test-driver change.

The new fourth migration `20261025040000` is locally qualified and has not been
applied by the agent. A fresh read-only hosted check confirms the first three
schemas and private bucket ready, with the roster RPC missing. Startup requires
all four schemas. There was no deployment or remote schema/object/application-row
write in this phase. Source/release/fixture bytes and retained failures are in the
new evidence archive. Staff teleport/mode/removal/bans/media audit, chat, enforced
LiveKit proximity/mute policy, classroom extraction, hosted recovery, survival
balance/bucket UI, device/network/capacity qualification and cutover/removal remain
required. The full goal stays active; no count-based admission caps were added.


## Staff mode and self-teleport increment

Release `66a9ff4dc9d4` implements the trusted control route, per-room serialized
staff dispatch, private SQL audit/receipts and independent worker deadline/revision
checks. Mode changes close views and invalidate action epochs before publication.
Teleport uses the worker's destination pose, clears old terrain/actor interest and
waits for collision readiness before explicit input resume. It never accepts
browser coordinates. Hidden staff remain absent from student replication. These
volatile gameplay acknowledgements have `saved: false`; ordinary checkpoints
capture mode/pose later, while pause/end retain committed-save guarantees.

A real actual-Wasm regression exposed dead-player ownership corruption when a
creative transition revived the readiness phase without health. The fix preserves
death across mode changes, reconnect and temporary observation; normal respawn in
either mode remains required. Tests verify conserved death drops, denied dead-owner
item acquisition, stale-command rejection and coherent checkpoint reconstruction.
A separate real SQL reproducer exposed admin-first precedence for dual profiles.
Migration five adds a private fresh profile resolver and replaces lifecycle begin
with matching school-profile precedence, preserving its existing grants and save
contract. Inactive and demoted dual profiles are denied; active teacher audit
identity remains teacher. Applied migration three is unchanged.

Final gates: 83 domain, 80 native/three ignored, 84 actual-Wasm, 38 source and 38
packaged integration; 36 SDK/policy, seven school gateway, 35 PostgreSQL; 89 web,
service/web types, production web boundary (41 modules/zero forbidden), three built
browser contexts. The isolated PostgreSQL instance is stopped. Evidence retains
both defect reproducers and the corrected positive checks. Fullscreen mouse input
acknowledgement succeeded in this run; historical failures remain unexplained.

At that staff capture the fifth schema was missing; the subsequent classroom
increment verifies its external installation. No migration was applied by the
agent. Remaining staff removal/bans/media enforcement,
chat, LiveKit, classroom extraction, survival balance/bucket UI, real devices,
network/load/capacity, hosted recovery and cutover/legacy removal retain their full
scope. No player, observer, object or room-count admission caps were added.


## Independent classroom service increment

`apps/classroom-server` now owns all 20 classroom HTTP routes and the extracted
attendance, presence, delegate, presenter, board-capability, moderation and media
helpers. Their previous files/routes and both timers are removed from
`apps/minecraft-server`; its remaining `/rtc/token` belongs only to legacy voxel
voice awaiting replacement. The classroom service has no gameplay socket, voxel
simulation or game package import. Actual compiled module loading and a frozen
route inventory verify this boundary; no room-count admission ceilings were added.

Account authority is freshly read, with school-profile precedence over duplicate
admin records. Startup performs bounded read-only Supabase base-table and LiveKit
API probes before listening; 30-second probes drive readiness afterward. Raw
signed webhooks precede JSON parsing. Attendance reconciliation and six-hour
cleanup cannot overlap themselves. Drain stops new work and timers, awaits owned
jobs/connections and shares the 60-second process deadline. A startup/shutdown race
is tested. Classroom media statistics exclude game rooms sharing the SFU project.

ClassroomPage, TeacherPage and the classroom admin explorer now require
`VITE_CLASSROOM_SERVER_URL` in production, with a separate development port 8083.
Board collaboration still uses the independent board service. The deployment
package and CI definition build just classroom and observability; Docker is absent
locally, so container construction/runtime is not claimed. Web routing, secure
delegate cookies, webhook signing and converter/board secrets must be rolled out
together and qualified against the hosted service before retiring deployments.

Final local checks pass 69 classroom, 32 observability, 120 legacy game and 19
board/drawing tests; 90 web tests, all affected typechecks and the actual production
web build pass. The native compiled classroom process serves real-SDK fixture
admission and drains on SIGTERM. Its integration checks exercise signed media and
board grants, presenter bootstrap/transfer, enforced source updates, guest rejoin
blocks, classroom/drawing closure, token revocation and signed attendance webhooks.
Those combined flows use fixture providers. Actual configured Supabase base-table
and LiveKit room-list API reads pass separately; no actual Auth/WebRTC/classroom
browser journey or hosted classroom mutation is part of this evidence.

The same read-only phase observes external installation of migration five. SDK
readiness, linked migration history, six exact function-body fingerprints/private
grants and target matching all pass. Guarded five-schema voxel loopback startup
passes health/readiness with zero rooms and no remote application writes. Earlier
staff/roster archives remain immutable historical records. The full goal still
requires staff removal/bans/media enforcement, persisted chat, voxel LiveKit
proximity/mute, authenticated catalog and hosted recovery, survival balance/bucket
UI, device/network/load/capacity qualification and cutover/legacy removal.

## Staff access moderation increment — 2026-10-26

Release `85b864f78689` adds durable remove/ban/unban with no room allocation or
owner lease needed for an offline policy change. SQL rechecks staff/profile,
game, deadline and target under locks; audit and policy commit together. Retry
receipts cannot evict a later fresh admission. The gateway fences admission IO
that was already in flight when moderation committed. Removed actors lose old
participant/owner/host proofs until explicit accepted re-entry; other connected
participants can renew across unrelated roster changes.

A negative test reproduced an old ticket reviving after self-removal and later
membership restoration; ticket revalidation now retains its original roster
generation. A second negative SQL test found that redundant unban suspended an
otherwise valid actor; no-op unban now preserves its policy generation. Actual
SQL tests include deadline expiry after row/audit waits, no partial audit,
role/grant denial, presence filtering, never-allocated worlds, offline-owner
bans and real-SDK lost-response retry through a packaged worker. Browser fixes
in this increment concern test assertions: retain the last successful epoch across
rejected joins and validate intentional `BANNED` replies from periodic session
reads. An earlier end-confirmation/browser-close failure remains retained with
unproven cause. Full gate counts and scope are in the current evidence section.

Gameplay access moderation is implemented; the rewritten LiveKit adapter and
server-enforced voice grants/mutes remain unfinished. No voice-ban enforcement
is claimed. Persisted moderated chat, actual authenticated school/catalog and
hosted recovery, classroom hosted/browser/WebRTC/container qualification,
survival balance/bucket UI, device/network/capacity and cutover/legacy removal
remain required. No player, observer, object or room-count admission caps exist.

## Persisted chat increment — 2026-10-26

Release `bedd62f9b37b` adds a private server actor-proof port used by the platform
chat adapter. The port reads live gateway authorization and durable ownership
without allocating rooms or exposing simulation objects. Posting repeats fresh
Auth/recess policy and binds the original connection through the asynchronous
read. SQL serializes with admission/moderation/lifecycle, checks the owner and
admission cutoff and rejects stale, banned, pending-readmission or terminal posts.
A rostered hidden teacher cannot impersonate a live participant. Chat persists
independently of world saves and remains available for staff supervision after
retirement; readers and moderators need no new worker or owner lease.

The seventh migration adds private messages/request receipts and service-only
history/send/delete/clear/status RPCs. Replies bind UUID/action/target and never
echo a deleted body. Server-derived names, 500 Unicode characters, canonical
sequences and bounded history pages share strict validators. History supports
older pages without a stored-message or user-count cap. Role/profile locks and
proof rechecks roll back mutations/audit after expired waits. One stable UUID
cannot duplicate a post or repeat a prior clear against new messages.

The owned RTL dialog polls only while open/visible, aborts stale scope requests,
escapes message text and keeps unconfirmed writes on an explicit same-ID retry.
Opening it pauses local input without pausing world time. The final browser flow
verifies send/retry, reopen, a literal HTML-shaped string, hidden-staff read-only
view, delete and clear, subsequent lifecycle saves and complete teardown. Initial
retry prompt markup combined status text and controls; they are now separate.
A subsequent fullscreen mouse Exit timeout remains retained without proven cause;
the instrumented rerun passes with trusted events and acknowledged dispatch.
The full gate counts and hosted missing-schema observation are recorded above.

Rewritten LiveKit proximity and server-enforced mute/media revocation, actual
school/Auth/catalog/hosted recovery, classroom rollout/browser/WebRTC/container,
survival balance/bucket UI, real devices/network/capacity and full cutover/legacy
removal remain required. This is not the completed rewrite or a deployed service.

## Voice foundation in progress — 2026-10-26

Current source adds a semantic runtime voice scene: absolute listener/actor poses,
correct camera forward/up axes, 32-unit proximity gain and native shape-aware
line-of-sight attenuation. No renderer, engine or SDK handles cross that port.
Preparing, ended, stale, disconnected or hidden-document scenes produce no audio
scene. Two targeted tests cover origin translation, occlusion, malformed/native
failure and 257 actors without a count cap. Game/web types pass; this work has
not received a new complete matched release build.

The independent WebAudio mixer owns one output mix, spatial/filter/gain nodes and
its output stream, while the media transport retains remote-track ownership.
Three real Chromium cycles with generated MediaStreams measure near RMS about
0.037 and occluded RMS about 0.0068, suppress distant/muted/unavailable scenes,
preserve large-origin gain, replace/remove tracks without leaks and close every
owned node/output/context. Late activation after close returns inactive. This
functional graph check does not use an SFU/microphone or qualify a physical audio
device, browser permissions, output routing, performance or media enforcement.
The adapter is not wired to product LiveKit/UI yet. The configured provider's
cached-token bypass baseline and the subsequent signaling proof are recorded
below; school-issued grants, SQL mute policy and product reconciliation remain
required.

### Private signaling transport qualification

The configured LiveKit 1.12.0 Standard/protocol 17 accepts cached original and
refreshed tokens after permission revocation. The isolated baseline in
`games/voxel/evidence/voice-provider-baseline/` retains that failure. The new
transport keeps reusable provider credentials in an independent backend worker
and gives browsers single-use opaque tickets. It sanitizes compressed SDK joins,
rejects metadata/source forgery and provider-directed migration, strips token
refresh frames and independently expires each authenticated upstream connection.
Bounded per-connection message queues do not impose actor or room count caps.

The real-provider run in `games/voxel/evidence/voice-signaling/` passes publication,
opaque-ticket replay through relay/direct SFU, forced listen-only rejoin,
historical-cutoff retry, noncooperative publication rejection and expiry while
the gateway event loop is blocked. A separate API witness observes the participant
absent before the gateway unblocks. Four refreshed tokens are filtered; no
backend credential reaches the browser. Generated audio contexts close and the
unique temporary room is deleted with absence verified. Seven focused tests and
strict service types pass. Earlier failures are retained; HTTP 400 exposed lost
base64 padding in rewritten joins, now covered for all three encoded lengths.

This is transport evidence, not school Auth/SQL/UI or deployment qualification.
No school database writes or user microphones are involved. Whole-host loss and
total upstream isolation need separate failure bounds. SQL media policy, audited
teacher controls, hidden-observer privacy, fresh school-bound grants and product
LiveKit/audio integration remain unfinished. The full rewrite scope above remains
required, and no new complete matched game release is claimed.

### School media backend and latest main merge

Migration eight adds private room/actor mute revisions, audited stable-UUID
commands, staff views and service-only authorization bound to the live world
owner, original gameplay admission and immutable media cohort. Global student
mute composes with individual mute and leaves staff supervision available.
Hidden staff grants are listen-only. Old grants cannot revive through delayed
policy IO: the signaling relay retains a five-second cutoff barrier across issue
and asynchronous consumption. Eight signaling tests and eight real SQL policy
tests pass. A ninth SQL/native actor integration passes with real SDK transport,
lost committed mute response, same-ID retry, a fresh listener, signed hidden
staff grants and media expiry after gameplay departure. Auth and SFU transport
in that integration are explicitly local fixtures. An initial fractional ticket
timestamp failure is retained; public deadlines now round down to milliseconds.

The current game build is `2140097fdcb8` (runtime hash `6a04d44e32a7`). Its full
core check passes: 91 domain, 80 native Rust (3 ignored), 84 Wasm and 41 source
plus 41 packaged integration tests. The SDK/policy suite passes 46 tests. The
full SQL regression has 58 passes and one control-flow socket timeout; the exact
control file passes all three tests in isolation, with no proven cause or full
rerun pass yet. Both observations are retained in `/tmp/voxel-media-*` logs.
The browser coordinator and opaque ticket/moderation API are implemented in
source; the coordinator is not yet wired into a product voice panel or qualified
through its full browser/device/reconnect flow. No complete voice release is
claimed. The prior immutable transport archive remains a narrower proof.

At the user's request, main `9b82587` merged as `b0ccf90`. The local tracked and
staged patches and all 1,698 untracked rewrite files matched their pre-merge
bytes. The incoming grade migration is
`supabase/migrations/20261026162928_add_kindergarten_and_grade_nine.sql`.
Post-merge web types and all 180 web tests pass. The user reports the media
migration pushed; read-only status checks on 2026-10-26 pass all eight voxel
schemas and the private bucket. Exact hosted media bodies/grants and new
guarded production startup still need qualification. No agent applied the grade
or media migration. Full school/hosted recovery, classroom, device/capacity and
cutover gates remain open; there are no count-based admission caps.

## Product voice panel increment — 2026-10-26

The coordinator is now wired into the Hebrew game voice dialog: explicit listening
and microphone activation, local output mute, output selection, hidden staff
listening and audited student mute/unmute controls. Unconfirmed policy replies
retain one UUID for explicit retry. Reconnect uses a fresh opaque ticket and
keeps the microphone off. Background/unavailable scenes stop capture; temporary
game recovery retains listening intent, while terminal/unmounted surfaces close
the owner. Late permission/activation completions cannot revive a stopped owner.

The actual panel/coordinator/SFU check passes with three isolated browser contexts
and generated audio. Near RMS is about 0.040, occluded about 0.0047, distant and
output-muted zero. Hidden staff are absent from peers' SDK lists. Forced provider
removal reconnects with no automatic microphone; policy retry uses the same UUID;
simulated background/game-scene loss stops capture; late capture tracks stop and
late audio activation issues no admission. Every owned audio node, input driver,
output, microphone and timer is released at teardown, and the temporary SFU room
is deleted with absence checked. School policy and game poses in this specific
browser test remain explicit fixtures; they are not actual Auth/game/SFU coverage.

This test exposed real silent remote audio despite received RTP, a live enabled
track and unit gain. A controlled playing media element made the same mix audible.
The mixer now owns volume-zero input drivers; all audible audio remains in the
spatial output. Three separate graph cycles still pass and preserve ownership of
remote tracks. Pending driver playback no longer reports a rejected autoplay.
Negative attempts and the initial direct-browser lost-reply timeout are retained;
the final UI fixture uses the production service's explicit unconfirmed response
after a committed policy, rather than claiming that raw TCP-loss case was fixed.

All 180 web tests, web types, current-source game release verification and the
production web build pass. All 59 SQL regressions pass in a standalone rerun;
the earlier control socket timeout remains retained without a proven cause.
The full React/game/SQL regression currently reproduces the previously intermittent
fullscreen mouse Exit cleanup timeout: the trusted click reaches Exit, the surface
unmounts, fullscreen clears and the runtime is disposed. An instrumented rerun is
in progress to identify the remaining audio/worker state. No fix or pass is claimed.

Read-only hosted catalog comparison matches all six media function bodies/grants,
three private tables, columns and constraints to a fresh local installation.
Migration eight SHA-256 is
`d58069e7469913cc7402fb8366297f739b8fe3971f82db18fca5cd83c6ac457d`.
All eight migration versions and the grade migration from merged main are recorded
on the matching CLI/SDK project. The agent applied neither migration. Guarded
new-release startup and immutable media evidence capture remain to do, along with
complete real school/hosted recovery, classroom, device/capacity and cutover gates.

The instrumented full React/native-game/SQL rerun subsequently passes with trusted
mouse dispatch acknowledged, all five dialogs closed, fullscreen released and
three zero-geometry/texture/worker teardowns with closed effects audio. This does
not establish a cause or fix for the retained intermittent Exit timeout. Guarded
startup of `2140097fdcb8` against the hosted eight schemas passes using exactly
eight status RPCs, health/readiness 200, zero rooms and no application writes.

The immutable `games/voxel/evidence/media/` archive captures 469 source inputs,
12 published game release files, a 2,697-file production web inventory and 523
artifacts including passing results, exact installation audit, startup and retained
negative attempts. Independent archive/source/release/web inventory audit passes.
Verification SHA-256 is
`280f27bb8791101c62b6ba0ef8d6fa0902cb95769743b917879baa4b424a3b6e`;
`apps/voxel-server/test-results/media-increment.json` is the separate pointer.
The archive explicitly excludes a final standalone web bundle and complete actual
Auth/game/SFU composition. This is a qualified local media increment, not the
completed rewrite or a deployment. The isolated local PostgreSQL cluster is stopped.

## Composed media and lifecycle correction — 2026-10-27

The actual React/native packaged game/local PostgreSQL/configured LiveKit flow
now passes together on game build
`5d89f56af88a8d1a456575052791a13f560bef75acac7144ebcb19882ced7247`.
Generated microphone audio is measured through the product mix using native
listener/source poses. The flow verifies hidden listen-only staff, distance
subscription removal after real teacher travel, SQL mute with a lost committed
reply and same-request retry, explicit joining without automatic capture,
student moderation rejection, and provider-confirmed removal of the banned
identity. Pause/save retry, chat/moderation, resume, end, trusted mouse/touch Exit,
and all three zero-resource browser teardowns pass. The unique SFU room is
deleted and its absence verified. Auth/PostgREST/Storage remain local fixtures;
no hosted school data is written.

This work fixes two independently verified product defects. Authoritative end
metadata now releases the surface's owned runtime and input controls, including
an asynchronous mount, even if its native socket disconnected before the end
message. End releases game and voice audio, workers, geometry and textures before
Exit. Pending control receipts retain their own lifetime until unmount. A real
Wasm/input-queue regression also reproduced same-epoch resync reusing input 3
after inputs 1–8 had already been transmitted. Prediction now preserves its
sequence counter within an epoch while resetting for a new epoch. The regression
fails before the correction and passes afterward with the existing delayed
snapshot/equipment invariants.

The combined test exposed expensive local transport fixtures: every school query
launched a new `psql` process. Asynchronous school reads and a test-only pinned
PostgreSQL pool preserve real SQL, role isolation and error codes without that
per-query process overhead. Role-isolation/error-code tests pass. In the passing
composition the slowest measured query is 79 ms and maximum gateway event-loop
delay is 124 ms; failed subprocess-based runs include 1–2-second queries. This
supports the fixture correction, not a physical-device performance claim or a
proven explanation for every earlier input/Exit timeout. Production authority
deadlines and admission behavior are unchanged; retained negative runs remain
unqualified.

The rebuilt full game gate passes 91 domain, 80 native Rust (3 ignored), 85 Wasm,
41 source integration and 41 packaged integration tests. All 61 SQL tests pass,
including the two new pool regressions. The previous immutable media archive
continues to describe its earlier source/build; it is not rewritten to claim
these newer results. Complete actual school Auth/catalog and hosted recovery,
classroom rollout, survival progression/bucket UI/balance, physical device and
network/capacity qualification, product ratification and cutover/legacy removal
remain required. The rewrite remains active and incomplete.

All 180 web and 46 service tests, web/service types, production web build and
current-source release verification also pass. Guarded startup of this rebuilt
release uses exactly eight hosted status RPCs, returns health/readiness 200,
allocates zero rooms and closes without application writes. The separate
`games/voxel/evidence/media-composition/` archive records this increment and
retains earlier failed composition attempts. It is not a standalone hosted app
deployment or a final production web bundle. The isolated test database is
stopped after qualification.

## Natural iron and reusable bucket browser qualification — 2026-10-27

The seed-4242 route now earns a bucket from empty survival inventory through
ordinary play: six natural logs, Hebrew workbench/tool crafting, river stone,
three mined iron ore, an earned-block shaft exit and charcoal refining. Touch
Build fills, places and recollects water, with same-slot container replacement,
unchanged other stacks and a filled-bucket reconnect. A same-identity desktop
handoff then collects/places the water using trusted OS mouse movement under
pointer lock, keyboard selection and two right-clicks. Touch ownership advances
114→118, desktop ownership 118→120; water edits explicitly alternate air and
compiled water state 116. Both clients release all owned geometry, textures,
workers and audio. Browser errors are empty.

The browser helpers handle ordinary shaft centering, pickup jumps and incidental
held mining using observed authoritative edits. They do not inject inventory,
world edits or positions. Headed Chromium uses an isolated X display and XTest
input. A missing private `libX11-xcb` dependency caused the retained WebGL startup
failure; a traced missing-library lookup and a subsequent successful WebGL2 probe
support that correction. No gameplay/runtime change is needed for this increment.
The existing inventory/crafting/chest/equipment/reconnect browser regression,
game types and current-source release verification also pass. The game remains
build `5d89f56af88a8d1a456575052791a13f560bef75acac7144ebcb19882ced7247`.

The separate `games/voxel/evidence/bucket-browser/` archive preserves the final
report/screenshots/test sources, earlier touch-only passes, retained negative
attempts and OS-input/tool provenance. Previous release archives remain intact.
This closes the local bucket UI route for one generated seed on software
Chromium. Natural extended progression across seeds, resource/yield balance,
readable filled-bucket presentation from all useful angles, actual school Auth
and hosted recovery, classroom rollout, physical devices/networks/capacity,
product decisions and cutover/legacy retirement remain open. No player, observer
or room admission caps were introduced. The full rewrite remains incomplete.

## Hosted journey preflight and approval boundary — 2026-10-27

Read-only checks pass all eight hosted schemas/private bucket, matching
browser/server project configuration and the active voxel catalog entry. A
reviewable [hosted school/recovery runner](../apps/voxel-server/docs/hosted-school-journey.md)
now covers two temporary synthetic identities and one private session: actual
Auth/RLS admission, natural mining, committed private checkpoint validation,
service restart, exact earned ownership, historical control replay and live
account revocation. Its guard confines provider work to the test IDs/namespace
and refuses global maintenance. Cleanup uses marker-checked SQL and Auth deletion.

All 50 service unit tests, strict types, two actual local SQL cleanup regressions
and the packaged-worker natural mining/restart driver pass. The SQL checks prove
unrelated rows survive and changed ownership/invitation aborts cleanup. A driver
timeout exposed its incorrect demand for focus in a restored paused world; the
driver now respects pause. No runtime correction or new game release is claimed.

Automatic approval review rejected hosted execution because those specific
Auth/profile/session/audit/checkpoint/Storage writes and deletions lack explicit
user authorization. That command did not execute; no hosted gameplay/recovery
pass is claimed. Explicit approval is required for this prepared run. This is
the first occurrence of that approval blocker, not a blocked full rewrite: local
implementation and qualification remain possible. The local database is stopped.

## Held bucket visibility and narrow viewport correction — 2026-10-27

Actual GPU rendering reproduced the presentation concern left by the first
bucket route: empty and filled buckets have identical pixels at rest at all
three measured viewports, and the portrait screenshot crops almost the whole
model at the right edge. The bucket now tilts its opening toward the camera,
keeps its forward swing within view and anchors/scales held items to the available
horizontal room. At aspect ratios of at least 4:3, other held-item poses retain
their existing transform. Simulation, container ownership, engine, content and
protocol are unchanged.

The six-case renderer check passes at 900×650, 390×780 and 768×1024, idle and
swing, with actual native procedural textures. At rest it measures 3,410, 3,285
and 5,113 filled-only blue pixels respectively, versus zero before. The shell
has a visible horizontal margin, the reticle remains clear, repeated switching
leaves zero stale pixels and geometry/texture ownership returns to zero. The
intermediate stricter framing failure and original screenshots are retained.
The new check is included in the voxel CI workflow.

Matched game build
`be31826802e0d7ea54bf7f6c8cdbb873e79e9ff217f87bbc21df18431d64d520`
passes the full core gate: 91 domain, 80 native Rust (3 ignored), 85 Wasm and
41 source plus 41 packaged integration cases. The natural empty-inventory bucket
route passes again with touch/reconnect and trusted OS desktop reuse, conserving
ownership and releasing all owned resources. All 50 service and 180 web tests,
strict service/web types, production web build and current-source release
verification pass. Guarded startup passes exactly eight read-only hosted status
RPCs, health/readiness 200 and zero rooms. An initial invocation omitted shared
voice configuration and failed before listening; the configured retry passes.

The separate `games/voxel/evidence/held-bucket/` archive records current release
bytes and before/after results. Earlier immutable archives keep their original
source/build scope. The private X display is stopped after verification. This
increment does not qualify physical hardware or recompose actual hosted
Auth/game/SFU. That hosted write run remains pending explicit user approval after
automatic approval review rejected its Auth/profile/session/checkpoint/Storage
creation/deletion. Extended progression and balance, full school/classroom
recovery, device/network/capacity qualification, product decisions and cutover/
legacy retirement remain required. The full rewrite stays active and incomplete.

## Snapshot scaling and backpressure correction — 2026-10-27

The maintained [server scaling measurements](../games/voxel/docs/server-scaling.md)
now cover dense survival motion and an equipped crafting/drop/TNT scene at
16/32/64/128 actors, with three alternating before/after pairs per workload.
The room reuses actor-delta computation across identical viewer baselines; the
worker reuses their encoded JSON within one snapshot pass. Visibility remains
per viewer and private self is encoded independently. All 24 paired wire hashes,
byte counts and message counts match. On the local two-core ARM host, median
p95 at 128 actors improves from 31.44→14.10 ms for dense motion and
48.79→35.25 ms for the activity scene. The heavier 64/128 profiles still miss
the proposed 10 ms p95 budget. This is comparative compute evidence, not final
school capacity qualification; no admission caps were introduced.

Review also reproduced a gateway defect: silently dropping unsent deltas above
64 KB can permanently lose a final actor change, and snapshot-only traffic can
skip the hard output-budget check. Ordered deltas now share the existing 1 MB
recovery budget. Exceeding it logs one bounded recovery event and closes only
that connection for fresh-baseline readmission. Both deterministic-pressure
regressions fail before and pass afterward with real sockets/native workers,
including the packaged gateway. Actual impaired-network qualification remains
separate from those injected-pressure cases.

Final matched build
`5886a6dc973378530fbe79b71c007eccfdd440fdbde064dc3cd2938ea363aa57`
passes 94 domain, 80 native (3 ignored), 86 Wasm and 43 source plus 43 packaged
integration cases. Real loopback profiles 1×16, 1×32, 1×64, 1×128, 2×32 and 4×16
complete at about 30 Hz with no resync or reported dropped simulation time;
all clients and workers close. Final 128-player input-ack p99 is about 156 ms
in the co-located driver, not a school-network result. The earlier CPU comparison
keeps build `87695b80ba09`; measured room/encoder/engine/content bytes match the
final release, and reconstructing that prior runtime with its old gateway passes.

Actual peer-rendering/origin-shift/held-shape browser checks, all 50 service and
180 web tests, strict types, production web build, current-source release
verification and guarded eight-read-only-status/zero-room startup pass. The
separate `games/voxel/evidence/snapshot-scaling/` archive preserves these phases
and the original failures without rewriting previous archives. Sustained richer
worker workloads, longer memory/capacity and real device/network qualification,
hosted Auth/recovery and classroom rollout, product decisions and cutover/legacy
removal remain open. Hosted writes still await the earlier explicit approval;
the overall rewrite remains active and incomplete.

## Worker timing distributions — 2026-10-27

Actual room workers now report bounded ten-second distributions for individual
world steps, paused observer-clock steps, full worker turns, successful generation
jobs and supervisor commands. Catch-up steps are sampled separately; world-step
counts match ticks. Empty paused windows cannot masquerade as free world steps.
Fixed 0.05 ms buckets through 200 ms and conservative overflow quantiles retain
no individual samples or player data. Metrics use actual elapsed windows and flow
through the existing gateway/service log path. No admission caps were added.

Matched release
`3ea11984a11a76d7d2993a55a882ed985827a6d1440e3336f3e8cf0612f5f508`
passes 97 domain, 80 native (3 ignored), 87 Wasm and 44 source plus 44 packaged
integration cases, including three actual worker reporting windows. All 50
service and 180 web tests, strict game/service/web types, production web build,
two-client browser cleanup, release verification and guarded eight-read-only-RPC,
zero-room startup pass.

Six isolated packaged loopback layouts finish near 30 Hz with no skipped driver
batches, resyncs or reported dropped simulation time, and all clients/rooms close.
Maximum room world-step p95 upper bounds are 2.25/4.10/9.75/20.50 ms for
16/32/64/128-player rooms, 5.20 ms for 2×32 and 2.60 ms for 4×16. The
128-player maximum is 104.99 ms and its input-ack p99 is 72.77 ms. These short
local movement samples include startup/warmup in worker windows and do not
qualify heavy activity, school networks or production capacity. In particular,
128-player p95 still exceeds the proposed 10 ms target.

[Worker timing documentation](../games/voxel/docs/worker-timings.md) and a separate
`games/voxel/evidence/worker-timings/` archive retain scopes, release bytes and
results. The completed single-pair diagnostic CPU profile keeps its preceding
`5886a6dc9733` identity and includes untimed harness work; it is not relabeled as
current-release performance. Heavy survival/scaling, sustained device/network/
memory and IO qualification, real school Auth/recovery/classroom journeys,
product decisions and cutover/legacy retirement remain required. The hosted-write
run still awaits explicit approval after automatic review rejected its temporary
Auth/database/Storage writes. No migrations changed; the rewrite remains active.

## Subscription/drop reuse and repeated worker measurements — 2026-10-27

Subscriptions now reuse the complete nearby-column set within a column, resetting
on disconnect/teleport and creating fresh state on reconnect. Explicit resync and
edit publication stay independent. Normal steps reuse the already-read actor
state. Drop replication shares immutable public views until their revision changes;
pickup queries retain owned copies. Filtering remains per viewer, old messages
stay immutable, and weak keys/dispose avoid retaining removed bodies. No admission
caps were added.

Matched release
`6b20c88f7d8c9e7b6158c26d02524c24a419cc03b5fc9b2d53a90c083066da47`
passes 99 domain, 80 native (3 ignored), 88 Wasm and 44 source plus 44 packaged
integration cases. All 50 service and 180 web tests, strict types, production web
build, actual peer browser cleanup, release verification and guarded eight-status,
zero-room startup pass.

All 24 direct before/after pairs against the preceding instrumented release
preserve exact recipient-ordered wire hashes, bytes and counts. Three-repeat
median p95 at 128 players falls 14.29→11.40 ms for dense motion and
35.99→29.00 ms for crafting/drops/TNT; 64-player activity falls 14.00→10.52 ms.
These larger workloads still miss the proposed 10 ms p95 target.

All six packaged loopback layouts complete near 30 Hz with no skipped input batches,
resyncs or reported dropped time, and all clients/rooms close. Their 128-player
world-step p95 upper bound is 26.20 ms, higher than the previous single recorded
window. Three additional alternating archived/new release pairs show overlapping
before 22.50–30.55 ms and after 20.45–29.10 ms ranges, medians 28.85→26.10 ms,
with one slightly slower after sample. Every sample is retained. This variance
precludes a robust real-room speedup/capacity claim from these short startup-inclusive
windows; it does not override the repeated direct compute comparison.

[Measurement scopes and commands](../games/voxel/docs/room-reuse.md) and the separate
`games/voxel/evidence/room-reuse/` archive record exact releases and results.
Heavy survival/scaling, sustained worker/IO/memory/device/network qualification,
actual hosted Auth/recovery/classroom journeys, product decisions and full cutover/
legacy retirement remain open. The separate rejected hosted-write test still
awaits explicit approval. No migrations changed; the full rewrite remains active.

## Drop JSON reuse and authoritative steady worker windows — 2026-10-27

Worker encoding now shares immutable public drop JSON across viewers/passes,
with weak keys and normal serialization for mutable/shallowly frozen inputs.
Reset/removal/filtering and private inventory stay independent. Exact recipient
wire output matches across all 24 repeated before/after pairs against the prior
room and its own encoder. Activity p99 improves 14.91→11.38 ms at 64 players
and 36.61→30.30 ms at 128; corresponding p95 improves only 10.63→10.44 and
28.60→27.48 ms. Movement p95 is effectively unchanged. The remaining larger
workloads still miss the proposed 10 ms p95 budget; no admission caps were added.

Metrics now carry actual monotonic reporting bounds. The socket benchmark defaults
to a 25-second endpoint sample and keeps all windows, selecting only fully
contained intervals for its separate steady distribution. Every room in all six
layouts has complete coverage. Maximum room steady p95 upper bounds are
1.15/2.15/7.45/24.00 ms at 16/32/64/128 players, 3.45 ms for 2×32 and 1.35 ms
for 4×16. The 128-player all-window p95 is 25.35 ms; startup does not fully explain
its cost. All profiles run near 30 Hz without input batch skips, resyncs or
reported dropped time, and every client/room closes. These single co-located
movement samples do not establish an encoding-specific worker speedup or capacity.

Matched release
`937183f45298044f5c58f4d985c4b55ff77a5b3dd90e7a2ccaee44be4f2ef788`
passes 103 domain, 80 native (3 ignored), 88 Wasm and 44 source plus 44 packaged
integration cases. All 50 service and 180 web tests, strict types, production web
build, actual two-client browser cleanup, release verification and guarded eight
read-only status/zero-room startup pass. A diagnostic profile retains its preceding
`6b20c88f7d8c` identity, including untimed harness work.

[Scopes and measurements](../games/voxel/docs/drop-encoding.md) and separate
`games/voxel/evidence/drop-encoding/` evidence preserve all samples, source/release
identities and startup/steady distinctions without changing prior archives.
Heavy survival/scaling, sustained worker/IO/memory and physical device/network
qualification, real hosted school Auth/recovery/classroom journeys, product
decisions and full cutover/legacy removal remain required. The separately rejected
hosted-write test still awaits explicit approval. No migrations changed; the
rewrite remains active and incomplete.

## One-pose snapshot passes and conservative visibility shortcut — 2026-10-27

Snapshot construction captures one raw pose per connected actor for that
synchronous pass. Playing actors reuse the quantized public body for their own
self; private epoch/ack remain per viewer. Other phases retain self without public
admission. Dense neighbors use a conservative radius-47 Manhattan interior shortcut;
all other cases keep the original radius-48 hypot comparison. Quantization, circle
boundaries, hidden staff and actor ordering are unchanged. No admission caps.

An actual-Wasm differential journey matches exact preceding per-viewer histories
through interior/axis/diagonal/quantization boundaries, preparing actors, hidden
staff, paused replication and historical message retention. All 24 repeated direct
survival pairs match exact recipient-ordered wire hashes, bytes and message counts.
Median p95 at 128 players improves 11.21→9.73 ms for motion and 26.86→25.74 ms
for activity; 64-player activity improves 10.12→9.70 ms, with one after run at
10.08 ms. Larger activity and actual-worker costs remain over the proposed budget.

Matched release
`dc0be6db305ecd9b23c809e7fa9e9c370b354d04847ae31bbaa0461188235e86`
passes 103 domain, 80 native (3 ignored), 89 Wasm and 44 source plus 44 packaged
integration cases. All 50 service and 180 web tests, strict types, production web
build, actual two-client browser cleanup, release verification and guarded eight
read-only-status/zero-room startup pass. The first service check overlapped game
compilation and correctly rejected partial artifacts; its two failures are kept
separately, and stable-release verification plus the full service rerun pass.

All six packaged loopback layouts have complete steady-window coverage and run
near 30 Hz without skipped input batches, resyncs or reported dropped time; all
clients/rooms close. Maximum room steady p95 upper bounds are
0.95/1.95/6.60/20.25 ms at 16/32/64/128 players, 3.10 ms for 2×32 and 1.05 ms
for 4×16. The 128-player endpoint ack p99 is 99.54 ms. These single co-located
movement samples do not establish a controlled worker speedup or school capacity.

[Scopes and commands](../games/voxel/docs/snapshot-pose.md) and separate
`games/voxel/evidence/snapshot-pose/` evidence preserve exact sources/releases,
comparisons and every worker window without changing the prior archive. Only
GameRoom changes inside the runtime source tree. Heavy survival/scaling, sustained
worker/IO/memory/device/network qualification, actual hosted Auth/recovery/classroom
journeys, product decisions and full cutover/legacy removal remain required.
The rejected hosted-write test still awaits explicit approval. No migrations
changed; the full rewrite remains active and incomplete.

## Persistent visibility membership and actual-thread profiling — 2026-10-27

An actual packaged 128-player diagnostic profile of the preceding release records
both gateway/load-client and room threads. Snapshot construction remains a major
room cost (about 3.39 sampled seconds), while the main thread also spends material
time in writes (4.88) and the client receive callback (4.56). These startup-inclusive
sample attributions include scheduling/profiling effects and are not final capacity.

Per-viewer actor membership maps now persist between passes. Fresh public-state
references mark visited members; unique-ID count equality skips stale scans only
when every retained entry was visited. Membership changes restore connected order
for later removals and teleport resets. Exact actual-Wasm histories match through
re-entry, simultaneous removals, trusted teleport, circle/quantization boundaries,
preparing actors, hidden staff, pause and historical message retention. No caps.

Final release
`543c9f288891986e003ce4b2e51c63177c38c14601f4ac8c3b6b1144fd0c3077`
passes 103 domain, 80 native (3 ignored), 89 Wasm and 44 source plus 44 packaged
integration cases. All 50 service and 180 web tests, strict types, production web
build, actual two-client cleanup, release verification and guarded eight-read-only
status/zero-room startup pass. Only GameRoom changes in the runtime source tree.

All 24 final repeated direct pairs preserve exact recipient wire hashes, bytes
and counts. At 128 players median p95 improves 9.80→8.73 ms for movement and
25.97→25.29 ms for fixture activity; smaller/tail samples include slower results.
The initial `70c5672eebc1` variant's modest/mixed 24-pair results, room source,
release and core bytes are also kept. The final refinement skips the common-case
scan; the two result sets retain their actual identities and scope.

All six actual-worker layouts have complete steady coverage, run near 30 Hz with
no input batch skips, resyncs or dropped time, and close all clients/rooms. Maximum
room steady p95 upper bounds are 1.00/1.80/5.05/18.25 ms at 16/32/64/128 players,
3.65 ms for 2×32 and 1.00 ms for 4×16. The 128-player ack p99 is 116.61 ms.
These single co-located movement samples are not a controlled worker comparison
or school capacity; actual school identity/IO and physical device/network loads
remain unqualified. Heavy activity and larger worker timing still exceed targets.

[Scopes and commands](../games/voxel/docs/visibility-reuse.md) and the separate
`games/voxel/evidence/visibility-reuse/` archive retain all phases and exact bytes
without changing earlier archives. Sustained rich survival/IO/memory qualification,
actual hosted Auth/recovery/classroom journeys, physical devices/networks, product
decisions and full cutover/legacy removal remain. The rejected hosted-write run
still awaits explicit approval. No migrations changed; the rewrite remains active.

## Sustained packaged survival and autosave recovery — 2026-10-27

The unchanged matched release
`543c9f288891986e003ce4b2e51c63177c38c14601f4ac8c3b6b1144fd0c3077`
now passes a 180.06-second two-room/eight-UUID-actors-per-room survival workload
through packaged gateways/native workers. Ordinary controls/actions complete 53
rounds, 848 mining/replacement cycles, 850 crafts, 424 contested chest races with
exactly one winner/conflict each, 1,274 cached replays, 184 food uses and 288 hits.
Both rooms pass 12 committed readbacks checking token conservation. Largest sampled
durable lag is 15 seconds; zero input batch skips, resyncs or dropped time.

Forced termination after committed pause restores exact inventories/revisions and
health under newer epochs; all 16 old-epoch craft replays are rejected. Both rooms
resume and craft again, commit and close. All 32 connections close, with zero rooms
or waiters retained. The 34 contained worker windows have maximum world p95/p99
upper bounds 0.80/1.45 ms; maximum client ack p99 is 45 ms. These are local bounds
for this sample, not pooled percentiles or school-capacity qualification.

CI now runs a shorter two-room 30-second autosave/recovery case and independent
report validation. The exact commands pass; strict game types and release/source
verification pass. Runtime sources and all 12 release files match the preceding
full qualification; its native/Wasm/service/web/browser checks were not rerun for
these tooling changes. Initial failed driver attempts are preserved separately.

[Workload scope and commands](../games/voxel/docs/sustained-survival.md) and separate
`games/voxel/evidence/sustained-survival/` evidence record fixture-owned kits and
prepared work platforms, in-memory metadata and delayed in-memory object operations.
Actual hosted Auth/SQL/Storage journeys, richer progressive survival/IO capacity,
travel/heap plateau, physical devices/networks, product decisions and full
cutover/legacy retirement remain. The rejected hosted-write run still awaits
explicit approval. No migrations changed; the rewrite remains active/incomplete.

## Repeated browser travel/reconnect owned resources — 2026-10-27

The unchanged `543c9f288891` release now has a six-cycle, 176.37-second software
Chromium resource measurement: authorized high-altitude creative flight over
generated terrain on a closed 48×48-block route, followed by same-page reconnect
each time. Each settled travel/reconnect pair repeats exactly: 49 collision
columns, 34/25 retained mesh columns, 72/61 geometries, five textures, 163/141
GL buffers and 2,429,812/1,843,268 tracked buffer bytes. Main Wasm grows once to
6,094,848 bytes, then stays fixed. All seven actual workers and sockets close;
all 1,503 GL buffers are deleted; final logical resources and room count are zero.

The browser-only weak-reference probe is checked against known GL buffer resize/
deletion and Wasm growth. Settled samples require drawn terrain and fresh buffers;
an initial camera-horizontal measurement is preserved separately as weaker evidence.
Independent report checks pass for two and six cycles and reject four corrupted
ownership/rendering reports. CI runs the two-cycle case, probe and report checker.
Strict types and unchanged source/release verification pass. No runtime changes.

[Detailed scope and measurements](../games/voxel/docs/travel-memory.md) and separate
`games/voxel/evidence/travel-memory/` evidence distinguish tracked ownership from
physical GPU memory and Wasm high-water from live allocation. Archive capture and
the source/release/prior-inventory audit pass after the temporary command-review
outage cleared. Forced-GC main heap
after reconnect rises from 6.24 to 6.59 MB with slowing growth; this is not asserted
as a heap-plateau verdict. Worker/whole-process/live allocator memory, longer and
richer scenes, repeated app mounts, physical devices/networks, real hosted journeys,
product decisions and full cutover/legacy removal remain. The rejected hosted-write
run still awaits explicit approval. No migrations changed; the rewrite stays active.

## Repeated actual React surface mounts — 2026-10-27

The full local React/SQL browser journey now checks actual `VoxelSurface` exit/
re-entry in the same page under StrictMode, four cycles by default in existing
CI and six in qualification. All six mounts preserve actor/world identity with
new epochs and repeat 49 collision columns, 21 geometries, five textures, one
worker and 556,804 tracked GL bytes. Every unmount releases canvas/inventory/
touch/voice elements, closes game audio and its actual worker/socket, and deletes
every tracked buffer. Final totals are 372 buffers and six workers/sockets, all
closed/deleted. Main Wasm high-water stays at 5,636,096 bytes.

The first passing run exposed a probe accounting error: summing each historical
GL context's peak inflated sequential-mount peak bytes. A new actual-browser
regression fails with the old probe and passes with global concurrent accounting.
The corrected full React rerun passes with a stable 557,740-byte peak. Existing
save-retry, inventory/fullscreen, chat, moderation, teacher/end and SQL roster
checks still pass, with empty browser errors and all three clients cleaned up.
Live media is disabled; SQL is local with fixture Auth/PostgREST/Storage transports.

A fresh two-cycle standalone travel regression and its independent checker pass
with the corrected probe, preserving the prior single-context measurements' scope.
Strict game/web types, boundaries and unchanged source/release verification pass.
No runtime sources or release bytes changed; prior full core/unit/build checks
remain prior evidence. The private database, gateway and local SQL cluster close.

[Details](../games/voxel/docs/react-mounts.md) and separate
`games/voxel/evidence/react-mounts/` evidence preserve both React runs, old-probe
failure, corrected probe and travel results, exact sources/releases and fixture
assets. Full hosted/shell journeys, richer/longer memory and capacity qualification,
physical devices/networks, product decisions and cutover/legacy removal remain.
The rejected hosted-write run still awaits explicit approval; the rewrite is active.

## Drain-driven edited-world join and real TCP stalls — 2026-10-27

Real TCP read suspension exposed a production defect in the preceding release:
a valid 4,818,072-byte edited baseline closed with code 1013 before all columns
arrived. The original diagnostic received 39/49 columns with native queued output
above 1 MiB; the new integration case also fails against the old packaged runtime.

The worker now reserves at most 512 KiB of baseline bytes per connection, with
credit returned by completed socket writes. Deferred subscriptions retain metadata
and encode current revisions after credit arrives, folding intervening edits into
their baseline. Already-published baselines retain ordered patches. Resync/unload/
teleport/disconnect/expiry/shutdown cannot revive stale work. The public protocol,
content, engine and checkpoint versions stay unchanged; no headcount caps or SQL.

Matched release
`f0d8830dee8d23bf0944268460d592a5bc4a9e1fb9c0b2294412b4264df8e252`
passes 103 domain, 80 native (3 ignored), 91 Wasm and 45 source plus 45 packaged
integration cases; strict types, all 50 service and 180 web tests, production web
build, release verification and eight guarded read-only-status/zero-room startup
RPCs pass. Actual one/five-second TCP stalls now deliver every edited column and
permit reconnect while a healthy peer continues. Native queued output stays near
503 KB. A rendered client freezes prediction/input/voice spatial data when stale,
recovers, reconnects and fully cleans up. Its software cold join is 10.54 seconds,
so this is functional evidence, not a passed device/readiness budget.

Full React/local-SQL save/chat/moderation/teacher/end/roster flow and six mount
cycles pass, as does two-client origin/held/audio cleanup. Six packaged movement
layouts have complete steady-window coverage and no skips/resyncs/dropped time;
maximum room p95 bounds are 1.05/1.95/4.70/11.70 ms at 16/32/64/128 players,
2.20 ms for 2×32 and 1.10 ms for 4×16. Larger p95 still exceeds the proposed budget.
The separate 180.68-second 2×8 mixed-survival run completes 864 mining/placement
cycles, 866 crafts, 432 chest races and committed crash/restart with all 16 stale
replays rejected; sampled durable lag ≤15 seconds and every client/room closes.

[Behavior, scope and exact measurements](../games/voxel/docs/column-drain.md) and
separate `games/voxel/evidence/column-drain/` evidence retain old failures and final
checks, with actual suspension separated from recovery latency. Only six runtime
files change; engine/content/migrations remain fixed. Physical/inbound/RTT/jitter/
bandwidth network qualification, actual hosted service/classroom journeys, richer
progression/capacity/memory/device gates, product decisions and cutover/retirement
remain. Rejected hosted-write approval is still pending; the rewrite stays active.

## Input backlog recovery and transient packet jitter — 2026-10-28

Actual client-to-server TCP read suspension exposed a persistent input delay:
the preceding runtime's restored 60 Hz connection retained a roughly ten-control
server backlog. Domain, actual-Wasm and built-browser regressions fail against
that archived queue. The browser's normal 3–6-frame acknowledgement lag becomes
a sustained 10–14 frames after a one-second hold despite fresh server snapshots.

Only `src/sim/input-queue.ts` changes in production. Overflow recovers immediately
on the next scheduled movement step; smaller queues longer than two packets get
a 100 ms jitter grace period before retaining only the newest packet. Discarded
identities add no movement time, consumed view change or transient jump. Existing
queue/age/held-input bounds and epoch invalidation remain. A first candidate
trimmed brief jitter prematurely; its exact release, 135-resync diagnostic and
failed control-preservation test remain separate. The refined policy preserves
jittered controls and clears both large and smaller persistent backlogs.

Matched release
`7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`
passes 107 domain, 80 native (3 ignored), 92 Wasm and 45 source plus 45 packaged
integration cases. Strict types, 50 service/180 web tests, production web build,
release verification and guarded eight-status/zero-room startup pass. No hosted
application writes, SQL, engine/content/checkpoint/public-wire changes or admission
caps are introduced.

Actual one/five-second inbound browser holds now restore sustained 4–7-frame lag
after the short hold, bound long-stall prediction at 120, release focus/voice data,
avoid automatic readmission and permit explicit same-actor/world new-epoch rejoin.
Outbound edited-world holds and all 49 column baselines still pass. Full local
React/SQL save/chat/moderation/teacher flow, six mounts and two-client presentation
pass with complete tracked graphics/worker/socket/audio cleanup; SFU is disabled.

Six final loopback layouts have complete steady-window coverage, no skipped
input batches, no steady resyncs and cleanup. They retain 149 single initial
corrections before sampling, rather than hiding them in a zero-resync claim.
Maximum world-step p95 bounds are 1.05/1.85/4.65/16.40 ms at 16/32/64/128 players,
2.35 ms for 2×32 and 1.05 ms for 4×16. Larger p95 still exceeds the proposed target;
an additional 10.00 ms 128-player sample does not establish a controlled speedup.
The 183.23-second 2×8 survival run completes 864 mining/placement cycles, 866 crafts,
432 chest races and coherent committed crash recovery rejecting all 16 stale
replays. Sampled durable lag is ≤14.97 seconds; all clients/rooms/waiters close.
Its lost wrapper session is documented through an observed terminal child report
and independent audit, without fabricating a shell exit or restarting the run.

[Behavior, exact measurements and limits](../games/voxel/docs/input-backlog.md)
and separate `games/voxel/evidence/input-backlog/` retain failures, final sources,
matched artifacts and independent audits. Physical devices/networks, actual hosted
and classroom journeys, richer progression/balance/memory/scaling, product
decisions and cutover/legacy removal remain. Hosted-write approval is still
pending. The full rewrite remains active.

## Shaped TCP latency, jitter and bandwidth matrix — 2026-10-28

The unchanged input-recovery release now has actual built-client coverage through
local FIFO TCP byte shaping, including all HTTP/assets/admission/gameplay traffic.
The per-direction rate budget is shared across connections, not multiplied by
parallel downloads. Real two-stream binary calibration verifies byte preservation,
aggregate pacing, bounded queued reads, clean half-closes and immediate cancellation.
A derived relay with pacing removed fails the same wall-time assertion. Early
strip-only syntax and half-close/cleanup failures remain separate evidence.

Three fresh software-browser processes pass 50 ms, 100 ms with ±25 ms one-way
read-chunk jitter, and 150 ms data RTT profiles, each with a 10 Mbps cap. Safe cold
readiness takes 5.15/5.53/6.13 seconds; warm rejoin takes 1.48/1.68/1.87 seconds.
All 49 collision columns and at least 25 nearby meshes are ready. Public creative
movement advances authority, sampled input lag stays within 2–16 frames, largest
sampled correction is 0.179 m, and settled client/server agreement is within 1 cm.
Each explicit reconnect preserves actor/world with a newer epoch; graphics/audio/
worker/socket, proxy queue/timer and gateway room teardown is complete.

The expanded 109 domain tests, strict game/tool types and unchanged matching
source/content/12-file release verification pass. Production runtime, engine,
content, protocol and persistence are unchanged. Prior broader qualification is
retained through exact hashes rather than rerun. No SQL, hosted writes or admission
caps are introduced. CI runs the matrix; separate
`games/voxel/evidence/shaped-network/` and
[scope/measurements](../games/voxel/docs/shaped-network.md) retain the evidence.

These are local byte-data profiles, excluding OS handshake/congestion/retransmit/
loss behavior. Matching the proposed readiness numbers here does not qualify
physical devices/networks or SFU. Richer survival under impairment, actual hosted/
classroom journeys, product decisions, larger-load performance and cutover/legacy
removal remain. The full rewrite stays active; hosted-write approval is pending.

## User scope clarification and PC survival — 2026-10-28

**Current user decisions supersede earlier scale/mobile release notes:** this is
a private-school app, without a scale-building requirement, and students mostly
use PCs. The 128-player timing is historical, not a release gate. Stop larger
synthetic load experiments and scaling work. Desktop keyboard/mouse and ordinary
student/teacher workflows are primary; mobile/tablet compatibility is optional.
No player/observer/room admission ceilings are introduced. The proposal's product
scope, delivery stage and validation matrix now reflect these decisions.

The existing natural survival journey now has a packaged-server desktop mode,
using trusted OS keyboard/mouse input in a private X display, owned pointer lock,
and the 100 ms data-RTT/±25 ms one-way-jitter/shared-10-Mbps link. It starts empty,
collects five logs and an apple, crafts/places a workbench, selects its pickaxe,
equips boots/shield, and eats after real room-time hunger with inventory open.
An independently admitted peer verifies remote gear, independent vision, origin
shift, UI changes and reconnect. No item/world/body/clock injection is used.

The completed PC run records 97 locked mouse moves, 7 primary and 3 secondary
presses, WASD/jump, E and hotbar keys, with zero untrusted events. Food changes
19→20 through owned consumption. Main/peer graphics, workers and audio release;
all eight proxy connections, queues/timers and gateway rooms close. An initial
driver assertion used an undefined debug field; the corrected check reads actual
DOM pointer-lock ownership, with its failed source/report retained separately.

Focused relay checks and strict types pass; source/content/12-file release
verification confirms unchanged production build
`7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`.
Relay close is idempotent and unconditional in fixture failure cleanup. CI uses
the PC journey instead of duplicating the full survival run; the dedicated
existing touch smoke is optional. [PC scope and reproduction](../games/voxel/docs/pc-school.md)
describe the functional evidence and its physical-device limits.

Remaining release work centers on actual school-PC and hosted student/teacher/
voice/save/classroom workflows, product decisions, cutover and legacy removal.
Large synthetic scale and mobile/tablet qualification are not blockers. Hosted
temporary-user/session writes still require the pending explicit approval.

## Legacy web client retirement — 2026-10-28

The new app route already uses `game/voxel/VoxelSessionContainer`. A resolved
TypeScript import graph plus cross-workspace search verified 28 old client files
were unshared. The NOA/Babylon client/container, socket hook, renderer-coupled voice,
HUD, mirrored protocol/crafting, mesher/model and worldgen-worker implementation
are now removed (10,304 lines). The shared telemetry URL helper is deliberately
retained. No classroom or other-game code is removed.

Web dependencies on Babylon, NOA and direct legacy content are removed; offline
lockfile resolution prunes 19 entries with no retained-version changes. Four
implementation-specific files/20 tests retire with the old stack. All remaining
160 web tests, strict types and production build pass. The bundle guard reports
45 new game modules and zero forbidden modules. The complete 197-entry content
disposition audit still passes, with its reference sources unchanged.

The actual React/local-SQL student/teacher journey passes after removal: save
failure/retry, chat/moderation, staff controls, resume/end, roster behavior and two
mount/exit cycles. Unmounts return tracked GL buffers/resources, workers/sockets
and audio to zero/closed. SFU is disabled; Auth/PostgREST/Storage transports are
fixtures. Production game build `7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`
is unchanged. No SQL, external writes or deployment is performed.

Architecture/project guides now describe the new runtime. The three old NOA
voxel skills are retired and older optimization/expansion documents marked
historical. [Retirement scope and validation](../games/voxel/docs/client-retirement.md)
separate this completed frontend cleanup from remaining legacy backend/public
assets/operational URL cutover, actual hosted/school-PC workflows and release
decisions. Large synthetic scale and mobile/tablet qualification remain excluded
by the user's current private-school PC requirements.
