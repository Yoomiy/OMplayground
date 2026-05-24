# Voxel Expansion Integration: Player Death & Suffocation

This document outlines the progress and final integration of the **Server-Authoritative Death & Suffocation** systems, completed on **Sunday, May 24, 2026**, as part of Phase 6 of the `voxel_expansion_specification.md`.

## Overview & Scope of Work

The previous run implemented most voxel systems (WorldGen, Tools, Recipes, Food/Hunger, Client-Side Audio, and TNT Explosions). However, player death/respawn and suffocation damage remained isolated in standalone files (`death.ts` and `death.test.ts`) that were untracked and not wired into the server socket layer, tick loops, or client handlers.

We successfully completed, integrated, and verified these systems.

---

## Completed Integration Steps

### 1. Unified PlayerRuntime Interface Extensions
Added `lastSuffocationAt?: number` to the `PlayerRuntime` interface in `apps/minecraft-server/src/room.ts`. This resolves TypeScript compiler errors within the suffocation tick checks.

### 2. Precise Socket Targeting with User Rooms
To enable the server to authoritatively wipe a player's inventory and synchronize the cleared slots back to the specific client upon respawning, we introduced socket-level user grouping. Sockets joining a room now also join a session-specific user channel:
- Channel format: `voxel-user:${userId}:${sessionId}`
- This allows server-side controllers to directly send `INVENTORY_SYNC` updates specifically to the deceased player using:
  `io.to(`voxel-user:${player.userId}:${room.sessionId}`).emit("INVENTORY_SYNC", ...)`

### 3. Wire Protocol RoomEvent Schema Updates
Registered `PLAYER_DEATH` and `PLAYER_RESPAWN` events in both the server (`protocol.ts`) and client (`voxelProtocol.ts`) schemas under the `RoomEvent` union:
```typescript
| { kind: "PLAYER_DEATH"; sessionId: string; userId: string; deathPos: Vec3 }
| { kind: "PLAYER_RESPAWN"; sessionId: string; userId: string; respawnPos: Vec3 }
```

### 4. Continuous Suffocation Tick & Death Checks
Wired `applySuffocationDamage` into the `tickRoomVitals` sweep in `apps/minecraft-server/src/index.ts`. On every vital tick:
1. The server checks if the player's head is inside a solid block.
2. If so, it deals 1 suffocation damage and emits `PLAYER_DAMAGE` of type `"suffocation"`.
3. The server then checks for starvation or suffocation deaths via a new `checkAndHandlePlayerDeath` helper.

### 5. Multi-Source Death & Respawn Validation
Hooked the authoritative `checkAndHandlePlayerDeath` routine into every survival damage conduit:
- **Fall Damage (`FALL_IMPACT`)**: Checks for death if a hard landing exceeds 12 units/sec downwards.
- **PvP Combat Damage (`PLAYER_ATTACK`)**: Checks if sword/weapon strikes reduce the target to 0 HP.
- **TNT Explosions (`tickRoomTnt`)**: Handles any death from explosive blast spheres and schedules world-drop events.
- **Vitals Sweep (`tickRoomVitals`)**: Catches deaths from starvation or suffocation.

When a player dies, the server:
- Calls `handlePlayerDeath(room, player, now)` to clear inventories/equipment/crafting-grids and spawn world-drop entities in place.
- Resets vitals/health to full and teleports coordinates to `spawnFor(room, player.userId)`.
- Broadcasts `PLAYER_DEATH` and `PLAYER_RESPAWN` events.
- Direct-emits `INVENTORY_SYNC` to the dead player to clear their local UI.

### 6. Client-Side Teleportation & Velocity Damping
Implemented event listeners for `PLAYER_RESPAWN` on the client side in `MinecraftClient.tsx`:
- When a `PLAYER_RESPAWN` event matches the local player, the client forcibly resets their positioning in the engine:
  `noa.entities.setPosition(noa.playerEntity, ev.respawnPos)`
- Wipes lingering physics velocity so momentum from explosions/falls does not carry over post-respawn.

---

## Quality Assurance & Verification

### 1. Pure Unit & Integration Tests
Ran the entire server test suite, including `death.test.ts`, and verified 100% compliance across all 16 test suites (109 tests passed successfully):
```bash
PASS src/inventory.test.ts
PASS src/tick.test.ts
PASS src/drops.test.ts
...
PASS src/death.test.ts
Test Suites: 16 passed, 16 total
Tests:       109 passed
```

### 2. Client-Side Linter
Validated the client application's type safety and conventions by running `tsc --noEmit` via the web workspace:
```bash
npm run lint -w @playground/web
# Exit code: 0 (Passed with no errors)
```
