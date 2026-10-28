# Voxel rewrite

Implementation follows [the full rewrite proposal](../../docs/voxel-runtime-rewrite-proposal.md).
Current capability/evidence and remaining work are tracked in
[rewrite progress](../../docs/voxel-runtime-rewrite-progress.md). This is the new
creative/survival runtime. The school application cutover, complete survival game and release
qualification remain in progress.

## Setup and checks

Use Node 24.21.0 and Rust 1.99.1 with `wasm32-unknown-unknown`. Install this game's
isolated dependencies with `npm ci --prefix games/voxel`; its wasm-pack installer
obtains the pinned binary. This game is not a root npm workspace.

From the repository root:

```sh
npm run build:voxel
npm run check:voxel
npm --prefix games/voxel run verify:release
npm --prefix games/voxel exec -- playwright install chromium
npm run test:voxel:browser
npm run test:voxel:creative
npm --prefix games/voxel run test:edited:browser
npm run test:voxel:touch
npm run test:voxel:environment
npm run test:voxel:presentation
npm run test:voxel:recovery
npm run test:voxel:inventory
npm run test:voxel:survival
npm run test:voxel:tnt
npm run test:voxel:equipment
npm run test:voxel:combat
npm --prefix games/voxel run benchmark:engine
npm --prefix games/voxel run benchmark:survival:workers
npm --prefix games/voxel run check:survival:workers
npm --prefix games/voxel run test:memory:probe
npm --prefix games/voxel run test:memory:browser
npm --prefix games/voxel run check:memory:browser
npm --prefix games/voxel run inventory:legacy
npm --prefix games/voxel run check:content:complete
npm --prefix games/voxel run survey:content
npm run dev:voxel
VOXEL_MODE=survival npm run dev:voxel
```

On Linux, Chromium needs the usual Playwright system libraries (`playwright
install --with-deps chromium` in CI). The compute test checks Node/Chromium/worker
parity. The creative test opens two built clients with software rendering and
checks walking/jumping, shared placement/removal, reconnect and disposal. The
touch test uses actual multi-touch events in an emulated tablet, tests cancellation,
dispatches the normal blur event and exercises actual WebGL loss/restoration.
The environment test renders clear/rainy nights from normal server-owned initial
ticks. The presentation test checks avatar orientation and instance coordinates
across a real chunk-origin shift, held shapes, audio listener coordinates,
mute gain and disposal. The recovery test injects actual worker-script failures,
checks finite retries/frozen movement and reconnects after repairing the worker.
The inventory test uses the actual Hebrew dialog to split/move stacks, craft
in 2×2 and at a placed 3×3 workbench, equip an instance, transfer through a placed
chest, reconnect without resubmitting mutations and dispose the entire UI/runtime.
The survival scenario starts with an empty inventory in normal natural terrain;
it harvests logs with held touch input and must collect drops, craft/place an owned
workbench, craft a wooden pickaxe, trail boots and a heavy shield, and render the tool without
creative grants. It harvests a natural apple, waits for room-time hunger with the
inventory open, then eats the owned item through the dialog. The combat scenario
uses two real natural-world clients, a touch attack and public attack commands,
server-selected hits against an inventory-open player, actual death, same-client
UI respawn/readiness, hit feedback and complete teardown. The TNT scenario uses
the normal survival route with six logs, gathers sand/stone from natural terrain,
crafts charcoal/powder/a durable firestarter/TNT, then checks owned placement,
touch ignition, fuse presentation, explosion and resource teardown.
Headless Chromium keeps its pages focused; real OS/window focus needs real-device
qualification. These checks do not establish hardware frame rate or school
device support.

The [sustained survival workload](docs/sustained-survival.md) runs ordinary public
inputs/actions through the packaged gateway and room workers, checks live autosave
readbacks, then terminates/restores workers and resumes crafting. Defaults are two
rooms of eight UUID actors for three minutes. It uses prepared work platforms,
owned fixture kits, in-memory metadata and delayed in-memory object operations;
it does not qualify actual Supabase IO, hardware rendering or school capacity.
The separate report checker verifies activity counts, recovery, timing-window
coverage and cleanup. CI runs a shorter two-room autosave/recovery scenario.

