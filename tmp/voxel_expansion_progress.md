# Voxel Expansion Implementation Progress

This ledger tracks major advancements, decisions, verification, and comments to address while implementing `docs/voxel_expansion_specification.md`.

## 2026-05-20 - Branch and Baseline

- Switched work to `dev` as requested.
- Fast-forwarded `dev` from `main` because `dev` was the merge base and the voxel expansion specification already existed on `main`.
- Existing uncommitted change before this work: `.codexignore` adds `!.cursor/`. Treat as pre-existing unless it becomes explicitly required for this task.
- Loaded local `.cursor` voxel skills for block, item, and entity work.
- Initial gap scan found the current baseline still centered on:
  - 2x2 crafting only (`InventoryRegion = "hotbar" | "storage" | "craft"`).
  - Mirrored worldgen inside `MinecraftClient.tsx` instead of shared `packages/voxel-content/src/worldgen.ts`.
  - No visible shared biome registry, hunger/eating protocol, equipment inventory region, chest protocol, or centralized voxel audio manager.

## Major Decisions

- Implement the expansion from the shared package outward: shared content/data and tests first, then server authority, then client UX/rendering.
- Keep heavyweight commands sequential; do not run build, lint, or test commands in parallel.
- Use `tmp/voxel_expansion_progress.md` as the working checklist/comment file and check it before each major implementation pass.

## 2026-05-20 - Shared Content Phase

- Added canonical block IDs 100-102 for `LADDER`, `TORCH`, and `CHEST`.
- Added expansion item IDs 111-126 for ingots, gems, food, diamond tools, swift pickaxe, flint and steel, and perk equipment.
- Added shared food/perk metadata helpers so hunger and equipment systems can be server-authoritative later.
- Added `BIOME_DEFS`, deterministic `MultiBiomeGenerator`, shared noise helpers, and shared `proceduralVoxelID` / `findSurfaceY` exports.
- Added content tests for biome metadata, deterministic worldgen, ocean water fill, dry surface safety, mechanical block IDs, and expansion item metadata.
- Verification run:
  - `npm run build -w @playground/voxel-content` passed.
  - `npm test -w @playground/voxel-content` passed: 5 suites, 32 tests.

## Current Work

- Working on Phase 1 implementation from `docs/voxel_expansion_specification.md`.
- Completed the shared package foundation: biome definitions, deterministic multi-biome worldgen, expansion block IDs, expansion item IDs, and focused package tests.
- Integrated the shared `proceduralVoxelID` and surface lookup into `apps/minecraft-server/src/world.ts`.
- Replaced the duplicated client-side worldgen in `apps/web/src/games/MinecraftClient.tsx` with the shared generator import.
- Updated the client texture map to the current `minecraft-assets/block/` asset layout, including ladder, torch, and chest.
- Tightened spawn fallback logic so rare water-heavy searches place players above sea level and clear blocking terrain.
- Added server-authoritative survival vitals and timed eating:
  - health/hunger/saturation/exhaustion persist through pause/resume and disconnect/reconnect,
  - movement, jumping, mining, regeneration, starvation, and food consumption update server state,
  - right-click food starts a timed eat action, releasing cancels, and completion consumes one item,
  - survival HUD shows server-synced health/hunger and eating temporarily slows movement.
- Verification run:
  - `npm run build -w @playground/voxel-content` passed after the spawn safety update.
  - `npm test -w @playground/minecraft-server -- world.test.ts` passed: 1 suite, 13 tests.
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run lint -w @playground/web` passed.
- Addressed the open performance and zoom-out WebGL comments with a focused terrain/model-cache pass.
- Added server-authoritative chest/container persistence and drag moves.
- Added client ladder climbing and torch point lights.
- Added rate-limited multiplayer arm swing sync and avatar swing animation.
- Next concrete step: first-person held-tool rendering, then remaining perk hooks like Helios sunlight regen / damage-reduction hooks when damage exists.

## 2026-05-20 - Shared Recipe Model

- Replaced the old 2x2-only shapeless recipe matcher with a unified shaped/shapeless matcher.
- Added bounding-box shrinking so shaped recipes can match anywhere inside either the 2x2 personal grid or the 3x3 crafting-table grid.
- Added expansion recipes for crafting table, sticks, pickaxes, axes, bread, helium boots, swift pickaxe, coal/ingot/diamond conversions, ladder, torch, chest, heavy shield, feather falling talisman, and Helios medallion.
- Added `GOLD_INGOT` as item ID `127` because the Helios recipe requires gold ingots while the previous expansion item list omitted them.
- Verification run:
  - `npm run build -w @playground/voxel-content` passed.
  - `npm test -w @playground/voxel-content` passed: 5 suites, 32 tests.

## 2026-05-20 - Crafting Table Grid Flow

- Addressed the normal-inventory crafting slot issue: survival now keeps a 9-slot server backing array, but normal inventory renders and accepts moves only in the top-left personal 2x2 cells `[0, 1, 3, 4]`.
- Added server-authoritative `craftingGridWidth` sync, `OPEN_CRAFTING_TABLE`, and `CLOSE_CRAFTING_TABLE`; right-clicking a crafting table in survival opens the 3x3 grid only after the server verifies reach and block identity.
- Closing a crafting table returns table-only cells to hotbar/item storage and drops overflow near the player as world drops.
- Updated client preview to run the shared recipe matcher against either the personal 2x2 projection or the full 3x3 grid.
- Added inventory tests for 3x3-only tool crafting and returning inactive table cells.
- Verification run:
  - `npm test -w @playground/minecraft-server -- inventory.test.ts room.test.ts` passed: 2 suites, 29 tests.
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run build -w @playground/voxel-content` passed.
  - `npm test -w @playground/voxel-content` passed: 5 suites, 32 tests.
  - `npm run lint -w @playground/web` passed.
  - `npm test -w @playground/minecraft-server -- drops.test.ts -t "magnet pickup adds blocks" --runInBand` passed.
  - Attempted the full minecraft-server Jest suite twice; all displayed suites passed, but the process hung before a clean summary because `drops.test.ts` did not complete. The stuck Jest processes were stopped.

