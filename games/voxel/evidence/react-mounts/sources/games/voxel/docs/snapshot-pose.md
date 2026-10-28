# Snapshot pose reuse

Release `dc0be6db305ecd9b23c809e7fa9e9c370b354d04847ae31bbaa0461188235e86`
reduces repeated body reads and dense-neighbor distance work during replication.
Only `src/sim/game-room.ts` changes within the runtime source tree relative to
the preceding [drop-encoding release](drop-encoding.md). Engine, content, protocol,
encoders and admission rules retain their preceding contracts. No admission caps.

## Changes and invariants

A snapshot pass captures one raw pose per connected actor. Playing actors reuse
their quantized public body vector for their own self snapshot; epoch and input
ack remain per viewer. Preparing/dead actors still get their own quantized self
without becoming public actors. Captures live for that synchronous pass only;
later ticks, teleports and checkpoints read new state. Previously, a playing actor
normally required three Wasm body reads and two quantization passes per snapshot.

The distance check uses a conservative Manhattan diamond of radius 47 strictly
inside the existing 48-block circle. Dense neighbors inside that diamond need
no `hypot`; every other case keeps the previous `Math.hypot(dx,dz)>48` comparison.
The existing quantized-other/raw-viewer coordinates, circle boundary and hidden
observer rules remain unchanged. This is an interior shortcut, not a new radius.

An actual-Wasm before/after journey compares exact per-viewer message histories
against pinned preceding room bytes. It covers the interior shortcut, axis and
diagonal circle boundaries, quantization edges, preparing actors, hidden staff,
paused replication and immutable historical messages. Existing shared-delta,
private-self, teleport/reconnect, survival and transport checks also pass.

## Repeated direct measurements

Run `VOXEL_BENCH_BASELINE=drop-encoding npm --prefix games/voxel run benchmark:survival`.
The baseline room SHA-256 is
`47410a364fc73bfd204cc3d3faf56fa7fb5ed5ad931acc834d8c895f8ff91d8d`;
both variants use their own matching, unchanged encoder, SHA-256
`07a2e205eb1abc1f040797d32025ba90eb0776f1e53fe878bc9f1680824594ed`.

On the two-core ARM64 Neoverse-N1 host, Node 24.21.0, all 24 alternating pairs
(three repeats per scene/size, 48 runs) match exact recipient-ordered wire hashes,
bytes and message counts. Each run has 90 warmup and 600 measured ticks. Median
per-run p95 elapsed simulation/input/encoding costs are:

| Players | Movement before → after (ms) | Craft/drop/TNT before → after (ms) |
| ---: | ---: | ---: |
| 16 | 0.95 → 0.96 | 2.14 → 1.99 |
| 32 | 1.91 → 1.69 | 4.30 → 4.17 |
| 64 | 4.06 → 3.49 | 10.12 → 9.70 |
| 128 | 11.21 → 9.73 | 26.86 → 25.74 |

The 128-player movement reduction is about 13%; activity improves about 4%.
All three 128-player movement p95 values are below the proposed 10 ms budget.
The 64-player activity median is below it, but one run is 10.08 ms. The larger
activity scene remains substantially over budget. Some smaller movement/tail
samples are slower; every raw result is retained.

These are synthetic-time compute/input/encoding comparisons. Activity uses
fixture-owned equipment/materials, normal crafting, injected drops/TNT and
12 measured explosions in every run. Generation batches and transcript hashing
are outside the timed step. Real worker scheduling, sockets, persistence, school
Auth, browsers and voice are outside this direct comparison. It is not natural
progression or final capacity evidence.

## Actual worker samples

The six packaged loopback profiles use three seconds of endpoint warmup and
25 seconds of sampling. All rooms have a fully contained worker reporting window;
all other windows are also retained. The table reports the maximum room quantile
upper bound per layout, not a pooled percentile across rooms:

| Rooms × players | Steady world p95 upper (ms) | Steady world p99 upper (ms) | Endpoint ack p99 (ms) |
| ---: | ---: | ---: | ---: |
| 1 × 16 | 0.95 | 1.00 | 23.61 |
| 1 × 32 | 1.95 | 2.35 | 53.39 |
| 1 × 64 | 6.60 | 8.20 | 74.15 |
| 1 × 128 | 20.25 | 22.20 | 99.54 |
| 2 × 32 | 3.10 | 4.20 | 49.75 |
| 4 × 16 | 1.05 | 2.50 | 60.09 |

Every profile runs near 30 Hz without skipped driver batches, resyncs or reported
dropped simulation time, and every client/room closes. The 128-player all-window
p95 upper bound is 21.55 ms. Steady worker costs still exceed the proposed budget
despite the direct movement improvement. These single co-located movement samples
include descheduling/GC and load-driver work; they are not a controlled worker
before/after comparison, rich survival, a physical network or school capacity.

## Qualification and open work

The [snapshot-pose archive](../evidence/snapshot-pose/README.md) preserves current
sources/release bytes, all comparisons, full/steady socket windows, browser and
build/startup evidence. Replacing only the current room source with the preceding
bytes reconstructs that prior runtime hash. The preceding archive is unchanged.

Final gates pass 103 domain, 80 native Rust (3 ignored), 89 Wasm and 44 source
plus 44 packaged integration cases. All 50 service and 180 web tests, strict
types, production web build, two-client browser cleanup, release verification and
guarded eight-read-only-status/zero-room startup pass. An initial service run
overlapped game compilation and two inventory checks rejected partial artifacts;
those failures are retained separately. Stable-release verification and the full
service rerun pass after compilation finishes.

Heavy survival/worker costs, sustained rich IO/load/memory tests, physical device/
network qualification, actual hosted school Auth/recovery/classroom journeys,
product decisions and cutover/legacy retirement remain required. The separate
rejected hosted-write test still awaits explicit approval. No migrations changed.
