# Voxel platform service

This workspace owns Supabase persistence and school admission for the rewritten voxel runtime. The
game package's simulation and worker remain independent of Supabase, React and
LiveKit. Fresh school authorization and renewable actor deadlines are implemented.
Central session-policy leases, paused teacher observation and safe retirement are
implemented. Fenced roster/status/presence projection, host reassignment, trusted
pause/resume/end controls and the production service entry point are implemented.
All seven schemas/private bucket pass hosted read-only readiness. The user applied
the seventh [chat schema](docs/chat.md); its function bodies/grants, private tables
and history index match the tested file. Guarded startup of packaged chat build
`bedd62f9b37b` uses only seven status RPCs and passes with zero rooms and no remote
application writes. The [installation record](../../games/voxel/evidence/chat-installation/README.md)
retains this separately from the earlier pre-installation chat archive. The React
session/HUD, departure, mode/self-teleport, remove/ban/unban and persisted moderated
chat are locally qualified. Current media source adds an eighth schema, private
credential signaling and school-bound mute policy. All eight hosted schema status
checks now pass following the user's media push, and exact hosted media bodies,
grants and private table catalogs match the tested SQL. The voice coordinator
is wired to product controls and passes isolated actual-provider browser checks.
Complete actual-Auth/game/SFU and physical-device qualification remain open.
Actual hosted school/recovery qualification
remains unfinished.
This is not deployed yet.

The backend requires `SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY`.
Current media composition also requires `LIVEKIT_URL`, `LIVEKIT_API_KEY` and
server-only `LIVEKIT_API_SECRET`, and verifies all eight schemas before listening.
There is no fallback to revoked legacy keys. Requests have an eight-second
deadline, retain user JWTs when explicitly supplied, and send the API secret as
`apikey`. Errors retain machine codes, not provider messages or credentials.
See [Supabase key migration](../../docs/supabase-key-migration.md).
The [media boundary](docs/media.md) explains private credential signaling,
audited mute revisions, browser resource ownership and qualification limits.
The [media increment archive](../../games/voxel/evidence/media/README.md) retains
current source/release evidence, hosted installation/startup checks and negative
observations alongside passing reruns.

[School admission](docs/school-admission.md) describes the current policy,
gateway/worker expiry, staff observation, periodic offline-TNT-owner checks and
the remaining service work. [Room lifecycle](../../games/voxel/docs/room-lifecycle.md)
describes the clock/pause/end and admission-retirement behavior. Protocol 13
also carries mode changes and teleport resets through the
[staff command boundary](docs/staff-commands.md).
[Access moderation](docs/moderation.md) covers removal/bans, admission generations and policy receipts.
[Session projection](docs/session-projection.md) covers accepted membership,
intent versus public status, expiring presence, host reassignment and fencing.
[Lifecycle controls](docs/lifecycle-controls.md) covers committed-save receipts
and audit; [production service](docs/production-service.md) covers build/start,
configuration, artifact/schema readiness and drain.

[Read-only operations](docs/operations.md) describes the administrator-only local
stats route and independent web/classroom routing. The old Minecraft backend
workspace is retired; no deployment has been changed.

For local app testing, run **`npm run dev:app`** from the repository root and
open http://localhost:5173. `npm run dev:voxel-server` starts just this service;
the existing `dev:voxel` command is the separate game-only sandbox. See
[local development](../../docs/local-development.md) for configuration and startup.

## Checkpoint backend

[The migration](../../supabase/migrations/20261025010000_voxel_checkpoint_storage.sql)
creates private metadata tables/RPCs and a private `voxel-checkpoints` bucket.
Browser roles have no metadata/RPC/object access. The service can read metadata;
mutations use functions that lock the world, check the database clock and owner
epoch, and commit the manifest, full object graph and active sequence together.
An identical committed pointer can be retried without duplicating history.

Uploads are create-only and protected before asynchronous Storage IO. A duplicate
is accepted only after verifying its bytes. Object readiness follows upload
confirmation; an upload alone never advances the active pointer. Metadata keeps
the full referenced object graph, including reused columns.

