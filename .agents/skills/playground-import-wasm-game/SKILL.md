---
name: playground-import-wasm-game
description: >
  Import, compile, and wire up an open-source game written in any language
  (Godot/C#/GDScript, C/C++ via Emscripten, Rust via wasm-bindgen/trunk,
  Pico-8 Lua, or pre-built HTML5 bundles) into The Playground as a solo
  iframe game. Covers cloning, toolchain detection, WebAssembly compilation,
  asset placement, React wrapper generation, SOLO_REGISTRY wiring,
  postMessage bridge injection, and the games-catalog SQL.
  Activate when the user asks to import, port, add, or integrate an
  external/open-source game that is NOT written in TypeScript/JavaScript,
  or when they mention WebAssembly, Wasm, Godot export, Emscripten,
  Rust game, Pico-8 export, or compiled HTML5 game.
---

# Importing a WebAssembly / Compiled Game into The Playground

This skill automates the full pipeline of taking an open-source game repo in
any compiled language, building it to an HTML5/WebAssembly bundle, and wiring
it into The Playground as a solo game with save-state support.

## Prerequisites & toolchains

The agent should check whether the required toolchain is available before
attempting to compile. See [references/toolchains.md](references/toolchains.md)
for installation commands and version requirements per engine.

> **If a toolchain is missing**: tell the user exactly what to install and
> stop — do not attempt to install compilers or SDKs silently.
> **If the game repo ships a pre-built HTML5 export** (i.e. you can already find
> an `index.html` + `.wasm` or `.js` bundle), skip the build step entirely.

---

## Step-by-step workflow

### Phase 1 — Clone & detect engine

1. **Clone the repo** into a temporary workspace directory.
   ```bash
   # Use the workspace tmp/ directory — never /tmp or ~/
   git clone --depth 1 <REPO_URL> tmp/import-<gameKey>
   ```

2. **Auto-detect the game engine / toolchain**. Look for these markers:

   | Engine | Detection markers |
   |--------|-------------------|
   | **Godot 4.x** | `project.godot` with `config_version=5` |
   | **Godot 3.x** | `project.godot` with `config_version=4` |
   | **Emscripten (C/C++)** | `CMakeLists.txt`, `Makefile`, or `emcc`/`emcmake` mentions; SDL/Raylib deps |
   | **Rust (wasm-bindgen)** | `Cargo.toml` with `wasm-bindgen` or `wasm-pack` dependency |
   | **Rust (trunk)** | `Cargo.toml` + `trunk.toml` or `index.html` with `data-trunk` attributes |
   | **Pico-8** | `.p8` cartridge file |
   | **Pre-built HTML5** | Existing `index.html` + `.wasm` / `.js` bundle in a `build/` or `export/` dir |
   | **Love2D (Lua)** | `main.lua` + `conf.lua` (use love.js for web export) |

3. **Choose a `gameKey`**: lowercase, no spaces, kebab-case.
   Must be unique across all existing `SOLO_LOADERS` keys in
   [SoloGameContainer.tsx](../../../apps/web/src/game/SoloGameContainer.tsx)
   and all `game_url` values in the `games` catalog.

### Phase 2 — Build to HTML5/WebAssembly

Follow the engine-specific build instructions in
[references/toolchains.md](references/toolchains.md).

**All engines produce the same output shape:**
```
tmp/import-<gameKey>/build/
  ├── index.html        ← entry point (REQUIRED)
  ├── <game>.wasm       ← compiled binary (most engines)
  ├── <game>.js         ← JS glue / loader
  ├── <game>.pck        ← Godot asset pack (Godot only)
  └── ... (textures, audio, etc.)
```

**Build rules:**
- Always target **release/production** mode (smaller binaries, no debug symbols).
- Always target **WebGL 2** if the engine has a renderer option.
- If the engine supports it, enable **gzip/brotli pre-compression** of `.wasm` files.
- Never include the game's development tooling or editor files in the output.
- Run a quick sanity check if possible: `ls -lh tmp/import-<gameKey>/build/index.html`

### Phase 3 — Place assets in public/legacy/

Copy the build output into the Vite public directory:

