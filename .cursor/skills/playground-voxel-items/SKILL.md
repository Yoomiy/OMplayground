---
name: playground-voxel-items
description: Implement and evolve the voxel item system (non-block and block-items) with shared ITEM_DEFS, server-authoritative drops/pickup/crafting, tool durability, and inventory UX improvements.
---

# Voxel items: architecture and gameplay

Use this skill when adding or changing inventory items, block-items, crafting inputs/outputs, item dropping, pickup behavior, or tool durability/mining interactions.

## Target architecture (what this skill assumes)

- Shared content package provides item definitions (`ITEM_DEFS`) and block/item relationships.
- Server inventory logic (`apps/minecraft-server/src/inventory.ts`) is data-driven from shared defs.
- Items are true gameplay entities, not just constants:
  - collectible
  - droppable to world
  - craftable/consumable/material/tool
- Client UI is responsive but server authoritative for ownership, stack limits, crafting validity, and pickup.

## Item model expectations

Each item definition should include only what gameplay actually needs:

- identity: stable key/id, category (`material`, `tool`, `food`, `blockItem`, ...)
- stack behavior: max stack, optional durability (for tools)
- optional place mapping: `placesBlockId` for block-items
- optional mining contribution: `toolClass`, `toolTier`, speed modifier
- optional crafting metadata references (recipe system owns full rules)
- icon/texture reference

## Server-authoritative flows

### 1) Drop from inventory

- Client emits explicit drop intent (single unit or stack-split based on UX).
- Server decrements inventory first, then spawns world drop entity.
- If spawn fails, rollback inventory mutation.

### 2) World pickup

- Server simulates proximity/magnet pickup and capacity checks.
- Pickup merges stacks by item id + metadata compatibility.
- Server emits inventory sync and drop-despawn events atomically.

### 3) Craft

- Recipe matching and consumption happen server-side only.
- Client sends recipe/intention, never trusted for result computation.

### 4) Mining + tools

- Break timing and allowed breaks depend on block hardness and required tool.
- Tool durability loss is server-owned and synced back to UI.

## Implementation checklist (for item changes)

1. Add/update shared `ITEM_DEFS` (+ linked block defs when needed).
2. Update server inventory helpers in `apps/minecraft-server/src/inventory.ts` to use defs, not hardcoded `if/else`.
3. Update socket handlers in `apps/minecraft-server/src/index.ts` for drop/pickup/craft/tool durability sync.
4. Keep protocol payloads in sync between:
   - `apps/web/src/lib/voxelProtocol.ts`
   - `apps/minecraft-server/src/protocol.ts`
5. Update client inventory/hotbar UX in:
   - `apps/web/src/games/MinecraftClient.tsx`
   - `apps/web/src/hooks/useVoxelSocket.ts`
6. Add/update item icons in `apps/web/public/minecraft-assets/`.

## UX rules

- Q-drop and pickup should feel immediate, but never bypass server ack.
- Show durability bar for tools when durability is finite.
- Keep stack split/merge rules consistent between drag-drop UI and server outcomes.
- Prevent ghost items: every optimistic UI change must reconcile with server sync.

## Tests to always include

- inventory add/merge/split with max-stack boundaries
- drop request decrements inventory and spawns world drop
- pickup merges into partial stacks, then empty slots
- full inventory rejects pickup without item loss
- crafting consumes exact inputs and yields exact outputs
- tool durability decrements and breaks/removes tool at zero
