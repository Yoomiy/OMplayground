# Voxel school service

This service adapts the voxel gateway to school Auth, access rules, sessions,
private Supabase checkpoints, trusted controls, moderation and persisted chat.
Voice issues standard LiveKit tokens; browsers connect directly to the SFU.
The simulation and engine remain independent of those providers.

## Run and deploy

Use Node 24.21.0. For the full local app, configure the environment files and run
`npm run dev:app` from the repository root. `npm run dev:voxel-server` starts
just this service. See [local development](../../docs/local-development.md).

Required settings are `SUPABASE_URL`, server-only `SUPABASE_SECRET_KEY`,
`VOXEL_ALLOWED_ORIGINS`, `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
Use [.env.example](.env.example); never put server credentials in frontend variables.
The service honors `PORT` (default 3001) and `VOXEL_HOST`.

Startup verifies the published game release and required schema/bucket status
before listening. `/health` identifies the process; `/ready` reports whether it is
accepting work. Shutdown drains saves/presence with a 60-second process deadline.
Normal operation includes checkpoint garbage collection.

- [Deployment and migrations](../../docs/voxel-deployment.md)
- [Production package and image](docs/packaging.md)
- [School access and HTTP APIs](docs/school-api.md)
- [Direct voice lifecycle](docs/media.md)
- [Read-only operations](docs/operations.md)
- [Persistence/recovery](../../games/voxel/docs/checkpoint-state.md)
- [Tests and provider boundaries](../../games/voxel/docs/testing.md)

## Checks

```sh
npm run typecheck --workspace @playground/voxel-server
npm test --workspace @playground/voxel-server
npm run test:integration --workspace @playground/voxel-server
```

`test:postgres` uses isolated local databases when `VOXEL_TEST_POSTGRES=1` is set.
Hosted project checks are separate opt-in operations. Configuration and schema
presence alone do not establish a working browser/SFU deployment.