```bash
# The directory name MUST match gameKey
cp -r tmp/import-<gameKey>/build/ apps/web/public/legacy/<gameKey>/
```

Verify the entry point exists:
```bash
test -f apps/web/public/legacy/<gameKey>/index.html && echo "✓ OK"
```

### Phase 4 — Inject the postMessage bridge (if needed)

The game must communicate with the parent React container via
`window.parent.postMessage`. If the game does not already have bridge code
(most won't), inject a small bridge script into the game's `index.html`.

Use the helper script:
```bash
node .agents/skills/playground-import-wasm-game/scripts/inject-bridge.mjs \
  apps/web/public/legacy/<gameKey>/index.html \
  <gameKey>
```

This script inserts a `<script>` tag just before `</body>` that:
- Posts `{ source: "playground-legacy-game", gameKey, type: "solo-ready" }`
  when the page loads (so the wrapper can send restore-state).
- Exposes `window.__playgroundBridge.checkpoint(state)` and
  `window.__playgroundBridge.finish(state)` functions that the game code
  can call (or that can be wired to existing game-over callbacks).

> If the game already has its own score/progress callbacks, wire them to call
> `window.__playgroundBridge.finish({ score })` or
> `window.__playgroundBridge.checkpoint({ currentLevel })`.
> For Godot, see the GDScript snippet in [references/toolchains.md](references/toolchains.md).

### Phase 5 — Create the React solo wrapper

Create `apps/web/src/games-solo/<GameKey>Solo.tsx`.

Use the **template** below. Replace placeholders marked with `{{...}}`:

```tsx
import { useEffect, useRef, useState } from "react";
import type { SoloGameSaveControls } from "@/lib/soloGameSaves";

export function {{PascalName}}Solo({ save }: { save: SoloGameSaveControls }) {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
    const handleFsChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement && document.fullscreenElement === sectionRef.current
      );
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        gameKey?: string;
        type?: string;
        state?: Record<string, unknown>;
      };
      if (
        data?.source !== "playground-legacy-game" ||
        data.gameKey !== "{{gameKey}}"
      ) {
        return;
      }

      // Game finished loading — send saved state for restore
      if (data.type === "solo-ready") {
        if (save.savedState && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              source: "playground-board",
              gameKey: "{{gameKey}}",
              type: "restore-snapshot",
              snapshot: save.savedState,
            },
            window.location.origin
          );
        }
      }

      // Checkpoint save (mid-game progress)
      if (
        data.type === "checkpoint" &&
        typeof data.state?.currentLevel === "number"
      ) {
        void save.saveState(
          { currentLevel: data.state.currentLevel },
          { saveKind: "checkpoint" }
        );
      }

      // Game finished — save high score
      if (data.type === "finish" && typeof data.state?.score === "number") {
        const key = "{{gameKey}}:bestScore";
        void save.mergeBestScores({ [key]: data.state.score });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [save]);

  return (
    <section
      ref={sectionRef}
      className={`mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 ${
        isFullscreen
          ? "h-screen w-screen !max-w-none flex flex-col justify-between gap-4 !rounded-none bg-slate-950 border-none p-6 overflow-hidden"
          : ""
      }`}
      dir="ltr"
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-white">{{nameHe}}</h2>
          <p className="text-sm font-medium text-white/70">{{descriptionHe}}</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 px-4 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 duration-200 shadow-sm flex items-center gap-1.5 backdrop-blur-sm"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? "מצב רגיל" : "מסך מלא"}
        </button>
      </div>

      {/* Game viewport */}
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${
          isFullscreen
            ? "flex-grow min-h-0 border-none"
            : "h-[640px] max-w-[1024px]"
        }`}
      >
        <iframe
          ref={iframeRef}
          title="{{PascalName}}"
          src="/legacy/{{gameKey}}/index.html"
          className="h-full w-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>
    </section>
  );
}
```

**Template variables:**
- `{{gameKey}}` — the kebab-case key (e.g. `flappy-bird`)
- `{{PascalName}}` — PascalCase version (e.g. `FlappyBird`)
- `{{nameHe}}` — Hebrew display name
- `{{descriptionHe}}` — Hebrew one-line description

### Phase 6 — Register in SoloGameContainer

In [SoloGameContainer.tsx](../../../apps/web/src/game/SoloGameContainer.tsx),
add one entry to `SOLO_LOADERS`:

```ts
"{{gameKey}}": () =>
  import("@/games-solo/{{PascalName}}Solo").then((m) => ({
    default: m.{{PascalName}}Solo,
  })),
