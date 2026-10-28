# Mode and teleport commands

The existing trusted `POST /api/voxel/control` route also accepts exactly
`{room, requestId, command}`. Commands are `{kind: "mode", mode: "creative"}`
(`survival` is also valid) and `{kind: "teleport", target: "spawn"}` or a current
actor UUID. The target names the destination actor; only the verified staff
member's own body/camera is moved. Browsers cannot submit coordinates, a moving
actor, role, lease, revision or outcome. The normal gameplay socket rejects these
commands. A child host cannot use them.

Supabase identity/profile/session policy is read before queueing and again after
room allocation. SQL locks the world, session and control rows, checks the actual
clock and owner epoch, repeats the active teacher/admin check and writes one audit
record with its private command revision. Proofs last at most five seconds. The
worker independently checks its monotonic command deadline and durable owner
deadline before application. No JWT or profile name crosses into the worker.

SQL gives any school profile precedence over a separate admin record, including
denial for an inactive profile and the actual role of a demoted profile. Migration
five applies that same fresh resolver to lifecycle begin; the already applied
third migration remains unchanged. The resolver is private even to service-role
callers and runs through the trusted definer functions. A real SQL negative
reproducer and the corrected dual-profile/audit/grant tests retain this boundary.

Mode changes complete native/private updates before publishing new rules. They
preserve inventory ownership, reset stale input/action epochs, close container
views, clear creative flight on return to survival, and require explicit local
input resume. Existing death state survives creative changes and reconnects until
normal respawn; its countdown still uses unpaused room time. Dead owners cannot
acquire items before respawn, old inventory commands cannot replay afterward, and
death drops remain conserved. Hidden observation does not restore gameplay rights.

Teleport resolves a live destination's authoritative position in that worker.
It clears velocity, mining, pending commands, open views and input epochs, freezes
the moving actor and starts collision readiness at the destination. A blocked
offset follows the normal safe-spawn search. Old terrain subscription incarnations
and actor interpolation are removed explicitly; drops/explosives reset their
interest views. The renderer, targeting and audio use the new authoritative pose.
The user resumes control after readiness. Hidden staff remain absent from student
replication. Paused observation/teleport does not advance gameplay timers.

These are volatile gameplay changes. Success acknowledges worker application with
`saved: false`; normal coherent checkpoints capture their resulting mode and pose.
They do not promise a newly committed save, and a forced loss can restore the
previous checkpoint. Pause/end/last-leave save guarantees retain their separate
committed-pointer behavior. The UI reads mode/pose from the runtime, never applies
an optimistic change from a receipt, and distinguishes historical results.

A request UUID has one command and one audit record. SQL records dispatch before
the worker request. A bounded worker result cache uses an independent ordered
rejection boundary, so cache eviction cannot reexecute an older revision. A retry
in the same owner epoch can recover a cached outcome. A dispatched but unconfirmed
request cannot execute under a replacement owner/worker; the response stays
unconfirmed and requires a new explicit request to act again. Completed receipts
can replay without allocating a worker, including after terminal retirement.
Audit completion and result validation are transactional and epoch fenced.

Protocol 13 adds validated rule updates and mode/teleport baseline reasons.
Engine/bindings/content identities and binary/checkpoint formats are unchanged.
The fifth migration is
[`20261025050000_voxel_staff_commands.sql`](../../../supabase/migrations/20261025050000_voxel_staff_commands.sql).
It is qualified locally and now installed. At 2026-10-26 09:36 UTC the read-only
check finds all five schemas and the private bucket ready. A linked-project query
confirms versions 001–005, exact body fingerprints for all six functions in this
migration, browser grant denial and the private role resolver. The configured SDK
and linked CLI projects match. Local loopback startup against just the five
hosted status RPCs passes health/readiness with zero rooms; a request guard blocks
all other provider operations. No agent deployment or hosted schema/object/
application-row mutation occurred. The earlier fifth-migration approval choice
no longer needs action; the schema appeared externally and matches the reviewed SQL.

Actual-Wasm tests cover mode/flight/input/inventory/death/respawn and checkpoint
reconstruction, plus paused hidden-camera teleport and safe readiness. Source and
packaged worker tests cover retry/cache eviction and independent deadline expiry.
SDK/SQL/native-worker checks cover fresh role denial, idempotent audit, malformed
commands/results, expired row-lock waits, replacement epochs, applied receipts
without saved claims and hidden staff movement. The built React fixture switches
both modes, preserves owned inventory, flies more than 65 metres using normal
touch input and teleports back after old terrain unloads. Its final three contexts
dispose all tracked owned resources. School Auth/PostgREST and Storage transports
in those combined checks are fixtures; hardware performance, the authenticated
catalog shell and full hosted school/recovery qualification remain open.

[Staff removal/bans](moderation.md) are now locally qualified with the installed
sixth schema. Enforced media moderation, persisted chat, LiveKit
proximity/mute policy, hosted qualification of the locally extracted classroom
service, balance/bucket UI,
device/network/capacity qualification and cutover/legacy removal remain required.
There are no player, observer, object or room-count admission caps.
