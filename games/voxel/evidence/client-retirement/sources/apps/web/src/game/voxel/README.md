# Rewritten voxel session

The existing catalog/invitation/play route mounts `VoxelSessionContainer` for
`minecraft` sessions. It lazy-loads `VoxelSurface` and the browser-only runtime
entry in `games/voxel/src/client/embed.ts`. The application build rejects old voxel
renderer modules and simulation/server modules in either browser bundle graph.
Classroom HTTP/RTC now has its own `apps/classroom-server` workspace and deployment configuration.

Set `VITE_VOXEL_RUNTIME_SERVER_URL` to the rewritten service's HTTPS origin.
Development defaults to `http://localhost:3001`; production requires configuration.
`VITE_CLASSROOM_SERVER_URL` selects the independent classroom/RTC service.
The legacy `VITE_VOXEL_SERVER_URL` remains only for code awaiting voxel retirement;
it is not a fallback for classrooms or the rewritten runtime.

The container obtains a fresh Playground session token for each API request,
checks its user ID and sends it only in the Authorization header. The trusted
service handles school admission and single-use socket tickets. Browsers cannot
persist lifecycle, roster or presence changes. Scoped metadata reads use
`POST /api/voxel/session`; active staff can inspect across partitions, while
completed-session reads require staff or existing roster authority. These reads
do not allocate a worker or grant gameplay. Expired presence arrays display empty.

Each mounted surface owns one runtime and cancellation signal. Abort checks
cover dynamic import, Wasm loading and renderer preparation. Late completion is
disposed. Inventory, touch controls, subscriptions and timers share that lifetime.
React receives HUD state at most every 100 ms, with immediate status/lifecycle/
role/inventory changes. Transform replication and world state stay in the runtime.
The fullscreen root also owns the Hebrew inventory dialog. Exit releases owned
pointer/fullscreen state and disposes GPU, worker, audio and DOM resources.

The Hebrew RTL HUD includes an owned hotbar, inventory/crafting/equipment/chests,
health/food/air, mining feedback, death/respawn, explicit input resume and a hidden
staff-observer state. Touch-player vitals sit below the measured header. Staff
participation changes require fresh admission. Pause/end confirmation displays
saved only after a committed server receipt; an unconfirmed request retains the
same UUID for retry. Superseded historical receipts cannot change current state.

Diagnostics use `POST /api/voxel/diagnostics`, with a fresh scoped identity and
strict operation/code/build/correlation fields. They contain no tokens, profile
names, chat bodies or arbitrary error text. Client reports are coalesced and
best effort. Diagnostic failure cannot recursively report itself.

Run web typechecking/tests/build through the workspace scripts. The browser
check is `npm run test:voxel:browser --workspace @playground/web`, with the same
isolated local PostgreSQL configuration as the service's SQL suite. It builds a
React development StrictMode fixture using the actual surface/API, packaged room
worker, Supabase SDK and SQL migrations. Auth/PostgREST/Storage transports are
fixtures. This checks cancellation, fullscreen inventory, failed-save retry,
paused staff flight, explicit resume/end, mobile controls and resource cleanup.
It does not establish the actual authenticated catalog-shell journey, hosted
recovery or physical school-PC performance. Earlier fullscreen automation dispatch
timeouts remain historical diagnostics; current repeated app mounts/exit and the
trusted PC keyboard/mouse survival journey pass. PCs and ordinary school use are
the release focus; large synthetic scale and mobile/tablet qualification are not
requirements. See `games/voxel/docs/pc-school.md`.

Voxel rejoin-card dismissal now calls the trusted self-departure API with a fresh
identity and stable retry UUID. It works outside recess and for old-partition
membership, rejects connected actors and waits for last-owner retirement before
terminal removal. It reports no save result. This needs the locally qualified
[fourth migration](../../../../../supabase/migrations/20261025040000_voxel_roster_departure.sql),
which now passes hosted readiness. See [roster departure](../../../../voxel-server/docs/roster-departure.md). Staff mode/self-teleport now use a confirmed, audited protocol-13 worker path; see
[staff commands](../../../../voxel-server/docs/staff-commands.md). The fifth staff schema and sixth [access moderation schema](../../../../voxel-server/docs/moderation.md)
are installed and read-only verified. Visible staff controls remove, ban and
unban participants with stable request retries and no checkpoint-save claim.
Banned entry is denied; removal/unban require explicit fresh admission. The
three-context browser flow preserves a nonempty owned bag through those entries.
[Persisted chat](../../../../voxel-server/docs/chat.md) now has owned Hebrew UI,
strict history/receipts, explicit lost-response retry and staff delete/clear. Its
seventh migration is locally qualified, installed and read-only verified. Remaining
LiveKit proximity/enforced mute policy, hosted classroom
qualification, hosted recovery and hardware/network/
capacity qualification and cutover/removal remain part of the full rewrite.
There are no player, observer, object or room-count admission caps.

Mode changes keep existing deaths until ordinary respawn, including after reconnect.
The HUD names the current mode and hides live survival vitals in creative while
retaining the death/respawn view. Staff feedback stacks with lifecycle save feedback
so an unconfirmed save remains visible. Neither mode nor teleport receipts claim
saving; pause/end keep their existing committed-save acknowledgements.
