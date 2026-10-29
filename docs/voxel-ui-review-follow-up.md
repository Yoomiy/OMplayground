# Voxel UI review follow-up

Repairs for the 2026-10-29 source review of `90fe575`. The first batch is `6af8112`; this follow-up adds camera support, graphics restoration and confirmed station/mining presentation behavior.

| Review findings | Implemented behavior |
| --- | --- |
| UI-01, UI-06 | Item thumbnails use the actual world models and textures. Hotbar and inventory show stack counts and durability. Survival health, food and air have graphical meters; air also shows seconds. |
| UI-02, UI-03, UI-05 | Compact nine-slot hotbar, stone-colored inventory and smaller floating header. Session management lives in a menu. Mining progress stays beside the crosshair. |
| UI-04 | Confirmed mining progress drives a target-shaped crack overlay, repeating arm swings and digging effects. |
| UI-07, BUG-06 | Empty equipment destinations show their names. Selecting an item highlights compatible equipment destinations. |
| UI-08, BUG-05 | Searchable visual recipe grids, result thumbnails and ingredient availability. Recipe expansion/search survive pending transactions and inventory revisions. |
| UI-09 | Drag stacks, right-click a source to select half, right-click a destination for one item, and Shift-click for quick transfer. Transactions remain server-authoritative. |
| UI-10 | Searchable image catalog. Choosing a block replaces the current creative quick-access slot; digits always address the nine visible slots. |
| UI-11 | Right-click opens a targeted workbench or chest. Holding Shift bypasses opening and allows placement beside it. |
| UI-12 | Help explains survival hold mining, sprint, sneak, creative flight, slot selection and TNT ignition. |
| BUG-01, BUG-02 | A brief input gap or authoritative ray miss pauses mining for up to 200 ms before cancellation. No mining ticks accrue during that interruption. Movement still expires after 100 ms. Block replacement, tool changes, focus loss and permission loss still invalidate mining. |
| BUG-03 | Release may finish only the final two valid server ticks. Earlier release cancels immediately. |
| BUG-04 | Transient gameplay rejection messages remain visible during normal play, with three seconds to read them. Local inventory hints also survive routine HUD refreshes and yield to new operations/server feedback; unchanged text is not rewritten on every tick. |
| BUG-07, BUG-08 | E respects other open dialogs. Pointer-lock rejection displays retry guidance and freezes local input. |
| BUG-09 | A running session restores GPU resources from retained scene/texture data, including the CPU-backed biome atlas. Input stays frozen until rendering returns and the player explicitly resumes. Session/inventory stay in place; errors and ended sessions are preserved. |
| BUG-10 | Wheel, V and the session menu select first/third person. A native collision-volume query keeps the camera before walls and respects partial block shapes. The local avatar carries its held item/equipment. Movement, interaction reach and proximity voice remain at the player's position. |

## Local checks

- The 14 native survival tests pass, including new input-gap/aim-miss and near-completion release regressions.
- A focused local browser flow rendered the production React surface with the native game worker. It checked nine image slots, compact header geometry, inventory split/drag/quick transfers, durability bars, recipe state/search, modal shortcut isolation, survival meters, gameplay rejection text and pointer-lock retry guidance.
- A focused browser check opened the actual 3×3 workbench through the desktop right-click handler and rendered the local third-person avatar/held item. Native camera tests cover walls, slabs, negative coordinates, zoom bounds and unchanged player state.
- An actual software WebGL loss/restoration check retained the same actor/world, 32 owned planks and 49 loaded columns, with zero new admissions or remounts. Resume was blocked during loss and required an explicit entry action afterward. This check used the existing `renderScale: 0.5` / 30 Hz options; it is functional evidence, not school-PC performance evidence.
- The mining DOM input path confirmed server progress, repeated swings/digging effects and active cracks. Bare-hand swings now rise above the hotbar; crack textures use the correct color space.
- Game and web TypeScript checks and updated client/server packaging pass. Existing engine sources, toolchain configuration and Wasm artifacts match the prior published hashes; that unchanged engine is reused because this executor has no Rust compiler.

## Release and next step

