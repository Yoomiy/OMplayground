# Wobble service deployment

Wobble uses the same separate game-service pattern as Rocket Arena. The React app hosts configuration and results; this Node service serves its matching iframe assets and authoritative rooms. Build and ship the server and browser bundle together.

## Build and run

Use the repository root as the Docker build context:

```sh
docker build -f games/wobble-rush/Dockerfile -t playground-wobble .
```

`railway.toml` selects this Dockerfile, checks `/ready`, and uses one replica. The service hosts multiple rooms without a configured room-count cap. Do not add replicas behind a random load balancer: live rooms and sockets are process-local. Scaling needs deliberate room routing and capacity measurements.

For a Node 24 host, run `npm ci`, `npm run build`, then `npm start` from `games/wobble-rush`. Bun is needed only at build/test time. The runtime dependencies are installed with `npm ci --omit=dev` in the container.

## Configuration

- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`: server-only access for profile/session admission and durable saves.
- `WOBBLE_TICKET_SECRET`: stable, secret, at least 32 characters. Retain across restarts and releases to verify checkpoints. Rotating it invalidates existing signed saves and tickets.
- `APP_ORIGINS`: comma-separated exact browser origins, including scheme and port. Only configured parents can launch the iframe.
- `HOST=0.0.0.0` and platform `PORT`: bind the service for hosting. Local development uses loopback and port 3000.
- `LOG_LEVEL=info`: lifecycle, admission, disconnection, completion and error logs. Use `debug` temporarily for correction diagnostics.
- Optional `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: voice token issuing and participant revocation, shared with the app’s voice setup.

Set the web app’s `VITE_WOBBLE_SERVICE_URL` to the public HTTPS service URL at web build time. Configure matching `APP_ORIGINS`. Enable WebSocket upgrades and permit long-lived connections in the hosting proxy. Never expose the signing secret or service role key to the browser.

## Release checks and recovery

`GET /ready` returns 200 while accepting traffic and 503 during shutdown. `GET /health` reports the build release, connections, rooms and overload counters. Service startup, room allocation/restoration, hibernation and shutdown logs include `activeRooms`, the number of rooms currently hosted in memory (including paused rooms and completed rooms retained for rematches). `GET /api/wobble/config` advertises the release, supported protocol and course content.

The build fingerprints runtime sources and shared app dependencies into one release identifier. Authenticated launch/attach rejects mismatched releases; existing clients should reload after a release. Keep protocol and content versions compatible with any durable saves you intend to restore.

SIGINT/SIGTERM initiate checkpoint/drain handling; allow at least 30 seconds before forced termination (the dev runner allows 35 seconds). Save state includes signed authoritative world and cup progress, with room ownership/lease checks. Verify save/resume and app reconnect after a hosting change.

Run the checks in [README.md](README.md) before release. The committed catalog migrations follow the normal Supabase migration process. Building these files or preparing a PR does not deploy the service or apply migrations.
