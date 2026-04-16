---
name: Playground rebuild — implementation plan (aligned with `.cursor/rules`)
overview: ""
todos: []
isProject: false
---

---
todos:
  - id: "spec-appendix"
    content: "ARCHITECTURE.md: diagram, Supabase vs Railway split, intents, RLS, event matrix, CORS/token notes"
    status: pending
  - id: "repo-layout"
    content: "Monorepo: apps/web (Vercel), apps/game-server (Railway), packages/game-logic (pure rules; shared by server + Jest)"
    status: pending
  - id: "ws-stack-decision"
    content: "Decision record: Colyseus vs Socket.io before Phase 3 — document choice and room model"
    status: pending
  - id: "phase1-supabase-auth"
    content: "Supabase schema + RLS; synthetic email auth; recess (Asia/Jerusalem); minimal login UI on Vercel for E2E smoke"
    status: pending
  - id: "phase2-social"
    content: "Social: friends, presence, messaging, challenges (pending_challenge + Realtime); UI under RLS; no DB polling for live UX"
    status: pending
  - id: "phase3-game-server"
    content: "Railway: rooms, lifecycle, authoritative intents; in-game chat relay + persist; gender/host-disconnect rules"
    status: pending
  - id: "phase4-frontend-games"
    content: "Vercel: port remaining pages; dumb games + containers; teacher/admin UIs per milestones doc"
    status: pending
  - id: "data-migration"
    content: "Staging dry-run import after schema stable; prod cutover; merge PublicKidProfile; password strategy"
    status: pending
  - id: "hardening"
    content: "Rate limits, logs/metrics, Railway health, load tests, optional Redis for multi-instance WS"
    status: pending
  - id: "backend-qa-tests"
    content: "Jest layers per playground-backend-qa; packages/game-logic unit tests; tests-only unless user approves prod fix"
    status: pending
isProject: false
---
# Playground rebuild — implementation plan (aligned with `.cursor/rules`)

This plan follows **`.cursor/rules/playground-project.mdc`** and **`playground-architecture.mdc`**. [`MIGRATION_EXPORT.md`](MIGRATION_EXPORT.md) and [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) remain behavioral references; where they describe client-driven `PATCH` game state or DB-as-realtime, **the rules override** for the new system.

---

## Ground rules (from Cursor rules)

| Rule | Plan implication |
|------|------------------|
| **Stack** | Frontend: React 18, Vite, Tailwind, shadcn/ui (TypeScript preferred for new code). Data: **Supabase** (Postgres + Auth + **RLS**). Realtime gameplay: **Node on Railway** (**Colyseus** or **Socket.io** — **decision checkpoint** before Phase 3). Deploy: **Vercel** (web), **Railway** (game server). |
| **UI vs network** | Pages/components do not embed raw fetch/WS; use hooks/modules. **Game components** take `gameState` + `onMove` / `onIntent`; **parent containers** own WebSocket connection and mapping. |
| **Authoritative server** | Clients send **intents** only; server validates, updates memory state, **broadcasts** snapshots. No trusting arbitrary client `game_state` blobs for multiplayer. |
| **Supabase Auth** | Kid/teacher usernames map to `[username]@playground.school.local` **only** for Auth API; **never** show this email in UI — display names from profile tables. |
| **RLS first** | Scope data with policies; avoid re-implementing the same filters only in app code when RLS can enforce. Document minimal service-role / Railway-only exceptions. |
| **Anti-patterns** | No `setInterval`+fetch for **live game state**. No **per-tick** Postgres writes during active multiplayer — persist at **boundaries** (paused, completed, disconnect policy). No new UI libs beyond Tailwind + shadcn without explicit approval. |

---

## Repository layout (monorepo)

- **`apps/web`** — Vite React app (Vercel). Routes, UI, Supabase client (browser), connection to Railway WS for games.
- **`apps/game-server`** — Authoritative Node server (Railway): rooms, intents, broadcasts, optional chat relay.
- **`packages/game-logic`** — **Pure** game rules (`State + Action → New State`): no I/O. Imported by **`apps/game-server`** and **Jest** tests (single source of truth; no duplicated Tic-tac-toe rules).

Adjust names if the repo uses `src/games/` inside the game server only — still **extract** pure logic into a shared package when the same code is tested in isolation.

**Todo:** `repo-layout`.

---

## Context documents

| Document | Role |
|----------|------|
| [`instructions.md`](instructions.md) | Spec principles: three-tier architecture, no DB-as-realtime for gameplay. |
| [`MIGRATION_EXPORT.md`](MIGRATION_EXPORT.md) | Domain model, routes, game catalog, component inventory — **adapt** REST/WS details to Supabase + authoritative server. |
| [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) | Legacy edge cases (auto-accept friends, blocks, teacher flows). |

---

## Spec appendix (parallel to early implementation)

Add **`ARCHITECTURE.md`** (or a major section in the repo README) covering:

