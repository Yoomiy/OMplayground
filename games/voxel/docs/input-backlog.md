# Input recovery after an inbound TCP stall

A restored connection could leave roughly ten controls waiting indefinitely on
the server. The server consumed controls at the same 60 Hz rate as new arrivals,
so its 12-frame queue stayed behind even after transport recovered. Those controls
were younger than the 200 ms expiry. Fresh server snapshots alone did not reveal
this one-way failure.

Release `7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`
clears this backlog during a scheduled movement step. When more than four controls
persist for 100 ms, or the transport queue overflows, the queue retains the latest
two and retires older input identities with an explicit resynchronization. Brief
arrival jitter can drain naturally. A normal 30 Hz packet contains two 60 Hz
controls. Retired controls contribute no movement step, view change or jump;
the next surviving control runs in the ordinary fixed-step schedule. The existing
12-frame transport bound, 200 ms expiry and 100 ms held-input deadline remain.

Only `src/sim/input-queue.ts` changes in production. No engine, bindings, content,
checkpoint or public protocol changes are required. There is no migration and no
player, observer, object or room admission limit. These queue values bound work
and latency for each connection.

## Regression evidence

The preceding release `f0d8830dee8d23bf0944268460d592a5bc4a9e1fb9c0b2294412b4264df8e252`
fails the new large/smaller steady-stream domain tests, stale-press test and actual-Wasm
prediction trace. The Wasm trace uses a one-second buffered stream, normal 30 Hz
packets, two scheduled movement steps per tick and 100 ms delayed snapshots. The
fixed queue restores client/server agreement within one centimetre, bounds the
server's remaining input latency by one packet and rejects the buffered jump as
a late server action. Exactly 240 scheduled movement steps execute.

The browser test runs the built client and packaged gateway/native workers over
an actual TCP relay. It suspends client-to-server socket reads while ordinary
server snapshots continue. It does not replace counters, fabricate snapshots or
drop/reorder WebSocket frames. The old build's normal acknowledgement lag samples
are 3–6 frames; after the one-second stall they remain 10–14 frames. The new build's
normal samples are 2–6; recovered samples are 4–7. The assertion compares sustained
post-recovery samples with that run's normal reference, rather than accepting one
transient low value.

A five-second input stall reaches the client's 120-input prediction bound. The
client enters recovery, releases focus and suppresses voice spatial data while
fresh snapshots continue. The authoritative body stays still during the hold.
After one bounded final batch settles, no further input frames appear throughout
the remaining hold. The test also checks unchanged pending-input count, bounded
movement/tick advancement after release, no automatic admission retry, and an
explicit same-world/actor reconnect with a newer epoch. Both workers and sockets
close, with zero graphics resources and closed audio after disposal.

An initial weaker browser assertion passed despite the old persistent delay; its
report is retained separately. A first run of the new build also exposed a test
observer race: one final already-sampled frame was reported after the recovery
state. The final check allows at most one four-frame batch to settle for 200 ms,
then requires a sustained quiet tail and stable pending count. That failed run and
the exact earlier tool are retained too. The production fix did not change for
this observer adjustment.

The first candidate trimmed every queue longer than four controls immediately.
It passed the stall test but recorded 135 resyncs in a later 128-player diagnostic,
and fails the added brief-jitter control-preservation regression. The final policy
waits through a 100 ms grace period for smaller backlogs; overflow still recovers
immediately. Tests verify that three jittered packets drain in order without a
resync, and that a smaller sustained backlog clears exactly once without overflow.
The first candidate's exact release, source, results and failed jitter test remain
separate from the final build's evidence.

## Local qualification and remaining scope

The matched build passes 107 domain, 80 native (3 ignored), 92 Wasm and 45 source
plus 45 packaged integration cases. Strict game/service/web types, 50 service
tests, 180 web tests, the production web build and eight guarded read-only schema
startup checks pass. Startup creates no rooms or hosted application data.

Source and packaged gateways still deliver all 49 heavily edited columns through
one/five-second outbound TCP holds. The rendered edited-world join, five-second
outbound stall and reconnect pass; software cold readiness is 10.51 seconds
including a one-second hold, which does not meet or qualify the proposed device
readiness gate. The actual React/local-SQL journey passes save failure/retry,
chat, moderation, teacher controls and six exit/re-entry cycles; every unmount
releases tracked GL buffers, workers, sockets and audio. Live SFU media is disabled
in this local journey. Two-client presentation and origin/held/audio cleanup pass.

The final six loopback movement layouts each use three seconds of warmup and
25 seconds of sampling. Maximum contained-window world-step p95 bounds are
1.05/1.85/4.65/16.40 ms at 16/32/64/128 players, 2.35 ms for 2×32 and 1.05 ms for
4×16. Every room has a complete contained window, near-30 Hz cadence and no reported
dropped time; all clients/rooms close. No input batches are skipped. There are
149 initial resyncs: one each for 21 actors in the 64-player layout and all 128 in
the largest layout, before sampling. No resync occurs during any measured interval.
The report preserves separate total/steady counts and bounded per-actor traces;
these initial corrections are not counted as zero or recurring steady recovery.

The largest layout still exceeds the proposed 10 ms p95 target; its ack p99 is
80.33 ms. A separate final 128-player diagnostic records 10.00 ms p95 and no
resyncs/skips, while a preceding archived-build sample records 10.40 ms. These are
individual co-located measurements with substantial variability, not a controlled
speedup or a passed school-capacity gate. The first candidate's full samples and
135-resync diagnostic remain separate; its initial timing run overlapped release
verification and is marked preliminary. Final timing runs execute alone.

The 183.23-second 2×8 sustained scenario completes 54 rounds, 864 mining/placement
cycles, 866 crafts, 432 chest races, 1,298 cached replays, 188 food uses and 276 hits.
Both rooms have 12 committed readbacks, maximum sampled durable lag 14.97 seconds,
and coherent worker crash/restart with all 16 stale-epoch replays rejected. Across
34 contained windows, maximum world-step p95/p99 bounds are 1.30/2.35 ms and the
largest input-ack p99 bound is 45.25 ms. There are no resyncs, skipped input batches
or reported dropped time. All 32 original/reconnected clients close, with zero
rooms or pending waiters. Prepared platforms/kits, advancing in-memory metadata
and 5 ms delayed in-memory object operations do not establish natural progression
or actual hosted persistence behavior.

The tool session disappeared near the end of that sustained run. Its existing
child was confirmed live and awaited without restarting. The child then exited;
its terminal report and complete recovery/cleanup data pass the independent report
checker. `survival-observation.json` records this evidence and its hashes, with no
claim about the missing parent shell's exit code.

`evidence/input-backlog/` retains exact sources, final and first-candidate release
bytes, failed regressions, browser/workload reports, final React fixture bytes and
web-build inventory. Its independent audit reconstructs the preceding runtime by
replacing only the input queue and verifies the preceding archive's immutability.

These checks use software Chromium on the two-core ARM development host, local
fixture admission and private local SQL or in-memory persistence contracts. They
do not qualify physical school devices, real network RTT/jitter/bandwidth/loss,
hosted Auth/RLS/Storage/SFU journeys, natural survival balance or school capacity.
Product decisions, broader progression/memory/scaling qualification, classroom
rollout, cutover and removal of the legacy runtime remain. The rejected hosted
write operation still awaits explicit approval. The rewrite remains active.
