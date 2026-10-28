# Repeated React session mounts

The full local React/SQL browser journey passes six same-page exit/re-entry cycles
using the actual `VoxelSurface` component under development StrictMode. Each new
runtime restores the same world and actor under a newer epoch. Every unmount
releases its controls, audio, native browser worker, gameplay socket and tracked
GL buffers. Runtime release remains
`543c9f288891986e003ce4b2e51c63177c38c14601f4ac8c3b6b1144fd0c3077`.

Run the existing app journey with its documented local PostgreSQL fixture setup:

```sh
VOXEL_TEST_POSTGRES=1 VOXEL_TEST_LIVEKIT=0 VOXEL_REACT_MOUNT_CYCLES=6 \
  npm run test:voxel:browser --workspace @playground/web
```

`VOXEL_REACT_MOUNT_CYCLES` defaults to four and must be at least two. CI already
runs this browser journey, so it now exercises four cycles by default. Each cycle
uses the visible exit and re-entry buttons; if the session was saved paused, its
host resumes through the normal control UI. There is no trusted position edit,
fake runtime disposal or authority bypass.

The lifecycle observer attaches before navigation, counting actual worker and
gameplay WebSocket creation/closure. Mounted samples require 49 subscribed and
collision-ready columns, completed nearby meshes, one canvas, one inventory and
one touch controller. Each exit waits for closed game audio and disposed runtime,
then checks zero tracked GL buffers/bytes, balanced actual worker/socket lifetimes,
and absence of canvas/touch/inventory/voice elements. The same actor/world IDs and
strictly increasing epochs must hold across mounts. The final roster departure
still ends the local session and returns its existing SQL receipt.

## Observed result

Node 24.21.0, ARM64 Neoverse-N1 with two available CPUs, software Chromium, mobile
viewport 540×800 and actual local PostgreSQL. Supabase SDK calls use fixture
Auth/PostgREST/Storage transports. LiveKit is explicitly disabled for this run;
earlier media qualification remains separate evidence.

| Quantity | Every mounted sample | Every unmounted sample |
| --- | ---: | ---: |
| Collision-ready columns | 49 | stream released |
| Geometry / texture / logical worker counts | 21 / 5 / 1 | 0 / 0 / 0 |
| Tracked GL buffers / bytes | 57 / 556,804 | 0 / 0 |
| Concurrent tracked GL byte high-water | 557,740 | 557,740 |
| Main Wasm memory high-water | 5,636,096 | 5,636,096 |
| Actual live gameplay sockets / workers | 1 / 1 | 0 / 0 |
| Game audio state | active owner | closed |

Epochs are 3, 9, 15, 21, 27 and 33. Final totals are 372 created/deleted buffers,
six opened/closed gameplay sockets and six created/closed browser workers. Browser
errors are empty. The full journey returns `PASS` with acknowledged desktop mouse
interaction, alongside its existing StrictMode cancellation, inventory/fullscreen,
failed-save retry, chat, moderation, teacher controls, session-end cleanup and SQL
roster-departure checks. Three fixture clients report zero final resources and
closed audio. The private test database and gateway close, then the local test
cluster is stopped.

## Correct concurrent peak accounting

The first six-mount run also passed all ownership/teardown checks, but exposed a
measurement defect: the probe's `peakBytes` summed historical per-context peaks.
Six sequential contexts therefore reported 3,346,440 peak bytes despite each
mount completely releasing its resources. That value did not represent concurrent
allocation and is retained only in the initial report.

The probe now maintains global live bytes and their maximum over time. A real
browser regression fails with the archived old probe and passes with the corrected
one: 64 bytes allocated and freed in one context, followed by 32 in another, must
retain a 64-byte peak. Concurrent 48-byte and 32-byte allocations must produce an
80-byte peak. Resize, indexed buffers, repeated deletion, complete cleanup and
exported Wasm growth also remain checked. The full React journey was rerun after
this correction; every mount then reports the correct 557,740-byte peak.

The preceding travel archive has one allocating game context, so its original
peak and live-byte results are unaffected; its bytes remain immutable. A fresh
two-cycle standalone travel/reconnect regression with the corrected probe passes:
2,429,812/1,843,268 settled travel/reconnect bytes, stable main Wasm high-water and
599 created/deleted buffers with all three workers/sockets closed. Its independent
report checker passes. Strict game/web types, import boundaries and current
source/release verification also pass.

## Scope and evidence

The [React-mount archive](../evidence/react-mounts/README.md) preserves the initial
and corrected runs, matching fixture assets and game release, the old-probe failure,
known-allocation checks, travel regression and exact source inventory. Runtime
sources and the previously qualified release are unchanged. Prior native/Wasm,
service/web unit and full production-build gates were not rerun for these tools.

This proves the measured ownership and UI teardown of repeated real React surface
mounts in the local fixture. GL requested bytes are not physical VRAM usage; Wasm
reservation is not live allocator accounting. The fixture intentionally retains
some diagnostic runtime/voice references, so no general JS-heap leak verdict is
claimed. Actual hosted Auth/RLS/Storage/SFU composition, full-shell navigation,
longer/richer scenes, worker/whole-process memory, physical devices/networks,
product decisions and cutover/legacy retirement remain required. The separate
hosted-write run still awaits explicit approval. No migrations or deployment.
