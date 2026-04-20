---
name: playground-add-game
description: Add a new game (or port a legacy old_project game) to The Playground without modifying the generic room/socket server. Covers the GameModule<State,Intent> contract in packages/game-logic, the dumb board component + BOARD_REGISTRY wiring in apps/web, the games-catalog SQL the user must run, and how the already-generic lifecycle (join, intent, stop, host disconnect, recess pause/resume) interacts with the new game. Use when the user asks to add, port, implement, wire up, or migrate a game (tictactoe, connectfour, memory, snakes, quiz, etc.), when touching packages/game-logic/src, or when registering a new gameKey.
---

# Adding a Game to The Playground

The game server is **already generic**. A new game is almost entirely pure logic + a dumb React board + one registry entry on each side + one row in the `games` catalog. You should rarely need to touch `apps/game-server/src/index.ts` or `room.ts`.

## The contract (read this first)

Every game implements `GameModule<State, Intent>` from `@playground/game-logic` (defined in [registry.ts](../../../packages/game-logic/src/registry.ts)):

```ts
export interface GameModule<State, Intent = unknown> {
  key: string;               // matches games.game_url in Supabase
  minPlayers: number;
  maxPlayers: number;
  initialState(players: GameSeat[]): State;   // seats come from server in join order
  applyIntent(state: State, playerId: string, intent: Intent):
    | { ok: true;  state: State; outcome?: GameOutcome }
    | { ok: false; error: { code: string; message: string } };
  isTerminal(state: State): boolean;
}
```

Hard rules:

- **`State` must be JSON-serializable.** It is broadcast in `ROOM_SNAPSHOT` and persisted into `game_sessions.game_state` at boundaries (game end, stop, recess pause). No class instances, no `Map`/`Set`, no `Date`.
- **`applyIntent` is pure.** No side effects, no Date.now, no Math.random with hidden state. If you need randomness, store the seed inside `State`.
- **Never trust the client.** Derive the caller's seat (symbol / color / team) from `state.seats[playerId]`, not from the intent. See [tictactoe.ts](../../../packages/game-logic/src/tictactoe.ts) for the canonical pattern.
- **Outcome is set only when terminal** and only on the winning transition (`{ kind: "won", winner }` or `{ kind: "draw" }`). The server uses it to fire `GAME_ENDED` + persist.
- **Intent shape is small and game-specific.** Example payloads sent over the wire: `{ cellIndex: 4 }`, `{ column: 3 }`, `{ cardId: "7H" }`. The client sends `{ sessionId, intent }`, the server passes `intent` straight into `applyIntent`.

## What the generic layer already does for you

Do not re-implement any of these:

| Concern | Where | Notes |
|---|---|---|
| `JOIN_ROOM` / seat assignment | [index.ts](../../../apps/game-server/src/index.ts) + [room.ts](../../../apps/game-server/src/room.ts) `assignPlayer` | While `room.players.size < minPlayers`, the server re-calls `module.initialState(seats)` on every join so seats repopulate. Once full, state is frozen. |
| `INTENT_GAME` dispatch | `index.ts` → `applyIntent(room, userId, payload.intent)` | Broadcasts `ROOM_SNAPSHOT`, fires `GAME_ENDED` + `persistGameEnded` when `outcome` returned. |
| `STOP_GAME` (host-only) | `canStopGame` in `room.ts`, `persistGameStopped` in `lifecycle.ts` | Nothing to do per game. |
| Host disconnect / transfer | `removePlayerFromRoom` | New host picked from remaining players; no per-game hook. |
| Recess end → pause snapshot | `recessSweep.ts` + `persistRecessPause` | Persists your `State` blob verbatim. |
| Stale-pause cleanup (24h) | `cleanupStalePausedSessions` in `lifecycle.ts` | |

Known gap: **resume from paused is not yet wired.** `getOrCreateRoom` always starts from `module.initialState([])`; the persisted `game_sessions.game_state` is not yet rehydrated on rejoin. If the user asks you to make a game resumable, flag this — it is a cross-cutting change in `room.ts`, not a per-game change.

## Files you will touch for every new game

1. `packages/game-logic/src/<gameKey>.ts` — pure rules + exported `<gameKey>Module`.
2. `packages/game-logic/src/index.ts` — one line in `registry`.
3. `packages/game-logic/src/<gameKey>.test.ts` — pure unit tests (see `playground-backend-qa` skill).
4. `apps/web/src/games/<GameKey>Board.tsx` — dumb React component: props = `{ gameState, mySymbol, onCellPress/onIntent }`, no sockets, no fetch.
5. `apps/web/src/game/GameSessionContainer.tsx` — one entry in `BOARD_REGISTRY`.
6. **Tell the user** the SQL to insert a `games` row. Do not run it for them.

