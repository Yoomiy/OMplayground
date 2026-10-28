# Subscription and drop replication reuse

Release `6b20c88f7d8c9e7b6158c26d02524c24a419cc03b5fc9b2d53a90c083066da47`
reduces repeated room work identified by the preceding CPU profile.

Subscriptions rebuild their complete nearby-column set only when the actor
crosses a column boundary or the subscription incarnation is invalidated.
Normal world/observer steps reuse the state already read for that actor. Explicit
resync baselines and edit patches remain independent. Disconnect and teleport
clear the cached center; reconnect creates fresh actor/subscription state.
Near-edge clipping and baseline priority/order retain the existing rules.

Drop replication reuses an immutable public view per live body's revision.
Movement and partial pickup change that revision, producing a fresh view without
mutating an earlier message. Radius filtering and visibility maps remain per
viewer. The ordinary pickup query still returns owned copies. Private owner,
pickup timing, expiry and velocity fields never enter the shared view. Weak
keys avoid retaining removed bodies, and dispose clears the view cache. There
are no actor, observer, object or room admission caps.

## Repeated direct survival comparison

`VOXEL_BENCH_BASELINE=worker-timings npm --prefix games/voxel run benchmark:survival`
compares against the pinned preceding room source, SHA-256
`4d99be037c3f3136592b129827b914358f6a53bbdde091cd5a47a94bff9ce918`.
Both variants use the existing shared snapshot encoder. The default `original`
baseline retains the earlier pre-snapshot-reuse comparison.

On the two-core ARM64 Neoverse-N1 host with Node 24.21.0, three alternating pairs
per scene/size have identical recipient-ordered wire hashes, byte counts and
message counts. Each run has 90 warmup and 600 measured ticks. Median per-run
p95 elapsed simulation/input/encoding cost is:

| Players | Movement before → after (ms) | Craft/drop/TNT before → after (ms) |
| ---: | ---: | ---: |
| 16 | 1.47 → 0.99 | 3.04 → 2.13 |
| 32 | 2.54 → 1.86 | 5.97 → 4.52 |
| 64 | 5.43 → 4.04 | 14.00 → 10.52 |
| 128 | 14.29 → 11.40 | 35.99 → 29.00 |

The 128-player reductions are about 20% and 19%. Both scenes at 128 players and
the 64-player activity scene still exceed the proposed 10 ms p95 target. Activity
uses explicit fixture-owned equipment/materials, normal crafting transactions,
injected drops/TNT and 12 measured explosion events. This is synthetic-time
compute evidence, excluding real worker scheduling, sockets, persistence, Auth,
SFU and browsers. It does not establish natural progression or capacity.

## Actual workers and variability

Six packaged loopback profiles run near 30 Hz with no skipped driver batches,
resyncs or reported dropped simulation time. All clients and rooms close.
Maximum room world-step p95 upper bounds are 1.60, 4.05, 8.60 and 26.20 ms at
16/32/64/128 players, 4.25 ms for 2×32 and 2.30 ms for 4×16. The 128-player
endpoint input-ack p99 is 97.46 ms. These short samples include startup/warmup in
the worker's ten-second windows, as described in [worker timings](worker-timings.md).

The single 128-player window is higher than the preceding release's recorded
20.50 ms despite improved direct compute. Three new alternating packaged-release
pairs therefore compare the actual archived preceding release against the new
one, using the same socket driver and independent processes. Each report keeps
its own build identity and validated server inventory.

| Pair | Before world p95 upper (ms) | After world p95 upper (ms) | Before → after input-ack p99 (ms) |
| ---: | ---: | ---: | ---: |
| 1 | 30.55 | 26.10 | 138.04 → 120.21 |
| 2 | 22.50 | 20.45 | 76.84 → 76.64 |
| 3 | 28.85 | 29.10 | 119.97 → 125.75 |

The median is 28.85→26.10 ms, with overlapping ranges and one slightly slower
after sample. These observations support continued tuning, not a robust real-room
speedup or school-capacity claim. Co-located driver scheduling, startup and short
windows remain important limits. `VOXEL_BENCH_RELEASE_ROOT` selects a standard
release directory for the socket driver; the normal release loader validates
its full server inventory and matching build/content before importing it.

## Verification and remaining gates

The [room-reuse archive](../evidence/room-reuse/README.md) retains all 48 direct
runs, the full six-layout socket run, all six additional 128-player reports,
sources, exact release bytes and browser/startup/build logs. No sample is dropped
because it is slower. The preceding worker-timings archive stays unchanged.
The original full-layout driver is retained separately; reconstructing it from
the final driver by removing release selection/report metadata matches exactly.

The full gate passes 99 domain, 80 native Rust (3 ignored), 88 Wasm and 44 source
plus 44 packaged integration cases. Focused cases cover radius boundaries,
immutable drop ownership through movement/pickup/expiry/recovery, column crossings,
resync, reconnect and same-column teleport incarnations. All 50 service and 180
web tests, strict game/service/web types, web production build, actual peer browser
cleanup, release verification and eight-read-only-status/zero-room startup pass.

Heavy survival and sustained worker/IO/memory loads, actual school Auth/recovery
and classroom journeys, physical device/impaired-network qualification, product
decisions and cutover/legacy retirement remain open. Hosted-write approval is
still pending after the separate automatic review rejection. No migrations
changed or were applied in this increment.
