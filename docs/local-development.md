# Local app development

## Fresh clone

Check out `dev/staging` and use Node **24.21.0**. From the repository root:

```sh
npm ci
npm ci --prefix games/voxel --ignore-scripts
npm --prefix games/voxel run restore:release
```

Restore your private local configuration into `apps/web/.env`,
`apps/game-server/.env`, `apps/voxel-server/.env` and
`apps/classroom-server/.env`. Copy the values from your working setup, or use
the available frontend/voxel/classroom `.env.example` files as templates. Use the
Supabase publishable key in the frontend and server-only Supabase/LiveKit keys in
the backend files. Leave the frontend service URL overrides empty for local
proxies.

The restore command verifies the checked-in, source-matched game release and
creates the ignored Wasm/client/server outputs. This startup path needs no Rust
toolchain. It refuses a source mismatch; game edits need the full rebuild
described below.

## Start the app

Run the full app with Node 24.21.0:

```sh
npm run dev:app
```

Open **http://localhost:5173**. This starts the web app, board server on 8080,
new voxel server on 3001 and independent classroom service on 8083. It builds the
shared packages once, checks the matched voxel release and configuration, refuses
occupied ports and stops its own process groups on Ctrl+C. A failed child also
stops the other processes. It does not stop servers started by another command.

The web app proxies HTTP and WebSocket requests to these local services through
port 5173. When using a remote workspace, forward only port 5173 and open
http://localhost:5173 on your PC. For a different browser hostname or port, add
that exact origin to the services' `CORS_ORIGIN` and `VOXEL_ALLOWED_ORIGINS` settings;
the proxy preserves authentication and origin checks. The web app
still loads its Supabase URL/publishable key from `apps/web/.env`. Services use
their server-only `.env` files. During transition, the voxel/classroom launchers
also load the preserved `apps/minecraft-server/.env` as a credential fallback;
the new voxel file, then the classroom-specific file, take precedence. No old
Minecraft code is started. Service ports stay distinct even if a shared old file
contains `PORT`. Local browser origins are added only by the dev wrapper.

This is the normal school app using the configured Supabase and LiveKit services;
saved worlds and school actions persist in that configured project. No SQL or
deployment change is part of the launcher. Local app testing still enforces school
access rules; use an existing teacher/admin account when testing outside recess. Configuration examples are in
[`apps/web/.env.example`](../apps/web/.env.example),
`apps/voxel-server/.env.example` and `apps/classroom-server/.env.example`.

Check configuration/build/port availability without starting the services or
contacting Supabase/LiveKit:

```sh
npm run dev:app -- --check
```

For separate terminals, the root commands are `dev:server`,
**`dev:voxel-server`** (replaces the removed `dev:minecraft`), `dev:classroom`
and `dev:web`. The individual web command uses its normal Vite environment;
leave `VITE_GAME_SERVER_URL`, `VITE_VOXEL_RUNTIME_SERVER_URL` and
`VITE_CLASSROOM_SERVER_URL` unset to use the same development proxies. Explicit
URL settings override those defaults. The combined launcher clears those three
browser URL overrides for its own web process so stale production URLs cannot
bypass the local services.

Stop the stack and run `npm run build:voxel` with the pinned
[engine toolchain](../games/voxel/UPSTREAM.md) after engine, content, world-profile
or shared simulation changes, then restart `dev:app`. Service-only edits use the normal
watcher. A missing
or stale release fails preflight rather than starting a mismatched build.

`npm run dev:voxel` remains the separate game-only sandbox at
http://127.0.0.1:5194. It is useful for isolated mechanics and does not start the
school app or use Supabase admission.
