# Toolchain Reference — Engine-Specific Build Instructions

This document covers how to compile games from each supported engine to an
HTML5/WebAssembly bundle that can be loaded in an iframe inside The Playground.

---

## 1. Godot 4.x (GDScript / C#)

### Requirements
- Godot 4.x **headless/server** binary or the full editor CLI.
- The Web export template must be pre-installed.

### Check availability
```bash
# Godot 4
godot4 --version 2>/dev/null || godot --version 2>/dev/null || echo "NOT FOUND"
```

If not found, tell the user:
> Install Godot 4 CLI: download from https://godotengine.org/download
> or `flatpak install flathub org.godotengine.Godot`

### Export template setup (one-time)
```bash
# Godot downloads export templates on first export. To pre-install:
godot4 --headless --export-templates-download
```

### Build command
```bash
cd tmp/import-<gameKey>
mkdir -p build

# Export for Web (HTML5)
godot4 --headless --export-release "Web" build/index.html
```

If the project doesn't have a `Web` export preset configured, you need to
create one. Add this to `export_presets.cfg` in the project root:

```ini
[preset.0]
name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/index.html"

[preset.0.options]
html/export_icon=true
html/custom_html_shell=""
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=true
```

### GDScript bridge hook

To wire the Godot game into the Playground save system, add this to your
main scene's `_ready()` or game-over handler:

```gdscript
# In your game-over / level-complete script:
func _on_game_over(score: int) -> void:
    # Call the injected bridge (see inject-bridge.mjs)
    JavaScriptBridge.eval("""
        if (window.__playgroundBridge) {
            window.__playgroundBridge.finish({ score: %d });
        }
    """ % score)

func _on_level_complete(level: int) -> void:
    JavaScriptBridge.eval("""
        if (window.__playgroundBridge) {
            window.__playgroundBridge.checkpoint({ currentLevel: %d });
        }
    """ % level)
```

> **Godot 3.x** uses `JavaScript.eval()` instead of `JavaScriptBridge.eval()`.

---

## 2. Emscripten (C / C++ — SDL2, Raylib, custom engines)

### Requirements
- Emscripten SDK (`emsdk`).

### Check availability
```bash
emcc --version 2>/dev/null || echo "NOT FOUND"
```

If not found, tell the user:
> Install Emscripten:
> ```bash
> git clone https://github.com/emscripten-core/emsdk.git
> cd emsdk && ./emsdk install latest && ./emsdk activate latest
> source ./emsdk_env.sh
> ```

### Build — CMake project
```bash
cd tmp/import-<gameKey>
mkdir -p build

emcmake cmake -B build-wasm -DCMAKE_BUILD_TYPE=Release
emmake make -C build-wasm -j$(nproc)

# The output usually lands in build-wasm/ as .html + .js + .wasm
# Copy to our standard output dir:
cp build-wasm/*.html build-wasm/*.js build-wasm/*.wasm build-wasm/*.data build/ 2>/dev/null
mv build/*.html build/index.html 2>/dev/null
```

### Build — Makefile project
```bash
cd tmp/import-<gameKey>

# Many SDL/Raylib projects have an emscripten target:
emmake make PLATFORM=PLATFORM_WEB -j$(nproc)

# Or invoke emcc directly for single-file games:
emcc main.c -o build/index.html \
  -s USE_SDL=2 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS=ccall,cwrap \
  -O2 --shell-file shell.html
```

### Build — Raylib project
Many Raylib games ship a `Makefile` with web support:
```bash
cd tmp/import-<gameKey>
make PLATFORM=PLATFORM_WEB EMSDK_PATH=<path-to-emsdk>
# Output: usually a .html file in the project root or build/
```

### Emscripten bridge hook (C/C++)
```c
#include <emscripten.h>

// Call from your game-over function:
void report_score(int score) {
    EM_ASM({
        if (window.__playgroundBridge) {
            window.__playgroundBridge.finish({ score: $0 });
        }
    }, score);
}

void report_checkpoint(int level) {
    EM_ASM({
        if (window.__playgroundBridge) {
            window.__playgroundBridge.checkpoint({ currentLevel: $0 });
        }
    }, level);
}
```

---

## 3. Rust (wasm-bindgen / wasm-pack / trunk)

### Requirements
- Rust toolchain with `wasm32-unknown-unknown` target.
- One of: `wasm-pack`, `trunk`, or manual `wasm-bindgen-cli`.

