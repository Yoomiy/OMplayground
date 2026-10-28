# Durable state implementation

The runtime now captures and reconstructs one private schema-1 room checkpoint,
including the world identity/preset/seed/bounds, compatible content/engine/generator
versions, simulation tick, pause state, event/input epoch counters, spawn, native
player poses, owned inventories, chests, vitals, drops, TNT and changed terrain.
Capture runs synchronously at a worker message boundary. Asynchronous immutable
object IO and pointer commits run in the gateway, outside simulation code.

The gateway accepts injected object-storage and transactional metadata ports.
The production Supabase adapter, private schema/RPC/bucket migration and retention
cleanup now live in `apps/voxel-server`. Their SDK and actual PostgreSQL tests pass.
The user applied the reviewed migration; the read-only installation check and a
temporary private Storage create/overwrite/privacy/cleanup check pass. School
fenced lifecycle projection is implemented and installed; full hosted checkpoint
recovery qualification remains pending. The
loopback launcher does not configure these ports and remains volatile. The
contract fixture used by integration tests is deliberately not a production
persistence implementation or evidence of a real database transaction.

## Coherent reconstruction

Capture copies all mutable state. Reconstruction checks exact fields, schema,
content/engine/generator compatibility, finite native bodies, bounds, ownership
relationships and component invariants before publishing a player or generating
terrain. Runtime-only fixes can restore a compatible older build: source build
identity is retained, while content, engine and generator compatibility must
match. A malformed/incompatible checkpoint fails startup; it never creates an
empty replacement world.

Inventories retain all 36 bag slots, both crafting grids, five typed wear slots,
selection, revisions and durable instances. Chests retain contents, cell,
identity/revision and the incarnation counter. A restored chest must correspond
to a saved container terrain edit. Dead owners cannot retain items that death
should already have drained. All stacks/slots/identities are validated before
installation; snapshots and decoded state share no mutable storage.

Vitals preserve health, food, air, respawn remainder, hunger phase, regeneration,
sunlight/vision phases, starvation/lava/drowning phases, fractional effort,
eating/attack/hurt cooldowns, protection and the partial fall peak. The native
17-value body, consumed look and remaining reconnect grace are retained. Body
motion, timers and drops earn no offline simulation time. Paused game time also
freezes reservation grace, including fractional monotonic milliseconds. Expired
connection reservations release ephemeral actor/socket state while durable
identity, pose, vitals and inventory remain; a later safe spawn starts a new fall
segment. A grace-period reconnect continues the saved partial fall.

Sockets, held controls, input/action queues, replay ledgers, subscriptions,
mining and open station/container viewers are not restored. Fresh admission
creates a new input epoch, frozen native body and collision readiness exchange.
A snapshot contains no role or capability grants. Every primed TNT owner needs
an explicit fresh policy resolution before the restored worker starts. Missing
resolution/provider failure blocks startup; explicit denial can fizzle the TNT.
Ordinary player admission independently obtains current capabilities.

When an owner resolver is configured, the worker also requests fresh permissions
for all live TNT owners. Each proof expires on a process-monotonic five-second
deadline chosen before IO. Missing/expired/unknown proofs hold due bodies without
fizzling them or applying terrain/damage. A fresh explicit denial can fizzle;
a fresh grant can finish the earned blast. A connected observer's stricter
participation still constrains passive ownership. These proofs are private and
never serialized. The gateway uses four concurrent policy reads as an IO budget,
not an owner-count limit; complete unknown batches cannot become partial denials.

Drop capture preserves stacks, IDs/revisions, position/velocity, owner pickup
exclusion and remaining pickup/expiry durations. TNT retains owner, state,
body motion and exact normal/chain/due fuse state; blast strength comes from
matched content. Both preserve insertion order, since pickup contention and
bounded due-blast processing depend on it. Terrain retains Uint16 edits, column
revisions and per-cell edit stamps. Recovery installs validated metadata into a
fresh compute world and normal jobs generate/replay terrain lazily. Failed
replay forgets the entire partial native column and height cache while retaining
metadata for retry. Revision exhaustion rejects edits or whole blast batches
before native writes; it cannot wrap or partially clear terrain.

## Immutable objects and ownership

Changed columns are separate content-addressed JSON objects. A coherent manifest
contains actor/container/timer state and references those columns. Unchanged
column hashes reuse committed references without uploads. All bytes are detached
before asynchronous work. IO concurrency is four independently of collection
sizes; there is no actor, observer, chest, drop, TNT or room-count admission cap.
Recovery checks the world-specific key namespace, byte length and SHA-256 of every
object before assembling the checkpoint, then the room/component decoders run.

Uploads precede metadata commit. The metadata port must atomically check the live
owner, owner epoch, unexpired lease and previous checkpoint sequence before
advancing the pointer. Upload success alone cannot acknowledge saving. Identical
commit retries must be idempotent; a lost response retries the identical graph
before capturing a newer checkpoint. An old owner cannot release a replacement
lease. The contract fixture remains, and the production adapter now also passes actual
PostgreSQL concurrency, rollback, permission and retention tests. Hosted Storage
end-to-end checkpoint RPC/Storage orchestration and provider outages remain
unqualified on the hosted project. A rollback-only check of its installed SQL
functions passes lease exclusion, atomic graph failure/commit, idempotent retry,
replacement-owner fencing and private grants using fixture object metadata.
Private Storage create-only bytes, duplicate rejection and
anonymous/public denial now have a live check with successful cleanup.

