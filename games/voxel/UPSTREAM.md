# Engine provenance and maintenance

Source: https://github.com/Potrock/blockyard

Pinned revision: `a79346108fc5ed3b68e3827608fdb448e5a7e5db` (2026-10-21 evaluation).

License: MIT, copyright 2026 Patrick Blais. The original notice is retained in
[LICENSE](LICENSE) and [engine/LICENSE](engine/LICENSE).

## Imported paths

| Upstream path | Local path | Use |
| --- | --- | --- |
| `engine/src/*.rs` | `engine/src/*.rs` | Generation/noise, shapes, collision/raycasting, lighting/meshing, culling, procedural textures and their tests. |
| `engine/Cargo.toml`, `engine/Cargo.lock` | Same paths | Locked Rust/Wasm build. |
| `LICENSE` | `LICENSE`, `engine/LICENSE` | Required MIT notice. |
| `engine/src/blocks.rs::tex::NAMES` | `content/texture-layers.json` | Layer names for the imported procedural texture array; compiler input, checked against actual Wasm in tests. |
| `src/platform/render/shaders/common.glsl`, `vertex_unpack.glsl` | `src/render/shaders/` | Shared packed terrain decoder, shape/light/AO and texture shader conventions. |
| `src/platform/world/chunks.ts`, `src/platform/render/{pipeline,textures}.ts`, `shaders/chunk.{vert,frag}` | Adapted in `src/render/terrain.ts` | Three.js packed-geometry attributes, indexed terrain passes and procedural texture arrays. The surrounding renderer, camera-relative upload/culling and lifecycle are rewritten locally. |

`engine/src/formats.rs` and `engine/src/state_width.rs` are new local code.
The TypeScript simulation, content compiler, authored content, tests and tools are
new code. The renderer adaptations are listed above. The imported actor/mover/damage compute modules are retained internally
with their regression tests; this does not add mobs, vehicles or micro-voxel
weapons to the release scope. No upstream host, account, uploaded-game, replay,
public-lobby, development-command, telemetry or server endpoint is imported.

## Fork changes

- Uint16 states across generation, blueprints, sparse sections, edits,
  mesh neighborhoods, shape lookup IDs, moving voxel buffers and JS bindings.
  Air remains zero; 65535 is unloaded/blueprint-keep, and is never a stored state.
- Versioned `VXC2` columns, `VXR2` neighborhoods and `VXE2` edits at the Wasm
  boundary; validation runs before mutation/unchecked compute. Packed mesh
  vertices retain their original fields; header word 79 identifies format 2.
- One immutable complete authored content manifest per engine instance.
  No production built-in allocation or custom-state pool. Lookup tables grow
  with the actual manifest and use conservative fallback entries.
- The generator's private template palette is translated to compiled semantic
  content before authored blueprints are stamped. Numeric template IDs are not
  content IDs. The authored palette retains natural wood/ore/flower varieties;
  remaining aliases are explicit in `content/index.ts`.
- Texture layers 115–148 are locally authored procedural additions for ten wool
  colors, sixteen stained-glass colors, mineral storage, sponge, pumpkin, cane,
  mossy stone bricks and melon. Earlier local TNT additions are retained.
  All use the imported procedural texture machinery; no external art is added.
- Liquid-inclusive container selection shares the native shape/occlusion ray
  implementation. Exposed targets match the shader's mean 7/8-block surface.
  Ordinary building/mining selection continues to pass through liquids.
- Water/lava physics uses semantic classification rather than upstream IDs.
  Unavailable terrain and the floor below the vertical world remain solid.
- `forget_column` releases compute-side edit/original/damage buffers after the
  authoritative or mirrored journal has been retained outside the engine.
  Ghost observers are excluded from building collision checks.
- Explicit creative flight survives neutral input while grounded. Descending
  onto terrain ends flight; merely toggling flight between input ticks does not.
- Spectator identity no longer forces flight back on after an authorized toggle
  or a permission change. Ghost movement passes through terrain only while flight
  is enabled; turning it off uses ordinary gravity/collision while retaining the
  observer identity and exclusion from placement/targeting. Native and actual-Wasm
  tests keep flight off across subsequent simulation steps and reconnect.
