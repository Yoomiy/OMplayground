# The Playground — Architecture & Product Guide

> **מגרש המשחקים** — private-school multiplayer platform, Hebrew RTL UI.
> Kids play **only during recess** (`Asia/Jerusalem`). Teachers and platform admins bypass the gate.  
> **Last updated:** 2026-10-28. The voxel client on this branch uses the rewritten runtime; hosted/backend cutover is still pending. PCs are the primary device target; large synthetic scale and mobile/tablet qualification are not release requirements.

**More docs:** [`docs/README.md`](docs/README.md) — index of ADRs, ops, and design specs.

**Future multiplayer imports:** [`docs/multiplayer-game-integration.md`](docs/multiplayer-game-integration.md) — agent pipeline, runtime selection, integration contract and acceptance checklists. Its proposed action runtime is forward-looking, not part of the currently implemented stack.

---

## 1. Overview

| Concept | Description |
|---|---|
| **Recess-gated access** | Kids cannot log in outside active recess windows. Teachers/admins bypass. |
| **Supabase Auth** | Username login → `[username]@playground.school.local` (Auth API only; never shown in UI). |
| **Gender separation** | Games, sessions, presence, and social data partitioned by `boy` / `girl`. |
| **Authoritative servers** | Live state belongs to Node game services, not Postgres ticks or browser-reported positions. |
| **Separate services** | Boards → `game-server`; rewritten voxel → `voxel-server`; classroom/RTC → `classroom-server`. The legacy game client/backend source is retired; hosted routing cutover remains pending. |

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui (`apps/web`) |
| Data | Supabase (Postgres, Auth, Realtime, RLS) |
| Board multiplayer | Socket.io → `apps/game-server` (`:8080`) |
| Voxel multiplayer | Native WebSocket → `apps/voxel-server`; room workers and shared Rust/Wasm simulation under `games/voxel` |
| Voice/classrooms | LiveKit SFU with separately authorized voxel and classroom media adapters |
| Shared packages | `game-logic`, `observability`; legacy content is frozen text for the offline disposition audit, with no executable workspace |
| Deploy | Web and independent Node services; operational cutover to the rewritten voxel/classroom services remains pending |

### Monorepo layout

```text
apps/web | apps/game-server | apps/voxel-server | apps/classroom-server
games/voxel                      # engine, content, simulation and imperative client
packages/game-logic | packages/observability
supabase/migrations
```

Key frontend entry points: `GameSessionContainer` + `BOARD_REGISTRY`, `game/voxel/VoxelSessionContainer`, `SoloGameContainer`, `usePresence`, `AdminPage`, `TeacherPage`. The old NOA/Babylon client/container/socket hook and Minecraft backend workspace have been removed. Classroom error reports use the classroom service; admin stats independently query game, voxel and classroom services.

---

## 2. System diagram

```
┌─────────────────┐         HTTPS (REST / Realtime)          ┌──────────────────────────┐
│  Browser (SPA)  │ ◄──────────────────────────────────────► │  Supabase                │
│  Vercel         │         PostgREST + RLS + Realtime       │  Postgres + Auth + RLS   │
│  (apps/web)     │                                         │  Social + catalog +      │
└────────┬────────┘                                         │  persisted chat rows     │
         │                                                   └──────────────────────────┘
         │ Socket.io  VITE_GAME_SERVER_URL
         ▼
┌─────────────────┐
│  game-server    │  Turn-based / event-driven multiplayer
│  Railway :8080  │
└─────────────────┘

         │ native WebSocket  VITE_VOXEL_RUNTIME_SERVER_URL
         ▼
┌─────────────────┐         LiveKit SFU (WebRTC voice)
│  voxel-server  │ ◄──── scoped media authorization, checkpoints and room workers
│                │
└─────────────────┘

Classroom/RTC HTTP endpoints use VITE_CLASSROOM_SERVER_URL → classroom-server.
Both media adapters use LiveKit without sharing the voxel simulation process.
```

