---
name: playground-voxel-items
description: Implement and evolve the voxel item system (non-block and block-items) with shared ITEM_DEFS, server-authoritative drops/pickup/crafting, tool durability, and inventory UX improvements.
---

# Voxel items: architecture and gameplay

Use this skill when adding or changing inventory items, block-items, crafting inputs/outputs, item dropping, pickup behavior, or tool durability/mining interactions.

## Current architecture

- Shared content: `packages/voxel-content` — `items.ts`, `recipes.ts`, `mining.ts`, `movementPerks.ts`.
- Server inventory: `apps/minecraft-server/src/inventory.ts` (data-driven from shared defs).
- Implemented server surfaces (extend these, don't duplicate):
  - `drops.ts` — world drop spawn, tick physics, pickup
  - `breakMining.ts` — break timing, tool gating, durability
  - `perks.ts` — movement/equipment perks from item defs
  - `vitals.ts` — food/eating (simplified vs full spec — see below)
- Client UI: `MinecraftClient.tsx`, `useVoxelSocket.ts`; protocol mirrors in `voxelProtocol.ts` / `protocol.ts`.

**Spec vs shipped:** `docs/voxel_expansion_specification.md` describes full hunger/exhaustion loops; current `vitals.ts` behavior is intentionally simplified (see `vitals.test.ts`). Follow the spec for new hunger work; don't assume all spec phases are live.

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
- Server decrements inventory first, then spawns world drop entity (`drops.ts`).
- If spawn fails, rollback inventory mutation.

### 2) World pickup

- Server simulates proximity/magnet pickup and capacity checks.
- Pickup merges stacks by item id + metadata compatibility.
- Server emits inventory sync and drop-despawn events atomically.

### 3) Craft

- Recipe matching and consumption happen server-side only (`CRAFT`, crafting-table handlers in `index.ts`).
- Client sends recipe/intention, never trusted for result computation.

### 4) Mining + tools

- Break timing and allowed breaks: `breakMining.ts` + shared mining defs.
- Tool durability loss is server-owned and synced back to UI.

## Implementation checklist (for item changes)

1. Add/update shared `ITEM_DEFS` / `RECIPES` in `packages/voxel-content` (+ linked block defs when needed). Run package build before app changes.
2. Update `inventory.ts` to use defs, not hardcoded `if/else`.
3. Update socket handlers in `index.ts` for drop/pickup/craft/tool durability sync.
4. Keep protocol payloads in sync between `voxelProtocol.ts` and `protocol.ts`.
5. Update client inventory/hotbar UX in `MinecraftClient.tsx` / `useVoxelSocket.ts`.
6. Add/update item icons in `apps/web/public/minecraft-assets/`.

## UX rules

- Q-drop and pickup should feel immediate, but never bypass server ack.
- Show durability bar for tools when durability is finite.
- Keep stack split/merge rules consistent between drag-drop UI and server outcomes.
- Prevent ghost items: every optimistic UI change must reconcile with server sync.

## Tests to always include

- `packages/voxel-content/src/items.test.ts`, `recipes.test.ts`, `mining.test.ts`
- `apps/minecraft-server/src/inventory.test.ts`, `drops.test.ts`, `breakMining.test.ts`, `perks.test.ts`

Cover: inventory add/merge/split with max-stack boundaries; drop decrements inventory and spawns world drop; pickup merge + full-inventory rejection; crafting input/output exactness; tool durability at zero.