- `sweep_body` exposes the existing shape-aware settling/axis collision routines
  for small authoritative dropped bodies. It validates finite bounded motion and
  dimensions, allocates no entity or simulation clock, and returns position and
  blocked axes. Existing player physics is unchanged; actual-Wasm tests cover
  high-state slabs, invalid sweeps, drop settling and pickups.
- Two appended procedural TNT texture layers (`tnt_side`, `tnt_top`) are local
  authoring in `texgen.rs`; the shared layer-name inventory matches their indices.
  Primed TNT reuses the shape-aware small-body sweep without changing player physics.
- The shared `player_step` now accepts bounded ground-jump power and returns the
  native takeoff outcome. Default power 1 preserves normal movement. The modifier
  applies only to the existing native ground-jump branch; swimming/flight/airborne
  input uses the original rules. Server equipment wear uses that outcome, never
  inferred browser flags. The same release bindings/Wasm serve prediction and authority.
- The original Apple-silicon bitwise physics fingerprint remains on that
  target. Every native target compares the complete motion/ray trace before
  and after content installation; shape/collision/mesh invariants remain.

## Asset provenance

The foundation uses no downloaded image/audio/model assets. Texture pixels are
produced locally by the imported MIT Rust texture-generator source. The layer
names and UV conventions derive from the same engine. New content uses those
procedural layers. This is the complete imported-asset inventory at this stage;
record the source and redistribution terms here before adding other assets.

The articulated instanced avatars, generated face texture, held-block primitive
geometry, sun/moon/cloud/star/rain geometry and edit particles are authored locally
in `src/render`. Held blocks borrow the same procedural terrain texture arrays.
Held/dropped pickaxes, axes, shovels, sticks, boots, apples, shields, powder,
firestarters, talismans and medallions are local primitive models
using those arrays. Dropped items use growable per-item instance batches and
camera-relative coordinates; no downloaded item models or icon textures are used.
`src/client/world-audio.ts` synthesizes ambience, footsteps and material edit
sounds with Web Audio oscillators and locally generated noise. No recordings,
third-party avatar models, fonts or new external art assets are bundled.

## Toolchain

Node **24.21.0**, Rust **1.99.1**, wasm-pack **0.15.0**; npm and Cargo lockfiles
are included. Cargo release uses optimization level 3, LTO, one codegen unit
and abort-on-panic. The release wasm-opt flags are pinned in `engine/Cargo.toml`;
wasm-pack 0.15.0's downloaded optimizer in the verified build is Binaryen 117.
`tools/build-engine.mjs` checks Node/Rust/wasm-pack versions. The same generated
`engine/pkg` artifact is tested in Node and Chromium, with matching hashed
copies and a content/build manifest under ignored `artifacts/`.

## Native fingerprint disposition

The original checkout on this Linux ARM host produced `1009773678157028658`
versus the fixture `5660272500767052814`; the Uint16 fork produced the same
observed value. Upstream `.github/workflows/ci.yml` explicitly says that this
fixture was recorded on Apple silicon and includes platform `exp`/`sin`.
No hash was replaced. This supports scoping that fixture, not a claim that all
platform differences have been diagnosed. Analytic collision/shape tests,
exact before/after traces on every native target, and release-Wasm cross-runtime
traces provide additional coverage. Broader traces and supported-browser/device
qualification remain required.

## Updating upstream

1. Select an explicit revision and inspect its diff from the pin. Do not pull
   upstream main automatically or import its hosting/platform entry points.
2. Review changes by subsystem, preserving the manifest and binary-format
   contracts. Update this path inventory and applicable notices.
3. Run `npm run check:voxel`, `npm run test:voxel:browser`,
   `npm run test:voxel:creative`, and the engine
   benchmark. Keep high-ID, invalid-format, shape/light and real-socket burst
   regressions. Do not refresh fingerprints to hide unexplained differences.
4. Review browser bundles, real-device performance and protocol/checkpoint
   compatibility before a new release. Matching content/engine artifacts are
   required; changing the upstream pin alone never authorizes deployment.
