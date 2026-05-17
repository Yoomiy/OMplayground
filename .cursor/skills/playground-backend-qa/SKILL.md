---
name: playground-backend-qa
description: Jest QA strategy for Playground backends, including the voxel server roadmap (data-driven registries, drops/pickup, tools/durability, and biome-aware worldgen). Prefer tests-first and server-authoritative assertions.
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

- Target pure modules (inventory helpers, recipe matching, drop physics helpers, worldgen functions).
- No real sockets, no Supabase calls.
- Cover happy path + edge path + invalid input path.

### 2) Integration tests (HTTP/middleware)

- Mock Supabase auth/profile calls.
- Validate auth/recess/role gates and session ownership checks.
- Use `supertest` and fake timers for recess windows.

### 3) Socket behavior tests

- Use `socket.io-client` as multiple players.
- Assert per-room broadcast scoping, join/leave behavior, and lifecycle events.
- Never accept client-declared truth; assert server recomputation.

## Voxel server roadmap coverage (must-have suites)

For `apps/minecraft-server`, keep these suites current as phases land:

1. **Registry parity suite**  
   Shared block/item definitions load and map to runtime ids/metadata consistently.

2. **Inventory suite** (`inventory.ts`)  
   add/merge/split stacks, max stack boundaries, block-item vs plain item behavior.

3. **Drop/pickup suite**  
   drop spawn, gravity/tick updates, pickup merge order, full inventory rejection, despawn timing.

4. **Mining/tools suite**  
   break denied without required tool, break time scaling by hardness/tier, durability decrement/break removal.

5. **Crafting suite**  
   recipe validation, exact input consumption, output insertion, failure rollback.

6. **Worldgen suite** (`world.ts`)  
   biome-dependent surface/tree generation and deterministic seeded output checks.

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
