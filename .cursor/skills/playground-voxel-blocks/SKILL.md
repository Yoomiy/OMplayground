---
name: playground-voxel-blocks
description: Add or modify placeable voxel blocks under the upcoming data-driven content model. Covers shared BLOCK_DEFS, client noa registration loops, BLOCK_HUD display names, server placement/break validation, tool-required mining metadata, worldgen hooks, and texture assets.
---

# Adding or changing voxel blocks (post-refactor model)

Use this skill when touching block content for `game_url = minecraft`: IDs, textures, hardness/tool requirements, drop behavior, placeability, or world generation spawn rules.

## Target architecture (what we are moving to)

- **Single source of truth** for block definitions in `packages/voxel-content` (no manual duplicated constants between web/server).
- Block metadata is **data-driven** (`BLOCK_DEFS`), not scattered in `MinecraftClient.tsx` and server `if/else` logic.
- Client and server both derive runtime registries from shared defs:
  - client: noa material/block registration loops
  - server: placement legality, break rules, drop mappings, worldgen references
- Server remains authoritative for all block legality and outcomes.

## Hard rules

1. `AIR` stays id `0`; ids are append-only and never reused.
2. Do not add ad-hoc block constants directly in `apps/web/src/lib/voxelProtocol.ts` or `apps/minecraft-server/src/protocol.ts` once shared defs exist.
3. Keep **render data** and **gameplay data** in the same block definition:
   - render: texture(s), transparent/opaque/fluid flags
   - gameplay: hardness, required tool class/tier, drop item, placeable flag
4. Client may optimize UX, but server validates placement and breaking.
5. If worldgen can produce the block, server worldgen and client baseline mirror must stay aligned.

## Block definition checklist

1. **Shared content**
   - Add/update block in `packages/voxel-content` block defs.
   - Include: stable id/key, display name key, textures/material mapping, solidity/opacity/fluid flags, drop metadata, and mining metadata (hardness + required tool).

2. **Client registration** (`apps/web/src/games/MinecraftClient.tsx` + `packages/voxel-content/src/blockClientCatalog.ts`)
   - **Textures + noa materials/blocks:** add entries in `blockClientCatalog.ts` (`MC_MATERIAL_ENTRIES`, `NOA_BLOCK_ENTRIES`) and wire URLs in `MC_TEX`. Hotbar/creative icons are derived from `NOA_BLOCK_ENTRIES` via `BLOCK_HOTBAR_ICON` — do not duplicate icon maps per block.
   - **Display names (manual):** add a Hebrew tooltip label for every new placeable block in `BLOCK_HUD` in `MinecraftClient.tsx`. This map powers hotbar, inventory, and creative-picker `title` tooltips; missing entries fall back to the raw block id.
   - Ensure noa registration loops consume shared catalog entries (not one-off per-block calls).
   - Add any new textures under `apps/web/public/minecraft-assets/` (use `npm run borrow-voxel-textures` when pulling from voxelsrv).
   - For cutout textures (leaves/plants), set alpha-friendly material options consistently.

3. **Server validation**
   - Placement allow-list comes from shared defs (`placeable`), not hardcoded arrays.
   - Break/drop behavior comes from shared defs and tool rules.

4. **World generation**
   - If naturally generated, add rules in `apps/minecraft-server/src/world.ts`.
   - Keep client procedural baseline (if still used) visually consistent with server defaults.

5. **Tests**
   - Add/update server tests for placement legality, breakability, and worldgen ids (`apps/minecraft-server/src/world.test.ts` and related suites).

## When this skill is NOT enough

- Non-placeable inventory/crafting items, dropping from inventory, pickup rules: use `playground-voxel-items`.
- Dropped-entity rendering/animation lifecycle: use `playground-voxel-entities`.
- Generic board-game modules (`packages/game-logic`): use `playground-add-game`.

## PR sanity checks

- New/changed blocks compile from shared defs without manual duplicate edits.
- No client/server id drift.
- Every new placeable block has a `BLOCK_HUD` label (tooltips show Hebrew name, not a bare id).
- Placement, break speed/gating, and drops behave identically across reconnects.