Do not touch: `apps/game-server/src/index.ts`, `room.ts`, `lifecycle.ts`, `sessionPersistence.ts`, `recessSweep.ts`.

## Step-by-step workflow

### 1. Write the pure module

Template (mirror [tictactoe.ts](../../../packages/game-logic/src/tictactoe.ts)):

```ts
import type { GameModule, GameOutcome, GameSeat } from "./registry";

export interface MyGameState {
  /* public fields: what every player sees */
  seats?: Record<string, string /* seat label, e.g. "red" | "yellow" */>;
  status: "playing" | "won" | "draw";
  winner: string | null;
  /* ...game-specific data (board, turn, deck, ...)... */
}

export interface MyGameIntent {
  /* shape sent by the client, e.g. { column: number } */
}

function initialMyGameState(): Omit<MyGameState, "seats"> {
  return { status: "playing", winner: null /* ... */ };
}

export const myGameModule: GameModule<MyGameState, MyGameIntent> = {
  key: "mygame",
  minPlayers: 2,
  maxPlayers: 2,
  initialState(players: GameSeat[]) {
    const seats: Record<string, string> = {};
    players.forEach((p, i) => { seats[p.userId] = i === 0 ? "red" : "yellow"; });
    return { ...initialMyGameState(), seats };
  },
  applyIntent(state, playerId, intent) {
    const seat = state.seats?.[playerId];
    if (!seat) return { ok: false, error: { code: "NOT_IN_ROOM", message: "Player not in session" } };
    /* validate intent shape, turn order, legality — return ok:false on any violation */
    /* compute nextState; detect terminal */
    let outcome: GameOutcome | undefined;
    if (nextState.status === "won" && nextState.winner) outcome = { kind: "won", winner: nextState.winner };
    else if (nextState.status === "draw")               outcome = { kind: "draw" };
    return { ok: true, state: nextState, outcome };
  },
  isTerminal(state) { return state.status === "won" || state.status === "draw"; },
};
```

Error-code conventions already in use (reuse where applicable): `NOT_IN_ROOM`, `WRONG_PLAYER`, `GAME_OVER`, `BAD_INTENT`, plus one game-specific code per kind of violation (e.g. `CELL_TAKEN`, `COLUMN_FULL`).

### 2. Register in the logic package

In [packages/game-logic/src/index.ts](../../../packages/game-logic/src/index.ts):

```ts
export * from "./mygame";
import { myGameModule } from "./mygame";

const registry: Record<string, AnyGameModule> = {
  [tictactoeModule.key]: tictactoeModule as AnyGameModule,
  [myGameModule.key]:     myGameModule    as AnyGameModule,   // add
};
```

### 3. Write pure logic tests

Follow the `playground-backend-qa` skill: `it("transitions to won on …")`, `it("rejects out-of-turn move with WRONG_PLAYER")`, `it("rejects occupied cell / full column / invalid card")`, `it("returns draw on full board with no winner")`. Do not import from `apps/game-server`.

### 4. Build the dumb board component

`apps/web/src/games/<GameKey>Board.tsx`. Rules from `.cursor/rules/playground-architecture.mdc`:

- No `fetch`, no `supabase`, no `socket.io-client` inside the board.
- Props only: `gameState`, seat info (e.g. `mySeat: "red" | "yellow" | null`), and a single `onIntent`/`onCellPress` callback.
- Disable inputs whenever `gameState.status !== "playing"`, `mySeat == null`, or it is not my turn. See [TicTacToeBoard.tsx](../../../apps/web/src/games/TicTacToeBoard.tsx).
- Tailwind + shadcn only (no new UI libs).

### 5. Register the board in the container

In [apps/web/src/game/GameSessionContainer.tsx](../../../apps/web/src/game/GameSessionContainer.tsx), extend `BOARD_REGISTRY`:

```ts
const BOARD_REGISTRY: Record<string, BoardRegistryEntry> = {
  tictactoe: { component: /* existing */ },
  mygame: {
    component: ({ gameState, mySymbol, onIntent }) => (
      <MyGameBoard
        gameState={gameState as MyGameState}
        mySeat={mySymbol as "red" | "yellow" | null}
        onIntent={(i) => onIntent(i)}   // i is whatever MyGameIntent expects
      />
    ),
    fullscreen: false, // set true when the game should occupy the viewport
  },
};
```

