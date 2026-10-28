# Presentation pacing evidence, 2026-10-22

Build `a84fb40c469d` (full identity in `build.json`). Verification matches current
runtime source bytes, every client/server release file and both browser reports.

Presentation limits are 60 Hz by default, 30 Hz for the low profile, and 10 Hz
for paused/preparing views. Input, streaming, prediction and network scheduling
remain independent of GPU submission. This reduces unnecessary paused-view
work; it does not establish a hardware performance verdict.

`check.txt` records successful types/import boundaries, 11 domain tests,
11 actual-Wasm tests, and two scenarios against each of source and packaged
gateway. The engine/bindings are byte-identical to the input milestone, whose
full check also passed 79 native tests (three debug helpers ignored) and whose
engine hash matches the recorded Node/Chromium/worker parity result.

The desktop browser run passes walk/jump, authoritative shared edits, reconnect,
and repeated disposal. The tablet-emulation run passes multi-touch, cancellation,
blur-handler authority effects and actual WebGL loss/restoration. Both end with
zero tracked geometry, texture and worker resources and no browser errors.
Read the input milestone for the exact trusted/DOM input methods and headless
focus limitation. Browser timers and total run times include software-GPU and
automation delays; they are not release loading or frame-time measurements.

The full rewrite remains incomplete. Real devices, final presentation, full
survival, school/RTC integration, durable recovery, scale/failure qualification
and cutover remain open in the implementation record.
