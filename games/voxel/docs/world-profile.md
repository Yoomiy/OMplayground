# Shared world-size build profile

`config/world.json` contains the square world's size in blocks. The default is
**512×512**, centered at the origin, with height **256**. Size must be a multiple
of 32 between 64 and 65,536, so both edges align with 16-block columns. Height is
unchanged. This is a shared build setting, not a player/observer/room limit or a
new settings panel in the school app.

One immutable bounds module drives cell and column validation, chunk decoding,
interest streaming, player prediction/authority, drop physics, spawn clamping
and checkpoint validation. It replaces the separate fixed horizontal clamps.
The profile bytes are part of the runtime fingerprint/build ID. Matching browser
and server artifacts therefore carry the same profile; incompatible clients
cannot claim another size by sending coordinates or an old build ID.

Stop the dev stack before editing the profile. Run `npm run build:voxel`, then
restart with `npm run dev:app`. Production web builds also verify the game release
and reject stale source/configuration/artifacts before producing a mixed build.
Service-only edits retain their normal watcher behavior. The production entry
loads its verified packaged profile, never arbitrary browser configuration.

Checkpoint schema 1 already stores exact bounds. The default preserves the
geometry of previous 512×512 saves: a real checkpoint captured from packaged
build `7c770c2043d1` restores with its player pose, vitals, inventory and edits.
A checkpoint whose saved bounds differ from the selected profile fails closed;
it is not resized, cleared or migrated. Keep the original profile to resume it,
or deliberately create a separate fresh test world after choosing another size.
Changing the profile performs no database cleanup or SQL migration.

Actual native/Wasm, binary/JSON, drop, checkpoint and real-socket gateway checks
exercise profiles 128, 512 and 1024 in isolated temporary copies, against both
source and packaged gateways. They verify all four horizontal player boundaries,
positive/negative wire limits, no drop snap to the old boundary, far-column edit
recovery, previous-default save compatibility, mismatched-profile rejection,
build incompatibility before worker allocation, distinct profile build IDs and
complete gateway cleanup. Malformed, unaligned and out-of-range profiles fail
before a build is produced. Per-profile results are saved in
`test-results/world-profiles-{source,bundle}.json`.

The accepted numeric range is a format/configuration bound, not a performance
qualification for every world size. The functional profiles above do not prove
physical-school-PC frame budgets or resource balance. The school default remains
512 and no larger synthetic player-count workload is added.
