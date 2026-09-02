# The Playground — Architecture & Product Guide

> **מגרש המשחקים** — school multiplayer platform (grades 1–7), Hebrew RTL UI.  
> Kids play **only during recess** (`Asia/Jerusalem`). Teachers and platform admins bypass the gate.  
> **Last updated:** June 2026. Aligns with `.cursor/rules/playground-project.mdc` and `playground-architecture.mdc`.

**More docs:** [`docs/README.md`](docs/README.md) — index of ADRs, ops, and design specs.

---

## 1. Overview

| Concept | Description |
|---|---|
| **Recess-gated access** | Kids cannot log in outside active recess windows. Teachers/admins bypass. |
| **Supabase Auth** | Username login → `[username]@playground.school.local` (Auth API only; never shown in UI). |
| **Gender separation** | Games, sessions, presence, and social data partitioned by `boy` / `girl`. |
| **Authoritative servers** | Live multiplayer state in Railway Node (Socket.io), not Postgres ticks. |
| **Dual game servers** | Board games → `game-server`; voxel Minecraft → `minecraft-server`. |

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui (`apps/web`) |
| Data | Supabase (Postgres, Auth, Realtime, RLS) |
| Board multiplayer | Socket.io → `apps/game-server` (`:8080`) |
| Voxel multiplayer | Socket.io → `apps/minecraft-server` (`:8081`) |
| Voice (voxel) | LiveKit SFU; `POST /rtc/token` on minecraft-server |
| Shared packages | `game-logic`, `voxel-content`, `observability` |
| Deploy | Vercel (web), Railway (both Node services) |

### Monorepo layout

```text
apps/web | apps/game-server | apps/minecraft-server
packages/game-logic | packages/voxel-content | packages/observability
supabase/migrations
```

Key frontend entry points: `GameSessionContainer` + `BOARD_REGISTRY`, `MinecraftSessionContainer`, `SoloGameContainer`, `usePresence`, `AdminPage`, `TeacherPage`.

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

         │ Socket.io  VITE_VOXEL_SERVER_URL
         ▼
┌─────────────────┐         LiveKit SFU (WebRTC voice)
│ minecraft-server│ ◄──── POST /rtc/token, webhooks
│  Railway :8081  │
└─────────────────┘
```

| Env var | Target |
|---------|--------|
| `VITE_GAME_SERVER_URL` | `apps/game-server` |
| `VITE_VOXEL_SERVER_URL` | `apps/minecraft-server` |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | `apps/game-server` and `apps/minecraft-server` |

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
| Voxel world/inventory | Snapshots at boundaries | Authoritative tick loop |
| LiveKit tokens | Roster validation | Mint + webhooks |

**Hot path:** No per-tick Postgres writes. Persist at boundaries (pause, complete, disconnect, chat batches). Solo games never touch Railway.

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
| minecraft-server | `voxel:{sessionId}`, `voxel-snapshot:*`, `voxel-snapshot-teacher:*` |

**game-server events**

| Client → server | Server → client |
|---|---|
| `JOIN_ROOM`, `LEAVE_ROOM`, `INTENT_GAME`, `CHAT_MESSAGE` | `ROOM_SNAPSHOT`, `ROOM_EVENT`, `ROOM_ERROR` |
| `PAUSE_GAME`, `RESUME_GAME`, `STOP_GAME`, `REMATCH`, `SPECTATE` | `LIVE_DELTA` (drawing, breakout), `CHAT_MESSAGE` |

minecraft-server uses tick snapshots and voxel intents — not `GameModule`. Voice: LiveKit room `voxel-session-{sessionId}`.

---

## 8. Games

HomePage splits catalog by `games.is_multiplayer`.

### Multiplayer (`game-server` + `game-logic`)

| `game_url` | Notes |
|---|---|
| chess, tictactoe, connectfour, memory | 2 players |
| drawing | 1–10; `LIVE_DELTA` |
| breakout | Code exists; **catalog hidden** until sync fixed |
| minecraft | Routed to `minecraft-server` |

Lifecycle: `waiting → playing → paused | completed`. Paused: roster-only rejoin; auto-resume when all reconnect.

### Solo (`/solo/:gameKey`)

`snake`, `simon`, `whackamole`, `balloonpop`, `drawing`, `alges-escapade`, `hexgl`, `chess-solo`, `breakout-solo` (alias `breakout`). Saves in `solo_game_saves`.

### Voxel

`MinecraftClient.tsx` (noa), worldgen Web Worker, `useLiveKitProximity`. Teacher spectators get filtered snapshots. See § Voxel teacher below.

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

**Teacher:** `TeacherPage` lists sessions; observes via `/play/:sessionId`; chat moderation RPCs; voxel spectator/teleport/`SWITCH_TEACHER_MODE`.

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

`packages/observability`: Pino, correlation IDs, `/api/admin/stats`, client `/api/telemetry` ingest, LiveKit webhook + voice stats. Wired on **both** Railway services.

**Admin Stats & Telemetry Persistence:**
- **In-Memory Buffering**: To prevent per-tick database writes, client FPS metrics and player launches are aggregated in-memory on the servers (`launchTracker.ts`, `fpsAggregator.ts`) and flushed to Supabase (`game_launch_stats`, `minecraft_fps_stats`) at session boundaries.
- **Disconnect Flushing**: When a player disconnects leaving a room empty, the server auto-flushes their accumulated stats to the database. For Minecraft, this flush has a 1-second delay (`setTimeout`) to ensure the final clientside unmount telemetry fetch (sent via `keepalive` fetch) arrives and is ingested.
- **Live Admin Flushing**: When an admin loads or refreshes the stats page, the server intercepts the stats request and invokes a non-destructive flush (`onAdminStatsQuery` hook) of all active game rooms. This flushes active launch/FPS metrics to the database without deleting active session keys from memory.
- **Polling Optimization**: The Admin Stats UI dashboard tab (`AdminStatsSection`) monitors tab visibility via the Page Visibility API. It pauses stats polling requests immediately when the browser tab is hidden to conserve network bandwidth and backend server CPU cycles.

`GET /health`, `GET /ready`, rate limits. Details: `docs/HARDENING.md`.

---

## 14. Scaling & tokens

Single Railway instance per service initially; later sticky sessions + Redis Socket.io adapter.

- CORS per server via `CORS_ORIGIN`.
- Browser: anon key only.
- Game servers: `access_token` in Socket.io `auth`.

---

## 15. Voxel teacher & spectator

Teachers bypass capacity; invisible to students (double-channel snapshots). Spectator flight; `SWITCH_TEACHER_MODE` when room has capacity. Host-drop isolation preserves student host when only teachers remain. LiveKit token path mirrors `JOIN_ROOM` gates.

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
