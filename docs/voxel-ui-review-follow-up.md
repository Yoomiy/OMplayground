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

The matched published game release is `0119f4a9e8a1701a86c4bc0a2b4d9442d3cc16f4fb691fe9897332d864b19d56`.

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

## Play feedback: cursor, tool reward, foliage and communication widgets

The user reports a longer play period with one remaining disconnect. Its event identifies authorization expiry with a renewal 2254 ms in flight, followed by unavailable room-policy reads. Authorization deadlines/fencing remain unchanged in this batch; it does not claim to eliminate real provider outages.

- Cursor-carried icons are centered at the pointer, including on first selection. Native dragging uses a transparent, rendered-size canvas preview centered on the pointer and hides the separate carried icon during that drag.
- The appropriate starting tool is roughly nine times faster than bare hands on wood and ground. Material families without a specific authored affinity use their existing wood/stone/ground metadata; wrong tools receive the same timing as bare hands. Tool requirements and durability remain authoritative. Cross-shaped plants still break immediately.
- Cross-shaped plants and leaves no longer receive the box-shaped target/crack presentation. Their actual ray target and server validation are retained.
- Item styling now resolves an item's authored material as well as placed blocks. Plant fibers therefore receive the leaf tint/cutout in thumbnails, dropped models and held presentation, rather than sampling grayscale leaf textures without tint. Bucket metal/water styling is retained.
- Chat follows the old compact dark floating card, with a draggable header, focused one-line input, Enter to send and a four-message minimized preview. The preview polls only while connected/paused/dead in a live session, every ten seconds; open chat keeps its three-second polling. Reads/writes/moderation retain their existing authorization and receipt checks. Normal successful sends no longer add an extra confirmation block.
- Audio uses a compact card: join first, microphone/speaker controls when connected, with device settings and staff moderation collapsed. M uses the same permission-checked microphone flow. Opening either widget hides the unrelated resume hint; closing restores game control. No microphone is started without an explicit user action.
- The app presents Minecraft without creative/survival badges or a gameplay-mode switch. Internal developer fixtures retain their trusted setup commands. Guide/catalog wording follows the single-game presentation.
- The end-dialog button says “סיום המפגש”; its body and receipt explain that the session cannot be resumed. Pause remains the save-for-later action. No text claims a final end checkpoint.

Focused validation: game/web types; three tool/material/bucket checks; four actual-Wasm mining/plant/release/tool checks; delayed-response inventory/cursor geometry flow; production React/native-room chat send/close, compact audio settings, recipe crafting, held fiber/PNG thumbnails, mode-label absence and end wording. Screenshots were reviewed at 1366×850. The final widget check also verifies that the readable minimized chat preview stays at the viewport's left edge. No SFU connection, hosted write, broad gameplay/media matrix or physical-PC performance claim is included. Existing browser tools were aligned with the changed controls but their full suites were not rerun.

Matched release: `97e41770853caa0eb4768e5b7784d3b065d00be776b92f8e059d703ae4397795`. Engine, content and protocol are unchanged, so the current saved world remains compatible. No migration, world reset or staging push.

## Initialization palette flash

The loading HUD defaulted to creative and displayed a filled palette before the server's welcome established the actual rules. It now starts with normal gameplay defaults, no selected block and an empty hotbar. Terrain jobs still begin only after the authoritative welcome supplies the seed/world identity. The school service already starts fresh worlds with normal gameplay rules; restored checkpoints retain their saved rules. This is a presentation fix, not a second terrain-generation path.

The map-generation question also confirmed that the gateway currently defaults every fresh room to seed `4242`. New rooms therefore start with the same terrain and maintain separate saved edits. This seed behavior was not changed by the initialization fix. Game types and matched packaging pass; no broad suite was rerun. Matched release: `c36e8047624d2b4afac1752eaf97687fb0a05ab5ff51af17b6730b61f9f89911`; engine/content/protocol unchanged, no migration/reset/push.


## Streamed exploration and distinct new-world seeds

The user requested auditing the 512×512 fence and removing it if streaming did not need it. The server loads nearby 3×3 columns per actor; the browser unloads distant render columns, and checkpoints retain edits rather than a generated map. No capacity or delta-storage requirement justifies the old fence. The profile now selects streamed terrain. Height remains 256. A shared guard at ±999,984 blocks stays inside the published native body-sweep API's ±1,000,000 coordinate contract; it also stays below the generator's f32 integer precision horizon. The engine is unchanged.

Compatible old centered finite saves expand on restore, retaining their original seed, edits, player positions and inventory. Content/engine/generator compatibility checks remain. New school worlds reserve a unique uint32 seed transactionally before their first checkpoint. A noncycling database sequence, bijective permutation and unique constraint prevent collisions/reuse, including across service instances. Seed 4242 is excluded for historical worlds. Restarting before the first checkpoint reuses the reservation. Saved worlds use their embedded seed. Standalone development fallback derives a stable seed from world identity; explicit development overrides remain available for deterministic fixtures.

The user confirmed applying `20261029220000_voxel_unique_world_seeds.sql` locally/staging. Its new RPC preserves the existing lease/fencing checks and leaves the old RPC and saves intact. Startup checks for the installed seed schema. No hosted writes were made by these checks.

