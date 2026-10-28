# Public avatar appearance and graphics startup evidence

Captured 2026-10-23 for build
`70127a28adf5c606b47b7f9bd749ca39397b964869f3fa4f13db4c2c96dc8957`,
protocol 10, engine `d907627aac8145c44e0ff405123bdb5d8deba8c7a11df47c90b59a4ce7973878`
and content `6cfc9de62ffe3dc2a54677f5b1be4647ea0bcb24abd6312cfca163b2b327801a`.
The content remains 21 families, 32 states, 35 items and 19 recipes.

The complete check exits 0: build/types/import and bundle boundaries, 54 domain
and rendering tests, 79 native tests (three upstream debugging helpers ignored),
51 actual-Wasm tests, and six gateway scenarios against both source and packaged
server. All eleven final browser commands exit 0 without a signal. Every command
has a terminal exit record; historical attempts remain separate. Current
runtime/content, engine/bindings and all twelve packaged files are checked in
`source-release-verification.json`. `verification.json` hashes the artifacts and
scenario sources; its screenshot records bind images to their passing command's
run interval. `source-inputs.json` and `source.tar.gz` preserve repository-relative
sources, tests, tools, locks, licenses and original legacy declarations. Every
archived regular file was compared with the workspace bytes. Capture/archive
scripts are included.

The server derives survival appearance from selected/worn ownership. Public
messages contain only semantic visible item identities, with no bag contents,
quantities, durability, grids, containers or inventory revisions. The client
validates references and worn slots. Actual-Wasm rooms exercise quiet count/wear
changes, final-use breakage, late joins, reconnect and hidden observers. Creative
catalog selection validates placeable compiled states through an epoch-scoped
assignment counter; it creates no owned item, spends no gameplay action sequence
and changes no movement freshness/time. Exact native movement traces match with
or without catalog traffic. See [appearance rules](../../docs/avatar-appearance.md).

Third-person held/worn models reuse the item primitives and procedural texture
arrays. One boot attaches to each leg; tools/shields follow arm joints and
trinkets follow head/belt pose. Growable batches share body visibility and
camera-relative coordinates. Three.js tests inspect actual instance matrices,
joint motion, origin invariance, 129-avatar growth/shrink and release of old
buffers without disposing shared textures. This allocation case is not a server
capacity or hardware verdict and introduces no player/observer/room ceiling.

The natural day route crafts an owned pickaxe, trail boots and heavy shield,
waits for real hunger and eats its apple. An independently admitted viewer
observes four gear instances in three batches, crosses a chunk origin, watches
normal UI unequipping/re-equipping and slot selection, reconnects and disposes.
The natural night route crafts all five special items. Its second client
observes Swift, Glow, Feather and two Helium boots as five instances in four
batches, while retaining its own unbrightened terrain shader. The owner uses a
real touch takeoff that rises 3.30 blocks and wears boots once. Its local Glow
comparison raises framebuffer luminance from 23.55 to 82.51 at the same frozen
night viewpoint. The day/night routes take about 148/134 seconds. No grants,
position/world injection or client-clock overrides are used. Natural foliage
occludes the day image; inspect its submitted matrices alongside the image.
Night and creative images provide additional character/model views.

Creative browser clients observe remote slab, stair, ladder, torch, plant,
glass and water selections over the actual socket, with body/item coordinates
checked across an origin shift. Other final routes cover shared edits,
touch/context restoration, inventory/chests, melee/death/respawn, TNT,
weather, worker failures/recovery and release-Wasm parity. Gear, ordinary GPU,
worker and audio resources return to zero; GPU completion fences are released.

Earlier desktop jump checks failed while authority actually jumped. Passive
wire tracing records the accepted jump frame and server height 69.30, while
render-sampled height stayed at 68 during multi-second stalls. The first-person
pipeline was still cold after focus. Startup now performs a tiny offscreen render
with the normal output color space and awaits GPU completion before admission or
input; failure cleans up the world/renderer. The unchanged one-key jump route
passes in two independent runs (26.9 and 35.3 seconds overall). The final trace
records 472 ms startup preparation, a sampled 0.848-block rise, a 950 ms maximum
frame gap and 467 ms receipt age. These are functional results, not acceptable
frame/latency qualification.

`pre-catalog-history/` preserves the exact earlier passing two-client night
source before creative catalog replication and the camera submission wait.
`pre-warmup-history/` preserves the previous release's partial browser passes,
all terminal interruptions/failures and passive jump diagnostics. They include
an external exit 143 (child signal unknown), a workbench behind foreground soil
and three missed visual-jump attempts. The final route approaches the workbench
more closely through ordinary movement. The failed route source is retained;
failures are not reclassified as passes.

Chromium uses SwiftShader on a two-core ARM host. Real-device rendering/input,
physical audio/touch, OS focus, latency/load/memory qualification, complete
content disposition/balance, durable timers/checkpoints, React/school/Supabase/
LiveKit integration and cutover remain open. The full rewrite is still active.
