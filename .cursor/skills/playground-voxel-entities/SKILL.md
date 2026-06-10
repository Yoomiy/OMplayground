---
name: playground-voxel-entities
description: Add or modify rendered voxel entities — player avatars, world-drop visuals, and future mobs/NPCs — for noa/Babylon integration.
---

# Voxel entity visuals (avatars + world drops)

Use this skill for render-side entities in the Minecraft experience: player avatars, dropped item entities, and future mobs/NPC visuals.

## Scope boundaries

- Server owns gameplay truth (spawn, position, despawn, pickup) — see `apps/minecraft-server/src/drops.ts`.
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
   Central mapping of visual type → model/texture/hitbox/render scale metadata. **Today:** only `player` avatar is cataloged.

4. **Callers/orchestration**  
   `apps/web/src/games/MinecraftClient.tsx`  
   Consume room snapshots/events, create/update/remove noa entities. World drops wired via `useVoxelSocket` drop listeners.

## World drops (implemented)

Server issues `worldDrop` ids; client must never invent drops.

- **Rendering today:** flat sprites / item textures in `MinecraftClient.tsx` (`spawnWorldDropEntity`, bob/spin) — **not** yet routed through `voxelEntityCatalog`.
- Resolve visuals from item definition (`itemId` → texture), avoid hardcoded per-item switches when adding new drops.
- Polish (client-only): idle bob, slow spin, pickup fade after server ack.
- Keep entity counts safe: culling/LOD for dense drop piles.

When adding a new drop visual type, prefer extending catalog + shared item icon paths over one-off mesh code.

## Avatar guidance

- Keep local and remote avatar code paths unified where possible.
- Drive remote yaw/pitch/walk from snapshot fields; smooth client-side.
- Maintain strict cleanup on leave/reconnect to avoid leaked meshes and orphan noa entities.

## Future: mobs / NPCs

Not shipped. When added, follow the same catalog + `noaVoxelVisual` layering; server spawns authoritative entity ids first.

## Verification checklist

- Two clients in one room: both see identical drop spawn/despawn timing.
- Pickup event removes world drop exactly once and updates inventory once.
- Stress test dense drops: FPS remains acceptable and no mesh leak after despawns.
- Avatar visibility and orientation remain correct in first-person vs third-person.