The [travel/reconnect resource scenario](docs/travel-memory.md) repeats six
authorized flight routes over generated terrain in the same page, reconnecting
after each route. It measures settled GL buffers, column/geometry counts, worker
and socket lifetimes, main Wasm high-water and forced-GC main-isolate heap samples.
The probe adds GL bookkeeping overhead; this is resource evidence, not FPS testing.
CI runs two cycles after checking the probe against known allocations.

The app's React browser journey also checks [repeated surface mounts](docs/react-mounts.md)
through its exit/re-entry buttons, including actual worker/socket and GL-buffer
teardown. Its default four cycles can be increased with `VOXEL_REACT_MOUNT_CYCLES`;
this remains a local SQL/fixture-transport scenario, with live media optional.

[Drain-driven column streaming](docs/column-drain.md) keeps heavily edited saved
worlds from repeatedly exhausting a slow connection's output queue during join.
Real TCP read-stall regressions cover source/packaged workers and the rendered
client, including stale-control freeze, complete baselines and reconnect.

[Input stall recovery](docs/input-backlog.md) retires stale queued controls during
scheduled movement steps so a recovered link does not retain input latency.
`test:input-stalls:browser` suspends actual inbound TCP reads for one/five seconds,
checks sustained acknowledgement recovery, bounded prediction and explicit rejoin.

The [shaped TCP browser matrix](docs/shaped-network.md) sends all HTTP/assets and
gameplay bytes through shared latency/jitter/bandwidth queues. Run
`test:network:browser` for 50/100/150 ms data RTT profiles at a 10 Mbps cap, including
safe readiness, public movement, explicit reconnect and complete resource teardown.
It complements real read stalls; physical devices/networks still need qualification.

The [PC-first school journey](docs/pc-school.md) uses trusted desktop keyboard/mouse
input for natural empty-inventory survival over the delayed link. CI runs this as
the primary survival scenario. Mobile/tablet support is optional; 128-player
diagnostics are historical and do not block the private-school release.

[Legacy web client retirement](docs/client-retirement.md) removes the unused
NOA/Babylon implementation and direct dependencies. The current app, content audit
and local student/teacher journey pass. [Backend retirement](docs/backend-retirement.md)
removes the old service workspace and routes classroom telemetry/admin operations
to independent services. [Content retirement](docs/content-retirement.md) freezes the inventory reference
and removes the old content workspace. [Asset retirement](docs/asset-retirement.md)
removes unused old media/import tooling after source and read-only catalog/avatar
checks. Actual hosted routing cutover remains separate work.

The [shared world profile](docs/world-profile.md) makes the playable square size a
build setting while retaining the 512×512 default and height 256. Geometry,
streaming, wire validation and saves share those bounds, and the profile enters
the build fingerprint. Stop/rebuild/restart the dev stack after changing it.

`build` compiles content, builds release Wasm and writes `artifacts/build.json`
plus a content-hashed Wasm file, browser bundle, headless gateway/room-worker bundle
and a matched `artifacts/release.json` inventory. `check` builds first, then checks
types/imports, the strict 197-entry content disposition/source audit,
authority/content tests, native invariants, actual-Wasm tests and
the creative gateway scenarios against both source and packaged server. Browser
and benchmark results are saved under ignored `test-results/`.
`verify:release` independently checks current runtime source, compiled authored
content, engine/bindings, build identity and every packaged release file. It
rejects stale artifacts and records `test-results/release-verification.json`.
`WASM_PACK` can select an already installed wasm-pack 0.15.0 binary. A Rust
selector override is allowed only when `rustc --version` still reports 1.99.1.

