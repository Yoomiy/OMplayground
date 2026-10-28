# Room worker timing measurements

Release `3ea11984a11a76d7d2993a55a882ed985827a6d1440e3336f3e8cf0612f5f508`
adds bounded timing distributions to the existing ten-second
`VOXEL_ROOM_METRICS` event. This makes actual worker step costs visible alongside
the [direct survival comparison](server-scaling.md). It adds no admission caps.

## What each distribution measures

| Prefix | Measured synchronous work |
| --- | --- |
| `worldStep` | One authoritative scheduler step, including movement, survival, subscriptions, replication, encoding and posting output to the supervisor. Each catch-up step is a separate sample. |
| `observerStep` | One paused observer-clock step, including its replication. This scheduler can run even with no connected observer. It does not advance world time. Ended rooms produce no step samples. |
| `workerTurn` | One four-millisecond interval callback, including authorization/lifecycle/projection work, zero or more world/observer steps, preparation and generation. |
| `generationJob` | One successful `generateOne()` call, including job selection, generation, insertion and edit replay. Empty job checks are included only in `workerTurn`. |
| `command` | One supervisor message handler, including synchronous join/input/control/checkpoint work and output posting. Async supervisor persistence and socket delivery are outside this measurement. |

Each prefix has `_samples`, `_meanMs`, `_p95UpperMs`, `_p99UpperMs` and `_maxMs`.
The event retains `ticks`, `columns` and `overrunMs`, and adds actual `windowMs`.
World-step sample count must equal `ticks`. A full paused window has zero world
steps; its observer-clock work is reported independently. A worker-turn percentile
cannot substitute for a world-step percentile because many turns execute no step.

Measurements use monotonic wall time, so they include descheduling and GC inside
the measured work. They are elapsed costs rather than CPU-cycle attribution.
Per-room distributions reset after each report. Five fixed histograms use about
156 KiB of bucket storage per room, with no retained individual samples or player
data. Buckets are 0.05 ms wide through 200 ms. Quantile fields are conservative
nearest-rank upper bounds, clamped to the observed maximum; if a quantile falls
in overflow, it reports the observed maximum. Empty windows report zero values
and `samples=0`, distinct from a measured zero-duration sample.

## Current local socket samples

The packaged socket driver runs alone on the two-core ARM64 Neoverse-N1 host,
Node 24.21.0, with three seconds of warmup and ten seconds of endpoint sampling.
Worker reporting windows include startup/warmup and differ from the endpoint
window. The following values are the maximum reported room percentile for each
layout, rather than pooled percentiles across rooms.

| Rooms × players | World step p95 upper (ms) | World step p99 upper (ms) | Input-ack p99 (ms) |
| ---: | ---: | ---: | ---: |
| 1 × 16 | 2.25 | 5.15 | 33.29 |
| 1 × 32 | 4.10 | 7.60 | 31.68 |
| 1 × 64 | 9.75 | 14.25 | 53.26 |
| 1 × 128 | 20.50 | 28.75 | 72.77 |
| 2 × 32 | 5.20 | 10.50 | 49.94 |
| 4 × 16 | 2.60 | 8.80 | 39.14 |

All six profiles deliver about 30 input batches/second, skip no driver batches,
report zero resyncs and zero dropped simulation time, and close every client and
room. Zero dropped time does not imply every step meets its budget: the 128-player
room has a 104.99 ms maximum world step and exceeds the proposed 10 ms p95 target.
The first profile's maximum generation job is 23.27 ms. The four-millisecond
generation scheduling window bounds when another job starts; it cannot preempt
a synchronous job already running.

These are single short, co-located movement/turn/jump samples with development
identity fixtures. They exclude rich survival activity, durable IO, real school
Auth, SFU, physical devices and impaired networks. They are not an isolated
before/after measurement of instrumentation overhead. The previous direct and
socket timings retain their original release identities; these results do not
establish a speedup over them or final school capacity.

## Verification and next work

The [worker-timings archive](../evidence/worker-timings/README.md) retains exact
sources/release bytes, the six socket profiles and a diagnostic CPU profile of
the preceding `5886a6dc9733` release. That profile covers one 128-actor pair per
scene, including startup, generation and audit hashing outside timed ticks. Its
sample totals identify remaining snapshot/encoding, subscription and drop work;
they are not a repeated performance qualification for this release.

Three histogram tests verify quantile error, overflow and reset. An actual-Wasm
case verifies separate catch-up and paused steps. A real worker case verifies
three reporting windows, including clean paused reset, in both source and packaged
execution. The full gate passes 97 domain, 80 native Rust (3 ignored), 87 Wasm,
44 source and 44 packaged integration cases. Service/web suites, strict types,
production web build, two-client browser cleanup, release verification and
eight-read-only-status/zero-room startup also pass.

Remaining work includes richer sustained worker/IO loads, longer travel/memory
runs, improvements to heavy-room timing, physical device/network qualification,
actual hosted school Auth/recovery, classroom rollout, product decisions and
cutover/legacy removal. The separate hosted-write run still awaits explicit
approval after automatic review rejected its temporary Auth/database/Storage
writes. This measurement increment does not require new migrations.
