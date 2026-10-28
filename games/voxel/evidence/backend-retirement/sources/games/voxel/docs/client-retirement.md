# Retired legacy voxel web client

The app already routes voxel sessions through `game/voxel/VoxelSessionContainer`
and the rewritten runtime. Its old frontend had no entry-point consumers. A
TypeScript-resolved import audit and cross-workspace reference search identified
28 unused files; they are now removed: the NOA/Babylon client/container, old socket
and renderer-coupled voice hooks, protocol/crafting mirrors, model/mesher/worker
code and old HUD. This retires 10,304 lines of unused implementation.

The direct web dependencies on `@babylonjs/core`, `noa-engine` and
`@playground/voxel-content` are removed. Offline lockfile resolution removes 19
package entries and changes no retained package versions. The repository's
remaining Excalidraw patches are unaffected. The new runtime keeps its own isolated
Three.js dependency.

Four old implementation test files (20 tests) are retired with their code. The
remaining 160 web tests pass, as do strict web types and the production build.
The bundle boundary verifies 45 rewritten game modules and zero legacy-engine or
server-authority modules. Replacement coverage lives in the new domain/Wasm and
rendered presentation/audio/streaming lifecycle checks, including the trusted PC
natural-survival journey. The complete 197-entry content disposition audit passes;
its legacy reference sources remain unchanged.

After removal, the actual React/local-SQL journey passes save failure/retry,
teacher controls, chat/moderation, resume/end, roster departure, fullscreen/exit
and two repeated mounts. Each unmount releases tracked GL buffers, geometries,
textures, workers, sockets and audio. This uses fixture Auth/PostgREST/Storage and
disables SFU; it is not an actual hosted or physical-school-PC result.

At this checkpoint `voxelServerUrl.ts` was retained for shared telemetry.
The subsequent [backend retirement](backend-retirement.md) removes that helper,
routes classroom telemetry to the independent service and replaces legacy admin
stats with the rewritten voxel operations API. Public asset retirement and
actual deployment/routing remain separate cutover work. Production
game build `7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`
is unchanged; there is no migration or hosted write.

The canonical architecture, project rules and add-game guide now describe the
new boundaries. Three obsolete NOA-specific voxel skills are retired; old client
optimization and survival implementation proposals are explicitly historical.
The user's private-school/PC scope remains authoritative: no large synthetic scale
or mobile/tablet release gate, and no new voxel headcount restrictions.
