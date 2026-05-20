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
- Verification run:
  - `npm run build -w @playground/voxel-content` passed after the spawn safety update.
  - `npm test -w @playground/minecraft-server -- world.test.ts` passed: 1 suite, 13 tests.
  - `npm run lint -w @playground/minecraft-server` passed.
  - `npm run lint -w @playground/web` passed.
- Next concrete step: implement the unified 2x2/3x3 recipe model and server-authoritative 3x3 crafting table flow, because equipment/food recipes depend on those item definitions.

## 2026-05-20 - Shared Recipe Model

- Replaced the old 2x2-only shapeless recipe matcher with a unified shaped/shapeless matcher.
- Added bounding-box shrinking so shaped recipes can match anywhere inside either the 2x2 personal grid or the 3x3 crafting-table grid.
- Added expansion recipes for crafting table, sticks, pickaxes, axes, bread, helium boots, swift pickaxe, coal/ingot/diamond conversions, ladder, torch, chest, heavy shield, feather falling talisman, and Helios medallion.
- Added `GOLD_INGOT` as item ID `127` because the Helios recipe requires gold ingots while the previous expansion item list omitted them.
- Verification run:
  - `npm run build -w @playground/voxel-content` passed.
  - `npm test -w @playground/voxel-content` passed: 5 suites, 32 tests.

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

## Comments / Instructions To Address

- Addressed: added `Current Work` above to explain the active implementation slice and next concrete step.
- Addressed: double-checked worldgen math and documented the empirical biome-area scan in `Worldgen Math Check`.
- just so you know: i have ( npm run dev:server )&; ( npm run dev:minecraft )&; npm run dev:web running in the background
