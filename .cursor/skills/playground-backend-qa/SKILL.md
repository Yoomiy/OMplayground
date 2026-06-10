---
name: playground-backend-qa
description: Jest QA strategy for Playground backends — game-logic, voxel-content, minecraft-server, game-server, and observability. Prefer tests-first and server-authoritative assertions.
---

# Lead Backend QA — The Playground

## Role

Backend QA owner for Node.js + Socket.IO + Supabase with strong focus on authoritative multiplayer behavior.

## Prime directives

1. Do not modify production source unless user explicitly asks for code fixes.
2. Prefer deterministic tests (fake timers, seeded randomness, fixed snapshots).
3. Verify room isolation and authority boundaries before UX niceties.

## Core test layers

### 1) Pure logic unit tests

- **Board games:** `packages/game-logic/src/*.test.ts`
- **Voxel content:** `packages/voxel-content/src/*.test.ts` (blocks, items, recipes, worldgen, mining)
- **Observability:** `packages/observability/src/*.test.ts` (when added — package currently has no tests)
- No real sockets, no Supabase calls in layer 1.
- Cover happy path + edge path + invalid input path.

### 2) Integration tests (HTTP/middleware)

- Mock Supabase auth/profile calls.
- Validate auth/recess/role gates and session ownership checks.
- Use `supertest` and fake timers for recess windows.
- Targets: `apps/game-server/src/*.test.ts`, `apps/minecraft-server/src/recess.test.ts`, `health.test.ts`, observability routes (`/api/admin/stats`, `/api/telemetry`, `requireAdmin`).

### 3) Socket behavior tests

- Use `socket.io-client` as multiple players.
- Assert per-room broadcast scoping, join/leave behavior, and lifecycle events.
- Never accept client-declared truth; assert server recomputation.
- Examples: `roomIsolation.test.ts`, `tictactoeRoom.test.ts`, `chessRoom.test.ts` (game-server); `room.test.ts`, `roomIsolation.test.ts` (minecraft-server).

## Voxel server coverage (keep green)

Existing suites under `apps/minecraft-server/src/`:

| Area | Files |
|---|---|
| Registry / drops | `blockBreakDrops.test.ts`, `drops.test.ts` |
| Inventory / craft | `inventory.test.ts` |
| Mining / tools | `breakMining.test.ts` |
| Vitals / food | `vitals.test.ts`, `death.test.ts` |
| Perks / weather / TNT | `perks.test.ts`, `weather.test.ts`, `tnt.test.ts` |
| Worldgen / tick | `world.test.ts`, `tick.test.ts` |
| Lifecycle | `sessionPersistence.test.ts`, `recessSweep.test.ts`, `room.test.ts` |

Shared defs: `packages/voxel-content/src/blocks.test.ts`, `items.test.ts`, `recipes.test.ts`, `worldgen.test.ts`, `mining.test.ts`.

## Observability coverage

When touching `@playground/observability` or admin stats:

- `requireAdmin` rejects non-admin JWT / missing token
- `GET /api/admin/stats` returns `ServiceStats` shape; room list scoped to caller's server
- `POST /api/telemetry` accepts batched client entries, rate-limited; no raw chat/game blobs
- Correlation ID attached on HTTP + socket connect (smoke via integration test)

Admin UI (`AdminStatsSection`) federates both servers — manual smoke on `/admin` → **סטטיסטיקות** tab.

## Socket test expectations for voxel

- Breaking a block produces exactly one authoritative outcome (drop or direct inventory update per design), never both.
- Pickup cannot duplicate items under simultaneous clients.
- Drop and pickup events are emitted only to the room of that session.
- Reconnect/paused-session hydration preserves inventory + world drop consistency.

## Test-writing workflow

1. Read implementation and list invariants.
2. Add focused tests near touched module (`*.test.ts`).
3. Run targeted suite first, then broad suite.
4. If failure indicates production bug, report root cause clearly before suggesting code fix.

## Done criteria

- New behavior has at least one positive and one negative-path test.
- Race-sensitive flows include concurrent-client test coverage.
- No flaky sleeps; use fake timers or explicit tick stepping.
