# Authoritative survival intro evidence, 2026-10-22

Build `37a9e3788edd` (full identity in `build.json`), protocol 5/environment 1,
inventory format 2. `source-release-verification.json` independently checks the
current runtime bytes, freshly compiled authored content, Wasm/bindings, build
identity and all 12 packaged client/server files. `verification.json` hashes the
captured evidence and scenario sources. Earlier milestones retain their own
identities; they are historical records.

`check.txt` and `check-exit.json` record a completed full check with exit code 0:
build, types, import/bundle boundaries, 30 domain tests, 79 native tests (three
upstream image/map debugging helpers ignored), 18 release-Wasm tests and five
gateway scenarios against both source and packaged server. `browser-suite.json`
records all eight browser commands finishing with exit code 0. Their reports
match this build; the compute-only parity report matches its engine/content.

Creative/survival mode is server-owned. Survival has a revisioned owned hotbar,
consumed placement, fixed-room-time mining, content-defined tool requirements,
speed and durability, and authoritative drops/pickups. Empty inventory cannot
place blocks, obtain creative grants, fly or remove blocks instantly. Mining
validates consumed controls, reach, occlusion, permission, target/cell version and
tool identity. Input bursts do not buy progress. Focus/epoch, tool/target changes,
permission loss and room pause cancel mining. Completion mutates the cell, wears
the tool and spawns canonical stacks once. Competing miners produce one result;
the losing tool does not wear. Replays remain retired after cache eviction.

Drops use validated small-body engine sweeps, room-time expiry and pickup delays,
authoritative reach/occlusion and capacity-aware partial transfers. Uncollected
remainders stay in the world. Restricted actors cannot collect items. The tests
exercise high-ID slab collision, blocked pickups, full-bag remainders, pause and
expiry, replacement cells, final-use tool breakage, competing pickups and revoked
permissions. Nearby drop replication uses bounded messages without a drop/player
admission ceiling; renderer batches grow and dispose when absent. Long-session
capacity and drop merging are not qualified here.

The survival browser scenario starts in a natural world with empty inventory.
It uses actual held touch mining, public look/movement controls and the actual
Hebrew inventory dialog. It mines three natural logs from one trunk, walks to
collect them, crafts planks/workbench/sticks in 2×2, places the owned workbench
(consuming the item), opens its reachable 3×3 grid and crafts a wooden pickaxe.
The selected owned tool is submitted to the held-item renderer. There are no
creative grants or test-only world mutations. Screenshots show a replicated drop,
crafting and the held pickaxe. Cleanup leaves zero tracked geometry, texture,
worker and audio resources. The touch overlay still covers part of the tool in
the prototype harness; final HUD ergonomics remain open.

The other browser scenarios cover two-client creative edits/reconnect, inventory
and shared chests, remote avatars/origin shifts/spatial audio, night/weather,
worker failure/recovery, touch/cancellation/WebGL loss and Node/browser/worker
compute parity. Parity includes production content and a synthetic 334-state
fixture, with generation/edit/mesh hashes, movement and small-body sweep traces.
The touch scenario also verifies rapid resume/pause and resume/inventory gestures
through real epoch boundaries.

Development failures are retained with `historical-` prefixes:

- `mining-input-stale`: a held request could reference an input before it was
  consumed. The client now waits for a sampled control and retries transient
  rejection while held; the server still validates consumed controls.
- `mining-liveness`: queued consumption made liveness depend on an older frame
  despite fresh accepted input. Liveness now uses the latest accepted receipt;
  invalid/duplicate/old-epoch packets cannot renew it. Queue age, scheduled
  consumption and held movement deadlines retain their independent bounds.
- `rapid-focus-race`: rapid resume/pause could leave the authoritative body
  unfrozen after the local UI paused. Matching baselines now reassert the latest
  focus intent, and inventory opening waits for confirmed focus state. Mutations
  are not silently retried.
- `browser-harvest-route`: the scenario switched trees and mined a high log that
  ordinary walking could not reach. The final route follows the first trunk;
  pickup reach and collision checks remain unchanged.
- `snapshot-comparison`: the burst test compared independently received snapshots
  from different ticks. It now compares a common authoritative tick with the
  original movement bound. Source and packaged gateway tests both pass.

These are software-Chromium/SwiftShader functional checks on two ARM cores.
Hardware frame/readiness budgets, physical audio, touch/keyboard ergonomics,
genuine OS focus and long-session memory/load remain qualification work. Earlier
desktop reconnect latency concerns remain open. Controls/prediction/networking
use a separate timer from GPU submission, but main-thread stalls can still delay
both; this record does not claim hardware performance.

Equipment perks, food/hunger/vitals/fall damage, combat/death/respawn, TNT, full
content/balance decisions, remote held equipment, the final React session/HUD,
actual school/Supabase/LiveKit adapters, durable checkpoints/leases, classroom
service separation and cutover remain in the
[implementation record](../../../../docs/voxel-runtime-rewrite-progress.md).
The full rewrite is still in progress.
