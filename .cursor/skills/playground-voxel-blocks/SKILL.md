---
name: playground-voxel-blocks
description: Add or modify placeable voxel blocks using the shared packages/voxel-content model. Covers BLOCK_DEFS, blockClientCatalog noa registration, BLOCK_HUD display names, server placement/break validation, tool-required mining metadata, worldgen hooks, and texture assets.
---

# Adding or changing voxel blocks

Use this skill when touching block content for `game_url = minecraft`: IDs, textures, hardness/tool requirements, drop behavior, placeability, or world generation spawn rules.

## Current architecture

- **Single source of truth:** `packages/voxel-content` — no duplicated block constants between web and server.
- Block metadata is **data-driven** (`BLOCK_DEFS` in `blocks.ts` + `blockMiningMeta.ts`), not scattered `if/else` in apps.
- Client and server both derive runtime registries from shared defs:
  - client: `blockClientCatalog.ts` → noa material/block registration loops in `MinecraftClient.tsx`
  - server: placement legality, break rules, drop mappings, worldgen via `world.ts` + shared `worldgen.ts`
- Server remains authoritative for all block legality and outcomes.
- **Hebrew display names** remain a manual map: `BLOCK_HUD` in `MinecraftClient.tsx` (not yet in shared defs).

## Hard rules

1. `AIR` stays id `0`; ids are append-only and never reused.
2. Do not add ad-hoc block constants in `apps/web/src/lib/voxelProtocol.ts` or `apps/minecraft-server/src/protocol.ts` — extend `packages/voxel-content`.
3. Gameplay fields live in `blocks.ts` / `blockMiningMeta.ts`; render catalog entries in `blockClientCatalog.ts`. Keep ids aligned.
4. Client may optimize UX, but server validates placement and breaking.
5. If worldgen can produce the block, extend shared `packages/voxel-content/src/worldgen.ts` first; keep client procedural baseline aligned.

## Block definition checklist

1. **Shared content**
   - Add/update block in `packages/voxel-content` (`blocks.ts`, mining meta as needed).
   - Include: stable id/key, placeable/breakable flags, drop metadata, hardness + required tool.

2. **Client registration** (`MinecraftClient.tsx` + `packages/voxel-content/src/blockClientCatalog.ts`)
   - **Textures + noa materials/blocks:** add entries in `blockClientCatalog.ts` (`MC_MATERIAL_ENTRIES`, `NOA_BLOCK_ENTRIES`) and wire URLs in `MC_TEX`. Hotbar/creative icons are derived from `NOA_BLOCK_ENTRIES` via `BLOCK_HOTBAR_ICON` — do not duplicate icon maps per block.
   - **Display names (manual):** add a Hebrew tooltip label for every new placeable block in `BLOCK_HUD` in `MinecraftClient.tsx`.
   - Ensure noa registration loops consume shared catalog entries (not one-off per-block calls).
   - Add any new textures under `apps/web/public/minecraft-assets/` (use `npm run borrow-voxel-textures` when pulling from voxelsrv).
   - For cutout textures (leaves/plants), set alpha-friendly material options consistently.

3. **Server validation**
   - Placement allow-list from shared defs (`placeable`).
   - Break/drop from shared defs + `apps/minecraft-server/src/breakMining.ts`.

4. **World generation**
   - Biome/multi-biome rules in shared `worldgen.ts`; server `world.ts` consumes them.
   - Client worldgen worker must stay deterministic with server output.

5. **Tests**
   - `packages/voxel-content/src/blocks.test.ts`, `worldgen.test.ts`
   - `apps/minecraft-server/src/world.test.ts`, `breakMining.test.ts`, `blockBreakDrops.test.ts`

## When this skill is NOT enough

- Non-placeable inventory/crafting items, dropping from inventory, pickup rules: use `playground-voxel-items`.
- Dropped-entity rendering/animation lifecycle: use `playground-voxel-entities`.
- Generic board-game modules (`packages/game-logic`): use `playground-add-game`.

## PR sanity checks

- New/changed blocks compile from shared defs without manual duplicate edits.
- No client/server id drift.
- Every new placeable block has a `BLOCK_HUD` label (tooltips show Hebrew name, not a bare id).
- Placement, break speed/gating, and drops behave identically across reconnects.
