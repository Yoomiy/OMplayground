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
- Next concrete step: integrate the shared `proceduralVoxelID` and surface lookup into `apps/minecraft-server/src/world.ts` and replace the duplicated client-side worldgen in `apps/web/src/games/MinecraftClient.tsx`.

## Comments / Instructions To Address

- Addressed: added `Current Work` above to explain the active implementation slice and next concrete step.
