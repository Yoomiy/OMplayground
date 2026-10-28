# Authoritative combat evidence, 2026-10-22

Build `a3db04da64a3` (full identity in `build.json`), protocol 7/environment 1,
inventory format 2 and vitals format 2. `source-release-verification.json` checks
current runtime source, freshly compiled authored content, Wasm/bindings,
identity and all 12 packaged client/server files. The engine is unchanged from
the previous survival/vitals milestones. Content has 20 families/31 states,
26 items and ten representative recipes. Earlier records retain their own
identities. `verification.json` hashes the captured artifacts and 21 scenario/
fixture sources.

`check.txt` and `check-exit.json` record the completed full check with exit code 0:
build, types, import/bundle boundaries, 38 domain tests, 79 native tests (three
upstream debugging helpers ignored), 30 release-Wasm tests and six scenarios
against both source and packaged gateway. Each final browser report matches the
release; compute-only parity matches its engine/content. `browser-suite.json`
records terminal child exit codes, keeping historical attempts separate.
All nine final browser commands finish with exit code 0 and no signal. Historical
failures remain separate from those final outcomes.

The attack wire contains only epoch/action sequence, consumed-input dependency
and owned-inventory revision. The server chooses the nearest eligible body on
the consumed view ray, checks shape-aware solid occlusion and authored reach,
then applies damage, cooldown, recovery/protection, owned weapon/armor wear and
any death outcome. Source and target need a separate combat capability; building
permission grants no combat permission. Creative actors and observers are excluded.
An individual's open inventory does not grant immunity. Attacks cancel mining;
bursts and replay cannot buy time or repeat effects.

Actual-Wasm tests exercise glass/partial-slab occlusion, reach, consumed aim and
future input dependencies, stale controls, permissions/modes, fixed cooldowns,
cache eviction, final-use weapon/shield breakage, pause/reconnect, melee death
and one-time item drain. The same connection respawns only after collision
readiness and receives room-time protection. Hazard-aware spawn search avoids
water/lava cells and still requires collision data when it crosses a column.

A nonfatal hit changes velocity without advancing position/time and sends a new
epoch/body/profile baseline. A direct 30-room-tick trace uses the actual hit
impulse and client prediction with quantized 15 Hz snapshots delayed 100 ms;
error stays below one centimeter. Existing unchanged-world and equipment/hunger
prediction traces remain green. New epoch baselines clear queued local actions.
Frozen inventory bodies receive damage without an impulse deferred until resume.

The two-client combat browser scenario starts with empty inventories in natural
terrain. It opens the victim's actual dialog, moves/aims through ordinary public
controls, sends a real touch attack and then ordinary public attack intents when
the authoritative cooldown clears. It observes actual death, dialog closure,
a frozen body, and the same client's normal respawn UI/readiness transition.
The trace observes protected respawn and explicit resume; no client-selected
victim, clock override, creative grant or test-only mutation is used. Server hit
events produce bounded gold sparks, Hebrew notices and local positional audio.
The panner's coordinates equal the exact float32 conversion of the accepted
absolute hit point. Both clients dispose all tracked GPU/worker/audio resources.
Screenshots show the death and respawn views.

The natural survival browser route now harvests five logs and nearby foliage,
collects an apple, crafts/places a workbench, crafts a pickaxe, trail boots and
heavy shield, and equips both items. With food already selected, it waits for
actual room-time hunger while the inventory remains open, then consumes the
apple once and restores food from 19 to 20. It resumes with a held pickaxe and
disposes all tracked resources. There are no grants or test-only world edits.
The other browser records cover touch/focus/WebGL loss, desktop two-client edits/
reconnect, inventory/chests, avatars/origin shifts/spatial audio, night/weather,
real worker failures/recovery and Node/Chromium/worker compute parity.

Retained development failures explain the final test contracts:

- `historical-early-readiness-fixture.txt`: the initial safe-spawn fixture sent
  ready before the newly selected column had collision data. The server correctly
  kept the actor preparing. The final fixture performs the ordinary bounded
  readiness exchange after generation instead of bypassing that gate.
- `historical-audio-double-precision-assertion.txt` and its exit metadata: a
  one-micro-unit comparison failed between double hit coordinates and browser
  panner values. `audio-float32-probe.json` directly measures the browser's exact
  float32 conversion. The final assertion checks exact equality to that conversion;
  it still rejects a camera-relative or otherwise wrong absolute source.

These are software-Chromium/SwiftShader functional checks on two ARM cores.
Software-browser latency/stall concerns remain open. The final creative run takes
roughly 122 seconds, including about 40 seconds from reconnect request to readiness.
Hardware FPS/readiness, physical audio, genuine OS focus, input ergonomics,
memory plateau and increasing player/room workloads remain unqualified. No player,
observer or room-count admission caps are introduced.

TNT, remaining special equipment capabilities, complete per-entry content
disposition/balance, remote held/offhand models and final presentation,
React session/HUD, actual school/Supabase/LiveKit adapters, durable checkpoints/
ownership, classroom service separation, qualification and cutover remain in the
[full implementation record](../../../../docs/voxel-runtime-rewrite-progress.md).
See [combat rules](../../docs/combat-rules.md) and
[survival rules](../../docs/survival-rules.md) for current tuning and remaining scope.
