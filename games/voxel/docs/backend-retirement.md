# Retired legacy voxel backend

The remaining 44 source/config/test files in `apps/minecraft-server` are removed
(10,081 lines), along with its workspace entry, root `dev:minecraft` command and
obsolete shared Socket.io logging whitelist. The independent classroom service
retains its admission, moderation, presentation, attendance and media routes.
Its boundary verifier accepts the absence of the legacy entry and still rejects
game dependencies. The historical extraction provenance remains in its route
contract. No deployed process is stopped or replaced by this source change.

Before deletion, each file was copied byte-for-byte to a temporary backup and
recorded by SHA-256. This includes the already-modified legacy entry/media files;
the classroom extraction is not undone. Ignored environment files, local build
outputs and dependency caches are preserved. Offline lockfile resolution removes
only the old workspace and its workspace symlink, with no retained version,
integrity or resolved-source changes.

Classroom browser telemetry now targets the independent classroom service.
Configuration failures preserve its queue for retry. The admin panel reads
board, new voxel and classroom services independently; the new read-only
[operations API](../../../apps/voxel-server/docs/operations.md) requires fresh
administrator identity and grants no game access. The unused old URL helper/env
typing and web content aliases are removed. No production browser request uses
`VITE_VOXEL_SERVER_URL`.

The classroom service passes 69 tests and its 20-route/zero-game-import boundary;
shared observability passes 32 tests and the voxel service passes 51. The web
suite has 165 tests, including classroom routing/retry and independent stats
failures. The packaged operations test covers administrator revocation and
provider outage without allocating a room.
Strict web/service types and the production web build pass; the bundle boundary
contains 45 new game modules and zero forbidden imports. The actual PostgreSQL
composition check and the full React/local-SQL student/teacher journey pass after
retirement, including save failure/retry, staff controls, moderated persisted chat,
resume/end and two mount/exit cycles. Tracked GPU resources, workers, sockets and
audio close; the launcher stops its private database. Auth/PostgREST/Storage are
fixtures and SFU is disabled in this journey. The current 197-entry content audit
and all 12 matched release files verify unchanged.

The game engine/client/server release remains
`7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`.
At this checkpoint the old content package remained for the offline 197-entry
disposition audit. The subsequent [content retirement](content-retirement.md)
freezes those references and removes that workspace. Public asset retirement
is recorded in the subsequent [asset retirement](asset-retirement.md). Local secret configuration may still be selected from the
preserved old environment file during transition; configure the independent
services before deployment. No secrets are copied into source or evidence.

Hosted school/recovery writes remain unexecuted after the previous automatic
approval rejection. No migration, Auth user, database row, Storage object,
catalog entry or deployment is changed here. Physical school-PC and actual
hosted student/teacher journeys remain separate qualification work. The user's
PC/private-school scope stands: no new mobile/tablet or synthetic-scale gate.
