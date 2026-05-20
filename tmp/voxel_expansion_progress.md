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

## Comments / Instructions To Address

- None yet.
