---
name: playground-voxel-entities
description: Add or modify rendered entities in the Playground Minecraft-style voxel game, including player avatars, NPCs, mobs, dropped props, voxel JSON models, noa visual attachment, and entity visual registries. Use when touching voxel avatar/entity visuals, future modelKey registrations, or files under apps/web/src/games/voxel.
---

# Voxel Entity Visuals

Use this skill when adding player avatars or future rendered entities to the Minecraft-style voxel game. This is for **visual entities**, not terrain blocks or inventory items.

## Boundaries

- Keep game truth server-authoritative. Clients render visuals from snapshots/intents; they do not invent authoritative entity state.
- Do not add block IDs here. For placeable blocks, use `playground-voxel-blocks`.
- Do not add crafting/storage item IDs here. For non-placeable items, use `playground-voxel-items`.
- Keep UI/network separation: `MinecraftClient` may own noa rendering lifecycle, but pages/containers should not gain low-level socket/rendering logic.

## Architecture

Use these layers:

1. **Voxel model layer**: `apps/web/src/games/voxel/voxelJsonModel.ts`
   - Pure Babylon.js only.
   - Accept `scene`, model JSON, texture URL, and `modelId`.
   - Build/cache templates and clone instances.
   - No `noa`, `ROOM_SNAPSHOT`, `userId`, or socket concepts.

2. **Noa visual layer**: `apps/web/src/games/voxel/noaVoxelVisual.ts`
   - Thin adapter for existing noa entities.
   - Attach cloned roots to entities/player, set yaw/visibility, and dispose visuals.
   - Hierarchical voxel roots (bone meshes under an empty root) must call `registerVoxelChildMeshesInNoa` after attach: noa only draws meshes registered with `noa.rendering.addMeshToScene`, not arbitrary Babylon children.
   - Do not create authoritative gameplay state here.

3. **Entity visual catalog**: `apps/web/src/games/voxel/voxelEntityCatalog.ts`
   - Map `modelKey` to `{ modelUrl, textureUrl, width, height, meshOffset?, hitbox? }`.
   - Adding a visual type should usually be one catalog row plus assets.

4. **Avatar animation (optional)**: `apps/web/src/games/voxel/voxelAvatarAnimation.ts`
   - Pure Babylon: rig discovery, walk phase, head pitch on bones, yaw snap/smooth.
   - Wire avatar-facing motion from callers (`MinecraftClient`): local uses `noa` camera + `tick`; remotes use `RoomSnapshot` positions/`heading`/`pitch`.
   - **Walk speed tuning**: voxelsrv used `phase += dist/5`, which is very slow in practice. Prefer `updateAvatarWalk`’s `stepsPerMeter` (default tuned for Minecraft-like cadence) and a small `movingThreshold` so slow movement still animates. Remote players only get new positions at snapshot rate — animation may look a bit steppier than local unless you interpolate or drive updates more often.
   - **Head pitch on others**: server must echo camera pitch (e.g. optional `pitch` on `InputReq` / `PlayerSnapshot` in `voxelProtocol` + minecraft-server) so remotes can run `setAvatarHeadPitch`; voxelsrv halves pitch on the head bone — match that in the animator if you want identical look.
   - **Geometry vs skin**: `player.json` from voxelsrv is **Steve**-width limbs (4×4 voxels per arm/leg cube). Pair it with a **Steve-layout** 64×64 skin (e.g. `public/minecraft-assets` texture). Using a slim **Alex** skin on Steve geometry stretches UVs and reads as “wrong” or too-thick limbs; slim avatars need a matching slim model JSON + UV layout, not just a different PNG.
   - Limb swing signs and bone names should stay aligned with voxelsrv `updateAnimationOfModel` in `sourceCode/voxelsrv/src/lib/gameplay/connect.ts` unless you intentionally change the rig.

## Player Avatar Checklist

1. Read the current plan if present: `.cursor/plans/voxel_player_avatars_2c1c85ee.plan.md`.
2. Build or reuse a voxel JSON model compatible with the voxelsrv subset: `geometry.texturewidth`, `geometry.textureheight`, `geometry.bones[]`, `cubes[]`, `origin`, `size`, `uv`, optional `inflate`, optional `pivot`.
3. Use an original/project-owned skin atlas or fetch it from sourceCode/voxelsrv/dist/textures/entity or sourceCode/resource-packs/ before committing assets under `apps/web/public/minecraft-assets/`.
4. Load the player visual once after noa is ready, respecting the mount effect's `cancelled` flag.
5. Keep a fallback to the old remote box if model/texture loading fails.
6. For remotes, keep entity creation in `MinecraftClient.ensureRemoteEntity`; then clone and attach the visual.
7. Drive orientation and limbs with `voxelAvatarAnimation`: e.g. `setAvatarYaw` / `setAvatarYawSmoothed` for `PlayerSnapshot.heading` (smooth for remotes), `setAvatarHeadPitch` when `pitch` is on the wire, `updateAvatarWalk` from world XZ each tick/snapshot.
8. For the local player, show the body only in third person (`noa.camera.zoomDistance > 0`) and drive yaw from `noa.camera.heading`.
9. On cleanup, dispose visual roots/children and delete remote noa entities.

## Future Entity Checklist

1. Decide who owns spawn state:
   - Server-driven NPCs/mobs: socket snapshot/event owns `{ entityId, modelKey, pos, heading }`.
   - Local-only props: the client system owns creation and cleanup.
2. Register the visual in `voxelEntityCatalog.ts`.
3. Load/cache the model through `voxelJsonModel.ts`.
4. Create the noa entity in the caller, then call `attachVoxelVisualToEntity`.
5. Update position/yaw from the owning system only.
6. Keep mesh attachment offsets in `noaVoxelVisual.ts` or the catalog; keep limb/head/yaw animation tuning in `voxelAvatarAnimation.ts` (or one dedicated animator per entity type), not scattered through callers.

## Verification

- Run `npm run lint -w @playground/web` after implementation.
- Smoke test two browser clients in the same room: remote appears, moves, rotates, leaves cleanly.
- Check first-person and third-person modes: local body hidden in first person, visible and aligned in third person.
- Watch for Babylon/noa disposal leaks when players leave and rejoin.

