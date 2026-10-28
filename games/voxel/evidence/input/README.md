# Input lifecycle evidence, 2026-10-22

Build `901ab685a7af21749774a31480af07dcce4b154537c86fdd90ff7bf21eded6d2`.
The capture checks current source bytes against `runtimeHash`, every built
client/server file against `release.json`, and desktop/touch results against
the build's engine/content hashes. Historical creative evidence is separate.

`check.txt` records the matching build, types/import and bundle boundaries,
11 domain tests, 79 native tests (three debug helpers ignored), 11 actual-Wasm
tests, and both gateway scenarios against source and packaged server.

`browser-creative.json` and `.txt` record two built clients walking, jumping,
sharing authoritative placement/removal, reconnecting, and disposing twice with
zero tracked geometry/texture/worker resources and no browser errors. The timed
run exposed severe software-GPU/animation-frame stalls during reconnect before
readiness completed; this is functional evidence, not acceptable performance
or a school device verdict. Pointer capture and jump use trusted input; held
walking/relative aim use DOM events through the normal input listeners.

`browser-touch.json` and `.txt` use actual multi-touch events in an emulated
800×600 tablet for walking, jumping, simultaneous aim, flight and cancellation.
The normal blur handler freezes the authoritative body. Headless shell reports
all tabs focused even with focus emulation disabled, so blur is dispatched as
a lifecycle event; genuine window/OS focus is unverified. Actual WebGL context
loss/restoration verifies input freezes, resume cannot bypass recovery, and
refresh is required. Disposal clears controls and all tracked resources.

The compute parity JSON tests the same engine/content artifact in
Node/Chromium/module workers; it was recorded before the touch UI was added.
This host uses Chromium 156 and SwiftShader. Real device ergonomics, hardware
frame budgets, memory plateau, worker failures and the remaining presentation,
survival, school integration, durability and cutover gates remain open.
