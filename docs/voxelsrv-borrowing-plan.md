# voxelsrv Borrowing Plan For Playground Minecraft

## Source Audit

- Source tree reviewed: `sourceCode/voxelsrv`.
- License reviewed: `sourceCode/voxelsrv/LICENCE` is MIT, so code and data-shape ideas can be reused with attribution.
- Most relevant source files:
  - `src/protocolWrappers/0.30c/lib/registry.json`: classic block/item registry with raw IDs, texture lists, solidity/opacity/fluid flags, and unbreakable metadata.
  - `src/lib/gameplay/registry.ts`: data-driven `noa` block registration, including transparent blocks and plant sprite meshes.
  - `src/lib/player/controls.ts`: block picking, fluid target filtering, placement blocked by entities, and inventory open/close behavior.
  - `src/lib/gameplay/world.ts`: chunk storage and explicit chunk loading from server-provided block arrays.

## Current Playground Gap

The current implementation has only 8 block IDs, 7 placeable blocks, and 2 non-placeable craft items. Blocks are manually registered in `MinecraftClient.tsx`, labels/icons are manually mapped, and procedural worldgen only creates grass/dirt/stone plus rare trees. Survival mode can collect and place blocks, but crafting only makes non-placeable plank/stick items.

## Ideas Borrowed In This Pass

1. **Classic block catalog expansion**
   - Borrow the practical subset of voxelsrv's classic registry: cobblestone, planks, sapling, gravel, ores, sponge, wool colors, flowers, mushrooms, metal blocks, slabs-as-cubes, bricks, TNT, bookshelf, mossy cobblestone, obsidian, and bedrock.
   - Keep existing Playground IDs stable and append new IDs.
   - Treat unsupported special blocks from voxelsrv (`barrier`, hard water, flowing variants) as out of scope because they need gameplay rules not present in Playground.

2. **Texture-backed terrain registration**
   - Borrow voxelsrv's registry idea: the expanded block IDs are backed by explicit texture, material, icon, and label mappings instead of hard-coded terrain-only assumptions.
   - Copy the required PNG assets from `sourceCode/voxelsrv/dist/textures/block` into `apps/web/public/minecraft-assets`.
   - Preserve existing assets and names where already used.

3. **Transparent and non-solid plant blocks**
   - Borrow voxelsrv's plant concept for saplings, dandelions, roses, and mushrooms.
   - Implement them as non-solid, non-opaque texture-backed blocks. Full custom X-sprite mesh is documented as a later visual upgrade because Playground's current block registration is cube-material based.

4. **Unbreakable bedrock**
   - Borrow the registry-level `unbreakable` idea.
   - Generate a bedrock floor and reject survival/creative block breaks against unbreakable blocks.

5. **Natural richer worldgen**
   - Add sparse ore distribution underground.
   - Add beaches/gravel patches and occasional surface flowers/mushrooms/saplings.
   - Keep the client-side mirrored worldgen deterministic with the server.

6. **Block-item behavior**
   - Borrow voxelsrv's `ItemBlock` idea by making the crafted plank output a placeable plank block in the hotbar.
   - Keep legacy non-placeable `PLANKS` item support so persisted saves and existing stick recipes continue to work.

7. **Drop rules**
   - Add a block metadata map for pickable, unbreakable, and drop target behavior.
   - Keep fluid/air non-pickable, make bedrock unbreakable, and make stone drop cobblestone.

8. **Creative usability**
   - Add an inventory-open creative block palette so the expanded block set is usable beyond the 1-9 hotkeys.
   - Keep the bottom hotbar compact and use number keys for the first nine blocks.

9. **Block picking and safer placement**
   - Borrow voxelsrv's middle-click block picking behavior: in creative it selects the looked-at block; in survival it selects an owned matching hotbar stack.
   - Borrow voxelsrv's "do not place inside entities" rule with a server-side player-body occupancy check.

## Ideas Considered But Not Borrowed Now

- Server-sent compressed chunk arrays: Playground intentionally uses deterministic client/server procedural generation plus sparse deltas, which is simpler for the current multiplayer session model.
- Full custom block meshes for slabs/cacti/plants: useful later, but it needs more collision/rendering plumbing than the current cube-material block path.
- Chest inventories, armor, chat commands, world import/export, and multi-server browser UI: valuable for a standalone voxel game, but outside the current blocks/items richness task.
- Tool-specific mining time: documented from voxelsrv but deferred until tools have gameplay meaning in Playground.

## Implementation Checklist

- Protocol registries expanded in both `apps/minecraft-server/src/protocol.ts` and `apps/web/src/lib/voxelProtocol.ts`.
- Web block mappings drive labels, icons, material registration, and `noa` block registration.
- Server block metadata drives placement, drops, and unbreakable break validation.
- Worldgen mirrored between server and client.
- Crafting supports logs to placeable plank blocks and legacy plank items to sticks.
- Creative mode has a full block palette and block-pick selection.
- Placement rejects coordinates occupied by players.
- Tests cover expanded registry, unbreakable bedrock, richer generation, and crafting/drop behavior.