Focused checks pass: game/service types; 13 checkpoint/inventory/survival checks; six service persistence checks; actual published-Wasm movement and drops near the numeric guard, wire validation, old-bounds expansion and far-edit socket recovery; distinct reserved seeds, worker termination before the first save and committed-seed restart. The latter flows also pass against the packaged gateway. Isolated PostgreSQL/PGlite verifies 32 distinct seeds, idempotence, ownership fencing, pre-checkpoint restart, legacy saves and browser-role denial. A permanent PostgreSQL integration case covers reservation and concurrent distinct-world allocation; the PostgreSQL CLI suite was not run in this executor. No broad browser or scale suite was added.

Matched release: `c6a2adac33c3ec1f094cd76d3ff7465686ee8c13b5df6174af20ff67c2871a02`. Restart the local stack and refresh the browser; no world reset is required. This is committed locally with no staging push.


## Voice signaling and game-audio activation

The user reported Vite WebSocket hang-ups on `/voxel-media/rtc/v1`, a subsequent ticket-validation 401, and silent game effects. The current branch was first merged locally into `dev/staging` at `fb0ae1d`; no push was made.

A focused regression reproduces a voice proof race: the game connection renews while the separate school authorization read is running, but voice still rejects the expiry sampled before IO. Voice now uses the fresh school result and the current same game connection. Connection/cohort loss, expired school proofs, media revisions and independent worker deadlines still fail closed. A second regression reproduces successful slow media reads exhausting the proof when renewal waits half the remaining lifetime. Renewal now reserves its measured provider duration. Both regressions fail against the previous code and pass after the changes.

A media handshake whose ticket expires during policy IO now sends an explicit 401 rather than destroying the socket with no HTTP response. Late replies still cannot allocate a connection. `VOXEL_VOICE_CONNECTION_FAILED` logs fixed phase/reason codes and an upstream status when available, without request URLs, tickets or credentials. Existing logging formats/levels are retained. Consumed tickets remain single-use, so a fallback validation 401 alone does not establish an incorrect LiveKit secret.

Automatic world entry did not create/unlock game audio. A normal focused movement key or world click now unlocks the effects context; an already-running context is reused. A software-browser check used automatic entry with no resume command, pressed W and measured a real footstep waveform after the master output (RMS about 0.001). Muting measured zero; disposal closed the context.

Validation: game/service types, 11 focused media checks, existing dev-proxy routing extended to `/rtc/v1`, and a real Vite → packaged gateway → signaling worker → local provider binary join pass. The proxy flow verifies the private provider credential is substituted upstream and a consumed browser ticket cannot validate again. These checks made no hosted calls and do not prove the user's self-hosted SFU/ICE deployment is healthy. No broad browser/media suite was run.

Matched release: `8658d3b91ebdaeeb4df5c82be0e829bb0f6944043f01a3871eb42e186615b8e8`. Restart the stack and refresh the browser. No migration, environment change or world reset is required. The fixes are committed locally and merged into local `dev/staging` without pushing.


## Leaf loot, mouse-free eating and mining guidance — 2026-10-30

Removed the guaranteed apple from every leaf. Oak now uses the existing deterministic forage roll for a 2% apple or 5% sapling outcome; birch/spruce retain only the 5% sapling roll. Existing owned stacks remain intact. Holding owned food and right-clicking sends the normal authoritative consume operation; R remains available. Escape releases the mouse without putting a blocking status card over the HUD. The eating button remains enabled for a playable, mouse-free connection with selected food and hunger. Global session pause, disconnection, full food and cooldown rules still apply.

Audited every currently authored block shape. Plants, leaves, torches and ladders omit target/crack presentation. Torches and ladders now break immediately, alongside plants; solid blocks, slabs/stairs and glass retain shape-aware feedback. The native action still validates aim, ownership, revisions and permissions. The ladder regression aims at an actual rail rather than the empty center of its model.

The guide groups required blocks by the minimum named tool (wood, stone, iron and diamond pickaxes), sorted by progression. Common resources appear first; longer building-block lists expand on demand. Recommended axes and shovels are distinguished from required tools. Authority and help share the same tool-preference function. Food/control guidance describes right-click eating and mouse release.

These content changes preserve state IDs/geometry, items, recipes, generator and checkpoint formats. The reviewed transition from content hash `2d930b06841018cd0cb4adc65905432e4ffedc3ea2d112bb7ff65a811165307c` to `05809e4f10d630b5446d0872e38b1ba7f40263d0a3fb59f5ea3e7c023d190ddc` is explicitly accepted by the save decoders. Other content mismatches still fail closed. An actual prior-tuning native checkpoint restores through object storage with its seed, edits, position, inventory, durability and dropped items intact. Future content changes require another compatibility review.

The requested cave-light audit found that meshing waits for its full neighbor set. Sky-colored distance fog/background can still expose the render frontier as a bright opening. A small trial reused the native sky probe at 4 Hz while covered; its measured native cost was about 0.024 ms per probe locally. The visual check showed it also darkened real outdoor openings under cover. That trial was reverted. No lighting/rendering changes ship in this batch. Distinguishing genuine exits from unloaded space needs further discussion under the user's explicit scope constraint.

Focused validation passes: game/web/service types; deterministic rare-apple check; native instant-attachment mining; native prior-content object-store recovery; and a production React/native-worker browser flow consuming food by right-click and by the mouse-free button. The latter observes hunger 4→8→12 and owned apples 4→3→2, no blocking release modal and correct tool guidance. Screenshots at 1366×850 were reviewed. No hosted writes, broad qualification or new migration. Engine Wasm is unchanged and reused.

Matched release: `0119f4a9e8a1701a86c4bc0a2b4d9442d3cc16f4fb691fe9897332d864b19d56`. Commit locally, restart the stack and refresh. Existing compatible worlds need no reset; staging is not pushed.
