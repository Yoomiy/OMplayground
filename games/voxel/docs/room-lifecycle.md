# Room lifecycle implementation

World time is independent of a player's local focus. A connected participant
with a current actor lease keeps room time running, including while a personal
inventory or local pause menu freezes that body. With school lifecycle policy
enabled, no current participants means the world pauses; staff observers alone
cannot advance hunger, hazards, drops, fuses, weather or the world tick.

`schoolGatewayPolicy` installs admission, passive-owner resolution and a fresh
session-status reader. The worker requests a private status proof whose monotonic
deadline starts before IO and lasts at most five seconds. The gateway validates
the reply and clamps it to that deadline. The worker checks expiry before ticks
and messages, independently of a stalled supervisor. An unavailable provider
cannot extend a confirmed proof; unknown initial or expired policy pauses the
world. Late replies cannot revive an older request. Explicit completion is
terminal in that worker and cannot be reversed with a resume command.

The worker combines fresh session state, current participant leases and a
server-only manual pause. Session pause, missing participants or expired policy
cannot be bypassed by manual resume. Explicit pause/save remains paused while
asynchronous checkpoint IO completes, and the save acknowledgement still follows
the committed pointer. Fenced metadata ownership remains a separate prerequisite
for all simulation/publication; session policy is not a replacement for it.

## Paused observation and presentation

A paused room still prepares joining actors, loads their collision interest and
processes readiness. Authorized observers use a separate bounded 30 Hz scheduler
with two 60 Hz movement substeps. Their camera can fly or walk and update bounded
interest without advancing any gameplay timer. Observers stay hidden from student
replication, do not block placement and retain their independent action denials.
Participant bodies remain frozen. Ending also freezes and closes observation.
Paused reservation grace uses paused room time rather than wall time.

Protocol 12 adds a validated public lifecycle view: playing/allowed, paused with a
public pause reason, or ended. No JWT, deadline or private capability is included.
The client also has preparing/recovering states for admission, collision loading
and transport/policy failure. Its presentation clock freezes at an explicit
authoritative pause tick instead of coasting through the pause. Global pause
clears participant input, releases pointer lock and requires explicit user resume
after permission returns. Ordinary local inventory/focus still has its separate
input epoch and does not globally pause time.

Completion can first be observed by either the room-policy reader or actor
revalidation. Both preserve the non-retryable `SESSION_ENDED` reason, including
across source/packaged module boundaries. The client freezes, unlocks input and
does not automatically request admission again. A fresh ticket cannot override a
completed session, revoked membership or closed recess.

## Allocation and retirement

Pending valid handshakes are tracked without a count ceiling. A cancelled
admission cannot leave an unjoined worker running: volatile workers stop, and
durable worlds commit a pause, stop and release their lease. A concurrent valid
handshake protects a shared allocation. Every await during fresh authorization
can cross retirement, so the gateway reacquires the current worker before
attaching. Existing durable last-player save/rejoin ordering remains in force.
Lifecycle-controlled volatile rooms also retire after their last connection.

Checkpoints retain coherent state and the paused bit, not sockets, policy proofs,
callbacks or teacher permissions. Fresh platform policy is required after a
restart. A completed platform session is denied rather than resumed from a saved
paused snapshot. Protocol 12 does not change the checkpoint schema or engine
formats; older compatible engine/content checkpoints still require fresh policy.

## Verification and remaining service work

Domain and actual-Wasm tests cover wire/clock boundaries, readiness and hidden
teacher motion while timers stay identical, and terminal admission/input. Real
source/packaged workers cover independent policy expiry during a supervisor
stall. Gateway tests cover provider/session pauses, resume bypass attempts,
terminal retirement and cancelled/concurrent/revalidated admissions. The real
SDK school fixture covers recess closing, frozen earned TNT, earlier-ticket
denial and fresh reconnect. These do not qualify the hosted school journey.
The built two-client browser also verifies cleared held input and released pointer
lock on central pause, unchanged world ticks while a teacher ascends, explicit
participant resume with fresh backward input, terminal state/no automatic
readmission and resource disposal. School metadata and identity are fixtures.

Fenced platform status/roster/presence projection, accepted membership and host
reassignment are now implemented through optional service ports and a new locally
tested migration; see [session projection](../../../apps/voxel-server/docs/session-projection.md).
Trusted pause/resume/end endpoints and production bootstrap now have local
SDK/SQL/packaged-runtime tests. React session/HUD, remaining teleport/mode/moderation/media controls, chat,
LiveKit, classroom extraction and full hosted recovery remain unfinished.
Production composition must install the projection/control migrations and ports;
a permission lease alone does not update the roster. Real device/frame/input/
network/capacity and
long-session qualification remain open. There are no player, observer, object or
room-count admission caps.


## Staff mode and teleport updates

Protocol 13 extends the existing lifecycle protocol with private owner rule updates
and mode/teleport baseline reasons. Mode changes preserve inventories and death
state until normal respawn, clear old inputs/creative flight and require explicit
resume. Trusted self-teleport resolves a server actor or world spawn, resets
subscription/incarnation/interpolation state and passes collision readiness before
control returns. Neither action advances a paused world's gameplay time or claims
a committed save. Their audited HTTP/worker/epoch boundary is documented in
[staff commands](../../../apps/voxel-server/docs/staff-commands.md). The checkpoint
schema and engine/content formats remain unchanged.
