# Runtime architecture

## Ownership

The gateway authenticates connections and supervises one worker per world.
Simulation, native bodies, terrain edits, inventories, vitals and timed objects
belong to that worker. Socket callbacks enqueue validated intents; clients never
submit authoritative positions, inventory rewards, damage or world clocks.

| Directory | Responsibility |
| --- | --- |
| `src/shared` | Content/protocol contracts, movement, coordinate and compatibility rules |
| `src/sim` | Room time, input playback, commands, inventories and gameplay state |
| `src/server` | Gateway, worker supervision, backpressure and persistence ports |
| `src/client` | Input, prediction, connection recovery, inventory controls and game audio |
| `src/world` | Tagged generation and meshing jobs |
| `src/render` | Terrain, avatars, items, camera and owned GPU resources |
| `engine` | Rust/Wasm generation, collision, ray queries, lighting and meshing |

The engine and game simulation import no React, Supabase or LiveKit services.
`apps/voxel-server` implements the school/persistence ports. The React adapter in
`apps/web/src/game/voxel` owns the mounted runtime, session controls, chat and voice.
Classroom and board services have independent ownership and URLs.

## Time and movement

World rules run at 30 Hz. The client predicts numbered movement samples using
bounded frame durations; the server replays those samples through the same Wasm
primitive. Authoritative snapshots acknowledge consumed inputs. The client
restores the self state, replays outstanding inputs and eases visual corrections.
Remote actors use buffered playback. Public pose deltas preserve the same playback
lead as actor introductions; self snapshots retain exact acknowledged poses.
See [movement synchronization](movement-sync.md).

A monotonic update clock prevents an old animation callback from repeating time
already advanced by a fallback timer. Inventory, chat and mouse release affect
local controls. They do not pause a world with active participants. Room pause
freezes gameplay timers; hidden authorized observers can still move. Completed
sessions are terminal. School policy and durable ownership independently constrain
simulation. See [school APIs](../../../apps/voxel-server/docs/school-api.md).

## Terrain and resources

The server generates nearby 3×3 columns per actor. Clients stream a larger render
interest and discard distant columns. Generation, meshes and subscriptions carry
incarnations/revisions so stale asynchronous output cannot replace newer state.
Meshing waits for its required neighbor set. Unavailable collision terrain remains
solid. The [world profile](world-profile.md) defines coordinates and seeds.

World coordinates stay authoritative; rendering rebases around a local origin.
Terrain, avatars, held items and audio use the same relative presentation basis.
Runtime disposal releases workers, sockets, timers, audio graphs and owned GPU
resources. Context loss freezes controls; restoration rebuilds presentation while
retaining loaded CPU state and requires normal resume.

## Wire and platform boundaries

Control/snapshot messages use validated JSON; bulk columns and patches use
versioned binary formats with Uint16 block states. Build and protocol mismatch
rejects admission. Bounded queues and byte budgets control per-connection work;
there are no player, observer or room-count admission caps.

Gameplay transport, chat HTTP, game audio and LiveKit voice recover independently.
An unavailable optional feature does not remount a healthy game. Ownership loss
still stops authority before its confirmed deadline. See
[failure isolation](resilience.md), [persistence](checkpoint-state.md) and
[ADR 002](../../../docs/adr/002-voxel-native-websocket.md).