| Env var | Target |
|---------|--------|
| `VITE_GAME_SERVER_URL` | `apps/game-server` |
| `VITE_VOXEL_RUNTIME_SERVER_URL` | `apps/voxel-server` |
| `VITE_CLASSROOM_SERVER_URL` | `apps/classroom-server` |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Relevant server-side media adapters; never browser secrets |

---

## 3. Data split: Supabase vs Railway

| Responsibility | Supabase | Railway |
|----------------|----------|---------|
| Identity, profiles | `auth.users`, `kid_profiles`, `admin_profiles` | JWT `sub` only |
| Social, catalog, recess | Yes + Realtime | No |
| `game_sessions` metadata | Yes (boundaries) | In-memory during play |
| Live match / tick state | No | Yes |
| In-game chat | Persisted | Relay + batch persist |
| Solo saves | `solo_game_saves` | No |
| Voxel world/inventory | Private immutable Storage objects plus fenced Postgres checkpoint pointers/owner leases | Coherent snapshots from authoritative 30 Hz room workers |
| LiveKit tokens | Roster validation | Mint + webhooks |

**Hot path:** No per-tick Postgres writes. Boards persist at their boundaries; voxel autosaves coherent checkpoints every 15 seconds and acknowledges pause/stop saving only after commit. Solo games never use the multiplayer services.

---

## 4. Authentication & roles

1. `LoginPage` → `supabase.auth.signInWithPassword` with synthetic email.
2. `usePlaygroundAccess` loads profile, enforces recess for kids.
3. JWT used for Supabase queries and Socket.io handshakes.

| Role | Table | Home route |
|---|---|---|
| kid | `kid_profiles` | `/home` |
| teacher | `kid_profiles` | `/teacher` |
| admin | `admin_profiles` | `/admin` |

---

## 5. Database (core tables)

`kid_profiles`, `admin_profiles`, `games`, `game_sessions`, `chat_messages`, `private_messages`, `friendships`, `kid_blocks`, `game_challenges`, `solo_game_saves`, `moderation_reports`, `recess_schedules`, `avatar_presets`, `audit_log`.

- View: `public_kid_profiles` (safe cross-kid reads).
- Helper: `is_within_recess_now()` for RLS and recess sweeps.

---

## 6. Routes (`apps/web/src/App.tsx`)

