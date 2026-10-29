# Voxel UI review follow-up

Repairs for the 2026-10-29 source review of `90fe575`. The first batch is `6af8112`; this follow-up adds camera support, graphics restoration and confirmed station/mining presentation behavior.

| Review findings | Implemented behavior |
| --- | --- |
| UI-01, UI-06 | Item thumbnails use the actual world models and textures. Hotbar and inventory show stack counts and durability. Survival health, food and air have graphical meters; air also shows seconds. |
| UI-02, UI-03, UI-05 | Compact nine-slot hotbar, parchment/wood inventory and smaller floating header. Session management lives in a menu. Timed mining uses target cracks without an extra progress bar. |
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

The matched published game release is `596d8ffc6b18024f391e27cf7c26a3a40bf82b806abe88168ac2737f92fbb80c`.

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

## Legacy UI parity and explicit session end

The next local-play report identified remaining regressions against the old game. The old inventory and guide were compared directly in source. This batch restores the following concrete workflows; it does not claim that every legacy presentation detail has been restored.

| Workflow | Current behavior |
| --- | --- |
| Inventory layout/theme | Parchment and wood panels, beveled image slots, crafting/result at the top, three bag rows and a separate numbered hotbar. Creative catalog has its own tab. Header, menus, chat and help use the same palette. |
| Stack distribution | Selected stacks remain in hand after placing one item. Rapid right-clicks across destinations queue against acknowledged revisions. Right-clicking the source selects half; clicking the source again cancels. Rejection retains a valid selection and stops queued moves. |
| Recipe discovery | Available recipes and basic progression come first. Categories cover tools/equipment, building, food/materials and all recipes. Search, ingredient availability and station requirements remain visible. |
| Recipe preparation | “סידור ברשת” returns existing ingredients to the bag, then places the recipe through ordinary authoritative moves. Creating the result remains an explicit result-slot click. A full bag or missing ingredients produces guidance rather than discarding items. |
| Guide | Six familiar topics: controls, crafting, tools, building, food and equipment. The crafting page explains log → planks → table and splitting a stack. Tool/equipment values come from the current content definitions. |
| Desktop controls | H toggles help, T/Enter opens chat, E closes inventory and returns mouse control. Arrow movement, Q drop, X attack and middle-click block selection are available alongside existing controls. |
| End versus pause | “סיום המפגש” ends without requesting a final checkpoint. “השהיית המפגש” still requires a committed save. Autosaves already in flight may finish; previous checkpoints are not deleted. Ordinary last-player departure and service drain retain saving. |

The user confirmed applying `20261029160000_voxel_end_without_checkpoint.sql`. It permits a null checkpoint only for end/resume, retaining ownership/epoch fencing, audited receipts and pause durability. It also accepts historical saved-end receipts from older servers.

Focused checks: strict game/web/service types; end/pause unit and receipt checks; actual PostgreSQL semantics in an isolated PGlite instance; a delayed-response authoritative inventory DOM flow distributing a stack across four cells and crafting a table; and a production React/native-room browser flow exercising the guide, shortcuts, recipe arrangement, table result and explicit end. The latter observed zero new checkpoint requests after end was accepted. Desktop screenshots at 1366×850 were reviewed. Persistence/lifecycle fixtures were local; these checks made no hosted writes and do not establish school-PC GPU performance. Existing PostgreSQL integration tests were updated but their CLI suite was not rerun.

Matched release: `cff3c428323c1a660d06f63fdebd4801a74faca4e5ca7bfd02906087c4154868`. Content, engine and protocol are unchanged from the prior entry/recovery release, so this batch does not require another world reset. No broad qualification rerun, log-level change or staging push was performed.

## Authorization renewal during slow startup/provider reads

The next local report contains repeated `RECOVERING` disconnects from the authorization supervisor (and once the worker), followed by clean save/release and fresh admission. This identifies the authorization path behind that rejoin loop; successful checkpoints precede the disconnect.

A focused reproduction exposed a renewal scheduling flaw. A proof aged by startup/membership IO waited another half of its remaining lifetime before renewal. School proofs expire five seconds from the provider request start, so the remaining time also excludes the provider's response latency. Both delays could leave too little time to finish the next check. The reproduction failed against the previous code.

The first connected check now starts immediately. Later checks reserve the observed provider duration in addition to half the remaining window. Temporary provider errors retry inside the current proof; they never move its independent expiry. Confirmed denial, capability changes and session completion still close the connection, and late responses cannot revive it. Safe disconnect fields distinguish expired/denied/changed/ended authorization and record renewal duration without provider messages or tokens. Log levels/format remain unchanged.

Focused validation passes: five authorization unit checks; a real native gateway/worker with in-memory durable ownership, slow membership acceptance leaving 1.6 seconds of its five-second proof, and successive one-second renewal reads; existing capability-revocation and late-response expiry checks; and terminal completion. The durable room retained the same worker and owner through the repeated checks. Game/service TypeScript and matched packaging pass. No hosted calls, browser matrix or broader gameplay suite was added.

Matched release: `a0fe518cf938d99a9197513bc4a7aff78217db7db0a70c3095eb49e3f81bad55`. Restart the local stack and refresh the browser to load the matched build. Content/engine/protocol are unchanged; no migration or additional world reset is required. The local reproduction is not a claim of verified hosted provider performance. Staging remains untouched.

## Stable inventory controls using the old layout

The user rejected the combined inventory/recipe layout and reported movement when selecting items. The old `MinecraftClient.tsx` inventory was read directly: a compact 640px panel, crafting at the top, equipment then storage/hotbar, 40px gray beveled slots, and a separate centered 440px recipe-book window. This batch follows that structure instead of keeping the earlier combined 1040px panel.

The main panel has a fixed viewport-bounded frame. Its header, status line, item details and action row reserve their space rather than appearing/disappearing on selection. The hotbar stays visible at the bottom; storage scrolls above it when needed. Selection, pending acknowledgments and inventory revisions update the existing slot buttons rather than replacing the entire layout. Structural changes such as opening a chest or switching to a workbench rebuild only when that layout actually changes. Catalog selection retains its list nodes and scroll position. Recipe previews use explicit left-to-right ingredient → result rows and compact cards.

The recipe book opens separately, as in the old version. E/Esc returns from it to the unchanged inventory. Arranging a recipe returns to the crafting grid; creating its result remains explicit. E/Esc or the close button returns from inventory to the game. Closing chat and voice restores local control, numpad digits select hotbar slots, and NumpadEnter opens chat. Escape without current browser activation restores keyboard control; the next world click captures the mouse. Help no longer displays an entry prompt behind it. Permissions, recipes, inventory authority and session lifecycle are unchanged.

Focused checks use the actual authoritative inventory model with delayed responses: select/split/distribute/craft two tables, prepare recipes, search/categories and reject a transfer. Dialog/grid/slot rectangles remain identical across the interaction and the original slot nodes remain connected. A production React/native-worker browser flow verifies separate recipe preparation, table crafting, help/chat shortcuts and returning to game control; screenshots were reviewed at 1366×850. Game/web types and matched packaging pass. These are local functional/visual checks, with no hosted writes, broader gameplay rerun or school-PC performance claim.

Matched release: `596d8ffc6b18024f391e27cf7c26a3a40bf82b806abe88168ac2737f92fbb80c`. No content/engine/protocol change, migration or additional world reset. No staging push.