The supervisor keeps one captured/unconfirmed snapshot and one coalesced pending
request. Explicit pause freezes simulation immediately even when an earlier save
is awaiting IO; its save acknowledgement waits for the paused capture's commit.
Autosave runs every 15 seconds. Last-player departure commits a pause, stops the
worker and releases ownership; a racing join waits and restores a fresh owned
baseline. A failed departure remains unsaved and can retry. Drain reports save
failure instead of claiming success, while stopping its workers and releasing
leases. Forced shutdown can lose changes since the last committed pointer.

Lease renewal never extends the last confirmed deadline on an outage. Deadlines
use the process monotonic clock with a one-second safety margin and are enforced
in both gateway and worker. The worker stops ticks/publication even if the gateway
event loop stalls. Lease loss disconnects clients into recovery. Storage fencing
and publication/input fencing are both necessary.

## Production adapter status

The latest core build is `bedd62f9b37b2a071c498413c7352033ccd97e94f2bd976101259481c789d3f8`:
86 domain/rendering, 80 native (three ignored upstream debug helpers), 84 actual-Wasm
and 40 integration scenarios against each source/packaged server pass. Protocol 13,
checkpoint schema and engine/content formats remain unchanged. Staff mode/pose
changes are volatile until an ordinary checkpoint; their receipts never claim a
new save. Access removal/bans/unban commit private SQL policy and audit separately
from worker disconnection or checkpoint saving. Death state and owned drops
survive mode changes/reconnect until ordinary respawn.
Fresh session leases pause expired/unknown
policy and observer-only rooms; staff can move without advancing saved timers.
Cancelled admissions retire unjoined workers without retiring valid peers.
See [room lifecycle](room-lifecycle.md) and
[session projection](../../../apps/voxel-server/docs/session-projection.md).
Accepted membership, fenced intent/status/presence and host reassignment are
implemented and locally tested. The first three migrations were user-applied;
all seven now appear in hosted history and pass read-only readiness with a private
bucket. The earlier six-schema positive startup belongs to build `85b864f78689`. The
current packaged chat build `bedd62f9b37b` now passes seven-schema read-only
startup with zero rooms; the user applied the matching seventh chat migration.
Its earlier guarded refusal to listen remains in the immutable chat archive. Full hosted school/worker recovery and deployment
qualification remain pending. Trusted lifecycle controls and
the production entry point now have local SDK/SQL/packaged-runtime tests; see
[controls](../../../apps/voxel-server/docs/lifecycle-controls.md).
Commit now supplies the complete object graph to metadata, enabling transactional
reference protection and cleanup. Overlapping shutdown callers await the same
confirmed lease release rather than returning while it is still in flight.

The current platform checks pass 38 SDK/policy/startup, seven school gateway and
50 actual PostgreSQL/SDK/native-worker cases. All 94 web tests and the actual
production build pass. Three built React contexts verify persisted chat/retry/reopen/delete/clear, remove/ban/unban,
stable-ID retry after a lost committed response, blocked/fresh re-entry with a
nonempty bag preserved, mode/self-teleport, save failure/retry, pause/resume/end,
fullscreen inventory, nine mobile controls and complete disposal. These use
fixture school/Storage transports. The current
[chat archive](../evidence/chat/README.md) retains release/source and
production/browser hashes plus earlier negative checks and input/confirmation
qualification limits.
The last complete eleven-scenario archived browser milestone remains
[content build e4f100782c69](../evidence/content/README.md). This private persistence
work has no new complete eleven-scenario browser or hosted durable-backend
qualification. The React fixture exercises actual SQL and packaged workers with
fixture school/Storage transports; the hosted schema/startup and private Storage
checks are separate. Actual Supabase outages, process/deployment overlap, full
hosted checkpoint recovery, healthy service lag and the actual authenticated
school shell journey remain outstanding release gates.


The current packaged chat release requires all seven migrations; all are hosted. At 2026-10-26 11:03 UTC they
and the private bucket pass read-only readiness. Nine relevant installed function
bodies/grants and the two private moderation tables match reviewed SQL, with fresh
school-profile precedence and browser grant denial. That earlier guarded loopback startup of
build `85b864f78689` verifies six status RPCs, health/readiness and zero rooms
without remote application writes. The current packaged chat service now passes
seven-status-only startup after user installation of migration seven. See the
[read-only installation record](../evidence/chat-installation/README.md). [Trusted roster removal](../../../apps/voxel-server/docs/roster-departure.md)
fences old tickets and requires saved last-owner retirement. Staff mode/teleport
and [access moderation](../../../apps/voxel-server/docs/moderation.md) retain
separate audited receipts with no new-save claim. Actual hosted recovery and the
authenticated school journey remain open. See
[moderation evidence](../evidence/moderation/README.md).
