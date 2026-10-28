# Persistent visibility membership

Release `543c9f288891986e003ce4b2e51c63177c38c14601f4ac8c3b6b1144fd0c3077`
retains each viewer's actor-membership map between snapshot passes. Only GameRoom
changes in the runtime source tree relative to [snapshot pose reuse](snapshot-pose.md).
Engine, content, wire schema, encoders and admission rules remain unchanged.
There are no player, observer, object or room admission caps.

## Profiling evidence and scope

A diagnostic actual-worker run of the preceding `dc0be6db305e` release records
both the main thread and room worker. It uses one 128-player packaged loopback
room, including startup, warmup and co-located load clients. Approximate sampled
attribution over 29 seconds includes:

| Thread | Frame | Sampled time (s) |
| --- | --- | ---: |
| Main: gateway + clients | Socket `writev` | 4.88 |
| Main: gateway + clients | Load-client receive callback | 4.56 |
| Main: gateway + clients | `postMessage` | 1.11 |
| Room | Snapshot construction | 3.39 |
| Room | Wasm `player_state` binding | 1.48 |
| Room | Encoder | 0.75 |
| Room | Garbage collection | 0.54 |

The worker snapshot path remains substantial, while the harness also has material
receive/write work. These are sampled wall-time attributions, including scheduler
effects and profiling overhead, not exclusive CPU-cycle or steady-window costs.
The original profiles, matching old executable bytes/maps and report are retained;
they are not relabeled as final-release qualification.

## Membership reuse and event order

Each public ActorState wrapper is fresh for a synchronous snapshot pass. Updating
a viewer's existing map to those fresh objects marks its visible actors without
allocating a new membership map on every pass. Unique connected IDs let the room
skip stale-member scanning when the visited count equals the map size. When the
counts differ, old object references identify members that are no longer visible.
The count is an internal algorithm check, not an admission threshold.

Each viewer retains separate membership and visibility filtering. Public actor
states remain immutable after publication; later passes create new wrappers.
That freshness is required for the stale-membership check. Membership changes
rebuild connected-actor order, so an older actor leaving/re-entering cannot move
behind newer actors in later removal or teleport-reset messages. The expanded
actual-Wasm differential journey compares exact histories through that sequence,
alongside circle/quantization boundaries, preparing actors, hidden staff, paused
replication and historical message retention.

## Repeated direct measurements

Run `VOXEL_BENCH_BASELINE=snapshot-pose npm --prefix games/voxel run benchmark:survival`.
Both variants use their own matching unchanged encoder. Three alternating pairs
per size/scene have identical recipient-ordered wire hashes, byte counts and
message counts. Each run has 90 warmup and 600 measured ticks, on Node 24.21.0,
two available ARM64 Neoverse-N1 CPUs. Median per-run p95 is:

| Players | Movement before → after (ms) | Craft/drop/TNT before → after (ms) |
| ---: | ---: | ---: |
| 16 | 0.82 → 0.84 | 2.13 → 2.03 |
| 32 | 1.70 → 1.62 | 4.20 → 4.18 |
| 64 | 3.66 → 3.37 | 9.88 → 9.55 |
| 128 | 9.80 → 8.73 | 25.97 → 25.29 |

The 128-player movement reduction is about 11%, activity about 3%. Smaller/tail
results include slower after samples. The larger activity scene remains over the
proposed 10 ms p95 budget. This is synthetic-time simulation/input/encoding;
fixture-owned crafting materials/equipment, injected drops/TNT and 12 measured
explosions per activity run do not establish natural progression, real worker/IO
performance or capacity. Generation and transcript hashing are outside tick time.

The initial map-reuse variant `70c5672eebc1` still scanned old memberships on every
pass. Its separate 24-pair comparison showed modest/mixed gains: at 128 players,
movement 9.83→9.48 ms and activity 25.44→25.08 ms. Its full 48 runs, exact room
source, release bytes and core log are retained separately. The refinement then
skips scanning only when count equality proves complete membership. Cross-run
host variability prevents treating the two after medians as a controlled comparison
of variants. Neither result set is discarded or relabeled.

## Actual worker samples

All six packaged profiles use three seconds of warmup and 25-second endpoint
samples, with complete authoritative steady-window coverage. Values below are
maximum room quantile upper bounds, not pooled percentiles across rooms:

| Rooms × players | Steady world p95 upper (ms) | Steady world p99 upper (ms) | Endpoint ack p99 (ms) |
| ---: | ---: | ---: | ---: |
| 1 × 16 | 1.00 | 1.05 | 19.53 |
| 1 × 32 | 1.80 | 2.20 | 56.54 |
| 1 × 64 | 5.05 | 6.20 | 23.64 |
| 1 × 128 | 18.25 | 20.10 | 116.61 |
| 2 × 32 | 3.65 | 5.50 | 53.37 |
| 4 × 16 | 1.00 | 1.65 | 49.21 |

All finish near 30 Hz without skipped driver batches, resyncs or reported dropped
time; every client/room closes. The 128-player steady cost remains over the proposed
budget. These single co-located movement samples include scheduling/GC and driver
work; they do not prove a controlled worker speedup, rich survival, school-network
latency or capacity. The direct fixture uses short `aN` identities, while sockets
use `roomN-actorN`; neither reproduces the full actual school identity/IO workload.

## Qualification and remaining work

The [visibility-reuse archive](../evidence/visibility-reuse/README.md) preserves the
diagnostic profiles, both comparison phases, final full/steady worker windows,
exact source/release identities and browser/build/startup results. Reconstructing
the preceding and initial-candidate runtime hashes by replacing only GameRoom
succeeds. The preceding archive remains unchanged.

Final gates pass 103 domain, 80 native Rust (3 ignored), 89 Wasm and 44 source
plus 44 packaged integration cases. All 50 service and 180 web tests, strict
types, production web build, actual two-client cleanup, release verification and
guarded eight-read-only-status/zero-room startup pass. Heavy survival/scaling,
sustained rich worker/IO/memory and physical device/network qualification, real
hosted Auth/recovery/classroom journeys, product decisions and cutover/legacy
retirement remain required. The separately rejected hosted-write test still
awaits explicit approval. No migrations changed.