- **Diagram (text):** Browser (Vercel) ↔ Supabase (Auth, Postgres, Realtime for social) ↔ Railway game server (rooms, WS).
- **Data split:** What lives in **Supabase** (profiles, schedules, private messages, moderation, catalog, **persisted** chat rows, session metadata at boundaries) vs **in-memory on Railway** (active match state, tick-level state).
- **Intent/event matrix:** client→server (e.g. join room, leave, `INTENT_MOVE`) vs server→client (snapshots, phase errors).
- **Errors:** JSON body + HTTP status for REST; structured errors or close codes for WS.
- **Scaling:** single Railway instance first; later sticky sessions + **Redis** pub/sub for multi-instance Socket.io/Colyseus.
- **Cross-origin / tokens:** Document **CORS** between Vercel origin and Railway; how the browser obtains a **short-lived token** (or session) accepted by the game server handshake; avoid exposing service-role keys in the client.
- **Observability:** Structured logging on Railway, health/readiness endpoints for deploys.

**Todo:** `spec-appendix`.

---

## Vertical slices (UI timing)

Phases are **backend-ordered**, but **do not defer all UI to Phase 4.**

| When | UI slice |
|------|-----------|
| **End of Phase 1** | **Minimal Vercel shell:** login, logout, recess-denied message, basic “session OK” — enough to manually or E2E-test Auth + recess without scripts only. |
| **Phase 2** | Friends list, inbox, profile pieces as features land — still **no** full game server required for social. |
| **Phase 3+** | Game play pages + containers; teacher watch once sessions exist. |

Phase 4 in this document means **completing** porting and parity (all routes, games, admin polish), not “first time any React exists.”

---

## Phase 1 — Database and Auth (strict)

- **Supabase project:** migrations for tables aligned with [`MIGRATION_EXPORT.md`](MIGRATION_EXPORT.md) §1 (`kid_accounts`, `games`, `game_sessions` metadata if persisted, `chat_messages`, `private_messages`, `moderation_reports`, `recess_schedules`, `avatar_presets`, admin linkage as designed). Drop legacy `PublicKidProfile` — public fields via **views** or filtered selects under RLS.
- **RLS:** policies per role (kid / teacher / admin). Same-gender social rules: prefer policies; if SQL becomes unmaintainable, use documented **`SECURITY DEFINER` RPCs** with narrow contracts (still “database-enforced,” not ad-hoc filtering only in the client).
- **Auth:** Supabase Auth for kids/teachers with synthetic email **`[username]@playground.school.local`**; profile row linked to `auth.users.id`.
- **Recess:** enforce using **`Asia/Jerusalem`** vs `recess_schedules`; teachers exempt. Validate **day-of-week** convention once (e.g. Sunday = 0 vs Luxon weekday).
- **Admin:** document pattern (e.g. dedicated Auth users + RLS, or server-only admin API with service role — **never** ship service key to the browser).

**Deliverable:** Schema + RLS + login/logout + recess denial + **`auth.me` equivalent** + **minimal login UI** on Vercel (vertical slice).

---

## Phase 2 — Social layer

- **Friends, blocks, requests** — per [`MIGRATION_EXPORT.md`](MIGRATION_EXPORT.md) §2.3; Supabase client + **RLS**; **Realtime** / **Presence** for online status (**not** DB polling for “who’s online”).
- **Private messaging** — under RLS; Realtime for new messages; unread counts via count query or transactional counters.
- **Challenges (`pending_challenge`):** store on `kid_accounts` (or equivalent); deliver updates via **Supabase Realtime** on that row/channel so the target sees a popup **without** the game server. Accept/decline may **reference** a `game_session` id created in Phase 3 — coordinate so session IDs exist when challenges are accepted (ordering: create session → attach challenge, or lazy join on accept).
- **UI:** port playground components from [`old_project`](old_project); presentational components stay free of raw fetch/WS.

**Deliverable:** Kid can friends / online / inbox / challenge flow **without** needing the Railway game server for notifications (game play still Phase 3).

---

## Phase 3 — Game server (Railway)

### Decision checkpoint (before coding)

- **Colyseus** — batteries-included rooms/state; faster for standard room sync; learning curve and opinions.
- **Socket.io** — lighter, more manual room/broadcast logic; familiar patterns.

Record the choice in-repo (ADR or `ARCHITECTURE.md`). **Todo:** `ws-stack-decision`.

### Runtime behavior

- **Rooms:** matchmaking hooks, lifecycle **`waiting → playing → completed`**, host transfer, reconnect policy.
- **Authoritative state:** canonical `gameState` in memory; clients send **intents** only; server validates using **`packages/game-logic`**, broadcasts snapshots.
- **Persistence at boundaries:** write `game_sessions` / outcomes to Supabase on **pause**, **complete**, **disconnect policy** — not per animation tick.

