# Hosted school and recovery qualification

The prepared runner is
[`tools/hosted-school-journey.ts`](../tools/hosted-school-journey.ts).
The user explicitly approved its exact temporary hosted scope on 2026-10-28.
It now passes against real Auth, PostgREST and private Storage with game build
`c293fe5e2511`; both test identities, the private session/metadata and all five
Storage objects were removed and their absence verified. The earlier automatic
approval rejection preceded this authorization and performed no writes.
The [authorized evidence](../../../games/voxel/evidence/hosted-school-authorized/README.md)
preserves the successful result and the first executed attempt's guard failure.

The read-only preflight on 2026-10-27 passes all eight installed schemas/private
bucket, verifies matching browser/server project configuration and finds one
active `minecraft` catalog row. The linked CLI project must match that SDK
project before the runner can prepare any resources.

## Approved and executed scope

The opt-in run creates exactly two randomly identified synthetic Auth users,
with one teacher and one child profile, and one private session. Synthetic
addresses use `playground.school.local`; admin `createUser` confirms them without
sending email. Passwords and sessions remain in memory. Names are explicit test
labels. The teacher creates the session through the publishable SDK under actual
RLS, using the existing active catalog row.

A local loopback production service uses real hosted Auth, PostgREST and private
Storage with its packaged gateway/native worker. A socket client proves a child
without an invitation is denied, then joins as the teacher/player, starts with
empty inventory and earns one resource by ordinary native mining/pickup. It
requests a committed pause, independently downloads/decodes the committed graph,
restarts the service, and checks the same world and earned ownership under a new
owner epoch. A fresh resume supersedes the historical pause receipt. Deactivating
only the temporary teacher tests live socket revocation.

The request guard accepts only the configured project, the test's exact profile
and session IDs, reviewed per-session RPCs and its acquired Storage namespace.
It refuses scheduled global retention/garbage work. It does not create an SFU
room, change school recess/class settings, change the catalog, or access existing
users' gameplay. This is a real-provider socket qualification; the actual app
browser, successful child recess journey, SFU composition, provider crash/outage,
physical devices, deployment and cutover remain separate gates.

Cleanup stops the owned service, removes and verifies absence of its namespace's
Storage bytes, then uses the linked CLI for one transaction guarded by the exact
random session UUID, teacher UUID and invitation marker. It removes only that
session's audit rows, session/checkpoint graph and object metadata. It verifies
session/world/object absence, then deletes the two marker-verified Auth users and
checks explicit Auth 404s. Failure keeps the run failed and leaves a recovery
journal plus exact cleanup SQL under a unique `/tmp/voxel-hosted-school-*` folder.
There is no broad test-world reset or migration application.

The approved execution used the existing server credential fallback and browser
configuration through normal Node env-file selection, without inspecting or
copying credentials. From the repository root:

```sh
VOXEL_HOSTED_SCHOOL_CHECK=1 node \
  --env-file=apps/minecraft-server/.env \
  --env-file=apps/voxel-server/.env \
  --env-file=apps/web/.env.local \
  apps/voxel-server/tools/hosted-school-journey.ts
```

## Local verification

All 52 service unit tests and strict service types pass. Five scope tests cover
allowed requests and rejection of other projects, sessions, actors, graphs,
unreviewed RPCs and global maintenance. Two real local PostgreSQL tests exercise
the exact cleanup SQL against installed voxel schemas: graph/audit deletion,
unrelated-row preservation, repeated cleanup and atomic refusal after ownership
or invitation changes. The isolated cluster is stopped after testing.

The packaged-worker mining/restart check passes with a local contract persistence
backend. It earns a natural item from empty inventory and restores its exact
bag/revision in a paused world. An earlier driver timeout is retained: focus is
correctly rejected while the restored room is paused. The corrected driver
checks restored ownership before issuing fresh resume. No product-runtime change
or new matched game build is claimed by this tool increment.

The first authorized hosted attempt stopped before gameplay because the test's
request guard omitted the accepted-challenge lookup needed to reject an uninvited
child. Its cleanup fully passed. The corrected guard permits only a GET of
accepted challenge IDs for that exact temporary child and session; missing or
different session/child/status/selection filters and writes are rejected. The
second attempt passes private-room denial, actual teacher/player admission,
empty-inventory natural mining/pickup, committed save plus independent graph
download, restart under owner epoch 2, identical earned bag/revision, historical
pause receipt supersession and live profile revocation. It has no service errors.
Both attempts' cleanup removes only their marked resources and confirms absence.

This passes the exact socket/real-provider scenario. It does not prove a successful
child recess session, actual React/catalog-shell journey against hosted services,
SFU/WebRTC, abrupt process crash/provider outage, physical PCs or deployment.

Local logs: `/tmp/voxel-hosted-service-tests.log`,
`/tmp/voxel-hosted-school-types.log`, `/tmp/voxel-hosted-cleanup-tests.log` and
`/tmp/voxel-hosted-driver-tests.log`. Negative local attempts remain under the
corresponding `*-before*` and `*-negative*` names. Read-only hosted preflight is
`/tmp/voxel-hosted-school-readiness.json` and
`/tmp/voxel-hosted-school-probe.json`.
