# Voxel runtime experiments

Experimental work only, on `research/voxel-runtime-rewrite`. No application integration, production fixes, save migration, or backward compatibility work. Existing worlds are disposable test worlds.

Follow-on design: [full voxel rewrite proposal](../../docs/voxel-runtime-rewrite-proposal.md). It proposes a new architecture; existing code has no preservation requirement.

Candidate: [Blockyard a79346108fc5ed3b68e3827608fdb448e5a7e5db](https://github.com/Potrock/blockyard/tree/a79346108fc5ed3b68e3827608fdb448e5a7e5db).

Recorded 2026-10-21. Playground baseline commit: `4784c0b3ed2fe0683cedcbe3748c5c4198fd9909`.

## Decision

Blockyard's engine and world/render pipeline merit adoption as the starting point for the later rewrite. These probes support that direction; they do not establish production readiness or hardware rendering performance. Avoid building another voxel engine from scratch before exhausting this option.

Keep the Playground application and service integrations. Carry useful content/rules over through adapters, without preserving the old runtime or numeric IDs. Reconsider the registry and fix movement time accounting before adopting the candidate. No candidate fixes are included in this experiment.

## Method and limits

- Host: two ARM Neoverse-N1 CPU cores, about 12 GB RAM, Linux, Node 24.21.0. Measurements are synchronous wall-clock timings on this shared VPS, not calibrated hardware comparisons.
- Built the pinned engine in release mode with upstream wasm-pack/wasm-opt settings. Wasm artifact: 638,210 bytes. All candidate builds and dependencies are in `/tmp/voxel-runtime-experiment-blockyard`; temporary Rust toolchain is under `/tmp/voxel-runtime-{cargo,rustup}`. A system C/C++ build toolchain was also installed to compile Rust dependencies.
- Scalar generator baseline imports our TypeScript source directly. Candidate benchmarks use the actual compiled Wasm engine and simulation classes, not native Rust timings.
- Timing probes ran separately from upstream tests. Small sample counts and one seed deliberately keep this evaluation cheap. No confidence intervals or sustained capacity claims.
- Browser checks use Chromium SwiftShader. They are functional checks only, with reduced graphics and a tiny viewport. They cannot establish real-device FPS, graphics quality, or responsiveness.

## Measured engine work

Seed 4242; 81 generated 16×16×256 columns, 49 meshed columns with complete 3×3 neighborhoods. Five generation calls warm the candidate before measurement. Times include the Wasm binding calls and their buffers.

| Candidate operation | Mean | p95 | Samples |
| --- | ---: | ---: | ---: |
| Generate a natural terrain column | 2.20 ms | 3.82 ms | 81 |
| Insert generated column into world | 0.026 ms | 0.044 ms | 81 |
| Extract neighborhood for a mesh job | 0.101 ms | 0.114 ms | 49 |
| Lighting + mesh, natural terrain | 2.67 ms | 3.55 ms | 49 |
| Extract + lighting + mesh, mixed block variants | 3.40 ms | 4.16 ms | 30 |
| Extract + remesh nine neighboring columns, serial | 26.30 ms | 26.70 ms | 10 |

Generated data averages 19.1 kB per column; extracted mesh neighborhoods average 160.3 kB; resulting mesh buffers average 39.3 kB. The engine memory high-water mark at this point is 5.5 MiB for this single instance. Removing the 81 loaded columns leaves a zero loaded-column count. This is not a memory-leak or worker-memory test.

Our generator: 25 columns at the same seed and coordinates -2..2, traversed as sixteen 16³ cubes per column, matching the client's scalar-call order. Full columns average 8.21 ms, p95 22.65 ms, max 35.39 ms. Individual cubes average 0.50 ms, p95 2.27 ms, max 17.18 ms. This excludes NOA ndarray population, meshing, rendering, and transfer. A full Uint16 column is 128 KiB.

The two generators produce different terrain and features, and use different caches/layouts. These numbers establish practical workload costs; they do **not** establish a Rust-versus-TypeScript speed ratio. The serial nine-column remesh cost also reinforces the need for worker scheduling and bounded uploads, even with the faster engine.

## Minimal authoritative room costs

Flat/void world, no survival rules or mobs; 30 Hz; two numbered movement inputs per player per tick; 90 warmup ticks followed by 300 measured ticks. RoomCore includes simulation, frame patches, JSON encoding, and simulated sends. Bytes are uncompressed UTF-8 payload bytes; socket I/O and compression are excluded. Direct storage edits are sampled separately and do not exercise the complete gameplay/edit-broadcast path.

| Players | Movement | Mean tick | p95 | p99 | Raw output per player |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Walking/turning | 0.301 ms | 1.213 ms | 3.637 ms | 5.0 kB/s |
| 8 | Idle controls | 0.420 ms | 0.524 ms | 0.628 ms | 12.8 kB/s |
| 8 | Walking/turning | 0.502 ms | 0.616 ms | 3.845 ms | 19.2 kB/s |
| 16 | Walking/turning | 0.972 ms | 1.046 ms | 4.300 ms | 35.8 kB/s |

There is headroom for a minimal room. This does not answer how many full survival rooms the VPS can host. Output grows substantially with player count; reconsider interest management and update policy before adding elaborate binary networking. We have not measured compression cost, persistence, multiple concurrent worker rooms, or sustained survival workloads.

## Prediction and input authority

Custom prediction probe: 15 simulated seconds, 60 Hz input, 30 Hz server. Uses identical ground definitions on client and server. Both fixed 50 ms delays each way and reliable ordered jitter (50–167 ms each way plus a 300 ms input interruption) yielded zero measured correction before the intentional server shove. The shove produces a correction in both cases. Under jitter the acknowledged input lag reaches 37 inputs: position agreement alone does not prove good latency recovery or feel. This is simulated delivery, not network emulation.

**Failing invariant: input bursts can buy extra movement time.** A separate reproducer uses real WebSocket connections and the server's default validation/rate limit:

- Normal client: 58 movement messages, 3.88 blocks in about 1.05 seconds.
- Burst client: 60 initial valid inputs of `dt=0.1`, followed by normal inputs; 118 messages total, 27.84 blocks in about 1.06 seconds.
- Both remain connected, below the default 300 messages/second limit. Cheats are disabled.

The queue-over-30 catch-up path in `src/platform/host/game.ts::moveInputs` bypasses the earned movement-time bank. The architecture is worth adopting, but this implementation needs bounded catch-up based on server time. The final reproducer intentionally fails when the invariant is violated. No patch or upstream report was submitted.

## Static fit

- Blockyard reserves 187 built-in variants and leaves 68 custom variant slots (IDs 187..254); 255 is a sentinel. Our content has 111 block definitions. Overlapping built-ins can be reused, but adding all our blocks as custom definitions will not fit. Orientations/halves also consume variant IDs. Decide whether to replace built-ins or widen storage/serialization to Uint16 before expanding content.
- World height is 256 blocks. Accept or change that deliberately; no experiment is needed to discover the limit.
- The Rust/Wasm pipeline is operational here, and the artifact size is modest. Additional toolchains are justified by reuse of working generation, shape collision, lighting, meshing, culling, and prediction-related primitives, rather than a generic language-speed claim.
- The existing Playground content/rules and teacher/session/voice integrations remain useful inputs to the future rewrite. The probes do not integrate them.

## Test record

- Eight selected upstream headless files pass: `predict`, `multiplayer`, `server`, `blocks`, `blockshapes`, `stairs`, `delta`, `freeze`. Includes real two-player sockets, late edits/joining, ladder prediction, and protocol reconstruction.
- Native release engine suite: **77 passed, 1 failed, 3 ignored**. Failure: `shapes::tests::built_in_physics_and_rays_are_unchanged`. It is a hard-coded floating-point fingerprint. Upstream CI explicitly runs engine fingerprints on macOS because Linux libm differs; this is consistent with the observed Linux failure, not independently proven as its sole cause. Do not call this suite green. Wasm movement/prediction tests pass separately.
- Candidate `tsc --noEmit` passes with both TypeScript probe files included.
- Browser smoke **passes**: two Chromium clients join, create four engine workers, observe the exact glowstone edit in both block stores, render meshes, and stream terrain during a 96-block teleport out and back. No page errors. Mesh upload queues are empty at final capture; generation/meshing can resume as the camera settles. This does not test prolonged memory stability, all visual effects, or real hardware FPS. The first attempt hit a harness timeout; the successful run uses corrected timeout options and a 320×180 viewport at 0.5 render scale. The harness now has a 120-second overall deadline for future runs.
- Final real-socket input-time test **fails**, as intended by the reproducer: normal client 3.88 blocks versus burst client 27.84 blocks over approximately 1.05 seconds, with both connections open and under the message-rate limit. This remains unfixed in the candidate.

Raw records are retained locally under `research/voxel-runtime/results/`: `blockyard.json`, `current-worldgen.json`, `browser-smoke.json`, `input-time-socket.json`, `engine-tests.txt`, `headless-tests.txt`, and `input-time-socket.txt`. The raw records and probe source files are not included in the documentation-only commit; the measurements and failures are summarized above so this report stands alone.

## Reproduce

Use a separate checkout at the pinned commit; install its lockfile dependencies and build its engine using `npm run wasm`. Engine build requires Rust's wasm32 target and a native C toolchain. `npm ci` on this host required explicitly allowing/running wasm-pack's installer.

The commands below record the local experiment workflow. Custom probes require the locally retained scripts; checking out the documentation alone does not provide those scripts. Upstream tests can be rerun directly from the pinned candidate checkout.

From the candidate checkout:

```sh
cp /home/ubuntu/OMplayground/research/voxel-runtime/probe.ts tests/headless/_playground-probe.ts
cp /home/ubuntu/OMplayground/research/voxel-runtime/input-time-socket.ts tests/headless/_playground-input-time-socket.ts
node scripts/headless.mjs tests/headless/_playground-probe.ts
node scripts/headless.mjs tests/headless/_playground-input-time-socket.ts
cargo test --release --manifest-path engine/Cargo.toml
node scripts/headless.mjs tests/headless/predict.ts tests/headless/multiplayer.ts tests/headless/server.ts tests/headless/blocks.ts tests/headless/blockshapes.ts tests/headless/stairs.ts tests/headless/delta.ts tests/headless/freeze.ts
```

The input-time test is expected to fail until the candidate bug is fixed. Its observations are written before the assertion. Main probe output defaults to `/tmp/voxel-runtime-blockyard-results.json` (override with `PROBE_OUTPUT`); socket observations go to `/tmp/voxel-runtime-input-time-socket.json`.

From Playground, run `node_modules/.bin/tsx research/voxel-runtime/current-worldgen.ts` for the current-generator sample. For browser smoke, start the candidate with `node scripts/dev.mjs --port 5193 --server-port 8893 sandbox --rooms 1 --data /tmp/voxel-runtime-browser-data --new`, then run `browser-smoke.cjs` with `PLAYWRIGHT_MODULE` pointing to an installed Playwright package. `PROBE_URL`, `PROBE_OUTPUT`, and `PROBE_SCREENSHOT` are optional overrides. The local server is stopped at the end of this evaluation.

Actual GPU performance, our survival gameplay integration, long sessions, and multi-room capacity remain unproven. Those belong in a later implementation spike once we decide to proceed, rather than extending this exploratory work.
