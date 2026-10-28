# Travel and reconnect resource measurements

The unchanged release
`543c9f288891986e003ce4b2e51c63177c38c14601f4ac8c3b6b1144fd0c3077`
passes six repeated travel/reconnect cycles with exact settled GL buffer,
geometry, texture and column plateaus, followed by complete worker/socket/GL
buffer teardown. This is software-browser resource qualification for a defined
creative-flight scene. It does not establish general heap leak freedom, worker
heap budgets or hardware performance.

```sh
npm --prefix games/voxel run test:memory:probe
npm --prefix games/voxel run test:memory:browser
npm --prefix games/voxel run check:memory:browser
```

Build a matching release first. `VOXEL_MEMORY_CYCLES` defaults to six and must be
at least two. The mutable report is `test-results/browser-travel-memory.json`;
the checker also accepts another report path. CI uses two cycles and runs both
the live scenario and the independent report checker.

## Scene and measurement boundaries

The built client and hashed release Wasm run unchanged, with the source gateway
and native room workers. A local development identity has explicit creative flight
capability; inputs use the public runtime controls. No trusted teleport or position
mutation is used. In a single page the actor ascends above natural terrain and
flies a closed 48-by-48-block route, then reconnects as the same identity under a
new epoch. Six routes total approximately 1,152 horizontal blocks, excluding the
initial approach and small corrections. Each leg waits for generation/meshing and
uploads to settle; it is not a rapid-travel or gameplay frame-budget benchmark.

Settled samples face down at the terrain and require actual terrain triangles,
new uploaded buffers and additional generated columns. This prevents a passing
result from a camera looking away while CPU meshes never acquire GL buffers.
The initial camera-horizontal attempt is retained separately as weaker evidence.

The probe wraps browser GL buffer creation, allocation/resizing and deletion.
Weak maps track handle ownership without retaining handles. Bound-buffer queries
correctly account for indexed/array targets; typed-array offset/length overloads
are measured in bytes. A separate actual-browser check verifies 64-byte allocation,
resize to 12 bytes plus a 16-byte index buffer, deletion including repeated deletion,
and a one-page exported Wasm memory growing to two pages. Weak references observe
the main Wasm memory exported by the real `WebAssembly.Instance` constructor.
Game and worker JavaScript responses are not rewritten.

GL bytes mean requested storage for currently owned buffer handles. They are not
physical VRAM residency: browser/driver caches and delayed reclamation are outside
this count. The GL bookkeeping adds overhead and must not be used for frame-time
qualification. Main Wasm linear-memory size is a high-water observation, not live
allocator usage; freed world allocations do not shrink the cached module's memory.

CDP collects garbage before sampling main-isolate heap/backing storage and DOM
counters. These exclude an authoritative accounting of worker heaps and whole
browser processes. Backing-storage and Wasm measurements are separate quantities;
they must not be added or interpreted as interchangeable resident-memory figures.
Playwright separately counts actual worker and socket births/deaths, alongside
the runtime's logical worker count. No snapshot or debug object is retained in
the page by the probe.

## Observed six-cycle result

Chromium/SwiftShader on ARM64 Neoverse-N1, Node 24.21.0, two available host CPUs;
480-by-300 viewport, low profile at half render scale/30 Hz, one compute worker
selected from a two-core browser override. The run lasts 176.37 seconds including
join, climb, all settled samples and teardown. Fourteen samples cover initial,
six travel, six reconnect and disposed states. It runs alone on the host.

| Owned quantity | Each settled travel | Each settled reconnect | Disposed |
| --- | ---: | ---: | ---: |
| Subscribed / collision-ready columns | 49 / 49 | 49 / 49 | stream released |
| Retained meshed columns | 34 | 25 | 0 |
| GL geometry / texture counts | 72 / 5 | 61 / 5 | 0 / 0 |
| Tracked GL buffers | 163 | 141 | 0 |
| Tracked GL buffer bytes | 2,429,812 | 1,843,268 | 0 |
| Actual live workers / sockets | 1 / 1 | 1 / 1 | 0 / 0 |
| Main Wasm high-water bytes | 6,094,848 | 6,094,848 | 6,094,848 |

All six values in each phase match exactly. Retaining outer-ring meshes explains
the travel/reconnect difference; both remain inside the 49-column interest set.
Each connection installs 49 initial columns; its route raises that to 133 and
executes 85 mesh jobs. Main Wasm memory grows from 5,636,096 bytes initially to
6,094,848 during the first traversal, then stays fixed. At teardown all 1,503
created GL buffers have been deleted, all seven actual workers and sockets have
closed, and the gateway closes with no rooms left. Browser errors are empty.

Forced-GC main-isolate heap after successive reconnects is 6,244,924; 6,390,104;
6,478,668; 6,550,252; 6,567,448; and 6,592,092 bytes. This finite sample shows
slowing growth, not a proof of a heap plateau or its cause. Teardown reduces the
observed heap to 5,661,628 bytes. CDP backing storage returns to approximately
7.47 MB on each reconnect and 744,499 bytes after disposal. DOM samples retain
one document, roughly 1,765–1,771 nodes and 365 listeners while active; after
disposal the development shell remains (345 nodes/211 listeners). Total DOM
listener counts are not claimed to reach zero.

The independent checker validates exact per-phase owned-resource/column/buffer
plateaus, stable main Wasm high-water after first travel, actual terrain rendering,
new epochs, balanced worker/socket lifetimes and final teardown. Corrupted reports
with a growing buffer count, growing memory reservation, leaked worker or missing
rendered terrain are rejected. A separate two-cycle smoke and known-allocation
probe pass, as do strict game types and current-source/release verification.
The prior native/Wasm/domain/service/web/browser gates for the unchanged runtime
remain prior evidence; they are not claimed as rerun in this tooling increment.

## Evidence and remaining scope

The [travel-memory archive](../evidence/travel-memory/README.md) preserves sources,
release bytes, raw two/six-cycle reports and logs, probe checks, report audits,
the under-rendered initial attempt and typecheck failure. Its inventory audit
checks current source/release hashes and the preceding sustained-survival archive.
The temporary command-review outage delayed capture; it did not change the test
results. Runtime sources, migrations and release files are unchanged.

This qualifies the measured owned-resource behavior of repeated creative flight
and same-page reconnect in software Chromium. Longer sessions, representative
ground/underground/build/TNT scenes, live allocator/worker/whole-process memory,
repeated app mounts, physical devices/networks and hosted school journeys remain
required, along with product decisions and cutover/legacy retirement. The separate
hosted-write test still awaits explicit approval; this work performs no hosted
Auth/SQL/Storage/SFU writes or deployment.