Content edits rerun the content compiler and require fresh engine instances;
existing Wasm instances intentionally cannot switch registries. Rust changes
require rebuilding Wasm. `dev:voxel` builds first, then serves the Hebrew standalone
harness at `http://127.0.0.1:5194` with a loopback gateway at port 8894. Use separate
browser profiles for distinct development identities and the same `?room=name`
for a shared room. Click the canvas to capture the mouse; WASD moves, Space jumps
or ascends, F toggles flight, Shift descends, and Escape releases the mouse.
The hotbar selects blocks; left click removes and right click places.
Press E or the bag button to open inventory. Select a source stack, then a target
slot to move/swap the whole stack; right click or Shift transfers one item. The
dialog shows crafting recipes and an authorized creative item catalog. Aim at a
placed workbench/chest and use the dialog's open-station button for 3×3 crafting
or shared storage. Escape closes the dialog; resume returns to movement.
The local body freezes while inventory is open; the multiplayer room keeps ticking.
The effects button mutes locally synthesized ambience, footsteps and material
edit sounds. Audio starts after a resume/capture gesture and stops while paused.
It is separate from voice, which remains pending platform integration.
Coarse touch devices receive a movement joystick, a right-side look area and
Hebrew jump/flight/build controls. World axes retain their desktop orientation.
`RuntimeOptions.inputMode` can explicitly select touch or desktop for an app
adapter. Pause, pointer cancellation, blur, disconnect and reconnect release
held controls. WebGL loss freezes input and requires refresh after restoration.
In survival, the first nine bag slots form the owned hotbar. Use digits 1–9 or
tap a slot to select it; left mouse hold or the held mining button mines. Release
to cancel. Right click/build places one owned item. The progress bar follows
server ticks. The inventory's discard button throws one selected bag item into
the world. Pickups use authoritative reach/occlusion and preserve leftovers when
the bag is full. Tools have data-driven requirements, speeds, tiers and durability.
An owned empty bucket uses the same build control to collect water; placing the
filled bucket returns its empty container in place. See the authored palettes,
tagged recipes, forage, four tool tiers and verification limits in
[content progression](docs/content-progression.md).
`?quality=low` selects half render scale and a 30 Hz presentation limit; the
default presentation limit is 60 Hz. Paused/preparing views submit at most
10 frames per second. `RuntimeOptions.renderHz` configures the active limit.
Input sampling, prediction, streaming and network scheduling keep their own
cadence; GPU submissions do not allocate movement time.
One WebGL2 completion fence prevents queuing another rendered frame while the
previous frame is pending. Polls use zero timeout; context loss and disposal
release the fence. This bounds submitted work, while main-thread/device stalls
remain a measured qualification concern.
Before admission/input, a tiny offscreen first-person render warms shader,
uniform and buffer work and waits for GPU completion. Startup failures clean up
the renderer/world instead of enabling a partly prepared session.

Room ticks drive a 20-minute day/night cycle and seeded, smoothly changing basic
weather. Sun, moon, stars, clouds, light, fog, water and ambience follow that
clock. Rain is presentation only and hides beneath overhead terrain. The gateway's
injected `worldDefaults` can set the initial seed/tick; clients cannot set room
time. The protocol is version 11 with environment version 1, vitals format 2 and inventory format 2. Room clocks are still
volatile in the launcher; the gateway now has injected checkpoint/lease ports
with coherent room recovery. The production Supabase adapter/migration now exists in `apps/voxel-server`; remote installation awaits approval.
First-person and remote
items use compiled shapes/textures. Remote held/worn identities come from owned
survival state or a validated creative catalog selection, without inventory
counts or durability. See [avatar appearance](docs/avatar-appearance.md).

The launcher grants development capabilities through a development-only
HttpOnly cookie. It binds to loopback and refuses production mode. It has no
school admission or durable saves. It is a development harness for the runtime,
not the final Playground session UI. After changing content, shared protocol,
Wasm or server code, stop the launcher, rebuild and restart both clients. Vite
reload is useful for presentation edits; it does not hot-swap running room worlds.

Inventory owns 36 bag slots, five typed equipment slots and personal 2×2/3×3
crafting grids. Chests have 27 shared slots. The room commits moves/crafting
atomically with owner revisions and chest identity/revisions, and applies the
same action ledger used by world edits. Conflicts return current authoritative
views. Inventory is private except for explicitly opened shared storage. A
nonempty chest cannot be mined; an explosion drains its contents into drops and
closes its viewers atomically. Grids/equipment survive reconnect for the
room's lifetime; abandoned workbench ingredients can be retrieved without a
table. The private checkpoint preserves these areas; the launcher still has no
configured durable backend. The launcher defaults to creative building
through the creative palette. `VOXEL_MODE=survival`
selects the server-owned survival mode for this launcher: catalog grants and
flight are rejected; mining completes on fixed room time; world edits, item
consumption/tool wear and drops commit together. It does not yet include the
remaining full survival/release scope, including final equipment/content balance.