```

### Phase 7 — Add HomePage metadata

In [HomePage.tsx](../../../apps/web/src/pages/HomePage.tsx), add an entry to
`GAME_METADATA`:

```ts
"{{gameKey}}": {
  emoji: "🎮",    // pick a fitting emoji
  gradient: "from-cyan-400 to-blue-600",     // pick a fitting gradient
  glowColor: "shadow-cyan-500/40",
  badgeGradient: "from-cyan-400 to-blue-500",
  // If the game has a thumbnail, place it at:
  //   apps/web/public/legacy/{{gameKey}}/thumbnail.png
  // and set: thumbnailUrl: "/legacy/{{gameKey}}/thumbnail.png"
},
```

### Phase 8 — Provide catalog SQL (do NOT run it)

Tell the user to run this SQL in Supabase:

```sql
INSERT INTO public.games (
  id, name_he, description_he, type, game_url,
  min_players, max_players, is_active, is_multiplayer, for_gender
)
SELECT
  gen_random_uuid(),
  '{{nameHe}}',
  '{{descriptionHe}}',
  'custom',
  '{{gameKey}}',
  1, 1, true, false, 'both'
WHERE NOT EXISTS (
  SELECT 1 FROM public.games WHERE game_url = '{{gameKey}}'
);
```

### Phase 9 — Clean up

```bash
rm -rf tmp/import-<gameKey>
```

---

## Vercel / deployment considerations

### `.wasm` MIME type
Vercel serves `.wasm` files with the correct `application/wasm` MIME type by default. No config needed.

### Rewrite rules
The existing `vercel.json` rewrite rule excludes paths ending in known file extensions
(`.*\.[a-z0-9]+$`) from the SPA catch-all, so static files under `public/legacy/` are
served directly. No changes needed.

### Bundle size
Wasm binaries can be 5–30 MB. Vercel compresses them automatically with Brotli.
For very large bundles, consider:
- Splitting assets (textures, audio) into a lazy-loaded pack.
- Using Godot's `--export-pack` to split the `.pck` from the `.wasm`.

---

## Validation checklist

- [ ] `gameKey` is lowercase kebab-case, unique in `SOLO_LOADERS` and `games` catalog.
- [ ] `apps/web/public/legacy/<gameKey>/index.html` exists and loads in a browser.
- [ ] The postMessage bridge is injected (game sends `solo-ready`, `checkpoint`, `finish`).
- [ ] `<GameKey>Solo.tsx` wrapper created with fullscreen toggle and save bridge.
- [ ] Entry added to `SOLO_LOADERS` in `SoloGameContainer.tsx`.
- [ ] Entry added to `GAME_METADATA` in `HomePage.tsx`.
- [ ] Told the user the exact catalog SQL. Did **not** run it.
- [ ] `tmp/import-*` cleaned up.
- [ ] Wrapper uses `dir="ltr"` on the section to avoid RTL layout issues.
- [ ] No changes to `apps/game-server/`, `packages/game-logic/`, or any multiplayer code.

---

## What to flag to the user

Always tell the user clearly when any of these apply:

- A build toolchain (Godot CLI, Emscripten, Rust/wasm-pack) is **not installed** and must be installed first.
- The `.wasm` binary is **very large** (>20 MB) and may cause slow first loads.
- The game uses **WebGL 2 features** that may not work on older iPads or low-end Chromebooks.
- The game's license is **not MIT/Apache/GPL** — confirm with the user before including.
- The game requires **audio autoplay** — browsers may block it until user interaction.
- The game captures **keyboard input aggressively** and may interfere with browser shortcuts.
- The game needs **mouse lock / pointer capture** — may feel jarring in an iframe without user prompt.
- You had to **modify the game source** to add bridge hooks — document what changed.
