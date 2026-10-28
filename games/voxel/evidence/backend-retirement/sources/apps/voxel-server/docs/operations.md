# Read-only service operations

`POST /api/voxel/admin-stats` with body `{}` and a Supabase bearer token returns
the local service's active transport connections, non-closing room count,
per-room connection counts and media signaling connection count. The gateway
applies its existing origin, preflight and request-body rules. No room is
allocated, game capability issued or database mutation performed by this route.

Every request verifies Auth identity and fresh profile rows through `SchoolAccess`.
Only platform administrators may read it. Teachers and students receive 403;
missing/invalid credentials receive 401, invalid bodies 400 and unavailable or
expired proofs 503. Responses use `Cache-Control: no-store`. Snapshot counts are
local observations; transport connections can include admission handshakes and
room connection counts include observers. Media connections describe signaling,
not an independently measured count of successfully joined SFU participants.

The web admin panel independently queries board, voxel and classroom services.
Voxel uses `VITE_VOXEL_RUNTIME_SERVER_URL`; classroom stats and browser error
reports use `VITE_CLASSROOM_SERVER_URL`. Each stats request has a ten-second
timeout; an unavailable/misconfigured service does not hide the other services.
Missing measurements are shown as unavailable rather than invented Socket.io
rates or latency for the native voxel transport. The old
`VITE_VOXEL_SERVER_URL` has no production consumer.

The packaged-gateway test covers preflight/origin rejection, fresh role checks,
admin revocation, provider outage, response scope and zero room allocation.
The PostgreSQL service-composition test also checks that the production route is
installed and rejects unauthenticated access. Web tests cover routing, independent
failure handling and classroom telemetry retry after missing configuration.

This is operational continuity for the private-school app. It adds no headcount
limits, scale infrastructure, SQL migration or deployment action.
