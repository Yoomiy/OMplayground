# Classroom service

Independent HTTP/LiveKit service extracted from the former combined Minecraft
process. It owns classroom admission, account/guest/delegate roles, presentation,
whiteboard permissions, moderation, attendance, records, lifecycle and cleanup.
The [route contract](docs/route-contract.json) retains all 20 classroom routes.
Those routes and their two background tasks have been removed from the old game
entry. This service loads no voxel world, simulation, worker or gameplay socket.
The canonical collaborative drawing service remains `apps/game-server`.

Use Node 24.21.0. From the repository root:

```sh
npm ci --ignore-scripts
npm test --workspace @playground/classroom-server
npm run dev:classroom
```

`npm test` builds the shared observability package and the production CommonJS
entry before tests. Its Jest runner enables VM modules for the installed LiveKit
SDK's dynamic ESM transport import; production uses ordinary Node. To run built
code with this workspace's local environment, run `npm start` from the workspace
after `npm run build`. `dotenv/config` reads the working directory's `.env`.
The [Dockerfile](Dockerfile) builds just this service and observability. Container
build/runtime qualification is separate from the native-process checks.

Required server bindings are `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LIVEKIT_URL`,
`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and the allowed web `CORS_ORIGIN` list.
The current Supabase secret is required; there is no legacy service-key fallback.
Default port is 8083. `DOCUMENT_CONVERTER_URL` and the matching
`DOCUMENT_CONVERTER_SHARED_SECRET` retain the existing converter contract.
`CLASSROOM_CLIENT_IP_SOURCE` is `railway`, `direct` or `unavailable`; configure it
only for the actual trusted ingress described in [logging](../../docs/LOGGING.md).

Set **`VITE_CLASSROOM_SERVER_URL`** when building the web app. ClassroomPage,
TeacherPage classroom closure and the classroom admin explorer use that origin.
Development defaults to the browser origin with Vite's `/__classroom` proxy;
production requires an explicit address. There is no fallback to either game service. The classroom publisher
continues through the parent classroom request adapter. `VITE_GAME_SERVER_URL`
still selects the board service, and `VITE_VOXEL_RUNTIME_SERVER_URL` selects the
rewritten voxel runtime. Voxel voice uses its independent signaling adapter and
does not determine classroom routing.

`GET /health` identifies this process. Startup checks the classroom base table
through the real Supabase SDK and authenticates a read-only LiveKit room listing
before listening. Both checks have five-second deadlines and no implicit database
retry. `GET /ready` is unavailable before successful probes or while draining;
the service repeats probes every 30 seconds. This verifies connectivity and the
base table, not every classroom schema or an end-user media connection.

The signed `/webhooks/livekit` route receives untouched raw bytes before JSON
parsing and persists attendance through the existing idempotent RPC. Attendance
reconciliation runs every 30 seconds and stale temporary-room cleanup every six
hours. Each task has at most one in-flight execution. Shutdown rejects new work,
stops timers, closes HTTP connections and awaits owned jobs; the shared lifecycle
enforces a 60-second process deadline. LiveKit rooms persist when this HTTP service
restarts. There are no user, observer or room-count admission ceilings.

Account authority is freshly verified on each request. An inactive school profile
cannot fall through to a second administrator record. Existing guest admission,
delegate cookies/scopes, board capability signatures, presenter epochs, hidden
administrators and host permission enforcement are retained. Classroom logs use
`service=classroom-server`. Its voice statistics exclude other rooms on the same
SFU project. Operational logs retain the existing structured/redacted conventions
and privileged actions retain durable platform audit records.

Roll out the service and web endpoint configuration together. Configure LiveKit
webhooks to reach this service with its signing key, retain the same board signing
secret on `game-server`, and keep the converter secret aligned. Verify the actual
teacher/student/guest/delegate browser workflows, secure cookies, board hydration,
presentation, media, attendance, restart and classroom closure before retiring the
old deployment. No deployment or hosted application mutation is included here.
The local fixture checks use real SDK/signature/HTTP/native-process boundaries;
they do not qualify hosted SQL, real SFU/WebRTC, browser devices or deployment.
