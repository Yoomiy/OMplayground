# Independent classroom extraction record

The game release remains `66a9ff4dc9d4a0a38acdffdb68a05776d271c445395bd1d1a3d379208b584e68`
(protocol 13). This increment transfers classroom HTTP/RTC ownership to
`apps/classroom-server`, removes its routes/helpers/timers from the legacy game
process, and routes classroom UI requests to `VITE_CLASSROOM_SERVER_URL`.
Its 20-route contract, actual compiled module graph and production inventory are
retained. No game simulation, gameplay socket or voxel package loads in classroom.
The canonical drawing service remains separate.

The production classroom build and 69 tests pass, including a compiled native
process that serves actual-SDK fixture admission and drains on SIGTERM. Checks
cover account/guest/delegate and hidden roles, private board/presenter grants,
presenter transfer, source permission synchronization, durable guest rejoin block,
classroom/drawing closure, token revocation, signed raw attendance webhooks,
provider-probe failure before listen and shutdown/startup/reconciliation races.
The helpers retain the prior classroom feature set; account authority is now fresh
and an inactive school profile cannot inherit a second admin record. Media stats
exclude game rooms sharing the SFU. Startup/periodic readiness probes are read-only,
have five-second deadlines and do not silently retry database failures.

Shared observability passes 32 tests, the remaining legacy game passes 120, and
selected board/drawing capability/checkpoint tests pass 19. All 90 web tests and
affected service/web/legacy typechecks pass. The actual production web application
build uses separate classroom and voxel public origins; its rewritten game boundary
reports 41 game modules and zero forbidden legacy renderer/server modules.
The classroom build has 30 production JS/map files and no tests. A boundary audit
checks source imports and actual loaded repository modules. Earlier full game-core
evidence is inherited only after verifying its relevant source inputs are unchanged
and all twelve current packaged release hashes still match.

Those combined classroom flows use fixture provider semantics over real SDK/HTTP,
JWT/HMAC/webhook and native-process boundaries. Actual configured Supabase classroom
base-table and authenticated LiveKit room-list reads also pass separately, without
starting attendance/cleanup jobs or writing application data. They do not qualify
actual user Auth, WebRTC, hosted classroom mutations, secure delegate cookies,
board/presentation browser journeys, device behavior or restart/provider failure.
Docker is unavailable locally; the Dockerfile and CI definition are prepared,
not locally container-qualified. No deployment or remote application mutation was
performed. The remaining legacy voxel game still awaits its full retirement gates.

The same read-only phase finds all five voxel migrations installed, a private
checkpoint bucket and all five status RPCs ready. Linked history lists versions
001–005; the six installed function-body fingerprints/grants exactly match the
reviewed fifth migration, including school-profile precedence and the private
resolver. The linked CLI and configured SDK target the same project. Migration
five appeared externally; the agent did not apply it. Earlier approval choices
need no action. A guarded local loopback voxel startup allows only those five
read-only RPCs, passes health/readiness, allocates zero rooms and closes with no
application writes. This is not hosted school gameplay or checkpoint recovery.

Previous staff/roster archives remain immutable, including their correct historical
observations of missing schemas. The full rewrite still requires staff removal/
bans/media enforcement, persisted chat, rewritten voxel LiveKit proximity/mute,
authenticated catalog and hosted recovery, classroom deployment/browser/WebRTC
qualification, survival balance/bucket UI, real devices/network/load/capacity,
and full cutover/legacy removal. No player, observer, object or room-count admission
ceilings were introduced. See the [classroom service contract](../../../../apps/classroom-server/README.md)
and [full progress record](../../../../docs/voxel-runtime-rewrite-progress.md).
