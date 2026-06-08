# Technical Proposal: Adoption of Breakout Game into OMplayground App

This document outlines the architectural proposal, implementation steps, and code changes required to adopt the external Breakout game (`sourceCode/breakout`) into our main web application (`apps/web`).

Following the structure of other games in our system (which support both single-player and multiplayer modes), we outline a two-phased adoption roadmap.

> **Status:** Phase 1 (Solo/Sandbox) is **implemented** — `BreakoutSolo` is registered under the solo key `breakout` in `SoloGameContainer.tsx`, with the legacy sandbox copied to `apps/web/public/legacy/breakout/`. Section 3 is kept for reference. The active work is **Phase 2** (Section 4).

---

## 1. Executive Summary
The external Breakout game in [sourceCode/breakout](file:///home/yosi/OMplayground/sourceCode/breakout) is a JavaScript/PixiJS-based arcade game that supports multiplayer controls using a third-party API called CouchFriends. Because the CouchFriends API relies on external web-sockets and mobile controllers, we will implement a phased rollout:
* **Phase 1: Solo/Sandbox Play** *(implemented)*: Packages Breakout as an iframe-embedded solo game using custom keyboard/mouse adapter code. Saves state/progress directly to Supabase.
* **Phase 2: Deterministic-Lockstep Multiplayer**: Both clients run the **same** Breakout physics simulation; we relay only small **input intents** (paddle direction / shoot) between peers over the existing `LIVE_DELTA` relay channel. No server-side physics and **no changes to the game server**.

---

## 2. Source Code & Dependencies Analysis

The source code for Breakout is structured as a client-side PixiJS application:
* **Entry Point**: [index.html](file:///home/yosi/OMplayground/sourceCode/breakout/src/index.html) loads the scripts, stylesheets, and initializes the game.
* **Core Game Loop & Controller Broker**: [game.js](file:///home/yosi/OMplayground/sourceCode/breakout/src/game.js) handles sound effects loading, PixiJS WebGL deferred rendering initialization, and CouchFriends listener events.
* **Game Coordinator**: [BreakOut.js](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js) contains the [BreakOut](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js#L25) namespace, state variables (levels, scores, current level), initialization function [BreakOut.init](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js#L171), [BreakOut.loadLevel](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js#L330), and player addition/removal methods [BreakOut.addPlayer](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js#L453) and [BreakOut.removePlayer](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js#L501).
* **Game Elements**: Detailed entities like [BreakOut.Ball.js](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.Ball.js), [BreakOut.Paddle.js](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.Paddle.js), [BreakOut.Brick.js](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.Brick.js) define game physics, rendering, and collision handling.
* **External Libs**: Includes `pixi.js` (rendering), `pixi.lights.js` (deferred lighting effects), `howler.js` (audio), `randomcolor.js`, and `lib.js` (ajax utils).

### Technical Challenges:
1. **CouchFriends API Dependency**: The game has a hard dependency on `https://couchfriends.com/src/api/build/couchfriends.api-latest.js` for mobile-device controls. In our sandboxed classroom/home environments, we must eliminate this network dependency and provide standard keyboard/mouse/gamepad controls.
2. **Asset Directories**: The game loads assets (sounds, textures, levels) from a relative `assets/` directory. When hosted in Vite, these assets must reside in public directories.
3. **Save State Sync**: We need to capture game boundaries (level completion, score milestones) and pass them to the React client wrapper to persist scores in Supabase.

---

## 3. Phase 1: Solo/Sandbox Play (iframe integration)
Following the pattern utilized for **HexGL** (in [HexGLSolo.tsx](file:///home/yosi/OMplayground/apps/web/src/games-solo/HexGLSolo.tsx)) and **Alges Escapade** (in [AlgesEscapadeSolo.tsx](file:///home/yosi/OMplayground/apps/web/src/games-solo/AlgesEscapadeSolo.tsx)), we wrap the original HTML/JS game inside an `iframe` and stub CouchFriends.

### Step 1: Migrate Files to Public
Copy game assets and source files into a legacy sandbox directory inside the React client asset folder:
* **Target Directory**: `apps/web/public/legacy/breakout/`
* Move all JavaScript files in `sourceCode/breakout/src/` to `apps/web/public/legacy/breakout/`
* Move the entire `sourceCode/breakout/src/assets/` directory to `apps/web/public/legacy/breakout/assets/`
* Move level JSON specifications (e.g. `level000.json`, etc.) from `sourceCode/breakout/build/assets/` to `apps/web/public/legacy/breakout/assets/`

### Step 2: CouchFriends API Removal & Keyboard/Mouse Controls Adapter
To convert the game into a standalone solo experience, we create a stub for `COUCHFRIENDS` and adapt the control listeners directly in the migrated copy of `game.js`:

```javascript
// Stub CouchFriends API to prevent reference errors
window.COUCHFRIENDS = {
    connect: function() { console.log("CouchFriends stubbed connection"); },
    on: function(event, callback) { /* no-op or internal routing */ },
    send: function(data) { /* no-op */ }
};

// Modify game.js initialization
function init() {
    // ... PixiJS Initialization ...
    
    // Always initialize a keyboard/mouse controlled paddle as the default player
    tmpPlayer = new BreakOut.Paddle();
    tmpPlayer.init();
    tmpPlayer.add();
    tmpPlayer.object.position.x = BreakOut.settings.width / 2;
    tmpPlayer.object.position.y = BreakOut.settings.height - 150;
    tmpPlayer.team = 'A';
    
    // Add default ball attached to the paddle
    var ball = new BreakOut.Ball();
    ball.init();
    ball.object.position.x = tmpPlayer.object.position.x;
    ball.object.position.y = tmpPlayer.object.position.y - 22;
    ball.add();
    ball.attachtTo = tmpPlayer;
    ball.attachtToPos = { x: 0, y: -22 };
    tmpPlayer.ball = ball;
    tmpPlayer.attachedBalls.push(ball);

    // Keyboard support: Left/Right arrow keys or A/D
    var activeKeys = {};
    window.addEventListener('keydown', function(e) {
        activeKeys[e.key] = true;
    });
    window.addEventListener('keyup', function(e) {
        activeKeys[e.key] = false;
    });

    // Handle frame tick inputs for keyboard movement
    function handleInputs() {
        var speed = 8;
        if (activeKeys['ArrowLeft'] || activeKeys['a'] || activeKeys['A']) {
            tmpPlayer.object.position.x = Math.max(50, tmpPlayer.object.position.x - speed);
        }
        if (activeKeys['ArrowRight'] || activeKeys['d'] || activeKeys['D']) {
            tmpPlayer.object.position.x = Math.min(BreakOut.settings.width - 50, tmpPlayer.object.position.x + speed);
        }
        if (activeKeys[' '] || activeKeys['ArrowUp'] || activeKeys['w'] || activeKeys['W']) {
            tmpPlayer.shoot();
        }
    }
    
    // Wrap update loop to process keyboard inputs
    var originalUpdate = update;
    update = function(time) {
        handleInputs();
        originalUpdate(time);
    };
}
```

### Step 3: Implement PostMessage Protocol for State Sync
In the sandbox `index.html` or inside the level transitions within `BreakOut.js`, dispatch events to the parent window to persist high scores and current levels.

For level transitions in [BreakOut.js](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js):
```javascript
// On level transition:
window.parent.postMessage({
    source: "playground-legacy-game",
    gameKey: "breakout",
    type: "checkpoint",
    state: { currentLevel: BreakOut.currentLevel }
}, window.location.origin);

// On game over / high-score milestone:
window.parent.postMessage({
    source: "playground-legacy-game",
    gameKey: "breakout",
    type: "scoreUpdate",
    state: { score: BreakOut.score.A }
}, window.location.origin);
```

### Step 4: Create the React Container Wrapper
Create a new wrapper component `apps/web/src/games-solo/BreakoutSolo.tsx` that embeds the iframe and listens to postMessage events:

```typescript
import { useEffect, useRef, useState } from "react";
import type { SoloGameSaveControls } from "@/lib/soloGameSaves";

export function BreakoutSolo({ save }: { save: SoloGameSaveControls }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!sectionRef.current) return;
    if (!document.fullscreenElement) {
      sectionRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement && document.fullscreenElement === sectionRef.current
      );
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        gameKey?: string;
        type?: string;
        state?: { currentLevel?: number; score?: number };
      };

      if (data?.source !== "playground-legacy-game" || data.gameKey !== "breakout") {
        return;
      }

      if (data.type === "checkpoint" && typeof data.state?.currentLevel === "number") {
        void save.saveState({ currentLevel: data.state.currentLevel }, { saveKind: "checkpoint" });
      }

      if (data.type === "scoreUpdate" && typeof data.state?.score === "number") {
        const scoreKey = "breakout:highScore";
        void save.mergeBestScores({ [scoreKey]: data.state.score }, [scoreKey]);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [save]);

  return (
    <section
      ref={sectionRef}
      className={`mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-rose-100 bg-white/95 p-4 shadow-play transition-all duration-300 ${
        isFullscreen ? "h-screen w-screen !max-w-none flex flex-col justify-between gap-4 !rounded-none bg-slate-950 border-none p-6 overflow-hidden" : ""
      }`}
      dir="ltr"
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 ${isFullscreen ? "border-slate-800" : "border-slate-100"}`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={`text-lg font-bold ${isFullscreen ? "text-white" : "text-slate-900"}`}>שבירת לבנים (Breakout)</h2>
          <p className={`text-sm font-medium ${isFullscreen ? "text-slate-400" : "text-slate-600"}`}>
            משחק שבירת לבנים קלאסי. השתמשו במקשי החצים או בעכבר כדי לנוע, ובמקש הרווח כדי לירות.
          </p>
        </div>
        <button
          type="button"
          className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 shadow-sm flex items-center gap-1.5 ${
            isFullscreen ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          }`}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <span>מצב רגיל</span> : <span>מסך מלא</span>}
        </button>
      </div>

      <div className={`relative mx-auto w-full overflow-hidden rounded-3xl border bg-black shadow-play ${
        isFullscreen ? "flex-grow min-h-0 border-slate-800" : "h-[640px] max-w-[1024px] border-slate-200"
      }`}>
        <iframe
          title="Breakout"
          src="/legacy/breakout/index.html"
          className="h-full w-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>
    </section>
  );
}
```

### Step 5: Register the Game in Container
Import the component and register `breakout` in [SOLO_REGISTRY](file:///home/yosi/OMplayground/apps/web/src/game/SoloGameContainer.tsx#L33) within `apps/web/src/game/SoloGameContainer.tsx`:
```typescript
import { BreakoutSolo } from "@/games-solo/BreakoutSolo";

// Under SOLO_REGISTRY:
const SOLO_REGISTRY: Record<string, (save: SoloGameSaveControls) => ReactNode> = {
  // ... existing entries ...
  breakout: (save) => <BreakoutSolo save={save} />,
};
```

---

## 4. Phase 2: Deterministic-Lockstep Multiplayer

### 4.0 Approach & accepted trade-off
Both clients run the **identical** PixiJS Breakout simulation (the Phase-1 sandbox, reused). Each player owns one paddle and broadcasts only **input intents** (direction change / shoot) to the peer. Because the simulation is deterministic and both ends apply the same inputs at the same simulation tick, the two screens stay in sync **without** sending coordinate snapshots and **without** server-side physics.

> **Authority trade-off (explicitly accepted for this game):** This model is **not** server-authoritative — it deviates from the platform's "never trust the client" rule. There is no anti-cheat and no authoritative correction; a malicious/modified client could desync. This is acceptable for a casual co-op arcade game between two kids. Do **not** copy this pattern for competitive/ranked games.

Why this is significantly cheaper than the earlier host-broadcast draft:
- **No server changes.** Inputs ride the existing `LIVE_DELTA` relay (see 4.1). We do not touch `apps/game-server/src/**`.
- **No headless physics port.** We reuse the Phase-1 sandbox physics verbatim on both clients.
- **Tiny payloads.** Only `{tick, dir, shoot}` per input change (not per frame), instead of 30 FPS coordinate dumps.

### Architecture
```
┌──────────────────────────┐                         ┌──────────────────────────┐
│  Player A (seat "A")      │                         │  Player B (seat "B")      │
│  Runs FULL physics sim    │   input intents only    │  Runs FULL physics sim    │
│  Owns paddle A            │  {tick,dir,shoot}        │  Owns paddle B            │
│  Applies A locally + B    │ ───────────────────────▶│  Applies B locally + A    │
│  from relay               │◀─────────────────────── │  from relay               │
└──────────┬────────▲───────┘                         └──────────┬────────▲───────┘
           │        │                                            │        │
           ▼        │            LIVE_DELTA passthrough          ▼        │
┌──────────────────────────────────────────────────────────────────────────────┐
│   apps/game-server (UNCHANGED) — relays LIVE_DELTA to the other seat only      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Transport: reuse the existing `LIVE_DELTA` relay (no server edits)
The game server already exposes a pure peer-relay used today by the live-drawing board:

```411:428:apps/game-server/src/index.ts
  socket.on(
    "LIVE_DELTA",
    (payload: { sessionId?: string; delta?: unknown }) => {
      const sessionId = payload?.sessionId;
      const delta = payload?.delta;
      if (!sessionId || delta === undefined) return;
      const room = getRoom(sessionId);
      if (!room || !room.players.has(userId)) return; // seated only
      ...
      socket.to(`session:${room.sessionId}`).emit("LIVE_DELTA", {
        from: userId,
        delta
      });
    }
  );
```

It is seated-only, has a 1 MB cap, broadcasts to the rest of the room (sender excluded), tags the payload with `from: userId`, and does **no** validation or persistence — exactly an input bus. It is already surfaced to boards via `BoardProps` as `onLiveDelta(delta)` / `subscribeLiveDeltas(cb)` in `GameSessionContainer.tsx`. We send/receive input intents through these and **add nothing to the server**.

Input-intent shape sent over `LIVE_DELTA`:
```ts
type BreakoutInput = { kind: "input"; seat: "A" | "B"; tick: number; dir: -1 | 0 | 1; shoot: boolean; seq: number };
```

### 4.2 Minimal `GameModule` (seats + lifecycle only — not physics)
Add a tiny pure module `breakout-mp` whose only jobs are: assign seats, gate `minPlayers/maxPlayers = 2`, carry a shared `seed`, and report terminal/outcome. **Gameplay does not flow through `applyIntent`** — it flows over `LIVE_DELTA`. This keeps all the generic lifecycle (join, host transfer, pause/resume, recess, stop, rematch) working for free.

```ts
// packages/game-logic/src/breakoutMp.ts
export interface BreakoutMpState {
  seats?: Record<string, "A" | "B">;
  seed: number;                 // shared deterministic seed for both sims
  status: "playing" | "won" | "lost";
  winner: string | null;
}
export interface BreakoutMpIntent {
  // optional, low-rate: report game end / sync barrier; NOT per-frame input
  kind: "report-end";
  result: "won" | "lost";
}
```
- `initialState(players)` assigns `seats` in join order and sets a `seed` (constant or derived; it just needs to be identical for both seats — it is broadcast in the snapshot).
- `applyIntent` handles only the occasional `report-end` (or simply remains a near no-op). Reads seat from `state.seats[playerId]`, never from the intent.
- `isTerminal` → `status !== "playing"`.

Register it in `packages/game-logic/src/index.ts` and add unit tests (`breakoutMp.test.ts`) for seat assignment + terminal transition.

### 4.3 Determinism requirements (the real work)
For two independent simulations to agree frame-for-frame:

1. **Fixed timestep + tick counter.** Decouple the sandbox update loop from `requestAnimationFrame`; accumulate elapsed time and step physics in fixed increments (e.g. 1000/60 ms), incrementing an integer `tick`. Both clients count ticks from a shared **start barrier** (a "START at tick 0" countdown both sides agree on after both have joined).
2. **Input delay buffer.** A locally-pressed input is scheduled to apply at `tick + N` (e.g. N = 4 ≈ 66 ms), and broadcast tagged with that `applyTick`. Both sims apply every input (local and remote) exactly at its `applyTick`, so ordering is identical on both ends despite network latency. If a remote input for a due tick has not arrived, the sim must **stall** that tick until it does (classic lockstep).
3. **Seeded RNG — replace physics-affecting `Math.random`.** The legacy code uses `Math.random` in ways that change gameplay and therefore must be made deterministic from the shared `seed`:
   - `BreakOut.Brick.js:114-115` — whether a bonus drops and **which** bonus.
   - `BreakOut.js:251-252` — a spawned ball's start position.
   - `BreakOut.js:352` and `BreakOut.js:508` — the ball's attach offset on the paddle (affects launch trajectory).
   Introduce a small seeded PRNG (e.g. mulberry32) seeded with `state.seed`, and route the above sites through it. Cosmetic randomness (`randomcolor.js`, `EffectSparkles`, `EffectPickup`, particle/sound variation) can keep `Math.random` — it does not affect simulation state.
4. **No floating-point cross-engine concern** in practice: both clients run the same JS in the same browser engine family; given identical code path, fixed `dt`, and seeded RNG, results match. (If drift is ever observed, add the optional re-sync in 4.6.)

### 4.4 Sandbox (iframe) changes — `apps/web/public/legacy/breakout/`
Extend the existing Phase-1 sandbox (do not fork a second copy). Add a small `multiplayer.js` loaded by `index.html` only when a `?mp=1` query flag is present, so solo mode is untouched:
- On load, read init via `postMessage` from the parent: `{ seat: "A"|"B", seed }`. Seed the PRNG; add the second paddle with `BreakOut.addPlayer` (multi-paddle already supported).
- Replace the rAF loop with the fixed-timestep loop (4.3.1) and the input-delay scheduler (4.3.2).
- Capture local keyboard → enqueue local input at `tick+N` and `postMessage` it up: `{ source:"playground-legacy-game", gameKey:"breakout-mp", type:"input", input:{...} }`.
- Receive remote input via `postMessage` from the parent and enqueue it at its `applyTick`.
- On game end, `postMessage` `{ type:"end", result }` so the board can report it via the module intent (optional, for the end overlay).

### 4.5 React board — `apps/web/src/games/BreakoutMpBoard.tsx` (dumb bridge)
A board with **no sockets/fetch** of its own (per architecture rule). It:
- Renders the iframe `src="/legacy/breakout/index.html?mp=1"`, fullscreen layout.
- Reads `mySymbol` (seat `"A"|"B"`) and `gameState.seed` from props; `postMessage`s the init to the iframe once loaded.
- `subscribeLiveDeltas((p) => ...)` → forwards peer `BreakoutInput` into the iframe via `postMessage` (ignores its own `from`).
- Listens to iframe `postMessage` local inputs → calls `onLiveDelta(input)`.
- Optionally calls `onIntent({ kind:"report-end", result })` on game end to drive `GAME_ENDED`/overlay.

Register it in `BOARD_REGISTRY` in `GameSessionContainer.tsx` with `fullscreen: true`, mapping `mySymbol`/`onLiveDelta`/`subscribeLiveDeltas`/`onIntent` through (the registry already passes these props — see the drawing entry at lines 170-177).

### 4.6 Optional drift safety net
If desync is ever observed in testing, add a low-rate integrity check **without** adding server authority: each client periodically sends a `LIVE_DELTA` `{ kind:"checksum", tick, hash }` of its simulation state; on mismatch, the seat-A client broadcasts a one-off full state dump over `LIVE_DELTA` and seat B hard-resets to it. This stays entirely client-side and is only a correction, not validation.

---

## 5. Summary of Actions & Proposed Next Steps

### Phase 1 — done
* Sandbox copied to `apps/web/public/legacy/breakout/`, CouchFriends stubbed, keyboard controls + `postMessage` save sync, `BreakoutSolo` registered (solo key `breakout`).

### Phase 2 — to implement (deterministic lockstep)
1. `packages/game-logic/src/breakoutMp.ts` — minimal seats/lifecycle module + `breakoutMp.test.ts`; register in `packages/game-logic/src/index.ts`.
2. `apps/web/public/legacy/breakout/multiplayer.js` (+ `index.html` `?mp=1` hook) — fixed-timestep loop, input-delay scheduler, second paddle, seeded PRNG replacing the four physics-affecting `Math.random` sites.
3. `apps/web/src/games/BreakoutMpBoard.tsx` — dumb iframe↔`LIVE_DELTA` bridge.
4. Register the board in `BOARD_REGISTRY` (`GameSessionContainer.tsx`, `fullscreen: true`).
5. **No changes** to `apps/game-server/src/**`, `room.ts`, `lifecycle.ts`, etc.
6. Verify sync over real latency; add the optional checksum re-sync (4.6) only if drift appears.

### What you (the user) must do
* Run the catalog SQL. **The `breakout` key is already taken by the solo game**, so multiplayer needs a distinct key, e.g. `breakout-mp`:

```sql
INSERT INTO public.games (
  id, name_he, description_he, type, game_url, min_players, max_players, is_active, is_multiplayer, for_gender
) VALUES (
  gen_random_uuid(), 'שבירת לבנים (שניים)', 'שבירת לבנים שיתופי לשני שחקנים', 'custom', 'breakout-mp', 2, 2, true, true, 'both'
)
ON CONFLICT (game_url) DO NOTHING;
```
  `game_url` must equal the module key and the `BOARD_REGISTRY` key (`breakout-mp`). `min_players`/`max_players` on the row must be `2`/`2`.

### Known limitations (accepted)
* Not server-authoritative — no anti-cheat; trusts both clients (explicitly accepted, see 4.0).
* Lockstep stalls the slower client to the speed of the laggier link; fine for 2 players on reasonable connections, not for high-latency or >2 players.
* Recovery from desync relies on the optional client-side re-sync (4.6), not the server.
