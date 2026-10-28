# Built client over shaped TCP

`npm --prefix games/voxel run test:network:browser` runs the matched built client,
release Wasm, packaged gateway and native workers through three local TCP data
profiles: 50 ms RTT, 100 ms RTT with ±25 ms one-way read-chunk jitter, and 150 ms
RTT. Each has a shared 10 Mbps cap per direction across all proxy connections.
HTML, JavaScript, Wasm, admission HTTP and gameplay WebSocket bytes all traverse
the proxy. FIFO forwarding preserves each stream; no game messages, socket
counters or authoritative positions are fabricated.

This adds latency/jitter/bandwidth coverage beside the separate actual one/five-
second read-stall tests. It is local byte shaping: TCP handshakes, congestion,
retransmission, packet loss and physical networks are not emulated. The configured
rate is an upper bound; host scheduling can reduce achieved throughput. These
results cannot qualify school hardware, physical networks or SFU voice.

## Model checks

The proxy meters at most 8 KiB per forwarding turn. Its directional scheduler is
shared across connections, rotates eligible flows and preserves each stream's
order when jitter changes eligibility. Socket reads pause at 64 KiB of queued
data per flow, with one read's bounded overshoot. Destination backpressure pauses
that flow without blocking other flows. Clean half-closes drain their pending
FIFO before teardown; cancellation immediately retires bytes, sockets and timers.
These are test work budgets, not game admission limits.

The real-stream calibration sends two distinct 256 KiB binary payloads. Both
uploads complete before either response starts, so the two shared-rate phases
cannot overlap. At 4 Mbps, 60 ms RTT and ±10 ms one-way jitter, the latest measured
2,264.17 ms exceeds the conservative 2,099.38 ms serialization/delay lower bound.
Every byte round-trips in order, both directions report exactly 524,288 forwarded
bytes, read backpressure occurs, and all resources close. Forwarding timestamps
also satisfy the per-packet eligibility/rate bounds. Removing the pacing statement
from a separate derived helper fails this same calibration assertion.

A separate case closes a relay while 10-second-RTT traffic remains pending; it
releases all queued data and timers immediately. Tests have abort deadlines and
cleanup. Early strip-only syntax and half-close/cleanup failures are retained
separately from the final passing implementation.

## Software browser results

Release `7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`
is unchanged from the input-recovery increment. Each profile starts a fresh
software Chromium process/context at 640×480, low quality, with a two-core worker
configuration. OS/driver caches are uncontrolled. Cold timing begins immediately
before navigation; readiness requires 49 collision columns, at least 25 nearby
meshes and no active jobs. Browser process startup is excluded. Warm timing starts
at explicit reconnect in the same page and uses the same readiness conditions.

| Data profile | Cold ready | Warm ready | Sampled input lag | Largest sampled correction |
| --- | ---: | ---: | ---: | ---: |
| 50 ms / 10 Mbps | 5.15 s | 1.48 s | 6–10 frames | 0.000073 m |
| 100 ms, ±25 ms one-way jitter / 10 Mbps | 5.53 s | 1.68 s | 2–16 frames | 0.179 m |
| 150 ms / 10 Mbps | 6.13 s | 1.87 s | 12–15 frames | 0.000095 m |

All samples meet the proposed 8/3-second readiness numbers in this local model;
that does not pass the physical-device/network gate. The creative scenario uses
public flight and movement controls over natural terrain, collects 24 lag/
correction/freshness samples, and verifies real authoritative movement. Once
neutral and settled, client/server positions agree within one centimetre (zero
observed difference in these runs). Reconnect preserves the actor/world and gets
a newer epoch with one additional admission. Every context releases graphics,
audio, workers and sockets; proxies end with zero queued bytes/flows/timers and
gateways with zero rooms. Largest observed per-flow queue is 96,768 bytes.

The expanded 109-test domain suite, strict game/tool types and current-source/
content/12-release-file verification pass. The previously archived native/Wasm,
gateway, school app, persistence and survival checks are retained by unchanged
runtime/release hashes; they were not rerun for this test-only increment. CI runs
the new browser matrix. There is no new migration or production runtime change.

`evidence/shaped-network/` retains the exact helper/tests/tool, calibration and
failed pacing control, browser reports, sources and matching release bytes. The
prior input-recovery archive remains immutable. Actual devices/networks, richer
survival under impairment, hosted Auth/RLS/Storage/SFU and classroom journeys,
product decisions, larger-load performance and cutover/legacy retirement remain.
