# The Playground — Architecture

This document describes the rebuilt system: browser app, Supabase (Auth, Postgres, Realtime), and the Railway game server. It aligns with `.cursor/rules/playground-project.mdc` and `playground-architecture.mdc`.

---

## System diagram (text)

```
┌─────────────────┐         HTTPS (REST / Realtime)          ┌──────────────────────────┐
│  Browser (SPA)  │ ◄──────────────────────────────────────► │  Supabase                │
│  Vercel (apps/  │         PostgREST + RLS + Realtime       │  Postgres + Auth + RLS   │
│  web)           │                                         │  Social + catalog +      │
└────────┬────────┘                                         │  persisted chat rows     │
         │                                                   └──────────────────────────┘
         │ WebSocket (Socket.io)
         │ JWT in handshake (Supabase access_token)
         ▼
┌─────────────────┐
│  Game server    │  In-memory rooms, authoritative state,
│  Railway        │  tick-level gameplay, chat relay → DB
│  (apps/game-    │
│   server)       │
└─────────────────┘
```

---

## Data split: Supabase vs Railway

| Responsibility | Supabase | Railway game server |
|----------------|----------|---------------------|
| User identity & profiles | Yes (`auth.users`, `kid_profiles`, admin tables) | No (reads JWT `sub` only) |
| Friends, blocks, DMs, challenges row | Yes (normalized tables + Realtime) | No |
| Game catalog, recess schedules, avatar presets | Yes | No |
| `game_sessions` metadata (lobby, teacher list, outcomes at boundaries) | Yes | Optional mirror in memory during play |
| Live match state, per-tick animation | No | Yes (in-memory) |
| In-game chat (live) | Persisted append | Relay + batch persist at boundaries |
| Teacher moderation of chat | Yes (reads/writes `chat_messages`) | Live observation can use WS snapshot + DB |

**Hot path rule:** Multiplayer gameplay state is **not** written to Postgres every tick. Persist at **boundaries** (paused, completed, disconnect policy, chat batches).

---

## WebSocket stack decision

**Socket.io** is the chosen stack (see `docs/adr/001-websocket-socket-io.md`). Reasons: explicit room/broadcast control, straightforward Jest testing with `socket.io-client`, and alignment with backend QA skill examples. Colyseus remains a documented alternative if room state machines grow very large.

**Room model:** One Socket.io room per `session_id` (game session). Join requires a valid Supabase JWT, matching `kid_profiles.gender` to the session’s gender partition, and host/disconnect rules implemented in server code.

---

## Intent / event matrix (game server)

### Client → server (intents)

| Intent | Payload (conceptual) | Server behavior |
|--------|----------------------|-----------------|
| `JOIN_ROOM` | `sessionId` | Validate JWT, gender, capacity; join socket room |
| `LEAVE_ROOM` | `sessionId` | Remove socket; apply host transfer / pause rules |
| `INTENT_GAME` | game-specific (e.g. Tic-tac-toe cell index) | Validate with `packages/game-logic`; update memory; broadcast snapshot |
| `CHAT_MESSAGE` | `{ text }` | Relay; queue persist to `chat_messages` (per message or short batch) |

### Server → client

| Event | Purpose |
|-------|---------|
| `ROOM_SNAPSHOT` | Authoritative `gameState` + phase metadata |
| `ROOM_ERROR` | Structured `{ code, message }` for invalid intents |
| `PLAYER_PRESENCE` | Join/leave/host change (as needed) |
| `CHAT_MESSAGE` | Echo + origin for in-room chat |

**REST (Supabase / optional HTTP):** JSON bodies and standard HTTP status codes. **WS errors:** structured payload or documented `close` codes for auth failures; in-room errors use `ROOM_ERROR` events.

---

## Scaling

- **Phase 1:** Single Railway instance; single Socket.io process.
- **Later:** Sticky sessions; **Redis** adapter for Socket.io pub/sub across instances; same JWT verification at each node.

---

## Cross-origin and tokens

- **CORS:** Railway game server allows the Vercel web origin via `CORS_ORIGIN` (or list). Credentials as needed for cookies (if used); default SPA pattern uses Supabase session in memory/local storage.
- **Browser → Supabase:** Only the **anon** key in the client; **never** ship the service role to the browser.
- **Browser → game server:** Send the Supabase **`access_token`** (short-lived JWT) in the Socket.io `auth` payload (or `Authorization` for HTTP health/metrics).
- **Railway-only operations:** Service role or DB credentials stay server-side; document any exception in this file when added.

---

## Observability

- **Railway:** Structured logs (JSON-friendly messages), `GET /health` and `GET /ready` for deploy probes. HTTP requests use `morgan` combined logs; see `docs/HARDENING.md` for production logging and rate limits.
- **Supabase:** Use dashboard logs; optional log drains in production.

---

## RLS summary

- Default path: **authenticated Supabase client + RLS** for kid/teacher data.
- **Public profile** fields for other kids are exposed via a **view** or narrow `SELECT` policies—never expose synthetic emails in UI.
- **Same-gender social rules** and blocks: enforced in policies and/or narrow `SECURITY DEFINER` RPCs with fixed contracts (see migrations).
- **Admin:** Separate auth users and policies; no service key in the client.

---

## Session list for teachers

**Chosen approach:** **Supabase `game_sessions` rows** updated at **boundaries** (create, status change, complete) so teachers can list active matches without polling the game server. Live observation of a session may combine WS snapshots (game server) with persisted `chat_messages` for moderation.

---

## References

- Cursor rules: `.cursor/rules/playground-project.mdc`, `.cursor/rules/playground-architecture.mdc`
- Product inventory: `MIGRATION_EXPORT.md`
- Backend QA: `.cursor/skills/playground-backend-qa/SKILL.md`
