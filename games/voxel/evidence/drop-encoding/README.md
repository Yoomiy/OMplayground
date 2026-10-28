# Drop encoding and steady-window qualification

Immutable public drop JSON reuse, repeated direct fixture survival comparisons, six packaged loopback movement profiles with authoritative contained steady windows, and software browser cleanup. No device/network/capacity signoff, hosted Auth/SQL/Storage writes, deployment or standalone web bundle.

Matched release: 937183f45298044f5c58f4d985c4b55ff77a5b3dd90e7a2ccaee44be4f2ef788. Full gate: 103 domain, 80 native Rust
(3 ignored), 88 Wasm, 44 source and 44 packaged integration cases. All 50 service
and 180 web tests, strict types, production web build, current-source release
verification and guarded eight-read-only-status/zero-room startup pass.

All 24 alternating direct pairs preserve exact recipient-ordered wire hashes,
bytes and counts against the preceding room and its own encoder. Median activity
p99 improves 14.91 to 11.38 ms at 64 players and 36.61 to 30.30 ms at 128;
p95 improves only 10.63 to 10.44 and 28.60 to 27.48 ms respectively. Movement
p95 is effectively unchanged; some smaller movement tails are slower. Every
sample is retained. Larger sizes still exceed the proposed 10 ms p95 target.

Six actual-worker layouts use 25-second endpoint samples after three seconds of
warmup. Every room has one fully contained ten-second worker reporting window,
selected by actual worker bounds. All windows are retained separately. Maximum
room steady p95 upper bounds are 1.15/2.15/7.45/24.00 ms at 16/32/64/128 players,
3.45 ms at 2x32 and 1.35 ms at 4x16. The 128-player all-window p95 is 25.35 ms:
startup does not fully explain the cost. All profiles run near 30 Hz with no
input batch skips, resyncs or reported dropped time; all clients/rooms close.
These co-located movement samples do not establish an encoding-specific worker
speedup, rich activity or school capacity. Two actual browser clients pass
presentation and zero-resource/audio teardown. No admission caps.

The diagnostic CPU profile remains build 6b20c88f7d8c9e7b6158c26d02524c24a419cc03b5fc9b2d53a90c083066da47, before these changes,
with one 128-player pair per scene and untimed harness/startup/generation/hashing
work. Its original driver and raw profile are copied. It is not current-release
qualification. Current source and exact release bytes are copied; production web
outputs are inventoried rather than copied as a standalone deployment bundle.
The preceding room-reuse archive stays immutable.

Heavy survival/scaling and sustained worker/IO/memory/device/network qualification,
real school Auth/recovery/classroom journeys, product decisions and full cutover/
legacy removal remain. The separate rejected hosted-write run still awaits
explicit approval. No migrations changed or applied.