The matched published game release is `5ee78c6d15b18a4448b1a92f6777bf7747b08f737d4f85255403f5d219f8f9b3`.

Terrain artwork continues to use the procedural world-texture pipeline (UI-13). Next is local play feedback; `dev/staging` stays untouched under the user's explicit instruction. The main PR and deployment walkthrough still depend on their later staging confirmation. No additional broad qualification loop is required for these presentation repairs.

## Follow-up fixes review

Addressed the two findings and thumbnail concern in the user's `tmp/voxel-rewrite-fixes-review.md`:

- Shift-click continues through compatible stacks and then empty destinations. Each move waits for the server's result and fresh inventory view, verifies the source reduction and revision, and then uses that new revision. Rejection, unexpected ownership changes, closing the inventory and session changes stop the chain. No stacks are changed optimistically.
- Creative players can put any item in bag slots 1–9, select it and use **החזקה מהתיק**. The hotbar then shows those nine owned slots; number keys and hotbar buttons select tools, blocks or an empty hand through the existing authoritative selection transaction. First- and third-person presentation use the selected item, and remote appearance follows current ownership. Choosing a catalog block returns to the building palette, including when choosing the same block as before. Inventory help explains both routes.
- Catalog and recipe slots reuse cached images immediately. Uncached thumbnails are requested only for visible slots, with at most one request per animation frame. Scrolling, search, closing and disposal update or cancel pending work. Opening the catalog no longer synchronously renders all 172 thumbnails.

Focused checks passed: game TypeScript, the five native appearance tests (including creative tool/palette switching and rejected selection), an actual-DOM check using the authoritative inventory model with delayed result/view delivery, and a built-client/native-room browser check of visible held tools, number-key selection and return to the block palette. The DOM check reproduced the review's 64/60-log setup and completed moves of 4 and 60 at successive revisions; rejection and close stopped further moves. It also confirmed that uncached offscreen catalog items were not generated and search results loaded when visible. These software-browser checks establish behavior, not school-PC GPU timing. Matched client/server packaging and the published snapshot are updated; the engine and content are unchanged.

## Local-play entry, recovery and plant feedback

The app now enters an admitted, collision-ready world directly. Keyboard input works with the world focused; the first world click captures the mouse using the browser-required gesture. Explicit pause, inventory, graphics recovery and ended-session controls still apply. The initial loading state no longer asks for a second entry confirmation.

Failures, stalled transport and socket closure release pointer lock so recovery controls can receive clicks. Pointer-lock events preserve an existing error/recovery state. The entry button is offered only for a usable paused connection, rather than alongside reconnect on an unusable connection. Expired authorization still stops input at its original deadline in both gateway and worker; a missed renewal now permits a fresh admission retry. Confirmed denial remains a denial. Disconnect events now record the safe close code/reason before empty-room retirement. The user's logs prove clean empty-room saving/release, not the original disconnect trigger; this change does not claim to identify that trigger conclusively.

Removed the redundant mining progress bar from app and sandbox. Grass, flowers, saplings, mushrooms, cane and other cross-shaped plants have zero-duration authored mining rules. The server performs the usual validated break/drop transaction without publishing an active mining overlay. Ordinary blocks retain timed mining and cracks.

Focused validation passed: game/web TypeScript; actual-Wasm plant and ordinary-mining checks; gateway and independent-worker authorization-expiry checks; production React/native-room browser flow using in-memory checkpoint storage. The browser flow entered directly, used keyboard controls, retained the connection through a real periodic checkpoint, released captured mouse input after a server rejection, restored the saved world through an actual reconnect-button click, and recovered automatically after abrupt transport loss. It retained 64 owned logs across three admissions with one runtime mount. This is local functional evidence, not a hosted-network or school-device performance claim.

The matched release is `5ee78c6d15b18a4448b1a92f6777bf7747b08f737d4f85255403f5d219f8f9b3`. Plant tuning changes the content hash; use a fresh test session when trying this release. Existing checkpoints are not migrated or deleted. The engine is unchanged and its published Wasm is reused. Staging and log-level handling remain untouched.
