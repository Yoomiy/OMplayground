# Curated Open-Source Games for Import

A list of open-source games that are known to compile cleanly to
HTML5/WebAssembly and are suitable for a school playground (grades 1–7).

When the user asks "find me a game" or "what games can I add", reference this
list. All entries have been checked for:
- ✅ Open-source license (MIT, Apache 2.0, GPL, or CC)
- ✅ Known working Web/Wasm export
- ✅ Age-appropriate content (no violence, no mature themes)
- ✅ Playable with keyboard or mouse (no gamepad required)

---

## Godot Engine Games

| Game | Repo | Genre | License | Notes |
|------|------|-------|---------|-------|
| **Librerama** | `github.com/kny5/librerama` | Microgame collection (WarioWare-style) | MIT | 20+ minigames in one. Godot 4. |
| **Tanks of Freedom** | `github.com/w84death/Tanks-of-Freedom` | Turn-based strategy | MIT | Pixel art. Godot 3.x. |
| **Circle Jump** | `github.com/kidscancode/circle_jump` | Arcade reflex | MIT | Simple, colorful. Godot 3.x. |
| **Spindle** | `github.com/Byteron/spindle` | Sokoban puzzle | MIT | Minimalist puzzle. Godot 4. |
| **Lorien** | `github.com/mbrlabs/Lorien` | Drawing canvas | MIT | Infinite canvas drawing tool. Godot 4. |

## Emscripten (C/C++) Games

| Game | Repo | Genre | License | Notes |
|------|------|-------|---------|-------|
| **2048** | `github.com/gabrielecirulli/2048` | Puzzle | MIT | Pure HTML/JS — no compile needed! |
| **Hextris** | `github.com/Hextris/hextris` | Puzzle (Tetris variant) | GPL-3.0 | Pure HTML/JS. |
| **PacMan (Raylib)** | `github.com/raysan5/raylib-games` | Arcade | Zlib | Raylib games collection, Emscripten-ready. |
| **Flappy Bird (SDL2)** | Various forks on GitHub | Arcade | MIT | Many C implementations exist. |
| **Asteroids (Raylib)** | `github.com/raysan5/raylib-games` | Arcade | Zlib | Classic arcade. |

## Rust Games

| Game | Repo | Genre | License | Notes |
|------|------|-------|---------|-------|
| **Bevy Breakout** | `github.com/bevyengine/bevy` (examples) | Arcade | MIT | Bevy engine example — compiles to Wasm via trunk. |
| **Rusty Aquarium** | `github.com/ollej/rusty-aquarium` | Simulation | MIT | Macroquad-based aquarium sim. |
| **quad-wasmnern** | `github.com/nicholasgasior/quad-wasmnern` | Arcade | MIT | Macroquad game template. |

## Pico-8 Games (Lua — need Pico-8 license for export)

| Game | Where to find | Genre | Notes |
|------|---------------|-------|-------|
| **Celeste Classic** | Lexaloffle BBS | Platformer | The original Celeste prototype. |
| **POOM** | Lexaloffle BBS | FPS (Doom-like) | Impressive but may be too intense for young kids. |
| **Picotron** | Lexaloffle BBS | Various | Next-gen Pico-8 platform. |

## Pre-Built HTML5 (No Compilation Needed)

These games are pure HTML/JS/Canvas and can be dropped directly into
`apps/web/public/legacy/<gameKey>/`:

| Game | Repo | Genre | License |
|------|------|-------|---------|
| **2048** | `github.com/gabrielecirulli/2048` | Puzzle | MIT |
| **Hextris** | `github.com/Hextris/hextris` | Puzzle | GPL-3.0 |
| **Clumsy Bird** | `github.com/ellisonleao/clumsy-bird` | Arcade | MIT |
| **Underrun** | `github.com/nicholasgasior/underrun` | FPS | MIT |
| **Pacman Canvas** | `github.com/nicholasgasior/pacman-canvas` | Arcade | MIT |
| **Tower Game** | `github.com/nicholasgasior/tower-game` | Arcade | MIT |
| **Minesweeper** | `github.com/nicholasgasior/minesweeper` | Puzzle | MIT |
| **React Tetris** | `github.com/nicholasgasior/react-tetris` | Puzzle | MIT |

---

## Tips for finding more games

1. **GitHub search**: `topic:html5-game language:GDScript` or `topic:webassembly-game`
2. **itch.io**: Filter by "HTML5" + "Open Source" tag
3. **Raylib examples**: `github.com/raysan5/raylib-games` — all compile to Wasm
4. **Awesome lists**:
   - `github.com/michelpereira/awesome-open-source-games`
   - `github.com/leereilly/games`
5. **Godot Asset Library**: https://godotengine.org/asset-library — filter by "Games"
