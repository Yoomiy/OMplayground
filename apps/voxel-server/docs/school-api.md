# School access and HTTP APIs

## Admission and connected authority

Requests carry a session UUID, optional invitation and player/observer choice.
Supabase Auth verifies the bearer token; active role, gender, grade, roster and
session policy come from current rows. Browser-supplied roles/capabilities are
rejected. An inactive school profile cannot fall through to a separate admin record.

Children play in their partition during effective recess, using the shared
Jerusalem-time schedule/class overrides and half-open closing boundary. Private
sessions require membership, a valid invitation or an accepted challenge. Deliberate
pause admits the existing roster; transient paused public presence during cold
startup also checks authoritative playing intent. Completion is terminal.

Teachers/admins default to hidden observation with no build/combat/explosive rights.
A teacher choosing player participation follows partition rules; an admin without
a gameplay partition cannot become a player. Counts do not gate admission.

Read-only admission/inspection has a twelve-second budget. Admission mints a short
proof after those reads, bounded by JWT expiry and recess; SQL membership consumes
it within five seconds. Tickets are single-use and rechecked across allocation.
Mutation proofs retain their five-second request-start budget and database fencing.

Joined connections enforce the known recess cutoff locally. Current profile,
roster and schedule checks run every 30 seconds without retaining the login JWT;
temporary provider failures retry after five seconds within the known cutoff.
Confirmed denial/completion disconnects, and capability changes require readmission.
The worker independently enforces deadlines. Local moderation revokes immediately;
external changes are discovered on the next successful policy read.

Passive TNT-owner eligibility keeps account/membership checks independently of
wall-clock recess. Five-second proofs hold due work when unknown/expired; explicit
denial can fizzle it. These private proofs are never serialized.

## Session ownership and presence

Accepted membership commits before worker attachment. Every async admission boundary
rechecks proof/allocation state and removal generations. Observers never enter the
student roster/presence or become host through observation.

Playing/paused/ended intent is separate from worker-projected public status. An empty
world can project paused without imposing a deliberate pause. Presence uses current
active roster rows and profile-derived names; its expiry is bounded by ownership
and fifteen seconds from successful projection. Clients treat expired arrays as empty.
A departing host transfers controls to the next eligible member, not physics ownership.

Projection locks/fences world, owner epoch and sequence. It coalesces pending views,
filters banned/removed cohorts and cannot overwrite terminal completion with an older
playing response. Browser writes cannot bypass allocated-session protections through
old definer functions. Normal retirement finalizes presence before releasing the owner.

## HTTP surface

All routes are under the configured exact-origin policy with no-store responses.
Private operations require a current Playground bearer token. The gameplay WebSocket
is `/voxel`; the shared gateway also installs `/api/voxel/admission` and `/api/voxel/control`.

| Route | Body / purpose |
| --- | --- |
| `/api/voxel/admission` | `{room, invitationCode?, participation?}`; single-use game ticket |
| `/api/voxel/session` | Read-only session scope, lifecycle and public presence |
| `/api/voxel/room-settings` | `{room, isOpen?}`; host reads/toggles privacy and invitation information |
| `/api/voxel/control` | `{room, requestId, action}` for pause/resume/end; staff commands use `command` instead |
| `/api/voxel/leave` | `{room, requestId}`; verified self-roster departure |
| `/api/voxel/moderation-targets` | `{room}`; current student moderation targets |
| `/api/voxel/moderation` | `{room, requestId, target, action}`; remove/ban/unban |
| `/api/voxel/chat-history` | `{room, before}`; null or a positive sequence cursor |
| `/api/voxel/chat-send` | `{room, requestId, message}`; live-participant posting |
| `/api/voxel/chat-moderate` | `{room, requestId, action, target}`; delete a message or clear history |
| `/api/voxel/voice-token` | `{room}`; token for the existing game actor |
| `/api/voxel/diagnostics` | Validated fixed diagnostics; no arbitrary provider text or secrets |
| `/api/voxel/admin-stats` | `{}`; administrator-only local service counters |

Exact validators and response types live in the `school-*.ts` adapters and
`apps/web/src/game/voxel/session-api.ts`. Missing credentials use 401; confirmed
policy denial uses 403; transient service failure uses the route's unavailable code.
Read-only session inspection can show completion without allocating a worker.

## Controls and idempotency

The current host or staff can pause/resume/end. Commands serialize per room and
repeat authority after queueing/allocation and under SQL locks. Reuse the request
UUID on retry. Receipts include ordered intent revision and `current`; an old
receipt cannot undo or display itself as a newer decision. An unfinished superseded
command returns `SUPERSEDED`. Audit records and receipts omit credentials/chat bodies.

Pause freezes immediately and reports saved only after a checkpoint commit. Resume
makes no save claim. End is terminal and skips a final checkpoint; earlier or
in-flight autosaves are not reversed. Older saved-end receipts remain readable.
A failed/unknown response is not proof of a completed save.

Staff commands can change internal gameplay rules or teleport their own actor to
spawn/a live target. Browser coordinates and child-host staff commands are rejected.
The worker checks command/owner deadlines, invalidates stale input and requires
collision readiness/resume. Success acknowledges application, not a committed save.
A dispatched uncertain command cannot reexecute under a replacement worker epoch.

Self-roster departure is available outside recess and after partition changes;
it grants no gameplay rights. Live unexpired presence returns `ROSTER_BUSY`.
It does not allocate a worker or claim to save/delete a world. Stable request IDs
make lost replies recoverable. Membership and host changes remain transactional.

Staff remove/ban/unban targets student profiles. Removal advances the admission
cutoff; ban also blocks new entry. Unban permits explicit fresh entry and does not
automatically reconnect. Redundant unban preserves a valid newer admission. A
historical receipt cannot disconnect a later accepted cohort. Moderation can work
without a live owner and makes no checkpoint claim.

## Chat and voice

Chat uses private SQL tables and trusted RPCs, outside gameplay checkpoints.
History enforces current policy; staff can inspect/moderate without allocating a
worker, including after completion. Posting additionally binds the current live
participant connection, accepted admission cohort and durable owner deadline.
Observers cannot post through an older roster entry. Paused gameplay can still chat.

Messages are server-attributed escaped text, at most 500 Unicode characters, with
canonical session sequences and keyset pages of up to 100. Request IDs/content hashes
prevent duplicate posts. Delete/clear preserve tombstones and one durable audit;
retrying a clear cannot erase newer messages. Chat bodies/names are not logged.

Voice uses [ordinary LiveKit tokens](media.md). Gameplay revocation and local voice
cleanup do not provide a server-enforced LiveKit removal/mute API. The SFU room is
scoped by world and owner epoch. There is no voxel-specific media-policy schema
requirement; historical migrations remain retained in database history.
