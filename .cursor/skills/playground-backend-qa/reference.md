# Reference — Playground backend QA

## Layer 1 checklist (pure logic)

**Board games** — `packages/game-logic/src/`:

- [ ] Happy path for one full match
- [ ] Illegal moves rejected with stable error shape (if applicable)
- [ ] Wrong player / out-of-turn rejected
- [ ] Win rows, columns, diagonals (grid games)
- [ ] Draw / tie when board full
- [ ] No imports of `socket.io`, Supabase, or HTTP in pure logic files

**Voxel content** — `packages/voxel-content/src/`:

- [ ] Block/item id parity with server imports
- [ ] Recipe match + shaped/shapeless grid rules
- [ ] Worldgen deterministic for fixed seed + coordinate
- [ ] Mining hardness / tool tier helpers

**Observability** — `packages/observability/src/` (add as suite lands):

- [ ] `requireAdmin` 401/403 paths
- [ ] Stats collector increments / rolling windows
- [ ] Telemetry ingest sanitization (no oversized payloads)

## Layer 2 checklist (integration)

- [ ] `jest.mock('@supabase/supabase-js')` (or project wrapper) — assert calls, not real network
- [ ] supertest: `401` / `403` / `200` paths for auth, recess, and `/api/admin/stats`
- [ ] Fake timers: document assumed timezone (e.g. `Asia/Jerusalem`) if middleware uses `Date` or a clock abstraction

## Layer 3 checklist (sockets)

- [ ] Two clients join same room; third with wrong gender rejected (if rule exists)
- [ ] Host disconnect: state matches spec (paused / transfer / end)
- [ ] Event only received by sockets in the same room
- [ ] Clean disconnect and reconnect if the server supports it

## Voxel module pointers (minecraft-server)

| Module | Test file | Focus |
|---|---|---|
| `breakMining.ts` | `breakMining.test.ts` | tool gating, break timing, durability |
| `drops.ts` | `drops.test.ts` | spawn, pickup, despawn, room scope |
| `inventory.ts` | `inventory.test.ts` | stacks, craft grid, moves |
| `vitals.ts` | `vitals.test.ts` | food, health (simplified hunger) |
| `perks.ts` | `perks.test.ts` | equipment perk effects |
| `weather.ts` | `weather.test.ts` | precipitation sync |
| `world.ts` | `world.test.ts` | biome columns, block ids |
| `tick.ts` | `tick.test.ts` | coalesced emits, vitals tick order |

## Naming examples

```text
describe('recessMiddleware')
  it('allows kid login when current time is inside an active schedule window')
  it('rejects kid login outside schedule windows')

describe('TicTacToe rules')
  it('declares winner on diagonal 0-4-8')
  it('returns draw when board is full and there is no winner')

describe('requireAdmin')
  it('returns 401 when Authorization header is missing')
  it('returns 403 when JWT is valid but user is not in admin_profiles')
```
