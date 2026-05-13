---
name: playground-voxel-blocks
description: Add a new block type (placeable voxel "item") to the Playground Minecraft-style game. Covers lock-step protocol IDs in apps/web and apps/minecraft-server, server placement validation, optional world generation in world.ts, noa materials/textures in MinecraftClient.tsx, and assets under public/minecraft-assets. Use when the user asks for new blocks, items, hotbar slots, textures, or BLOCK_REGISTRY changes for the voxel game (game_url minecraft / Voxel server).
---

# Adding a block type to the Voxel (Minecraft) game

In this project, **"items" in survival parlance are block IDs**: the hotbar sends a numeric `blockId` on place; there is no separate item entity system.

## Rules

- **Keep `apps/web/src/lib/voxelProtocol.ts` and `apps/minecraft-server/src/protocol.ts` identical** for `BLOCK_REGISTRY`, `PLACEABLE_BLOCK_IDS`, and `MAX_REACH`. These files are intentionally duplicated until `packages/voxel-protocol` exists.
- **`AIR` must stay `0`.** Assign the next unused integer (today `GLASS` is `8`; the next free id is `9`).
- **Server is authoritative for placement**: the socket handler rejects `blockId` values not in `PLACEABLE_BLOCK_IDS` (see [`index.ts`](../../../apps/minecraft-server/src/index.ts) around the `placeBlock` / `PL.includes` check). The client must not be trusted for legality—only for UX (hotbar).
- **World generation** uses numeric IDs from `proceduralVoxelID` in [`world.ts`](../../../apps/minecraft-server/src/world.ts). If the new block should **never** spawn naturally, skip world changes; if it should appear in terrain, update **both** `world.ts` and the mirrored `proceduralVoxelID` in [`MinecraftClient.tsx`](../../../apps/web/src/games/MinecraftClient.tsx) so chunk meshing matches the server baseline + deltas.

## Checklist (every new placeable block)

1. **Protocol (both sides)**  
   - Add `BLOCK_REGISTRY.YOUR_BLOCK = <id>` in:
     - [`apps/web/src/lib/voxelProtocol.ts`](../../../apps/web/src/lib/voxelProtocol.ts)
     - [`apps/minecraft-server/src/protocol.ts`](../../../apps/minecraft-server/src/protocol.ts)
   - Append the id to `PLACEABLE_BLOCK_IDS` if players may **place** it from the hotbar.

2. **Hotbar**  
   - [`MinecraftClient.tsx`](../../../apps/web/src/games/MinecraftClient.tsx) uses `const HOTBAR = PLACEABLE_BLOCK_IDS` and number keys `1..n`. New placeable blocks automatically gain a slot when added to `PLACEABLE_BLOCK_IDS` (order = hotbar order).

3. **Rendering (noa)** — same file, inside the engine `useEffect`:
   - **Textures**: add PNG(s) under [`apps/web/public/minecraft-assets/`](../../../apps/web/public/minecraft-assets/) (see texture skill / plan: one `registerMaterial` per unique `textureURL`).
   - Extend `MC_TEX` and `registerMcTerrainMaterials`: one material name per distinct file; reuse material names wherever the same PNG applies.
   - Call `noa.registry.registerBlock(BLOCK_REGISTRY.YOUR_BLOCK, { material, solid, opaque?, fluid? })`:
     - `material`: string (all faces) or `[top, bottom, sides]` or six face names — see [noa BlockOptions](https://fenomas.github.io/noa/API/classes/_internal_.BlockOptions.html).
     - **Transparency**: `opaque: false` + `texHasAlpha: true` on materials for leaves-style cutouts; water-like blocks use `solid: false`, `opaque: false`, often `fluid: true`.
   - If the block can appear from **procedural** terrain, update `proceduralVoxelID` here to match `world.ts`.

4. **Server logic**  
   - Break/place already work per-coordinate via `getVoxelID` / `applyDelta`; usually **no** `index.ts` changes unless you add new events.
   - If the block needs **special break rules** (e.g. only certain tools), extend validation in the break handler (not added yet—follow existing patterns).

5. **Tests**  
   - Extend [`world.test.ts`](../../../apps/minecraft-server/src/world.test.ts) if world generation or deltas involve the new id.
   - Add/extend socket or room tests per [`playground-backend-qa`](../../../.cursor/skills/playground-backend-qa/SKILL.md) if behavior crosses the wire.

6. **Assets & licensing**  
   - Only commit textures you may redistribute. Copy from your resource pack staging into `public/minecraft-assets` with stable names referenced in `MC_TEX`.

## Non-goals (this skill)

- **Board games** (`GameModule`, `BOARD_REGISTRY`) — use [`playground-add-game`](../../../.cursor/skills/playground-add-game/SKILL.md).
- **New voxel server features** (new socket events, tick rate) — out of scope unless explicitly required.
- **Supabase catalog rows** — `games.game_url = 'minecraft'` already points at this experience; new blocks do not need a new catalog row.
- Items (non-placeable) are handled by the companion `playground-voxel-items` skill; use ITEM_REGISTRY for those.

## Quick reference — files you usually touch

| Change | Files |
|--------|--------|
| New id + placeable | `voxelProtocol.ts`, `protocol.ts` |
| Look & materials | `MinecraftClient.tsx`, `public/minecraft-assets/*` |
| Natural generation | `world.ts`, `MinecraftClient.tsx` `proceduralVoxelID` |
| Tests | `world.test.ts`, optional `room` / socket tests |

## Sanity check before PR

- `npm run lint -w @playground/web` and `npm test -w @playground/minecraft-server` (or full repo test) pass.
- Grepping for the new id appears in both protocol files with the **same numeric value**.