`mySymbol` in the container is the generic "my seat value" — it is read from `gameState.seats[myUserId]`. Cast to your seat union.
For fullscreen games, set `fullscreen: true`. The container already applies fullscreen layout and keeps lifecycle UX (`RECESS_ENDED`, `GAME_STOPPED`, `HOST_LEFT`, stop button, end overlay) wired.

### 6. Catalog row (user runs the SQL)

Per the coding protocol, **do not run SQL**. Tell the user to execute, e.g.:

```sql
INSERT INTO public.games (
  id, name_he, description_he, type, game_url, min_players, max_players, is_active, for_gender
) VALUES (
  gen_random_uuid(), 'שם בעברית', 'תיאור קצר', 'custom', 'mygame', 2, 2, true, 'both'
)
ON CONFLICT (game_url) DO NOTHING;
```

`game_url` **must equal** `myGameModule.key`. `min_players` / `max_players` on the row override the module's defaults at `JOIN_ROOM` time.

## Complexity guide — simple vs complex games

The contract is the same; complexity lives inside `State` and `applyIntent`.

| Scenario | What to add |
|---|---|
| Turn-based, fully observable (tic-tac-toe, connect four, checkers) | Store `next: seatLabel`. Reject intents where `state.seats[playerId] !== state.next`. |
| Simultaneous intents (e.g. both players lock in a choice) | Store `pending: Record<seat, Intent>` in `State`; only resolve when all seats submitted. `applyIntent` either records the pending slot or resolves the round. |
| Hidden information (cards, roles) | Keep the full ground truth in `State` and, in the container/board, **redact** before rendering what the current user shouldn't see. The server currently broadcasts the full snapshot to all players — flag this if the user is adding hidden-info games; it requires a per-seat snapshot, which is a cross-cutting change to `index.ts`. |
| Real-time / tick-based (snakes, pong) | Avoid. Current broadcast is event-driven on `INTENT_GAME`. Ticks require a timer per room in `room.ts`. Flag and discuss with the user before implementing. |
| Quiz / question bank | Put the question set in `State` (drawn at `initialState` time, possibly from a seed). Keep the `correctAnswer` in `State` and redact on the client if needed, or don't send it until the round resolves. |
| Fullscreen game UI (canvas/action game, no board card) | Per-game logic is usually simpler than grid-board games. Set `fullscreen: true` in `BOARD_REGISTRY`; container chrome is adjusted automatically. |

If the user asks to port a game from `old_project/`, read the legacy file first to extract the rules, then rewrite them as a pure module here — **do not port the legacy UI wiring**, only the pure rules.

## Validation checklist before you hand back

- [ ] `<gameKey>` is lowercase, no spaces, matches `games.game_url`.
- [ ] `State` is JSON-round-trippable (no class instances, `Map`, `Set`, `Date`).
- [ ] `applyIntent` always returns an `error` with a `code` on every invalid-input path (turn order, legality, shape).
- [ ] Seat/symbol is read from `state.seats[playerId]`, never from the intent.
- [ ] `outcome` is set on the terminal transition and **not** on subsequent calls (`isTerminal` returns true afterwards so no more intents get through, but guard explicitly too).
- [ ] Module registered in `packages/game-logic/src/index.ts`.
- [ ] Board registered in `BOARD_REGISTRY` in `GameSessionContainer.tsx`.
- [ ] Pure unit tests added (`<gameKey>.test.ts`) covering: valid win, draw/no-winner, invalid-shape intent, wrong-player, post-terminal rejection.
- [ ] No changes to `apps/game-server/src/index.ts`, `room.ts`, `lifecycle.ts`, `sessionPersistence.ts`, or `recessSweep.ts` (unless the user explicitly asked for a cross-cutting change like resume, per-seat snapshots, or ticks).
- [ ] Told the user the exact SQL to insert into `public.games`. Did not run it.

## What to flag to the user (per coding protocol)

Always tell the user clearly when any of these apply:

- They must run the `INSERT INTO public.games ...` SQL in Supabase.
- The game requires **resume from paused** (currently not wired — server starts fresh on rejoin).
- The game has **hidden information** (current server broadcasts full state to all seats).
- The game needs a **server tick** loop (current server is event-driven only).
- `minPlayers` / `maxPlayers` differ from the module defaults and need to match the `games` row.
