# Technical Proposal: Adoption of Breakout Game into OMplayground App

This document outlines the architectural proposal, implementation steps, and code changes required to adopt the external Breakout game (`sourceCode/breakout`) into our main web application (`apps/web`).

Following the structure of other games in our system (which support both single-player and multiplayer modes), we outline a two-phased adoption roadmap.

---

## 1. Executive Summary
The external Breakout game in [sourceCode/breakout](file:///home/yosi/OMplayground/sourceCode/breakout) is a JavaScript/PixiJS-based arcade game that supports multiplayer controls using a third-party API called CouchFriends. Because the CouchFriends API relies on external web-sockets and mobile controllers, we will implement a phased rollout:
* **Phase 1: Solo/Sandbox Play**: Packages Breakout as an iframe-embedded solo game using custom keyboard/mouse adapter code. Saves state/progress directly to Supabase.
* **Phase 2: Hybrid Client-Broadcast Multiplayer**: Converts the game into a shared-session multiplayer experience by utilizing our existing Socket.io server to relay client controller inputs to the Host, and broadcasting coordinate snapshots back to the clients.

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

## 4. Phase 2: Hybrid Client-Broadcast Multiplayer
Because kids in **OMplayground** play on remote screens, they cannot share a single physical TV screen (unlike standard CouchFriends setups). However, we can adapt the multi-paddle support already present in [BreakOut.addPlayer](file:///home/yosi/OMplayground/sourceCode/breakout/src/BreakOut.js#L453) using a **Host-Broadcast & Relay Model**.

This keeps the physics simulations strictly on the Host's browser, preventing CPU overload on the game-server while still syncing the screens of both players.

### Architecture

```
┌────────────────────────┐                   ┌────────────────────────┐
│  Player A (Host)       │                   │  Player B (Client)     │
│  Runs physics & logic  │                   │  Renders visuals only  │
│  Renders local screen  │                   │  Captures local input  │
└─────┬───────────▲──────┘                   └──────┬──────────▲──────┘
      │           │                                 │          │
      │ 30 FPS    │ Inputs                          │ Inputs   │ 30 FPS
      │ Snapshots │ (Relayed)                       │ (Sent)   │ Snapshots
      ▼           │                                 ▼          │
┌─────────────────┴────────────────────────────────────────────┴──────┐
│            Socket.io Relay Broker (apps/game-server)                │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 1: Capture & Relay Client Inputs
* **Client Interface (Player B)**: Player B runs a lightweight shell of the game. Keyboard actions (ArrowLeft / ArrowRight / Spacebar) are captured and emitted via the active Socket.io room channel:
  ```typescript
  socket.emit("INTENT_GAME", { type: "PADDLE_INPUT", direction: -1 | 1 | 0, shoot: boolean });
  ```
* **Server Relay**: The server receives this intent and broadcasts it back to the room Host (Player A).
* **Host Application**: Player A's browser catches the input payload and applies it to Player B's paddle reference in the game sandbox:
  ```javascript
  // On input packet received from Player B:
  var playerBPaddle = BreakOut.players.find(p => p.id === playerBId);
  if (playerBPaddle) {
      playerBPaddle.element.setSpeed(data.direction * 8);
      if (data.shoot) {
          playerBPaddle.element.shoot();
      }
  }
  ```

### Step 2: Broadcast Host Game Coordinates (30 FPS)
* **Host Application**: The Host client executes the game physics loop. At a throttle rate (e.g. every 30-40ms), it captures coordinate positions of moving components:
  ```javascript
  // Host captures state
  var stateSnapshot = {
      balls: BreakOut.objects.filter(o => o.name === 'ball').map(b => ({ x: b.object.position.x, y: b.object.position.y })),
      paddles: BreakOut.players.map(p => ({ id: p.id, x: p.element.object.position.x, y: p.element.object.position.y })),
      bricks: BreakOut.objects.filter(o => o.name === 'brick').map(br => ({ id: br.id, destroyed: br.destroyed }))
  };
  window.parent.postMessage({ source: "playground-legacy-game", gameKey: "breakout", type: "stateBroadcast", state: stateSnapshot }, "*");
  ```
  The React container forwards this snapshot to the game-server room via Socket.io.
* **Client Interface (Player B)**: The client wrapper receives this periodic payload and overrides local PixiJS rendering layout:
  * For paddles & balls, it smoothly interpolates (slides) objects to coordinates received in the snapshot.
  * For bricks, it triggers destruction events if marked destroyed.

This hybrid approach allows us to utilize **100% of the game's existing multi-paddle codebase** without complex server-side game-loop programming.

---

## 5. Summary of Actions & Proposed Next Steps
* Create legacy app folder under `/apps/web/public/legacy/breakout/` and copy assets/source files.
* Stub CouchFriends calls and enable local keyboard event listeners inside the sandbox script copy.
* Inject `postMessage` calls into key transition boundaries.
* Write wrapper React component and append to the solo game routes.
* Verify performance, sound, and fullscreen scale responsiveness.
