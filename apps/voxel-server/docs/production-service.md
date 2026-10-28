# Voxel service entry point

`src/index.ts` composes the packaged game gateway/worker, school SDK policy,
fenced session projection, lifecycle controls and private checkpoint backend.
It uses `@playground/observability` Pino/lifecycle helpers and runs independently
of the old Minecraft/classroom process. It does not serve the prototype launcher,
classroom routes or a public guest flow. This is implementation and local
qualification; it has not been deployed or routed for school users.

Build with Node **24.21.0** and the game's pinned Rust/Wasm toolchain:

```sh
npm ci --prefix games/voxel
npm ci --workspace @playground/voxel-server --workspace @playground/game-logic --workspace @playground/observability --include-workspace-root=false --ignore-scripts
npm run build:voxel
npm run build --workspace @playground/voxel-server
npm start --workspace @playground/voxel-server
```

For an explicitly assembled runtime directory and container build, see
[production packaging](packaging.md). It retains matching manifests and workers
without copying the development checkout or credentials into the runtime image.

The service requires `SUPABASE_URL`, server-only `SUPABASE_SECRET_KEY` and
`VOXEL_ALLOWED_ORIGINS` (comma-separated exact origins), plus `LIVEKIT_URL`,
`LIVEKIT_API_KEY` and server-only `LIVEKIT_API_SECRET`. Production origins must
use HTTPS and cannot contain credentials, paths or wildcards. `PORT` defaults to
3001 and `VOXEL_HOST` to `0.0.0.0`. Normal dotenv loading is available; no fallback
to legacy/public Supabase keys exists. Set `NODE_ENV=production` for deployed
logging and origin rules. Logs never receive the environment, tokens or request
bodies. Each fresh world starts with the current natural survival defaults.

Before listening, startup validates every packaged server file against the
release inventory/hash and matching build/content/engine identities. It then
checks checkpoint, projection, control, roster, staff, moderation, chat and media
schemas through service-only RPCs. The independent signaling worker must become
ready before listening. Shutdown closes media before draining gameplay ownership.
A missing/invalid schema or artifact fails startup. The first three voxel schemas were
applied by the user and passed read-only checks on 2026-10-25, with the SDK and
linked CLI targeting the same project. Local loopback startup against those
hosted schemas returned 200 for health/readiness, allocated no rooms, performed
no remote application writes and closed successfully. Deployment, hosted school
authorization and complete checkpoint/worker recovery remain unqualified.

`/health` is process liveness. `/ready` indicates successful startup and admission
not draining; it does not promise that a provider remains available. Admission,
actor/session proofs and owner leases have their own bounded fresh checks and
fail closed. HTTP body/header deadlines are bounded. There are no player,
observer, room or object-count admission caps.

Garbage collection runs once per minute with the existing bounded Storage IO
batch and supervision. SIGTERM/SIGINT stop admission, wait for queued controls,
pause/save rooms, persist final empty presence, stop workers and release owners.
Repeated close calls share the same promise. A failed drain is an error and a
sixty-second forced timeout exits unsuccessfully; no saved acknowledgement is
invented. A forced process loss can still lose changes after the last committed
checkpoint. The shared timeout behavior has explicit failure/success tests.

Local tests validate startup artifact corruption before executable import,
strict origin/listener configuration, all-schema readiness before listening,
real SDK/PostgreSQL startup, authenticated control API composition, absence of a
prototype root route and idempotent drain. Container/hosting/process routing,
actual provider outage/crash/drain and browser/device qualification remain open.
The independent classroom service is now extracted locally; its hosted rollout
and hosted browser qualification remain pending. Authenticated school UI and voxel
voice/media enforcement are implemented and locally exercised; actual hosted
Auth/game/SFU qualification remains open. Access removal/bans/unban and persisted moderated chat are implemented. See
[moderation](moderation.md), [controls](lifecycle-controls.md) and
[session projection](session-projection.md).

The current source requires all eight voxel migrations, including
[roster departure](roster-departure.md), [staff commands](staff-commands.md),
[access moderation](moderation.md), [persisted chat](chat.md) and media policy.
All eight status RPCs and the private bucket now pass hosted read-only readiness
following the user's media push. Exact hosted media function bodies/grants and
private table catalogs match local installation. Guarded startup of build
`2140097fdcb8` permits only eight status RPCs, passes health/readiness with zero
rooms, closes successfully and performs no hosted application writes. The
[media increment archive](../../../games/voxel/evidence/media/README.md) records
the scopes and outstanding actual-Auth/game/SFU and device qualification. The
previous chat installation's linked history lists
001–007. The user applied migration seven, and its five function bodies/grants,
private tables and valid history index match the tested SQL. Guarded startup of
packaged build `bedd62f9b37b` permits only seven status RPCs, passes health/readiness,
allocates zero rooms and closes without remote application writes. The immutable
[chat archive](../../../games/voxel/evidence/chat/README.md) retains its earlier
missing-schema/denied-startup result; the subsequent
[installation record](../../../games/voxel/evidence/chat-installation/README.md)
records the now-installed schema and unchanged service/release bytes. In-progress
voice-client source is outside that packaged-release qualification. No agent
applied either migration or deployed the service.
Full hosted school and recovery gates remain open.
