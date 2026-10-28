# Browser travel/reconnect owned resources

Tooling/CI only; six settled creative-flight/reconnect cycles in software Chromium. Exact GL-owned-buffer/resource/column plateaus, main Wasm high-water and actual worker/socket teardown. Forced-GC main-isolate heap observations are not a heap-leak verdict; excludes physical GPU residency, worker/live-allocator/whole-process budgets, school device/network/capacity or hosted service qualification. Runtime/release unchanged; prior full qualification reused, not rerun.

Release: 543c9f288891986e003ce4b2e51c63177c38c14601f4ac8c3b6b1144fd0c3077.

The [full report](full.json) records six cycles and fourteen settled samples over
176.37 seconds. Each travel/reconnect pair has 49 collision columns, 34/25 mesh
columns, 72/61 geometries, five textures, 163/141 tracked GL buffers and
2,429,812/1,843,268 buffer bytes. Main Wasm grows once to 6,094,848 bytes then
stays fixed. Final teardown deletes all 1,503 buffers and closes all seven actual
workers/sockets, with zero remaining rooms. No browser errors.

The [two-cycle smoke](smoke.json), [known-allocation probe](probe.json), strict
types and unchanged release verification pass. Independent report checks require
actual drawn terrain/new uploads, exact per-phase ownership plateaus, new epochs
and complete teardown. Four corrupted ownership/rendering reports are rejected.
The initial under-rendered measurement and type failure are kept separately.

Post-GC reconnect heap ranges from 6,244,924 to 6,592,092 bytes with slowing
growth; this is not asserted to prove heap plateau or causation. Final heap is
5,661,628 bytes. Main Wasm reservation remains cached after freeing the world.
GL buffer bytes are requested live ownership, not physical VRAM accounting.

Sources and matching game release bytes are copied. The unchanged production web
bundle is inventoried, not copied as a deployable artifact. Prior archives remain
immutable. No runtime/migration changes, hosted writes or deployment. Full hosted
journeys, physical devices/networks, longer/richer scenes, repeated app mounts,
worker/live-allocator/whole-process memory, product decisions and cutover/legacy
retirement remain. The separately rejected hosted-write test awaits approval.
