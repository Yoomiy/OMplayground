# Vitals, food and equipment evidence, 2026-10-22

Build `0f33682a9fc3` (full identity in `build.json`), protocol 6/environment 1,
inventory format 2 and vitals format 1. `source-release-verification.json` checks
current runtime source, freshly compiled content, engine/bindings, identity and
all 12 packaged client/server files. The engine is unchanged from the preceding
survival milestone. Content has 20 families/31 states, 25 items and nine recipes.
`verification.json` hashes the captured evidence and 15 scenario sources.

`check.txt` and `check-exit.json` record the completed full check with exit code 0:
build, types, import/bundle boundaries, 34 domain tests, 79 native tests (three
upstream debugging helpers ignored), 24 release-Wasm tests and five gateway
scenarios against both source and packaged server. Browser reports retain their
matching release identity; compute parity records the matching engine/content.
All eight final browser commands have recorded exit code 0 with no signal;
earlier failures and the interrupted batch are retained separately.

The room owns private health, food, air, hunger, effort, regeneration, starvation,
food cooldown, drowning/lava damage and respawn wait. Clients cannot submit
health, food awards, fall distance or damage results. Native motion supplies fall
peaks/landings; focus and room pause retain the fall segment. Authoritative block
queries keep water/lava hazards running when an individual inventory freezes its
body. Room pause freezes these timers. Disconnected vitals freeze until reconnect;
durable state and lifecycle policy remain pending.

Equipment modifiers come from compiled content and only activate in equipped
slots. Trail boots replace the earlier leather prototype and can be crafted from
four planks at a 3×3 workbench. They supply a bounded movement/fall effect and wear
once on a damaging landing; the last durability breaks the item. A changed
equipment/hunger movement profile rotates the input epoch and sends the same
speed/gravity/control/sprint profile used by server motion, client prediction and
replay. The added 600-step trace switches profiles with quantized 15 Hz snapshots
delayed 100 ms and stays within one centimeter.

Food checks owner revision and an authored nutrition value, applies the effect
and consumes one item in the same synchronous operation. Full-food, cooldown and
conflict failures do not consume it. Actual-Wasm tests return cached food outcomes
and reject replay after result-cache eviction. Room tests with release Wasm also exercise falls,
equipment breakage, privacy, reconnect/reservation expiry, frozen-body hazards,
pause, real lava death and readiness-gated respawn.

Death rotates the epoch, cancels pending controls/actions/mining, closes storage,
freezes the body and drops private bag/grids/equipment once. Dead commands and
pickups cannot mutate owned state. Respawn waits for two simulation seconds and
starts fresh collision readiness. Reconnect retains health/dead state and does
not repeat the item drain. A fresh spawn after reservation expiry clears the old
fall segment, avoiding damage from an unrelated pre-disconnect height.

The natural browser scenario starts empty and uses ordinary public controls,
actual held touch mining and the Hebrew dialog. It harvests four logs and nearby
foliage, collects an apple, crafts/places an owned workbench, crafts a pickaxe and
trail boots, and equips the boots. With the apple already selected and eating
disabled at full food, it waits for actual room-time hunger while inventory stays
open. The eating button becomes available without reselecting; clicking consumes
the apple and restores food from 19 to 20. It then resumes with the selected held
pickaxe. There are no creative grants, clock overrides or test-only world edits.
Screenshots show the dropped item, equipment/crafting dialog and held tool.
Disposal leaves zero tracked GPU/worker/audio resources and removes the dialog.

The browser record also covers touch/focus/WebGL loss, two-client creative edits
and reconnect, shared containers/inventory, avatars/origin shifts/spatial audio,
night/weather, real worker failures/recovery and Node/browser/worker parity. The
parity fixture retains 334 states and matching generation/edit/mesh, movement and
small-body sweep traces. `browser-suite.json` records terminal exit codes rather
than inferring completion from a report or lock file.

Historical failures and interruption remain explicit:

- The first `e2584dd96619` creative run timed out waiting for placement. Its log
  lacked body/queue diagnostics, so the cause is unproven. The log and first suite
  status are retained. Placement diagnostics were added without changing its
  timeout or authority assertions. The final creative repeat passes.
- A subsequent outer batch terminated with exit 143 during creative reconnect.
  Its scenario processes were confirmed absent. Its completed survival/touch
  exits remain valid; creative was rerun from the start, and remaining commands
  run independently. The interrupted suite/log are retained and are not passes.
- The final creative run still takes about 119 seconds, with severe software
  browser stalls and roughly 41 seconds from reconnect request to readiness.
  Functional success does not close the latency/readiness gate.

These are software-Chromium/SwiftShader functional checks on two ARM cores.
Hardware FPS/readiness, physical audio, genuine OS focus, input ergonomics,
long-session memory and increasing player/room loads remain unqualified. No
player, observer or room-count admission caps are introduced.

Current tuning is in [survival-rules.md](../../docs/survival-rules.md), including
the special equipment capabilities still to implement. Combat, TNT, complete
equipment/content disposition and balance, final death/damage presentation,
React session/HUD, actual school/Supabase/LiveKit integration, durable checkpoint
ownership, classroom service separation and cutover remain required by the
[full implementation record](../../../../docs/voxel-runtime-rewrite-progress.md).