### In-game chat (hybrid)

- **Live path:** messages relayed through the **game server** WS for low latency and room scoping.
- **Persistence:** append to **`chat_messages`** in Supabase (per message or short batch), so history and **teacher moderation** read from the DB. Teacher delete/clear operations remain defined in product docs (soft delete / system notice).

### Alignment with export

[`MIGRATION_EXPORT.md`](MIGRATION_EXPORT.md) §7.1-style events map to server broadcasts. Listing/joining may use Supabase or thin HTTP; **live play** is not DB-polled state patches.

**Deliverable:** Two test clients play one ported game end-to-end with **server-validated** moves; chat persisted and moderatable.

---

## Teacher and admin milestones

| Area | Depends on | Notes |
|------|------------|--------|
| **Admin — games, kids, schedules, presets, reports** | Phase 1–2 + schema | Mostly **Supabase + RLS** + `apps/web` admin routes; can reach **usable MVP** before full game porting. |
| **Teacher — list active sessions** | Phase 3 metadata | Session list: read **Supabase** rows updated at **boundaries** and/or lightweight “lobby” API from game server — **pick one** in `ARCHITECTURE.md` and stay consistent. |
| **Teacher — watch / moderate chat** | Phase 3 + chat persistence | Observation UI reads **game state** from WS or snapshot API; chat moderation reads/writes **persisted** `chat_messages` per product rules. |

Do not block **admin CRUD** on completion of Phase 4 game porting unless a feature truly requires live gameplay.

---

## Phase 4 — Frontend and game porting (completion)

- **Vercel** SPA; routes per [`MIGRATION_EXPORT.md`](MIGRATION_EXPORT.md) §6.
- **Port order:** complete shell (Layout, heartbeat, recess timer) → KidHome flow → inbox/profile → **`GameRenderer`** games one-by-one → **Teacher** watch → **Admin** polish if not already done.
- **Games:** dumb components + **container** per game; Railway WS + `packages/game-logic` on server.
- **Embedded games:** iframe; no extra UI libraries.
- **Uploads:** Supabase Storage + client compression as in legacy.

**Deliverable:** Feature parity with legacy for kid / teacher / admin **per agreed scope**.

---

## Testing and QA (cross-cutting)

Follow **[`.cursor/skills/playground-backend-qa/SKILL.md`](.cursor/skills/playground-backend-qa/SKILL.md)** and [reference.md](.cursor/skills/playground-backend-qa/reference.md).

| Layer | Scope | Tools |
|-------|--------|--------|
| **1 — Unit** | **`packages/game-logic`** (pure): `State + Action → New State` | Jest; no I/O |
| **2 — Integration** | HTTP middleware (recess, auth), Supabase mocks | Jest, **supertest**, `jest.mock`, **fake timers** |
| **3 — Sockets** | Rooms, gender, host drop, room-scoped emits | Jest + **socket.io-client** (or stack client) |

**Policy:** Tests and test utilities only; production edits only when explicitly fixing a failing test.

**When:** Layer 1 as soon as `packages/game-logic` exists; Layer 2 with HTTP surface; Layer 3 with game server.

**Todo:** `backend-qa-tests`.

---

## Data migration and cutover

- After **Phase 1 schema is stable**, run a **staging dry-run import** from legacy SQL: validate FKs, RLS behavior, and synthetic Auth user creation.
- Merge **`PublicKidProfile`** into kid profile rows; preserve stable IDs where possible.
- Passwords: **re-hash** or forced reset for legacy plaintext.
- Production cutover: rehearsed window; rollback plan (snapshot/backup).

**Todo:** `data-migration`.

---

## Hardening

- **Rate limits** — Auth, messaging, reports.
- **Audit logs** — Optional for teacher/admin destructive actions (chat clear, kid ban).
- **Load / soak** — Railway WS + Supabase Realtime; **Redis** only when horizontally scaling WS.
- **Health** — Railway HTTP health checks; log aggregation for incidents.

**Todo:** `hardening`.

---

## Deprecated assumptions (old plan draft)

The following are **not** the target architecture:

- Generic “REST-only first” with client `PATCH` of `game_state` as the primary multiplayer sync.
- WebSocket emits **only** after every DB write for game ticks.
- Postgres as the live multiplayer bus.
- Waiting until Phase 4 for **any** UI — Phase 1 must ship a **minimal** login vertical slice.

---

## Key references

- **Rules:** [`playground-project.mdc`](.cursor/rules/playground-project.mdc), [`playground-architecture.mdc`](.cursor/rules/playground-architecture.mdc)
- **Backend QA skill:** [`playground-backend-qa/SKILL.md`](.cursor/skills/playground-backend-qa/SKILL.md)
- **Product/API inventory:** [`MIGRATION_EXPORT.md`](MIGRATION_EXPORT.md)
- **Legacy behavior:** [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md), [`old_project/`](old_project/)