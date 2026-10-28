# Presentation and worker recovery evidence, 2026-10-22

Build `6026fc56edb2` (full identity in `build.json`), protocol 3/environment 1.
`source-release-verification.json` checks the current runtime source, freshly
compiled authored content, Wasm/bindings, identity hash and all 12 packaged
client/server files. `verification.json` also inventories the captured evidence
bytes. Reproduce the source/release check with `npm run verify:release` from the
game package. Historical milestone directories retain their own identities.

`check.txt` records successful type/import boundaries, 17 domain tests, 79 native
tests (three upstream debugging helpers ignored), 11 release-Wasm tests and three
gateway scenarios against each of source and packaged server. Node, Chromium and
module-worker compute parity passes for production content and a synthetic
332-state manifest. The original Apple-silicon physics hash remains scoped to
that target; no fixture was replaced to hide Linux ARM differences.

The presentation scenario uses two built clients, trusted touch resume/audio
unlock and normal public runtime controls with server-authorized flight. It
crosses a real chunk origin, checks submitted avatar instance coordinates and
heading across pause, cycles held slab/stair/ladder/torch/plant/glass/water shapes
without retaining old geometry, checks absolute audio listener coordinates and
the actual mute/unmute gain, and disposes all tracked GPU/worker/audio resources.
`avatar-held.png` shows the resulting articulated avatar and held slab.

The environment scenario uses normal gateway-owned initial seed/tick settings to
render clear and rainy nights. It checks moon/stars/clouds, rain visibility under
open sky and disposal; screenshots are `clear-night.png` and `rain-night.png`.
Domain/socket tests check deterministic continuous weather, bounded coasting
after stale snapshots, continuing room time for late joins/reconnects and rejected
browser time changes. Room time is still volatile until persistence integration.

The worker scenario intercepts actual module-worker asset requests and injects
startup errors. Two transient errors recover on the third start. Permanent errors
exhaust two restarts, leave zero live workers, freeze movement and install no empty
terrain; resume cannot bypass recovery. Repair plus ordinary reconnect restores
terrain in a fresh epoch. Its expected injected errors are separately recorded;
unexpected browser errors are empty.

The tablet run passes actual multi-touch, simultaneous joystick/look, jump,
flight, cancellation, dispatched blur authority effects, real WebGL context
loss/restoration and GPU/worker/audio teardown. The desktop run passes jump/walk,
authoritative shared edits with particles and positioned audio, reconnect and
repeated disposal on its repeat. Input methods and resource counts are recorded
in the JSON reports. Headless Chromium keeps tabs focused; genuine OS/window
focus remains a device gate.

The first desktop run timed out during reconnect amid severe browser stalls.
`browser-creative-failed.txt` preserves its failure and room metrics. The unchanged
repeat passes (`browser-creative-retry.txt`), taking about 117 seconds to reach
reconnected readiness and about 53 seconds for the reconnect phase itself.
These are software-Chromium/SwiftShader functional checks on two ARM cores, with
audio output muted by the browser harness. The repeat does not resolve latency,
memory plateau, hardware frame budgets or physical audio quality. Those remain
qualification work; this evidence is deliberately marked as retaining a browser
failure rather than an unconditional all-green qualification result.

Remote held equipment/tool models, complete survival, the React session/HUD,
school/Supabase/LiveKit integration, durable recovery, classroom service split,
capacity/device/failure qualification and cutover remain open in the
[implementation record](../../../../docs/voxel-runtime-rewrite-progress.md).
