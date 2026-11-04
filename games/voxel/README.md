# Voxel game

The Minecraft game uses a shared Rust/Wasm engine for terrain, collision and
movement, a Three.js client, and a Node WebSocket gateway with a worker per world.
The school app supplies admission, persisted worlds, chat and direct LiveKit voice
through `apps/voxel-server`. Classroom media runs in `apps/classroom-server`.

## Run locally

Use Node **24.21.0**. From the repository root:

```sh
npm ci
npm ci --prefix games/voxel --ignore-scripts
npm --prefix games/voxel run restore:release
npm run dev:app
```

Configure the frontend and backend environment files first. Open
http://localhost:5173; only that port needs forwarding for remote development.
The published release supplies Wasm and matched client/server files, so a fresh
clone needs no Rust compiler. The school app uses the configured Supabase and
LiveKit projects. See [local development](../../docs/local-development.md).

`games/voxel` has its own lockfile and is not a root npm workspace. For an isolated
volatile game sandbox, `npm run dev:voxel` builds and serves port 5194 without
school admission or persistence.

## Maintain

- [Architecture](docs/architecture.md): ownership, workers and rendering boundaries.
- [Gameplay and content](docs/gameplay.md): authoritative mechanics and authored data.
- [World identity](docs/world-profile.md): streamed coordinates and durable unique seeds.
- [Movement](docs/movement-sync.md): prediction, playback and remote interpolation.
- [Persistence](docs/checkpoint-state.md): leases, checkpoint compatibility and recovery.
- [Failure isolation](docs/resilience.md): degraded features and recovery guarantees.
- [Testing](docs/testing.md): focused checks, full CI and fixture boundaries.
- [Published releases](docs/published-release.md): rebuild, freeze and restore.
- [Deployment](../../docs/voxel-deployment.md): services, migrations and rollback.
- [Upstream and licenses](UPSTREAM.md): imported engine/artwork and asset notices.

Game source, content and configuration changes require matched browser/server
artifacts. Use the pinned Rust toolchain in `UPSTREAM.md` for a full rebuild,
then verify and freeze the published release. Keep regression fixtures under
`tests/fixtures` and the frozen legacy content inputs under
[legacy-content-reference](docs/legacy-content-reference/README.md).
