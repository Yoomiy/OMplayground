# Sustained packaged survival workload

Release `543c9f288891986e003ce4b2e51c63177c38c14601f4ac8c3b6b1144fd0c3077`
passes a 180.06-second, two-room survival sample with eight UUID actors per room.
This increment adds workload tooling and CI coverage. Runtime sources and all
12 packaged release files match the preceding [visibility qualification](visibility-reuse.md).

Run from the repository root after building a matching release:

```sh
npm --prefix games/voxel run benchmark:survival:workers
npm --prefix games/voxel run check:survival:workers
```

`VOXEL_SURVIVAL_SECONDS` defaults to 180, `VOXEL_SURVIVAL_ROOMS` to 2,
`VOXEL_SURVIVAL_PLAYERS` to 8 per room and `VOXEL_SURVIVAL_IO_MS` to 5. The driver
needs even player counts for its paired chest/combat scene and positions that fit
the configured world. These are scenario constraints, not admission restrictions.
Fixture materials and tool durability are finite; the report checker rejects
exhausted supplies that reduce crafting activity. Longer runs need an adequately
supplied scenario. The mutable result is `test-results/survival-workers.json`;
the checker also accepts a report path as its first argument.

## Workload and assertions

The packaged gateway supervises real native room workers executing release Wasm.
Clients use UUID identities, normal admission/hello/readiness/focus, globally paced
30 Hz batches of two 60 Hz controls, current revision proofs and public actions.
They have no coordinate or inventory authority. Each room begins from a coherent
checkpoint prepared before measurement: generated natural terrain with clear
work platforms at height 160, chests, cobblestone targets and owned tools/materials.
Preparation restores actor positions, supplies kits and reduces initial health/food;
no trusted mutation is used during measured activity.

Each round mines and collects an owned drop, replaces the block, crafts a log into
planks, replays the craft, races two actors to withdraw one shared chest token,
replays the winning withdrawal, eats when hungry and performs alternating unarmed
combat while the target has enough health. Crafting and chest races run every round;
food and combat follow live vitals, including regeneration and knockback epochs.
The contested withdrawal must yield exactly one success and one revision conflict.

The storage contract fixture has an advancing monotonic lease clock. Metadata is
in memory; object reads/writes each wait five milliseconds by default. Actual
checkpoint capture, immutable object encoding, hashing, reference reuse, commits,
lease renewal and restore run through the packaged persistence implementation.
Every newly observed committed checkpoint is read back and checked for exact total
iron-token conservation across bags, crafting, equipment, chests and durable drops.
Sampled durable lag uses live world ticks minus the last read-back committed tick.

After measurement, each room is paused and committed. The driver terminates both
workers, waits for lease/connection cleanup, starts a new gateway and restores the
same actors. It checks world identity, committed tick, newer epochs, exact bags and
inventory revisions, and health. Replayed old-epoch crafts must be rejected without
changing inventory. It then resumes the rooms, crafts once in each and commits again.
All client sockets, waiters and rooms must close. Each client retains at most 256
events and 256 unacknowledged timing entries; report counters retain total traffic.

The independent report checker additionally verifies complete per-round counts,
the post-recovery crafts, exactly the expected injected worker failures, identity
reuse, zero resyncs/lost ack samples/skipped input batches, authoritative contained
metric windows, healthy lag and cleanup. A PASS label alone does not satisfy it.

## Measured result

Node 24.21.0 on ARM64 Neoverse-N1, two logical/available CPUs, co-located loopback
load clients, no renderer, and no other qualification workload ran concurrently.
There is no separate warmup: the sample begins after every client becomes active.
World timing uses only complete ten-second worker windows inside that sample;
endpoint latencies include the initial and recovery connections.

| Observation | Result |
| --- | ---: |
| Complete mixed rounds | 53 |
| Mining / replacement actions | 848 / 848 |
| Crafts, including two after recovery | 850 |
| Shared-chest races / expected conflicts | 424 / 424 |
| Cached success replays | 1,274 |
| Food uses / combat hits | 184 / 288 |
| Rejected old-epoch craft replays | 16 |
| Live committed readbacks per room | 12 |
| Largest sampled durable lag | 15.00 s |
| Fully contained room metric windows | 34 |
| Maximum room-window world p95 / p99 upper bound | 0.80 / 1.45 ms |
| Maximum room-window worker-turn p95 / p99 upper bound | 0.55 / 0.80 ms |
| Maximum client ack p95 / p99 upper bound | 42.60 / 45.00 ms |
| Maximum client command p99 upper bound | 8.05 ms |
| Minimum contained-window world cadence | 29.997 Hz |
| Resyncs / lost ack samples / skipped batches / dropped time | 0 / 0 / 0 / 0 |
| Closed clients / remaining rooms / pending waiters | 32 / 0 / 0 |

These are maximum per-window/per-client quantile upper bounds, not pooled global
percentiles. Loaded columns are 12 or 16 per room. Storage retains 98 objects
(627,680 bytes), with 32 total commits including preparation and recovery saves.
Object retention in this test backend is intentional and does not measure runtime
heap leakage. This fixed-site sample cannot establish travel-memory plateau.

The exact CI command also passes at 30 seconds, two rooms of two actors: eight
rounds, 32 mining/replacement actions, 34 crafts, 16 contested chest conflicts,
four old-epoch rejections, autosave readbacks, four contained metric windows and
complete cleanup. A separate one-room/two-actor ten-second recovery smoke passes.
Strict game types and current-source/release verification pass. Full native,
Wasm/domain, service/web and browser gates were previously run for this unchanged
runtime release; they are not claimed as rerun in this tooling-only increment.

## Evidence and remaining qualification

The [separate evidence archive](../evidence/sustained-survival/README.md) preserves
the smoke, sustained and exact CI reports/logs, prior failed driver attempts,
source inputs, release bytes and an independently checked inventory. Prior archives
remain unchanged. Initial failures concerned Node type stripping, join readiness,
fixture material assumptions, target-face aiming, private-view ordering and focus
intent across policy resume; they are retained rather than relabeled as passes.

This establishes sustained ordinary survival actions, concurrent autosaves and
committed worker-crash recovery for this local contract fixture. It does not test
actual Supabase Auth/RLS/SQL/Storage IO, SFU media, browser rendering, physical
devices/networks, TNT load, progressive heavy survival capacity or full process
failure. The prepared kits/platforms do not prove natural progression; that has
separate browser evidence. Larger/richer scaling, travel/heap plateau, real hosted
journeys, device/network budgets, product decisions and cutover/legacy removal
remain required. The separately rejected hosted-write test still awaits explicit
approval. No migrations changed or were applied.
