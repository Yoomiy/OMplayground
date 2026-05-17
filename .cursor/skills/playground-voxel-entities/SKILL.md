---
name: playground-voxel-entities
description: Add or modify rendered voxel entities with emphasis on the upcoming world-drop system, player avatars, and reusable visual catalogs for noa/Babylon integration.
---

# Voxel entity visuals (avatars + world drops)

Use this skill for render-side entities in the Minecraft experience: player avatars, dropped item entities, and future mobs/NPC visuals.

## Scope boundaries

- Server owns gameplay truth (spawn, position, despawn, pickup).
- Client owns visual interpolation, mesh lifecycle, and polish only.
- Blocks/items definitions belong to:
  - `playground-voxel-blocks` for blocks
  - `playground-voxel-items` for inventory/crafting/drop semantics

## Required layering

1. **Model/template layer**  
   `apps/web/src/games/voxel/voxelJsonModel.ts`  
   Build/cache Babylon templates, clone by model key.

2. **Noa attachment layer**  
   `apps/web/src/games/voxel/noaVoxelVisual.ts`  
   Attach cloned meshes to noa entities, handle offsets/dispose cleanly.

3. **Visual catalog**  
   `apps/web/src/games/voxel/voxelEntityCatalog.ts`  
   Central mapping of visual type -> model/texture/hitbox/render scale metadata.

4. **Callers/orchestration**  
   `apps/web/src/games/MinecraftClient.tsx`  
   Consume room snapshots/events, create/update/remove noa entities.

## World-drop specific guidance (new priority)

For dropped items as world entities:

- Render from **server-issued worldDrop ids** only; never invent drops client-side.
- Visual key should resolve from item definition (`itemId -> itemVisual`), not hardcoded switch logic.
- Use lightweight visuals by default (billboard/voxel icon) and reserve full models for rare entities.
- Add simple polish that does not affect authority:
  - idle bob
  - slow spin
  - short pickup fade/shrink animation after server pickup ack
- Keep entity counts safe: support culling/LOD strategy for dense drop piles.

## Avatar guidance

- Keep local and remote avatar code paths unified where possible.
- Drive remote yaw/pitch/walk from snapshot fields; smooth client-side.
- Maintain strict cleanup on leave/reconnect to avoid leaked meshes and orphan noa entities.

## Verification checklist

- Two clients in one room: both see identical drop spawn/despawn timing.
- Pickup event removes world drop exactly once and updates inventory once.
- Stress test dense drops: FPS remains acceptable and no mesh leak after despawns.
- Avatar visibility and orientation remain correct in first-person vs third-person.

