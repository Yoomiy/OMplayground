---
name: playground-voxel-items
description: Add support for distinct items (non-placeable collectibles, crafting) to the Minecraft voxel game. Covers ITEM_REGISTRY in protocol files, ItemSlot, pickup/craft functions in inventory.ts, CRAFT socket events, and basic full-inventory concepts. Use when adding items, recipes, or inventory expansions beyond blocks.
---

# Adding Items to the Voxel (Minecraft) game

Items are separate from blocks: use numeric IDs >=100 in ITEM_REGISTRY (blocks stay <100). Hotbar holds placeable blocks; items live in main storage (27 slots) + crafting.

## Rules

- Keep protocol.ts and voxelProtocol.ts in lock-step for ITEM_REGISTRY and ItemSlot.
- Server authoritative for crafting and pickups; client requests CRAFT with recipeId.
- No mixing blockId/itemId in same slot; use separate HotbarSlot vs ItemSlot.
- Minimal crafting: implement tryCraft for 1-2 recipes (e.g. planks->sticks).
- Textures go under public/minecraft-assets/items/ (or flat in minecraft-assets).

## Checklist

1. **Protocol**  
   Add ITEM_REGISTRY and ItemSlot + CraftReq/CraftAck in both protocol files.

2. **Inventory logic**  
   Add addItemPickup, tryCraft in inventory.ts. Support full inv size 27.

3. **Server handlers**  
   Wire "CRAFT" listener in index.ts; emit INVENTORY_SYNC for items when needed.

4. **Client**  
   Extend MinecraftClient with item icons + craft button calling the craft() from useVoxelSocket.

5. **Assets**  
   Copy item PNGs from sourceCode/resource-packs/ into apps/web/public/minecraft-assets/

## Quick reference

| Change | Files |
|--------|-------|
| New item id | protocol.ts, voxelProtocol.ts |
| Pickup/craft | inventory.ts |
| Events | index.ts + useVoxelSocket.ts |
| UI | MinecraftClient.tsx |

## Sanity

- npm test -w @playground/minecraft-server passes
- ITEM_REGISTRY ids unique and > BLOCK max