Survival includes private health/food/air, room-time hunger/regeneration,
authoritative fall/water/lava hazards, food consumption, equipment movement/fall
effects and death/respawn. R or the food button eats the selected owned food;
the dialog can eat any selected bag food. Q, the touch attack button or a left-click
on a pointed actor sends an attack intent. Separate server combat capability,
consumed aim, body reach/shape occlusion, owned weapon/armor wear, world-time
cooldowns, hit recovery and respawn protection determine the result. Nonfatal
impulses install a fresh prediction baseline; receipt never advances motion.
Death drops personal bag/grids/equipment
once and respawn requires a fresh collision-readiness exchange. Prototype tuning,
equipment composition and timing policy are documented in
[survival-rules.md](docs/survival-rules.md), [combat-rules.md](docs/combat-rules.md) and [explosive-rules.md](docs/explosive-rules.md). G or the touch ignition button
ignites aimed TNT with an owned firestarter in survival. Right-click also ignites
when that tool is held. Fixed fuses, chained bodies, shape/material shielding,
chest drains and blast damage are server-owned. Durable vitals/timers,
complete content decisions and the final React session/HUD remain open.

Special equipment now includes a selected Swift pickaxe speed bonus, a fall-immunity
talisman, Helios sunlight healing, native helium jump strength and local glow
visibility. Ownership, typed slots, fixed timers and accepted native outcomes
govern activation and wear. Prediction receives the authoritative jump/speed
profile; glow changes local shader visibility while retaining real world light,
sky and fog. Recipes, tuning and remaining evidence gates are in
[equipment-rules.md](docs/equipment-rules.md).
The natural night route obtains and crafts all five items, observes the server
profile, uses an actual boosted touch jump and compares real shader output before
and after Glow. The complete matched checks, all eleven browser outcomes and
retained failures are in [equipment evidence](evidence/equipment/README.md).
The subsequent [appearance evidence](evidence/appearance/README.md) verifies
owned remote gear, creative catalog shapes, privacy, origin shifts, UI changes,
reconnect and graphics startup against protocol 10. The subsequent
[content evidence](evidence/content/README.md) records all 197 content decisions,
expanded palettes/recipes, owned progression and water containers, native wood
mapping, stable creative catalog keys, and matched protocol-11 regressions.

Dropped items use shape-aware engine sweeps, a short pickup delay and a five-minute
simulation-time lifetime. Unloaded columns do not become empty fallback terrain.
Nearby drop replication is split into bounded messages without an entity/player
admission ceiling. `GameRoom.setPaused` is a service-side lifecycle port: it
rotates input epochs/cancels mining and freezes world/drop/vitals/respawn timers. The school
service adapter and actual Supabase storage/metadata implementation remain open.
The injected gateway path captures coherent room state, uploads immutable changed
columns, commits a fenced pointer, coalesces autosaves, saves/releases empty rooms
and restores through fresh admission. See [checkpoint state](docs/checkpoint-state.md)
for behavior, contract-fixture evidence and remaining service qualification.

## Boundaries

`src/shared` defines content, versioned protocol and fixed movement contracts.
`src/sim` owns earned movement time, command authority and revisioned world state.
`src/server` supervises room workers and accepts an injected admission policy.
`src/client` owns prediction/input/socket lifecycle; its optional touch UI adapter
only calls the public runtime command interface. `src/world` runs tagged
generation/mesh jobs; `src/render` owns Three.js resources and culling.
Engine code has no React, Supabase, LiveKit or platform-service imports. Static
checks and both main/worker bundle graphs enforce the browser/server boundary.
Transport callbacks enqueue controls; the room scheduler alone calls movement.
There are no player, observer or room-count join limits.

The authored content uses one item stack representation
(`itemType`, `count`, optional instance data). All 197 legacy declarations have
explicit checked decisions in `content/disposition.json`; extended natural
progression and final balance remain open. See
[UPSTREAM.md](UPSTREAM.md) for provenance, format changes and update policy.
`content/legacy-inventory.json` enumerates the existing 111 blocks, 44 items and
42 recipes with source hashes. Their original source bytes are frozen as `.ts.txt`
under [legacy-content-reference](docs/legacy-content-reference/README.md); the old
content workspace is retired. The offline `inventory:legacy` tool checks the frozen
hashes and extracts declarations without executing old registries. This
inventory is checked against the explicit retain/replace/combine/remove decisions.
Target/label/source checks and actual-Wasm progression cover the implementation;
final balance and extended natural travel remain unqualified.
