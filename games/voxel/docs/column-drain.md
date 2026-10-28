# Edited-world baseline delivery under TCP stalls

Joining a heavily edited saved world could close with code 1013 before every
column arrived. The gateway's recovery limit then asked the client to reconnect
to the same large baseline. Release
`f0d8830dee8d23bf0944268460d592a5bc4a9e1fb9c0b2294412b4264df8e252`
streams those baselines using bounded reservations released by socket writes.
It preserves ordered edits and the existing output recovery limit.

## Reproduction and behavior

A valid prepared checkpoint has 49 nearby columns, each with 16,384 edited cells
and valid revision stamps: 802,816 total edits and 4,818,072 binary baseline bytes.
The fixture excavates below the spawn surface and leaves bedrock unchanged. It is
prepared metadata, not a claim that a player naturally performed that excavation.
Restore, encoding, admission, native workers and TCP transport are real; persistence
uses the in-memory contract fixture.

An actual loopback TCP relay suspends server-to-client reads. It never overrides
`bufferedAmount`, manufactures server events or drops/reorders WebSocket frames.
The old packaged release `543c9f288891` fails the new integration test with code
1013. The original diagnostic receives only 39 of 49 columns after the native
socket queue reaches 1,081,718 bytes. Both failures are retained.

The updated worker reserves at most 512 KiB of column-baseline bytes per
connection. One maximum-size encoded column fits inside that budget. The gateway
returns credit after successful local socket writes, batching completed bytes per
connection into one worker message per event-loop turn. Browser readiness still
requires collision data and revision proofs. The public wire format is unchanged;
the new drain message and column classification are private supervisor protocol.

Deferred subscriptions retain coordinates, incarnation and pending state. They
copy/encode their current edits only after obtaining transport space. Accepted
edits while a baseline waits are included in its latest revision. Once a baseline
is sent, patches continue in order. Resync uses the same rule. Unload, teleport,
disconnect, authorization expiry and shutdown remove or fence obsolete work;
drains retry only the actor's current subscriptions. An O(1) edit-count query
avoids copying a blocked column merely to discover its encoded size.

The existing shared 1 MiB output recovery budget still handles genuine sustained
pressure from the complete stream. This is a per-connection work budget. No
player, observer, object or room admission limits were introduced. Checkpoint,
content, engine and public protocol versions are unchanged; no migration is needed.

## Actual TCP and browser checks

The new integration case runs against both source and packaged gateways. A healthy
peer remains active while another reader stalls for one second, receives all 49
columns, becomes ready, disconnects, then rejoins with a five-second read stall.
All cell indices/states/revisions are checked, the world ID persists and epochs
increase. The healthy simulation keeps advancing throughout. Final focused runs
measure maximum native queued output of 503,396/503,700 bytes for source/packaged
workers, with no backpressure/fault events and complete cleanup. The test uses
intentional socket termination during cleanup; its recorded code 1006 is distinct
from the old runtime's code 1013 during baseline delivery.

The built-client scenario also uses the packaged gateway/native workers and the
same edited checkpoint. A one-second TCP hold at hello delays its cold join;
all 49 collision columns and 25 meshes become ready. Cold readiness is 10.54
seconds on software Chromium at 640×480, low profile, one compute worker and two
available ARM64 Neoverse-N1 host CPUs. This exceeds eight seconds in this sample
and is not the specified school-device/10 Mbps/100 ms release-readiness gate.

During a later five-second output stall the client reports `stalled`, stops
prediction and stops accumulating input. Its measured position stays unchanged
through the latter part of the stall, input lag holds at 91, and stale voice
spatial sampling returns null. In the final sample, TCP suspension lasts 5,017 ms
and fresh-stream recovery takes a further 129 ms. Input lag returns to six and
the reported correction is zero. Reconnect restores the same actor/world under
a newer epoch and complete terrain. Both client workers/sockets close; final
geometry/texture/worker counts are zero and game audio closes.

Run with a matching build and installed Chromium:

