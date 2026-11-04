# Streamed world terrain and seed identity

`config/world.json` selects streamed horizontal terrain. The former 512×512
playable fence is removed. Height remains **256**. Only nearby columns are
loaded/generated; client rendering unloads distant columns. Saved data contains
seed/version identity, edits and gameplay state rather than an entire map.
Exploring farther therefore does not allocate a full map, although making more
edits grows checkpoint storage.

One immutable bounds module drives cell/column validation, wire decoding,
streaming, player prediction/authority, drop physics and checkpoints. Its
horizontal guard is **−999,984 inclusive to +999,984 exclusive**. The published
native body-sweep API rejects coordinates beyond ±1,000,000; one column of margin
keeps boundary sampling inside that contract. This is also below the f32 terrain
generator's integer precision horizon. It is a technical coordinate guard, not a
school map-size setting or a player/room limit.

The profile enters the runtime fingerprint. Restart with matched browser/server
artifacts after updating; incompatible builds are rejected before worker
allocation. The packaged release is checked before production web builds.

Compatible schema-1 saves with the historical centered finite profiles expand
to the new bounds on restore. Content, engine and generator versions must pass
their explicit compatibility checks. Seed, edits, inventories and positions remain;
newly explored columns use that same seed. No checkpoint or world is deleted.

New school worlds reserve a distinct uint32 seed through
`voxel_acquire_seeded_room` before their first checkpoint. Migration
`20261029220000_voxel_unique_world_seeds.sql` adds a service-only seed reservation
RPC/table, a noncycling sequence and a unique constraint. A bijective permutation
spreads successive reservations across the uint32 range; 4242 stays reserved for
historical worlds. Worker/process restarts before the first save reuse the
reservation. Saved worlds restore their embedded seed. Existing RPCs and saved
data remain intact. Verify installation on each target project.
Standalone development gateways without school metadata derive a stable seed
from world identity; explicit development seed overrides remain available. Those
development fallbacks do not provide the database's global uniqueness contract.