Retention keeps the active checkpoint and a 24-hour history. Cleanup prunes old
history, locks and rechecks unreferenced objects, claims bounded work batches and
deletes bytes through the Storage API before finalizing catalog removal. Failed
deletions remain retryable. Active references cannot starve later garbage, and
an upload/commit cannot reuse an object while it is claimed for deletion. Session
deletion preserves orphan object addresses for subsequent cleanup. Batch size is
an IO work budget, not a player, object or room admission limit.

## Verification

Run `npm run typecheck --workspace @playground/voxel-server` and
`npm test --workspace @playground/voxel-server` from the repository root.
After building the game package, run `npm run test:integration --workspace
@playground/voxel-server` for the real gateway/school adapter scenarios and
`npm run test:browser --workspace @playground/voxel-server` for the built observer
client in Chromium. School Auth/PostgREST responses in these tests are fixtures;
they do not qualify the hosted school service. CI retains both workspaces' reports.
`npm run test:browser:lifecycle --workspace @playground/voxel-server` uses two
built clients for central pause, frozen world time, teacher touch flight, explicit
child resume, terminal state/no automatic readmission and complete disposal.

The actual PostgreSQL suite requires a **local** cluster with `psql`, `createdb`
and `dropdb`. Set `VOXEL_TEST_POSTGRES=1`, normal `PGHOST`/`PGPORT`/`PGUSER` and
authentication variables, then run `npm run test:postgres --workspace
@playground/voxel-server`. `VOXEL_PG_BIN` can select an unpacked binary directory.
Tests create/drop their own random databases and reject remote database hosts.

The suite verifies real concurrent owners/commits, expired-lock waits, atomic
rollback, role/grant isolation, retention, cleanup races and a real native room
worker restart through the installed Supabase SDK and PostgreSQL. Only the test
HTTP Storage byte service is a fixture; it does not prove hosted Storage policy
or provider outage behavior. The game core's own complete checks remain required.

`node --env-file=apps/voxel-server/.env apps/voxel-server/tools/check-supabase.ts`
performs a read-only installation check with the currently configured project.
It now requires five voxel migrations and a private bucket. The fourth
[roster migration](../../supabase/migrations/20261025040000_voxel_roster_departure.sql)
now passes hosted readiness. The fifth
[staff migration](../../supabase/migrations/20261025050000_voxel_staff_commands.sql)
now passes hosted readiness. A read-only history/function/grant check confirms all
five versions and the exact six reviewed staff/lifecycle function bodies. A guarded
local loopback startup of build `66a9ff4dc9d4` against those hosted status RPCs passes
health/readiness, allocates zero rooms, blocks every non-status provider request
and closes successfully. This is separate from hosted gameplay/recovery qualification.
The earlier three-schema record remains historical: on 2026-10-25 the
configured SDK and linked CLI projects matched, migration history contained
`20261025010000`, `20261025020000` and `20261025030000`, and all three schema
checks passed. Local production composition against those hosted schemas returned
200 for health/readiness, allocated no rooms and closed successfully. These were
read-only checks; they do not qualify hosted school authorization or recovery. The opt-in
`check-live-storage.ts` also passes against the configured bucket: create-only
upload, duplicate rejection, byte verification, anonymous/public denial and
deletion of its one random qualification object. Hosted checkpoint metadata and
real school recovery qualification remain open. A linked-project rollback-only
SQL check also passes all nine ownership/atomic-commit/idempotence/grant checks:
`supabase db query --linked --output json --file
apps/voxel-server/tests/hosted/checkpoint-rollback.sql`. It inserts a new fixture
session inside `BEGIN/ROLLBACK`, checks the installed functions as `service_role`
and verifies the fixture is absent afterward. Object metadata is a fixture;
this is separate from the live Storage byte check, not full hosted recovery.
Do not run a broad migration push to install unrelated pending migrations: apply
only reviewed migrations transactionally to the intended project and record
their migration versions. The first three versions above are already installed;
`20261025040000` also now passes hosted readiness. `20261025050000` is the new
locally qualified staff schema, not installed by the agent. See
[trusted roster departure](docs/roster-departure.md).

[React integration](../web/src/game/voxel/README.md) describes the app adapter,
read-only session/diagnostic endpoints, input ownership and remaining school work.
