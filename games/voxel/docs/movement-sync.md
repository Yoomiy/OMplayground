# Movement synchronization

Numbered duration samples use the MIT Blockyard mechanics recorded in
[UPSTREAM.md](../UPSTREAM.md). World rules run at 30 Hz; player movement replays
the same bounded sample duration on client and server. The current protocol
version is defined in `src/shared/protocol.ts`.


The upstream mechanics are `GameHost.moveInputs`, `Predictor` and `FrameBuffer`.

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

## Maintenance

Keep acknowledgement identity, consumed pose and replay duration on the same
timeline. Public pose introductions and deltas use playback lead consistently;
private self snapshots remain unadjusted. Movement, snapshot-sharing and wire
boundary regressions are under `tests/wasm`; [testing](testing.md) describes the
source/packaged and browser checks. Real network/device feel remains a playtest concern.
