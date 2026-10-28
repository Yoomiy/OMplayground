# Authoritative session projection

`SupabaseSessions` composes with `schoolGatewayPolicy(access, sessions)` and the
checkpoint backend. The gateway requires durable ownership and central lifecycle
policy whenever session projection is installed. This is implemented service
composition, not a deployed production entry point.

The new migration is
[`20261025020000_voxel_session_projection.sql`](../../../supabase/migrations/20261025020000_voxel_session_projection.sql).
The user applied it with the checkpoint and control migrations. On 2026-10-25
the configured project passed all three read-only schema checks and the private
bucket check; migration history includes all three versions. This establishes
installation, with full hosted school/recovery qualification still open.

## Membership and public state

Allocation initializes intent under the acquired owner/world/epoch. Fresh
admission precedes membership IO, and a participant enters the worker only after
that IO succeeds. The gateway rechecks expired authorization and reacquires the
current allocation after every await. Observer grants never add membership.
Names come from active platform profiles, not browser request fields. A concurrent
pause is rechecked after the database owner lock; a new nonmember cannot use an
earlier ticket to pass that boundary. Existing members and the host can return.

`voxel_session_controls.desired_state` records playing, paused or ended intent.
`game_sessions.status` displays the authoritative worker projection. An empty
room projects paused without turning that into manual pause intent; a returning
eligible member can resume time. Completion is terminal. A completed platform
session or ended intent cannot be projected back to playing.

The worker sends full state on change and a ten-second heartbeat. Only current
participant connections enter its list. The database independently intersects
that list with active roster profiles in the session's partition, derives aligned
names and selects the first remaining connected roster member when the current
host departs. Hidden staff cameras never enter student presence or become host
through observation. Host controls remain separate from simulation ownership.

`voxel_presence_expires_at` bounds public connected-player arrays by both the
owner lease and fifteen seconds from a successful projection. The React adapter
and home/open/rejoin lists treat expired arrays as empty. This deadline matters after a
process crash; raw persisted arrays alone are not evidence of a live connection.
It is not an admission, player or room count limit.

## Fencing, shutdown and access

Every roster/projection mutation locks the world row and checks the actual database
clock, owner UUID and epoch after acquiring the lock. Projection sequence ordering
is per epoch; delayed writes cannot overwrite a later revision or replacement
owner. One view is in flight and at most one newer full view waits. Provider
failure retries the latest view; completion cannot be superseded by playing.

Normal retirement saves the world, commits final empty presence, stops the worker
and releases the lease in that order. Failed final projection leaves retirement
retryable and does not acknowledge release. Process drain reports failure when
saving or final projection fails. A forced crash can leave persisted presence
until its explicit expiry and retains the last committed checkpoint.

Browser roles cannot read the control table or invoke these service RPCs. A
trigger rejects browser updates/deletes of allocated voxel sessions, including
old browser-invoked SECURITY DEFINER functions. It uses the original role/request
claims, which survive those function calls. Other games and pre-allocation
session creation retain their current policies. Trusted maintenance remains
possible; broad cleanup/reset operations are not part of this change.

## Verification and remaining integration

Actual-SDK tests cover strict replies, credential boundaries, deadlines and
observer exclusion. Isolated PostgreSQL tests cover accepted membership,
partition checks, aligned names, hidden presence, host reassignment, intent versus
projection, terminal completion, sequence/epoch/lease fencing, expiry after a
row-lock wait, browser and legacy-definer isolation, and a real native worker
join/leave/save/release workflow. Source and packaged socket regressions verify
membership-before-welcome, failure before attach and retryable final projection.
Auth/PostgREST metadata remains a fixture in the existing school/browser tests;
this is not full hosted school or provider recovery qualification.

Trusted pause/resume/end endpoints, durable staff audit and production bootstrap
now have local SDK/SQL/packaged-runtime tests; see [controls](lifecycle-controls.md)
and [production service](production-service.md). The [React adapter](../../web/src/game/voxel/README.md)
implements lifecycle/presence UI and save receipts. Trusted
[self-roster removal](roster-departure.md) is locally qualified under a new fourth
migration, now ready on the hosted project. Staff mode/self-teleport are
[locally qualified under a fifth schema](staff-commands.md). [Access moderation](moderation.md) now filters banned or pending-readmission
actors from presence under the same session locks, so a queued older view cannot
restore a removed actor. Remaining media controls, chat, LiveKit and hosted
qualification of the extracted classroom service remain unfinished. Intent changes use the trusted service,
never direct browser database writes. Do not deploy this as a complete school service.
