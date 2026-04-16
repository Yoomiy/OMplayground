# Reference — Playground backend QA

## Layer 1 checklist (unit, `src/games/`)

- [ ] Happy path for one full match
- [ ] Illegal moves rejected with stable error shape (if applicable)
- [ ] Wrong player / out-of-turn rejected
- [ ] Win rows, columns, diagonals (grid games)
- [ ] Draw / tie when board full
- [ ] No imports of `socket.io`, Supabase, or HTTP in pure logic files

## Layer 2 checklist (integration)

- [ ] `jest.mock('@supabase/supabase-js')` (or project wrapper) — assert calls, not real network
- [ ] supertest: `401` / `403` / `200` paths for auth and recess
- [ ] Fake timers: document assumed timezone (e.g. `Asia/Jerusalem`) if middleware uses `Date` or a clock abstraction

## Layer 3 checklist (sockets)

- [ ] Two clients join same room; third with wrong gender rejected (if rule exists)
- [ ] Host disconnect: state matches spec (paused / transfer / end)
- [ ] Event only received by sockets in the same room
- [ ] Clean disconnect and reconnect if the server supports it

## Naming examples

```text
describe('recessMiddleware')
  it('allows kid login when current time is inside an active schedule window')
  it('rejects kid login outside schedule windows')

describe('TicTacToe rules')
  it('declares winner on diagonal 0-4-8')
  it('returns draw when board is full and there is no winner')
```
