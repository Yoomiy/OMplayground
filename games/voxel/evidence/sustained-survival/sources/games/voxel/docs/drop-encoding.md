# Drop encoding and steady worker windows

Release `937183f45298044f5c58f4d985c4b55ff77a5b3dd90e7a2ccaee44be4f2ef788`
reuses JSON for immutable public drop replicas and records authoritative worker
metric bounds. This follows [subscription/drop reuse](room-reuse.md); it adds no
player, observer, object or room admission caps.

## Public drop encoding

The room already creates an immutable public drop view per body revision.
The worker encoder now reuses that view's JSON across viewers and reporting
passes. Its weak-key cache does not keep a removed body/view alive. Views must
have frozen outer data, position, stack and optional instance data before entering
the cache. Mutable or shallowly frozen inputs retain normal serialization.
Reset flags, removed IDs, viewer filtering and private inventory are encoded
independently. The wire schema and recipient ordering are unchanged.

Two additional encoder cases verify reuse across viewers/passes, fresh revision
data, historical immutability, escaped identities, empty/reset/removal messages,
and mutable/nested-mutable fallback. Existing real-room drop, pickup, recovery and
transport cases continue to pass.

## Repeated direct comparison

`VOXEL_BENCH_BASELINE=room-reuse npm --prefix games/voxel run benchmark:survival`
uses the preceding room source and its own pinned encoder. Each variant uses
its actual encoder; a new optimization cannot silently benefit the baseline.
The original and worker-timings baseline options remain available.

All 24 alternating pairs (48 runs, three repeats per scene/size) preserve exact
recipient-ordered wire hashes, bytes and message counts. Each run has 90 warmup
and 600 measured ticks on the two-core ARM64 Neoverse-N1 host, Node 24.21.0.
Median per-run activity-scene elapsed costs are:

| Players | p95 before → after (ms) | p99 before → after (ms) |
| ---: | ---: | ---: |
| 16 | 2.10 → 2.09 | 3.71 → 2.81 |
| 32 | 4.41 → 4.34 | 6.93 → 4.98 |
| 64 | 10.63 → 10.44 | 14.91 → 11.38 |
| 128 | 28.60 → 27.48 | 36.61 → 30.30 |

The 128-player p99 reduction is about 17%; p95 improves about 4%. Movement-only
p95 is effectively unchanged (11.32→11.27 ms at 128). Smaller movement tails
include slower after samples; the complete raw results remain in the archive.
This change mainly improves activity tails and does not resolve the proposed
10 ms p95 budget at larger sizes.

Activity uses fixture-owned equipment/materials, normal crafting transactions,
injected drops/TNT and 12 measured explosion events per run. This is synthetic
simulation/input/encoding time, excluding real worker scheduling, sockets,
persistence, school Auth, SFU and browsers. It is not natural progression or
capacity qualification. A new diagnostic CPU profile retains its preceding
`6b20c88f7d8c` release identity and includes untimed harness/startup/generation/
hashing work; it is not a current-release qualification.

## Authoritative steady-window measurements

`VOXEL_ROOM_METRICS` now includes process-monotonic `windowStartedAtMs` and
`windowEndedAtMs`, with their difference equal to existing `windowMs`. Worker
tests verify adjacent windows meet exactly and the worker clock shares the
supervisor's monotonic time base. These values are not wall-clock timestamps.

The socket driver defaults to three seconds of endpoint warmup and a 25-second
sample. It retains every worker window in `roomMetrics` and selects only those
fully contained in endpoint sampling into `steadyRoomMetrics`. Selection uses
actual worker bounds, never a delayed receipt timestamp. Every room must have
coverage in the default current-release run. Short custom samples may report
partial coverage. Archived releases without bounds report coverage unavailable.
Missing, nonfinite, reversed or inconsistent bounds cannot claim containment.

All six current profiles have complete coverage. The following are maximum
reported room quantile upper bounds, not pooled quantiles across rooms:

| Rooms × players | Steady world p95 upper (ms) | Steady world p99 upper (ms) | All-window p95 upper (ms) | Endpoint ack p99 (ms) |
| ---: | ---: | ---: | ---: | ---: |
| 1 × 16 | 1.15 | 2.70 | 1.40 | 35.95 |
| 1 × 32 | 2.15 | 2.65 | 2.85 | 51.28 |
| 1 × 64 | 7.45 | 8.95 | 8.70 | 78.69 |
| 1 × 128 | 24.00 | 26.35 | 25.35 | 120.69 |
| 2 × 32 | 3.45 | 4.75 | 3.95 | 42.89 |
| 4 × 16 | 1.35 | 2.75 | 2.35 | 45.43 |

Each room contributes two full reporting windows, one wholly inside sampling.
All profiles finish near 30 Hz without skipped driver batches, resyncs or
reported dropped time, and close every client/room. The 128-player steady p95
still substantially exceeds the proposed 10 ms target: startup does not fully
explain the cost. Timings include descheduling/GC and the co-located load driver.
These single local movement samples are not isolated before/after worker evidence
for drop encoding, rich survival, a physical school network or final capacity.

## Verification and open work

The [drop-encoding archive](../evidence/drop-encoding/README.md) preserves current
sources/release bytes, all direct comparisons, every full/steady socket window,
browser cleanup and build/startup evidence. The full gate passes 103 domain,
80 native Rust (3 ignored), 88 Wasm and 44 source plus 44 packaged integration
cases. All 50 service and 180 web tests, strict types, production web build,
actual two-client browser cleanup, release verification and guarded eight-read-only
status/zero-room startup pass. The previous room-reuse archive remains unchanged.

Heavy-room costs, sustained rich worker/IO/memory loads, real device/network
qualification, actual hosted school Auth/recovery/classroom journeys, product
decisions and cutover/legacy retirement remain open. The separately rejected
temporary hosted-write test still awaits explicit approval. No migrations changed.