```sh
node --test games/voxel/tests/integration/column-drain.test.ts
VOXEL_TEST_BUNDLE=1 node --test games/voxel/tests/integration/column-drain.test.ts
npm --prefix games/voxel run test:edited:browser
node games/voxel/tools/probe-edited-join.ts
```

The last command is a diagnostic that writes `test-results/edited-join.json`;
the tests supply assertions. The new actual-Wasm cases cover accepted edits
before first baseline, contiguous later patches, deferred resync, retained old
messages, interest changes, disconnect and new incarnations. CI runs the source/
packaged integration cases through the existing full check and adds the rendered
edited-world scenario. Suspension and post-release recovery timings are separate;
initial reports with the combined timing label are retained alongside final reruns.

## Full qualification of this release

The full gate passes 103 domain, 80 native Rust (three ignored debugging helpers),
91 actual-Wasm and 45 source plus 45 packaged integration cases. Strict game,
service and web types, all 50 service and 180 web tests, the production web build,
release verification and eight guarded read-only schema-status startup RPCs pass.
Startup opens zero rooms and performs no hosted application writes.

The full React/local-SQL journey passes its save retry, inventory/fullscreen,
chat/moderation, teacher/end/roster and six actual mount cycles, with empty browser
errors and all three clients cleaned up. The two-client presentation scenario
passes origin changes, held items, audio and zero-resource teardown. Live SFU
media is disabled in this React run. The private SQL fixture database, gateway
and local cluster close.

Six packaged loopback profiles have complete contained steady-window coverage,
near-30 Hz cadence, no batch skips/resyncs/reported dropped time and complete
cleanup. Maximum room-window world quantile upper bounds and endpoint ack p99:

| Rooms × players | World p95 (ms) | World p99 (ms) | Ack p99 (ms) |
| --- | ---: | ---: | ---: |
| 1 × 16 | 1.05 | 1.15 | 28.67 |
| 1 × 32 | 1.95 | 3.90 | 16.96 |
| 1 × 64 | 4.70 | 6.95 | 53.38 |
| 1 × 128 | 11.70 | 14.40 | 73.04 |
| 2 × 32 | 2.20 | 3.15 | 57.18 |
| 4 × 16 | 1.10 | 1.75 | 39.41 |

These are single co-located movement samples with 3-second warmup and 25-second
measurement, not a controlled speedup comparison or school capacity. Quantile
bounds are maxima across room windows, not pooled percentiles. The 128-player
p95 remains above the proposed 10 ms target.

The separate 180.68-second two-room/eight-UUID-actors-per-room survival run passes
54 rounds, 864 mining/replacement cycles, 866 crafts, 432 contested chest races,
1,298 cached replays, 192 food uses and 280 hits. Each room has 12 committed
readbacks checking token conservation, with at most 15 seconds sampled durable
lag. Committed worker-crash recovery rejects all 16 old-epoch craft replays and
resumes crafting. All 32 connections, rooms and waiters close. Across 34 contained
windows maximum world p95/p99 bounds are 0.90/1.50 ms and maximum client ack p99
bound is 32.85 ms. This uses prepared work sites/kits, in-memory metadata and
five-millisecond delayed object operations; it is not actual hosted IO.

## Evidence and remaining gates

The [column-drain archive](../evidence/column-drain/README.md) preserves old failures,
exact broad-check test source, initial/final timing reports, current sources and
release, final React fixture assets, all worker windows and production web inventory.
Only six runtime source files change from the preceding release. Engine/bindings,
content and installed migrations remain unchanged. The prior archive is immutable.

The real TCP holds qualify this ordered-output failure/recovery path locally.
They do not qualify physical school networks, inbound stalls, 50–150 ms RTT/jitter,
packet loss, bandwidth shaping or all sustained backpressure scenarios. Full hosted
Auth/SQL/Storage/SFU/classroom journeys, richer progression/scaling/memory/device
qualification, product decisions and cutover/legacy removal remain. The separately
rejected hosted-write test still awaits explicit approval. No deployment or new
migrations; the full rewrite remains active and incomplete.
