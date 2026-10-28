# Foundation evidence, 2026-10-22

`check.txt` is the local root `npm run check:voxel` output: matching content/Wasm
build, type/import gates, eight domain/content tests, 79 native invariants
(three debug-image helpers ignored), and five actual-Wasm/socket tests.
`build.json` identifies that engine, generated JS bindings, production content
and format versions. `browser-wasm.json` tests that same Wasm and production
content plus a synthetic 332-state manifest in Node/Chromium/module workers.
`engine-benchmark.json` measures the same production artifact/content.

These are recorded observations, not a substitute for rerunning the commands.
The source and reproduction steps are in `../../README.md` and `../../tools/`.
This does not verify the future rendered client, real school devices, full
survival, multi-room capacity, school integration, durability or cutover.
The complete remaining scope is in the repository's rewrite progress document.