### Check availability
```bash
rustup target list --installed | grep wasm32 || echo "NOT FOUND"
wasm-pack --version 2>/dev/null || trunk --version 2>/dev/null || echo "NO WASM BUILDER"
```

If not found, tell the user:
> ```bash
> rustup target add wasm32-unknown-unknown
> cargo install wasm-pack   # OR: cargo install trunk
> ```

### Build — trunk project (Bevy, Macroquad, etc.)
```bash
cd tmp/import-<gameKey>
trunk build --release --dist build
# Output: build/index.html + .wasm + .js
```

### Build — wasm-pack project
```bash
cd tmp/import-<gameKey>
wasm-pack build --target web --release --out-dir build
```

For wasm-pack, you often need to create a thin `index.html` wrapper that
imports the generated JS module. Check if the project provides one.

### Build — manual wasm-bindgen
```bash
cd tmp/import-<gameKey>
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/<crate>.wasm \
  --out-dir build --target web --no-typescript
```

### Rust bridge hook
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["window", "__playgroundBridge"])]
    fn finish(state: &JsValue);

    #[wasm_bindgen(js_namespace = ["window", "__playgroundBridge"])]
    fn checkpoint(state: &JsValue);
}

// Call from your game-over handler:
pub fn report_score(score: i32) {
    let state = js_sys::Object::new();
    js_sys::Reflect::set(&state, &"score".into(), &score.into()).ok();
    finish(&state);
}
```

---

## 4. Pico-8 (Lua)

### Requirements
- Pico-8 desktop app (commercial, $14.99 — https://www.lexaloffle.com/pico-8.php).
- OR: use the **free web player** approach (see below).

### Option A: Export from Pico-8 CLI
```bash
pico8 -export build/index.html tmp/import-<gameKey>/game.p8
```

This produces a self-contained `index.html` with the embedded Pico-8 player.

### Option B: Use the free Pico-8 web player (for `.p8.png` carts)
If the user doesn't own Pico-8, many games are distributed as `.p8.png`
cartridge images that can be played in browser-based players:

1. Download the `.p8.png` from the game's itch.io or Lexaloffle BBS page.
2. Use an open-source HTML player like [pico8-player](https://github.com/nicholasgasior/pico8-player).
3. Place the player + cartridge in `apps/web/public/legacy/<gameKey>/`.

### Bridge hook (Pico-8)
Pico-8 games run in a sandboxed virtual console. You cannot inject code into
the Lua VM, but you **can** detect the game state from the HTML shell:
- Override the Pico-8 `_update()` callback is not possible from outside.
- Best approach: use the injected bridge (`inject-bridge.mjs`) which polls
  the page title or a known DOM element for score changes, or simply skip
  save-state integration and treat it as a stateless game.

---

## 5. Love2D (Lua)

### Requirements
- [love.js](https://github.com/Davidobot/love.js) — compiles Love2D games to web.

### Check availability
```bash
npx love.js --help 2>/dev/null || echo "NOT FOUND"
```

### Build
```bash
cd tmp/import-<gameKey>

# Package the .love file
zip -r game.love . -x ".git/*" "build/*"

# Convert to web
npx love.js game.love build/ --title="<GameTitle>" --memory 67108864
# Output: build/index.html + game.js + game.wasm + game.data
```

---

## 6. Pre-built HTML5 bundles

If the cloned repo already contains a working HTML5 export (many itch.io games
ship this), **skip compilation entirely**:

1. Locate the `index.html` (check `build/`, `dist/`, `export/`, `web/`, or root).
2. Copy the entire directory to `apps/web/public/legacy/<gameKey>/`.
3. Verify the entry point: `test -f apps/web/public/legacy/<gameKey>/index.html`.
4. Proceed to Phase 4 (bridge injection).

---

## Binary size optimization tips

| Technique | Effect | How |
|-----------|--------|-----|
| `wasm-opt -O3` | 10–30% smaller `.wasm` | `wasm-opt -O3 game.wasm -o game.wasm` (from binaryen) |
| Gzip pre-compress | 60–70% transfer reduction | `gzip -k game.wasm` → serve `.wasm.gz` |
| Strip debug info | Significant | Most release builds do this; verify with `wasm-objdump -h` |
| Godot: exclude unused modules | 5–15 MB savings | Custom export templates without 3D/physics if 2D-only |
| Texture compression | Smaller `.pck` / `.data` | Use ASTC/ETC2 for mobile, S3TC for desktop |
