# Server replication and workload measurements

The snapshot-scaling release recorded below is
`5886a6dc973378530fbe79b71c007eccfdd440fdbde064dc3cd2938ea363aa57`.
It reuses actor-delta calculation and serialization across viewers without
changing the wire protocol, movement, visibility or private inventory model.
These measurements are workload samples, not admission limits or production
capacity signoff. Player, observer and room counts do not restrict admission.

## Replication reuse

Each snapshot pass builds one public state per actor. Viewers commonly share
the same previous state object. The room computes the corresponding delta once
and reuses that immutable object across those viewers. Visibility filtering
still happens separately for every viewer, including hidden staff rules.

The worker's `SnapshotEncoder` reuses the shared delta's JSON during that pass.
It encodes every viewer's private `self` independently. Both world tick and
monotonic time delimit the cache, since paused observers can move while the
world tick stays fixed. Other message types retain normal JSON encoding.
Three unit cases and an actual-Wasm room case cover all delta shapes, identity
escaping, split snapshots, private-self separation, different baselines for the
same actor, paused time and immutable historical output. Subsequent
[worker timing instrumentation](worker-timings.md) has its own release and evidence.

## Comparative survival compute

`npm --prefix games/voxel run benchmark:survival` runs the pinned previous room
implementation and current implementation on the same engine/content. The old
source is retained in the media-composition archive and checked by SHA-256.
There are 90 warmup ticks and 600 measured ticks per run, three alternating
before/after pairs per workload. This is synthetic 30 Hz simulation time, not a
real-time server clock. The measured interval includes input dispatch, scripted
activity, complete survival simulation and actual JSON/chunk encoding. Audit
hashing and generation batches are measured outside that interval.

The natural seed-4242 scene keeps actors densely colocated, turning and jumping.
The activity variant uses fixture-owned picks/vests/boots/logs, verified normal
crafting transactions, dropped bodies and primed TNT. Resource grants and object
injection are explicit workload preparation/activity fixtures; they do not prove
natural progression or client authorization. The measured activity window has
successful crafting and 12 explosion events in every run. Socket/worker
scheduling, persistence, school Auth, browser rendering and voice are excluded.

On Node 24.21.0, ARM64, two available Neoverse-N1 CPUs, the median of the three
per-run p95 values is:

| Actors in one dense room | Motion before → after (ms) | Craft/drop/TNT before → after (ms) |
| ---: | ---: | ---: |
| 16 | 1.40 → 1.27 | 3.22 → 3.03 |
| 32 | 3.35 → 2.51 | 6.76 → 5.92 |
| 64 | 9.73 → 5.32 | 16.90 → 13.75 |
| 128 | 31.44 → 14.10 | 48.79 → 35.25 |

All 24 pairs have identical recipient-ordered wire hashes, byte counts and message
counts. The 128-actor reductions are about 55% for motion and 28% for activity.
The heavier 64/128-actor samples still exceed the proposed 10 ms p95 budget;
the 128-actor activity p99 is about 41 ms. These results leave further profiling
and scaling work; they do not justify caps or a claim of release qualification.

The comparison was captured on build `87695b80ba09`. The subsequent backpressure
fix changes only the gateway within the runtime source tree. Reconstructing that
earlier runtime hash with the saved old gateway succeeds, and the measured room,
encoder, engine and content hashes match that final snapshot-scaling release. The archive
keeps this component comparison's original build identity. It does not relabel
the old timing run as a new complete-release measurement.

## Real worker and socket samples

`npm --prefix games/voxel run benchmark:sockets` starts packaged gateways/native
room workers and real loopback WebSocket clients. The maintained driver uses a
monotonic 30 Hz batch schedule with two ordinary input frames per batch. It skips
missed driver batches instead of creating a catch-up burst. Profiles have three
seconds of warmup and a ten-second sample. Each profile checks that all clients
receive acknowledgements, have no unexpected close, and close along with all
room workers at teardown.

Final-build samples:

| Rooms × actors per room | Input-ack p99 (ms) |
| ---: | ---: |
| 1 × 16 | 41.09 |
| 1 × 32 | 46.76 |
| 1 × 64 | 33.68 |
| 1 × 128 | 156.37 |
| 2 × 32 | 46.58 |
| 4 × 16 | 28.95 |

All six complete without resync or reported dropped simulation time. Endpoint
sampling observes about 29.8 ticks/second; worker metrics report 299–300 ticks
in their ten-second intervals. Those metric intervals can include startup and
warmup and are not per-tick cost percentiles. The 128-player driver misses one
batch slot in this sample. Acknowledgement latency includes the co-located load
clients' event loop, differs with timer phase and has only one short sample per
profile. It is not a school-network latency measurement or a scaling law.
This socket scene covers movement/turning/jumping, not the richer activity scene.

The profile lists and durations are configurable through `VOXEL_BENCH_PLAYERS`,
`VOXEL_BENCH_REPEATS`, `VOXEL_BENCH_TICKS`, `VOXEL_BENCH_LAYOUTS` (for example
`1x64,2x32`) and `VOXEL_BENCH_SECONDS`. These are benchmark inputs, not application
admission settings.

## Backpressure correctness

Review found a separate defect: the gateway silently dropped snapshot deltas
above 64 KB of queued output after the room had already advanced its viewer
baseline. A final change could therefore disappear permanently. Snapshot-only
traffic also returned before the existing hard output-budget check.

The gateway now preserves the ordered stream under the existing shared 1 MB
budget. Exceeding that budget emits the bounded `VOXEL_BACKPRESSURE_RECOVERY`
event and closes only the affected socket with retryable code 1013. Fresh
admission supplies a new baseline. This is a per-connection work budget and
does not restrict actor or room counts.

Two real-socket/native-worker regressions fail before and pass after: final yaw
delivery under temporary pressure, and isolated over-budget recovery/readmission
while healthy peers continue. The pressure counter is injected deterministically;
these tests do not establish physical TCP stalls, packet loss or school-network
qualification. Both cases also pass against the packaged gateway.

## Release evidence and open gates

The [snapshot-scaling archive](../evidence/snapshot-scaling/README.md) retains the
timing runs, exact source/release identities, original pressure failures, final
socket/browser checks and passing core/service/web checks. Final core counts are
94 domain, 80 native Rust (3 ignored), 86 Wasm and 43 source plus 43 packaged
integration cases. The two-client browser verifies actual peer presentation,
origin shifts, held shapes and cleanup. All 50 service and 180 web tests, strict
types, production web build, release verification and eight-read-only-status
startup also pass. Production web bytes are inventoried, not copied as a final
standalone deployment bundle.

Remaining gates include sustained survival with mining/containers/combat and
durable IO across actual workers, longer repeated travel/load/memory runs,
continued measurement using worker tick-cost distributions, actual 50–150 ms networks and one-to-five
second stalls/backpressure, school workloads and device budgets, hosted
Auth/recovery, classroom rollout, product decisions and full cutover/retirement.
The separate hosted-write check remains pending explicit user approval after
automatic approval review rejected its temporary Auth/database/Storage writes.
