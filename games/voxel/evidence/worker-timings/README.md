# Worker timing qualification

Bounded actual-worker timing distributions, six packaged loopback movement workloads and two software-rendered browser clients; fixture identities, no hosted Auth/SQL/Storage writes, device/network/capacity qualification, deployment or standalone web bundle. Diagnostic CPU profile retains previous release identity.

Matched release: 3ea11984a11a76d7d2993a55a882ed985827a6d1440e3336f3e8cf0612f5f508. Full checks pass 97 domain, 80 native Rust
(3 ignored), 87 Wasm, 44 source and 44 packaged integration cases. All 50 service
and 180 web tests, strict game/service/web types, production web build, release
verification and guarded eight-read-only-status/zero-room startup pass.

World steps, paused observer-clock steps, worker turns, successful generation
jobs and supervisor commands have separate fixed-storage ten-second histograms.
Quantiles use 0.05 ms buckets through 200 ms and conservative overflow maxima.
Actual-Wasm catch-up and three real worker reporting windows verify counting,
paused semantics and reset. Metrics forward as flat numeric log context.

All six socket profiles run near 30 Hz without skipped input batches, resyncs
or reported dropped time; all clients/rooms close. Maximum room world-step p95
upper bounds are 2.25/4.10/9.75/20.50 ms at 16/32/64/128 players, 5.20 ms for
2x32 and 2.60 ms for 4x16. The 128-player maximum is 104.99 ms, with 72.77 ms
endpoint input-ack p99. Windows include startup/warmup; these are single short
co-located samples, not overhead comparisons or school-capacity qualification.
Two actual browser clients pass presentation and zero-resource/audio teardown.

The diagnostic profile is build 5886a6dc973378530fbe79b71c007eccfdd440fdbde064dc3cd2938ea363aa57, before instrumentation,
with one 128-actor pair per activity scene and four wire-equivalent runs. CPU
samples include harness/startup/generation/hashing outside measured ticks. Its
room and encoder inputs match the preceding snapshot-scaling archive. The
current release does not inherit that profile's timing claims.

Current sources and exact release bytes are copied. Web outputs are inventoried
rather than copied as a final deployment bundle. The preceding snapshot-scaling
archive is immutable. Heavy survival and sustained IO/load/memory/network/device
gates, actual school Auth/recovery/classroom rollout, product decisions and
cutover/legacy removal remain. The separately rejected hosted-write run still
awaits explicit approval. No migrations were changed or applied.