## 2026-05-20 - Equipment Slots and Perk Hooks

- Added the `equipment` inventory region with four authoritative equipment slots: head, chest, legs, and feet.
- Equipment slots persist through pause/resume and disconnect/reconnect alongside hotbar, item storage, and crafting grid state.
- Server inventory moves now validate equipment placement against shared item perk metadata; e.g. helium boots only fit feet, glow/Helios items fit head, feather talisman fits legs, and heavy shield fits chest.
- Client inventory renders a dedicated equipment area and syncs equipment through join/inventory payloads.
- Client perk hooks are active from synced equipment:
  - helium boots increase local jump force,
  - heavy shield reduces local movement speed,
  - glow talisman enables full-bright ambient lighting.
- Verification run:
  - `npm test -w @playground/minecraft-server -- inventory.test.ts room.test.ts` passed: 2 suites, 33 tests.
  - `npm test -w @playground/minecraft-server -- drops.test.ts -t "magnet pickup adds blocks" --runInBand` passed.
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run lint -w @playground/web` passed.

## 2026-05-20 - Survival Hunger and Eating

- Added `PlayerVitals` to the voxel protocol, join ack, inventory sync payloads, and room snapshots.
- Added server-side vitals runtime helpers for default state, persistence hydration, exhaustion decay, hunger/saturation drain, health regeneration, starvation damage, and food application.
- Persisted vitals alongside survival hotbar, item storage, crafting grid, and equipment state for pause/resume and disconnect/reconnect.
- Wired server-authoritative eating:
  - `EAT_START` validates survival mode, hotbar slot, food metadata, and non-full hunger;
  - `EAT_FINISH` requires the timed hold window, consumes one food item, applies nutrition/saturation, and emits inventory/vitals sync;
  - `EAT_CANCEL` clears pending eating.
- Added movement/jump/mining exhaustion and a survival vitals tick before dirty snapshot coalescing, so passive hunger/health changes still emit snapshots.
- Client socket state now tracks vitals and exposes typed eat start/finish/cancel callbacks.
- Client survival controls now right-click food to eat, cancel on release, slow movement while eating, and render a compact health/hunger HUD above the hotbar.
- Focused verification run:
  - `npm test -w @playground/minecraft-server -- vitals.test.ts tick.test.ts room.test.ts --runInBand` passed: 3 suites, 20 tests.
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run lint -w @playground/web` passed.

## 2026-05-20 - Worldgen Math Check

- Addressed the comment asking to double-check the new worldgen math.
- Ran an empirical scan with seed `1234567`, window `-1000..1000` on X/Z, step `20`:
  - Land: `36.5%`; ocean/water: `63.5%`, inside the spec target of `30%-70%` land.
  - Sampled biome counts: beach `2079`, desert `612`, forest `611`, ice mountains `22`, iceplains `1360`, mountains `939`, ocean `1723`, plains `2406`, savanna `449`.
  - Approximate connected biome areas at 20-block resolution: savanna around `15k` blocks, forest/desert around `27k-31k`, plains/iceplains/mountains/ocean around `62k-98k`, beach around `208k` due deliberate broad shelves.
- Adjusted the generator after the first scan showed sharp threshold cliffs:
  - widened water transition blending,
  - added mountain/coastal beach shelf blending,
  - added desert/mountain, savanna/mountain, and cold/warm highland transition blending,
  - clamped desert dune height to avoid accidental underwater desert cells.
