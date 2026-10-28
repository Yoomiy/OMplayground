# Desktop creative evidence, 2026-10-22

This records build `fcc0e5d406c8dae970dde9df47afd3b77a5ac4a1530f55defa2dbab09a531a58`.
`verification.json` was written only after checking all client/server files
against `release.json` and matching both browser results to the engine/content
hashes in `build.json`. These are historical observations; rerun checks after
changing source or toolchains.

- `check.txt`: matched release build, types, static and main/worker bundle
  boundaries; 11 domain tests, 79 native tests (three debug helpers ignored),
  11 actual-Wasm tests, and two gateway scenarios against each of source and
  packaged server. Scenarios include late join, command replay, stale epochs,
  forged movement, burst time budgets and observer capabilities.
- `browser-wasm.json` / `.txt`: Node/Chromium/module-worker compute parity with
  production content and a synthetic 332-state manifest.
- `browser-creative.json` / `.txt`: two built Chromium clients walk/jump,
  target/place/remove a shared block, receive authoritative results and peer
  patches, reconnect with a fresh epoch, then dispose twice. Both finish with
  zero tracked geometry/texture/worker resources and no browser errors.
  Pointer capture and jump use trusted browser input; held movement and relative
  aim use DOM events through the normal runtime listeners to avoid headless
  pointer-lock automation latency. No test-only world mutation is exposed.
- `creative.png`: small software-rendered viewport after reconnect; basic
  avatars can overlap the spawn camera. Final avatar/spawn presentation remains
  part of stage 2.
- `audit.json`: isolated lockfile audit reports zero known advisories.

The browser uses Chromium 156 and SwiftShader on a two-core ARM cloud host.
This checks functionality, not hardware FPS, sustained memory plateau or school
device support. Admission is a loopback development policy. School/teacher
integration, full survival, durability, classroom service extraction, scale and
failure qualification, and production cutover remain outstanding. See the full
[implementation record](../../../../docs/voxel-runtime-rewrite-progress.md).