| Route | Page | Notes |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/home` | `HomePage` | Catalog, open/paused games |
| `/solo/:gameKey` | `SoloGameContainer` | No WebSocket |
| `/play/:sessionId` | `PlayPage` | Board or voxel container |
| `/join/:code` | `JoinByCodePage` | |
| `/inbox`, `/profile`, `/profile/:kidId` | Messaging & profiles | |
| `/friends` | `FriendsDeprecatedPage` | UI disabled — `docs/friends-deprecation.md` |
| `/teacher` | `TeacherPage` | |
| `/admin` | `AdminPage` | moderation, users, import, games, schedule, **stats**, operations, audit |

---

## 7. Real-time

### Supabase Realtime (not game ticks)

`presence:playground:{gender}`, `game_sessions`, `private_messages`, `game_challenges`, `chat_messages`.

### Socket.io

**Stack:** Socket.io — see `docs/adr/001-websocket-socket-io.md`.

| Server | Rooms |
|---|---|
| game-server | `session:{sessionId}` |

**game-server events**

| Client → server | Server → client |
|---|---|
| `JOIN_ROOM`, `LEAVE_ROOM`, `INTENT_GAME`, `CHAT_MESSAGE` | `ROOM_SNAPSHOT`, `ROOM_EVENT`, `ROOM_ERROR` |
| `PAUSE_GAME`, `RESUME_GAME`, `STOP_GAME`, `REMATCH`, `SPECTATE` | `LIVE_DELTA` (drawing, breakout), `CHAT_MESSAGE` |

Rewritten voxel has its own native WebSocket protocol and accepted ADR (`docs/adr/002-voxel-native-websocket.md`). Bearer-authenticated admission yields single-use tickets; control frames contain inputs, not positions or durations. Matching engine/content/build identities, actor epochs and revisioned binary column baselines fence joins/reconnects. This is separate from the board Socket.io contract and `GameModule`.

---

## 8. Games

HomePage splits catalog by `games.is_multiplayer`.

### Multiplayer (`game-server` + `game-logic`)

| `game_url` | Notes |
|---|---|
| chess, tictactoe, connectfour, memory | 2 players |
| drawing | 1–10; `LIVE_DELTA` |
| breakout | Code exists; **catalog hidden** until sync fixed |
| minecraft | Rewritten `VoxelSessionContainer` → `voxel-server` |

Lifecycle: `waiting → playing → paused | completed`. Paused: roster-only rejoin; auto-resume when all reconnect.

### Solo (`/solo/:gameKey`)

`snake`, `simon`, `whackamole`, `balloonpop`, `drawing`, `alges-escapade`, `hexgl`, `chess-solo`, `breakout-solo` (alias `breakout`). Saves in `solo_game_saves`.

### Voxel

`apps/web/src/game/voxel/VoxelSessionContainer` owns the React HUD/session journey around the imperative runtime in `games/voxel`. The new client uses Three.js, bounded generation/mesh workers and the same release Wasm as Node prediction/authority. Content is compiled from `games/voxel/content`; old numeric IDs and protocol types are not adapters. See `games/voxel/README.md`, `games/voxel/docs/pc-school.md` and the rewrite proposal. Historical scale results do not block the private-school release.

Add games: `.cursor/skills/playground-add-game/SKILL.md`.

---

## 9. Social

| Feature | Status |
|---|---|
| Messages, blocks, challenges | Active |
| Friends / friend requests | **UI deprecated** — schema retained (`docs/friends-deprecation.md`) |
| Online peers | Supabase Presence (`usePresence`) |

---

## 10. Teacher & admin

**Teacher:** `TeacherPage` lists sessions and observes via `/play/:sessionId`; the voxel adapter provides capability-checked observation/play, teleport, room controls and persisted moderation.

**Admin:** `AdminPage` — kid CRUD, CSV import (`import-bulk-kids` Edge Function), games, recess, reports, `audit_log`, live stats tab (`AdminStatsSection`), operations RPCs.

---

## 11. Recess enforcement

Client (`usePlaygroundAccess`), RLS (`is_within_recess_now()`), both servers (`recessSweep.ts`), auto sign-out when recess ends. Teachers/admins bypass.

---

## 12. Security

Supabase JWT; gender checks on join + LiveKit tokens; server-authoritative game state; `admin_profiles` + `audit_log`; service role server-only; block checks on messages.

**RLS:** Default authenticated client; `public_kid_profiles` for safe reads; same-gender policies + RPCs.

---

## 13. Observability & ops

`packages/observability` supplies shared Pino/correlation/process handling and existing operational HTTP routes. Rewritten voxel emits bounded room/worker/queue/checkpoint timing and audit events with build/epoch context. It does not log each input, chat body or voice content. The shared legacy telemetry URL helper remains until backend operational routing is retired.

**Legacy operational stats retained during backend cutover:**
- **In-Memory Buffering**: To prevent per-tick database writes, client FPS metrics and player launches are aggregated in-memory on the servers (`launchTracker.ts`, `fpsAggregator.ts`) and flushed to Supabase (`game_launch_stats`, `minecraft_fps_stats`) at session boundaries.
- **Disconnect Flushing**: When a player disconnects leaving a room empty, the server auto-flushes their accumulated stats to the database. For Minecraft, this flush has a 1-second delay (`setTimeout`) to ensure the final clientside unmount telemetry fetch (sent via `keepalive` fetch) arrives and is ingested.
- **Live Admin Flushing**: When an admin loads or refreshes the stats page, the server intercepts the stats request and invokes a non-destructive flush (`onAdminStatsQuery` hook) of all active game rooms. This flushes active launch/FPS metrics to the database without deleting active session keys from memory.
- **Polling Optimization**: The Admin Stats UI dashboard tab (`AdminStatsSection`) monitors tab visibility via the Page Visibility API. It pauses stats polling requests immediately when the browser tab is hidden to conserve network bandwidth and backend server CPU cycles.

`GET /health`, `GET /ready`, rate limits. Production operations are documented
in `docs/HARDENING.md`; required logging practices for every new feature and
process are documented in `docs/LOGGING.md`.

---

## 14. School hosting & tokens

Use the private school's ordinary sessions as the operational target. No synthetic-scale gate, horizontal-scaling project or Redis adapter is required for the voxel rewrite. Preserve game/service isolation and ordinary bounded work queues.

- Configure allowed origins per service; rewritten voxel uses `VOXEL_ALLOWED_ORIGINS`.
- Browser: Supabase publishable key; backend secret keys stay server-side.
- Game servers: `access_token` in Socket.io `auth`.
- Voxel: bearer admission followed by a short-lived, single-use native WebSocket ticket.

---

## 15. Voxel teacher & spectator

Teacher/admin abilities are explicit server capabilities. Hidden observers are non-colliding, excluded from student replication and denied survival actions. Trusted mode/teleport/pause/moderation commands are scoped and audited; admission and reconnect revalidate school/recess/membership. There are no voxel player/observer/room headcount ceilings. LiveKit grants follow the separately checked media policy. The actual hosted journey remains a release validation task.

---

## 16. Cursor references

- Rules: `.cursor/rules/playground-project.mdc`, `playground-architecture.mdc`
- Backend QA: `.cursor/skills/playground-backend-qa/SKILL.md`
- Add a game: `.cursor/skills/playground-add-game/SKILL.md`

---

## 17. Virtual Classrooms

**Route:** `/classroom/:roomCode` (accessible publicly with or without platform login).

### Stack & Infrastructure
- **Media Engine**: LiveKit SFU (HD video/audio streaming, presentation screen share, reactions, and active speaker highlighting).
- **Session DB state**: `classroom_sessions` tracks title, creator, settings, room code, status, persistence, and activity timestamps. The active whiteboard checkpoint lives in the linked drawing `game_sessions.game_state`.
- **Security Check**: Restricted token endpoints verify `admin_profiles` or `kid_profiles`. Classroom lifecycle and promotion APIs require an authenticated teacher/admin; the database maintenance RPCs are service-role only.

### Excalidraw Whiteboard Integration & Sync
- **Whiteboard Engine**: Embedded `DrawingCanvas.tsx` / `DrawingBoard.tsx` (reusing the platform's drawing module).
- **Canonical Live State**: The game server owns one in-memory Yjs document for each active `class-draw-{roomCode}` room. Permitted clients submit Yjs deltas; the server applies and broadcasts them. LiveKit Data Channels carry only media-adjacent chat, reactions, hand raises, and host controls.
- **Join and Reconnect Sync**: The server sends `CLASSROOM_DRAWING_SYNC` with its complete canonical Yjs state to every joining socket. The client renders that state before enabling its binding, then acknowledges it; live deltas are accepted only after that acknowledgement. This prevents a late client from overwriting the active board with an empty or stale local scene.
- **Durability**: The linked drawing `game_sessions.game_state` is a recovery checkpoint, not the live source of truth. The canonical state is checkpointed periodically and on lifecycle events, so the board can be rebuilt after a game-server restart. Explicit clears update both the live document and its durable checkpoint.
- **Viewport Lock & Refocus**: The host's scroll position and zoom level are synchronized to all student screens. Non-host students are locked to the host's focus area to prevent them from panning/scrolling away.

### Room Lifecycle & Cleanup
- **Room Persistence**: Classrooms are either temporary (`⏳ זמנית`) or permanent (`📌 קבועה`). Persistent rooms are protected from automated cleanups.
- **Stale Room Purging**:
  - **Auto Cleanup (Cron)**: A background server interval runs every 6 hours to remove non-persistent rooms only when ended or stale by `last_activity`, then completes linked drawing sessions and wipes LiveKit memory via `RoomServiceClient.deleteRoom`.
  - **Manual Cleanup**: Administrators can trigger a manual cleanup via the `🧹 ניקוי כיתות ישנות` button in the admin dashboard.
- **Safe Hardware Init**: Prevents failures or crashes when users lack audio/video devices (`Starting videoinput failed`) by safely wrapping device tracks initialization.
