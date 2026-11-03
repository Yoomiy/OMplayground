# Room lifecycle implementation

World time is independent of a player's local focus. A connected participant
with a current actor lease keeps room time running, including while a personal
inventory or local pause menu freezes that body. With school lifecycle policy
enabled, no current participants means the world pauses; staff observers alone
cannot advance hunger, hazards, drops, fuses, weather or the world tick.

`schoolGatewayPolicy` installs admission, passive-owner resolution and a
session-status reader. Status is checked about every 30 seconds with a bounded
60-second response horizon. Unknown initial state pauses the world. A temporary
read failure preserves the last confirmed playing/paused state and retries after
five seconds; it cannot clear a confirmed pause or revive an ended room. A hung
read that reaches its horizon pauses until a successful response. Explicit
completion is terminal and cannot be reversed with a resume command. Storage
ownership deadlines remain independent and still fence simulation/publication.

Connected school participants have a locally enforced recess cutoff, refreshed
only by successful background policy checks. Temporary provider errors do not
disconnect them before that cutoff. Confirmed access denials still disconnect.

The worker combines fresh session state, current participant leases and a
server-only manual pause. Session pause, missing participants or expired policy
cannot be bypassed by manual resume. A fenced SQL Resume receipt updates cached
playing intent immediately, invalidates older status replies and requests a fresh
background read; it still cannot bypass ownership, recess or missing participants.
The control button stays busy until the UI reflects that transition. Explicit pause/save remains paused while
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
durable allocations that nobody joined stop and release their lease without
writing another checkpoint. Rooms that have hosted players commit a pause before
release. A concurrent valid
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

## Browser recovery

Transport closure and temporary admission failures share a retry delay of 1.5,
3, 6, then at most 10 seconds until recovery. A connection that stays open but
receives nothing for 10 seconds is replaced. Admission attempts time out after
15 seconds. Online/visible events can retry promptly; disposal cancels pending
attempts and retries. Confirmed terminal denials stop automatic retries.

The app keeps authentication separate from playground access. Temporary check
failures preserve the last confirmed access decision; a known recess cutoff still
blocks play locally. The access screen rechecks automatically and offers retry
without signing out, so the next recess can reopen the current route.

`tools/browser-connection-recovery.ts` exercises admission retries, silent sockets,
online recovery, terminal denials and cleanup. The real app guard/hook is exercised
by `apps/web/tools/access-recovery-browser.ts` with fixture provider decisions.

## Join budgets and lifecycle logs

A socket has five seconds to send its hello. Once a valid ticket is presented,
room loading has a separate 30-second deadline and sends a small `joining` message
every two seconds. These messages keep the browser's silent-socket watchdog from
replacing a healthy loading connection. Missing hello and expired loading have
distinct close reasons; loading expiry is retryable.

Accepted joins log at info with actor ID, role, connection/room/world identities,
connection count and authorization/allocation/membership timings. Worker-ready
logs retain worker duration and add total loading time, restore status, ownership,
checkpoint and initialization timings. Clean browser disposal closes with code
1000 and a fixed departure reason; normal player departures are info events.
Unexpected transport loss remains a warning. Arbitrary peer close text is never
logged. Controls include room, actor and duration. Pointer-lock refusals remain
local to the browser; legacy reports are acknowledged without provider IO or logs.

`tools/browser-loading.ts` verifies an eleven-second load uses one admission and
produces a clean departure. `apps/web/tools/voxel-controls-browser.ts` verifies
Resume remains busy between its HTTP receipt and the world update.
