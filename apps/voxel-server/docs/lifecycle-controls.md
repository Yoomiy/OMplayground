# Trusted lifecycle controls

`POST /api/voxel/control` requires the current Playground bearer token and exactly
`{ "room": "session UUID", "requestId": "request UUID", "action": "pause" }`.
Actions are `pause`, `resume` and `end`. The request ID is stable across retries.
No browser-supplied lease, identity, role, checkpoint or owner epoch is accepted.
The production composition installs this endpoint with normal origin/preflight
checks and no-store responses. Missing credentials, invalid fields, foreign
origins and non-host children are rejected before allocation.

The gateway serializes controls per room. The school adapter reads verified
identity/profile/session authority again after queueing and allocation; a stale
grant cannot survive revocation or host reassignment. The database independently
locks the current world, platform session and intent rows, checks the current
owner/epoch and actual clock, bounds the authorization proof and rechecks the
current host or staff role. Existing recess/partition policy still applies to
school authorization. Host ownership does not transfer physics authority.

Pause freezes gameplay immediately and awaits a coherent committed checkpoint.
End also commits a pause before issuing terminal worker shutdown. Successful
receipts contain `completed: true` and a committed `savedSequence`; only those
pause/end responses have `saved: true`. Resume clears the server manual pause,
but cannot bypass current session intent, expired policy, recess, missing
participants or the child's explicit input-resume requirement. Its receipt has
`saved: false` because it does not request a new checkpoint.

A failed capture/upload/commit/receipt write returns an unconfirmed response
(`503`, `saved: false`); pause/end intent remains enforced. Retry the same request
ID. A completed receipt is returned without reapplying the action or allocating a
worker, even after terminal retirement. Each intent has an ordered revision.
`current: false` means a later command superseded that historical receipt; it
must not be displayed as the room's current state. An unfinished superseded
request returns `409 SUPERSEDED` and cannot undo newer intent. A forced crash
before completion retains the last valid checkpoint and may leave an incomplete
command; full hosted crash/provider recovery remains a separate qualification.

The service records all requests durably in `voxel_session_commands`. Teacher
and admin actions also insert the platform `audit_log` record in the intent
transaction and update its completion/save metadata after commit. Request UUIDs
are correlation IDs. Audit data has IDs/action/revision/epoch/save status, no JWT,
chat content, media or profile names. Service-only receipts/commands are not
browser-callable database RPCs.

The new migration is
[`20261025030000_voxel_session_controls.sql`](../../../supabase/migrations/20261025030000_voxel_session_controls.sql).
The user applied it and the preceding projection migration on 2026-10-25.
Migration history and all three read-only schema checks pass in the configured
project. The private checkpoint bucket check also passes. Hosted installation
does not establish full school authorization or worker-recovery qualification.

Actual-SDK/SQL/HTTP/native-worker tests cover unauthorized callers, host/role
changes, expired proofs, stale ownership, retries/revision conflicts, one durable
staff audit, uncommitted-save rejection, injected upload failure/retry, resume,
end and receipt replay after retirement. Source and packaged gateway tests cover
ordering and disconnect during a pending save. Direct policy tests cover strict
fields, fresh queued revocation and historical receipt replay without reading an
ended session. This is local qualification with fixture Auth/PostgREST/Storage
transports; it is not a hosted school journey.

Mode mutation and self-teleport now have a
[trusted audited worker path](staff-commands.md). Moderation/removal and enforced
media policy and their audit flows remain unfinished. Participant/observer choice still uses fresh admission.
The [React HUD](../../web/src/game/voxel/README.md) now exposes pause/resume/end,
stable-ID retry and committed-save feedback. Full teacher and school integration
remain unfinished. Trusted self-roster removal from rejoin cards now has a
[separate locally qualified API and migration](roster-departure.md).
