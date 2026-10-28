# School admission boundary

`SchoolAccess` reads current Supabase identity, profile, session, invitation and
recess policy. `schoolAdmission` adapts it to the runtime gateway. This implements
the authorization boundary. The production entry, React session/HUD and fenced
lifecycle projection are implemented, along with removal/ban/unban, persisted
chat and rewritten media endpoints. Deployment and full hosted school
qualification remain open.

The HTTP request contains a session UUID, optional invitation code and optional
player/observer choice. The bearer JWT is verified with Supabase Auth before its
subject and expiry are read. Role, gender, grade, activation, session membership
and staff eligibility come from current rows. Browser role/capability claims are
rejected. Reads omit names, saved gameplay blobs and capacity fields. An inactive
profile cannot fall through into administrator access.

Children enter their session's partition during effective recess. Schedule
interpretation uses the platform's shared Jerusalem-time helper, including class
overrides and half-open closing boundaries. Corrupt or unavailable policy fails
closed. Closed sessions require a current roster/host, accepted invitation code
or accepted challenge. A deliberate pause admits existing members and staff
inspection; new players cannot bypass it with an invitation. When public presence
displays paused during empty-room recovery or startup, admission reads the
service-only `voxel_session_policy` RPC. Playing intent permits normal new
admission; paused or ended intent and unavailable or malformed replies cannot
open the room. Membership acceptance rechecks pause intent inside its SQL locks.
Completed or unrelated game sessions are denied.

Teachers and administrators default to hidden observation across partitions.
Observers have flight, including in survival, and have no build/combat/explosive
grants. Teachers choosing player participation follow the normal partition rule;
administrator profiles without a gameplay partition cannot become players.
Saved flight state is cleared when current authority no longer permits flight.
Player and observer counts do not participate in admission.

Each private grant lasts at most five seconds from the start of its read, also
bounded by JWT expiry and an actual recess closing boundary. There is no profile
cache. PostgREST's automatic retries are disabled for policy reads; the gateway
owns renewal and expiry. Provider errors expose a fixed machine code rather than
provider messages or credentials.

The gateway revalidates a single-use ticket before allocating its room and again
after a slow allocation when necessary. It renews connected authority midway
through the remaining lease. Changed identity/role/capabilities require a fresh
admission and baseline; explicit denial disconnects, and provider failure closes
with a retryable recovery reason. A delayed read cannot revive an expired socket.
The worker independently expires the actor on its monotonic deadline, including
while paused or while the gateway event loop is blocked. Late renewals cannot
recreate a disconnected actor. Capability functions and JWTs never cross into
the simulation or checkpoint.

Cross-origin admission permits only the configured origin (or same origin),
`POST` and the `Authorization`/`Content-Type` headers. Preflight does not call the
identity provider. Responses, including policy errors, preserve the allowed
origin and disable caching. WebSocket origin checks remain in force.

## Evidence and outstanding integration

Sixteen school-policy tests use the installed Supabase SDK with fixture Auth
and PostgREST responses. Six additional tests use that adapter through the real
HTTP gateway, sockets and native worker. They cover origin handling, ticket
revocation, invitation rotation, teacher participation/observation, survival
flight, hidden visibility, live revocation, offline-owner profile outages and
account deactivation. Core tests also
run ticket/renewal/stall cases against source and packaged servers. The rendered
software-Chromium scenario checks observer touch and keyboard flight, role HUD,
live revocation and resource disposal. These do not establish live Supabase
school authorization, hardware performance or the complete school journey.
The two-client lifecycle browser also checks central session pause, released
pointer lock and cleared input, frozen presentation time, staff flight while
paused, explicit participant resume and terminal state without automatic
readmission. School responses remain fixtures.

`schoolGatewayPolicy` installs connected admission, the owner resolver and the
fresh session-status reader. The worker combines status, current participant
leases and server-only pause. Missing participants, a paused session or expired
policy freezes world time while authorized staff can inspect. Completed sessions
are terminal, including when actor renewal observes completion before the room
poll. See [room lifecycle](../../../games/voxel/docs/room-lifecycle.md).
Restoring and periodically renewing primed TNT owners obtains explicit fresh
eligibility. Proofs last at most five seconds from the worker's request start;
unknown/expired proofs hold due explosions rather than interpreting a provider
outage as revocation. Explicit current denial can fizzle them. IO is bounded to
four reads without limiting owner counts. Late, incomplete, mismatched or
expired replies cannot revive an older request. A connected observer's stricter
role still constrains its passive ownership. Proofs are never saved.

Passive owned-object eligibility deliberately ignores wall-clock recess while
retaining membership/account checks. Individual recess denial removes gameplay
authority and pauses time when no authorized participant remains. Fenced
status/roster/presence projection, trusted pause/resume/end and the production
bootstrap are implemented. The React session/HUD uses these boundaries. Trusted
staff controls and access moderation are implemented. Persisted chat is locally qualified under its seventh schema.
LiveKit proximity/mute enforcement and hosted qualification of the locally
extracted classroom service remain part of the full rewrite.

Accepted membership, intent/status separation, expiring public presence and host
reassignment now have an optional fenced service adapter. See
[session projection](session-projection.md) for installation/test scope and
remaining host/teacher API and production integration work.

Private membership revisions now fence accepted admission after roster removal.
Connected participant renewal and passive owner checks require accepted membership,
even in open rooms. Fresh explicit admission remains possible when eligible. The
[roster API and fourth migration](roster-departure.md) are locally qualified; the
fourth schema now passes hosted readiness. Staff mode/self-teleport have a
[qualified and installed fifth schema](staff-commands.md). The installed sixth
[moderation schema](moderation.md) denies banned actors, fences their old tickets,
accepted actor/owner proofs and child-host controls, and filters queued presence.
Ticket revalidation never upgrades its original roster generation; live peers
can renew across unrelated changes. Media policy and full hosted school/recovery
qualification remain open.

[Persisted chat](chat.md) now uses fresh identity, SQL roster/policy checks and a
private live-connection proof for posting. Current observers cannot post through
an older roster entry. Proofs bind the worker owner epoch and original admission
cutoff; bans/removal and owner loss deny writes. History and staff moderation
remain independent of room allocation. The seventh schema is locally qualified, installed
and read-only verified. Voice/media enforcement remains separate work.