- Tradeoff vs `voxelsrv-server`: this keeps our generator synchronous and O(1) for the web client, so it has less high-frequency biome detail than worker/neighborhood approaches, but it avoids the client lag and duplicated logic the spec warned about.
- Added a regression test that samples a 2000x2000 window and asserts the land/ocean balance remains in the target range.
- Verification after tuning:
  - `npm run build -w @playground/voxel-content` passed.
  - `npm test -w @playground/voxel-content` passed: 5 suites, 33 tests.
  - `npm test -w @playground/minecraft-server -- world.test.ts` passed: 1 suite, 13 tests.
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run lint -w @playground/web` passed.

## 2026-05-20 - Performance and Zoom WebGL Comment Pass

- Addressed the comment asking whether rendering should move to another thread and where the bottleneck is.
- Finding: the highest-risk hot path is the browser chunk fill path, not the server. The server samples procedural blocks sparsely for reach checks, deltas, drops, and spawn lookup; the web client fills whole noa chunks synchronously.
- Immediate fix:
  - cached `MultiBiomeGenerator.sampleColumn(x,z)` results per seed with bounded pruning,
  - skipped expensive tree/structure checks for blocks far above the local terrain column,
  - kept server math unchanged behaviorally while reducing repeated client column/noise work during vertical chunk fills.
- Addressed the zoom-out WebGL comment:
  - `voxelJsonModel` template caching is now scene-aware,
  - if a cached Babylon template belongs to an old scene, it is disposed and rebuilt before cloning,
  - this avoids cloning mesh/geometry resources from a different WebGL context when the local player body becomes visible after zooming out or after remounts.
- Decision: do not move rendering/worldgen to a worker yet. A worker would require async chunk plumbing around noa and cross-thread delta hydration; the current bottleneck had lower-risk local fixes first.
- Verification run:
  - `npm run build -w @playground/voxel-content` passed.
  - `npm test -w @playground/voxel-content -- worldgen.test.ts --runInBand` passed: 1 suite, 7 tests.
  - `npm run lint -w @playground/web` passed.
  - `npm run lint -w @playground/minecraft-server` passed.

## 2026-05-20 - Chest Storage

- Added a `chest` inventory region plus 27-slot mixed block/item chest slots in the shared voxel protocol.
- Added server inventory support for moving stacks between hotbar, item storage, and open chest slots while keeping equipment/crafting validation unchanged.
- Added persistent room chest state keyed by chest block coordinate (`"x,y,z"`) and included chests in pause/resume snapshots.
- Added server-authoritative chest interaction:
  - right-click/open validates survival mode, reach, block identity, and per-chest lock ownership,
  - `CHEST_MOVE` applies authoritative stack moves against the locked chest,
  - close/disconnect releases locks,
  - breaking a chest ejects its contents as world drops, removes the persisted chest inventory, releases locks, and closes active clients.
- Client socket state now tracks the active chest and receives `CHEST_SYNC`.
- Client survival right-click opens chest blocks, and the inventory overlay renders a 27-slot chest grid that drag-moves with hotbar/storage through the server.
- Verification run:
  - `npm test -w @playground/minecraft-server -- inventory.test.ts room.test.ts --runInBand` passed: 2 suites, 37 tests.
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run lint -w @playground/web` passed.

## 2026-05-20 - Ladder and Torch Mechanics

- Added client-side ladder movement behavior using the authoritative synced block map:
  - detects when the player bounding box overlaps a `LADDER` block,
  - climbs while pressing jump/forward,
  - descends on backward,
  - otherwise slides slowly instead of falling through.
- Added torch point-light lifecycle:
  - existing torch deltas create warm Babylon point lights on load,
  - `BLOCK_DELTA` updates create/remove lights when torches are placed or broken,
  - teardown disposes all active torch lights with the noa scene.
- Kept placement/break authority unchanged on the server; the client derives movement/light effects from server-synced blocks.
- Verification run:
  - `npm run lint -w @playground/web` passed.

## 2026-05-20 - Arm Swing Sync

- Added typed `ARM_SWING` / `PLAYER_ARM_SWING` protocol payloads.
- Server now rate-limits swing broadcasts per player at 150ms and relays accepted swings to other players in the voxel room.
- Client socket layer exposes `armSwing` and `onArmSwing` alongside existing snapshot/block listeners.
- Local mining/placing actions trigger a swing request and animate the local third-person avatar if visible.
- Remote avatar rigs now track swing state and overlay a right-arm swing animation on top of walking/head-pitch updates.
- Verification run:
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run lint -w @playground/web` passed.

## Comments / Instructions To Address

- Addressed: added `Current Work` above to explain the active implementation slice and next concrete step.
- Addressed: double-checked worldgen math and documented the empirical biome-area scan in `Worldgen Math Check`.
- just so you know: i have ( npm run dev:server )&; ( npm run dev:minecraft )&; npm run dev:web running in the background
- Addressed: normal inventory now shows only the 2x2 personal craft cells, while right-clicking a crafting table opens the server-authorized 3x3 view.
- Addressed: the slowdown bottleneck is primarily client chunk generation; server math is sparse. Added bounded biome-column caching and high-air structure culling before considering a worker.
- Addressed: zoom-out WebGL context error likely came from scene-blind voxel model template caching; templates now rebuild when the Babylon scene changes.

- adress unadressed comments!
