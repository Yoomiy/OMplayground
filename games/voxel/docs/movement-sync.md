# Movement synchronization

Implemented 2026-11-01; protocol 14. Smooth local walking, jumping, flying and
building take priority. Combat does not determine interpolation delay or input
playback policy. No hosting or deployment is implied by this source/build change.

## Adopted mechanics

The algorithms adapt the MIT-licensed Blockyard revision recorded in
[UPSTREAM.md](../UPSTREAM.md), particularly `GameHost.moveInputs`, `Predictor`
and `FrameBuffer`. This replaces the previous fixed 60 Hz player-input timeline;
world rules, vitals, mining, objects and persistence still use fixed 30 Hz ticks.

- Each animation frame predicts one numbered input with its actual duration,
  capped at 100 ms after a browser stall. The identical sample and duration replay
  through the shared Wasm primitive on the server. Test/headless clients may omit
  duration to explicitly request one 1/60-second sample.
- Inputs are batched for transport at 30 Hz. Server playback primes with 40 ms of
  input, uses a 50 ms cushion and a 250 ms time bank, and consumes surplus 5% faster.
  Empty queues do not invent held or neutral movement steps. Acknowledgements
  describe exactly the inputs applied to the published body.
- Blockyard's queue-over-30 catch-up plays buffered samples instead of discarding
  their identities and resetting prediction. Catch-up may simulate buffered movement
  faster than wall time; this is intentional under the trusted-client product
  priority. A 240-sample queue bounds retained work. Exceptional overflow requests
  recovery, while ordinary arrival jitter does not.
- Client reconciliation restores authority and replays unacknowledged samples with
  their original durations. Pending prediction is bounded by two seconds rather
  than a display-rate-dependent number of frames.
- Small local corrections retain the currently shown position and decay at
  `exp(-12 * dt)`. Routine lifecycle/profile baselines also preserve continuity
  when the difference is below two blocks. Join/readiness, teleport, respawn and
  mode changes remain discontinuities. Epochs still retire obsolete commands.
- Public player poses compensate for the input playback bank's fractional
  remainder using velocity, as Blockyard's `caughtUp` does. Self snapshots retain
  the exact acknowledged body for replay; interest checks use authoritative poses.
- Actor snapshots publish at 30 Hz. Remote playback buffers two ticks, never moves
  playback time backward, and holds the latest sample when the buffer runs out.
  It no longer extrapolates a stale velocity through an unknown stop/collision.

Render-frame prediction runs before GPU submission pacing, so a 30 Hz graphics
limit does not create a second competing movement timer. A fallback timer pumps
loading/recovery when animation callbacks are suspended.

## Validation

`tests/wasm/prediction.test.ts` exercises changing 30/60/120 Hz input durations,
ordered arrival jitter, direction changes, jumps and a half-second input hold.
Every delayed reconciliation must stay below 1 mm on unchanged geometry, with
no ordinary resync. Queue tests cover priming, starvation, gradual catch-up,
overflow and epoch invalidation during a movement outcome. Real-socket tests
compare native motion against the actual accepted inputs, including sequence gaps.

`tools/browser-network.ts` exercises the built client and packaged workers at
50 ms, 100 ms with 25 ms jitter, and 150 ms shaped RTT. It records every retained
reconciliation during the movement window and requires correction below 1 mm
and no new resync baselines, plus stationary agreement and reconnect/cleanup.
`tools/browser-input-stalls.ts` checks actual one/five-second TCP read suspension;
post-stall distance is bounded by consumed input duration rather than wall time.
Diagnostics are available only through the runtime debug surface.

Physical-device feel, real packet loss and classroom network behavior still need
playtesting. Software Chromium and deterministic Wasm tests establish functional
behavior, not a claim of hardware frame pacing or subjective smoothness.

## Local verification record

Matched client/server build: `a91b40a5296b` (unchanged release Wasm).
TypeScript, import boundaries and source/release identity verification pass.
The full gateway/worker integration suite passes 49/49. Unit plus actual-Wasm
coverage passes 210/213; the three failures reproduce in an isolated unchanged
`e5432b5` checkout: inventory wire target bounds, invalid checkpoint suffixes,
and the weighted-mining failed-write assertion. They are not new movement failures.

The final software-Chromium matrix records 365 reconciliations over its three
movement windows. Maximum corrections are 0.0924 mm at 50 ms RTT, 0.0868 mm at
100 ms RTT with 25 ms jitter, and 0.1047 mm at 150 ms RTT. All three windows have
zero resync baselines, and reconnect/readiness and cleanup pass. Actual one/five-
second inbound TCP holds also pass explicit recovery and cleanup checks.
These are local functional measurements; device feel remains a playtest question.
