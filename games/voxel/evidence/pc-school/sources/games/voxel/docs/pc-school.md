# PC-first private-school release

The user clarified on 2026-10-28 that the app serves a private school and students
mostly use PCs. Complete student/teacher workflows, desktop controls, voice,
saving and recovery take priority. The historical 128-player timing result is
not a release gate; no further synthetic scale experiments or scaling
infrastructure are planned. Mobile/tablet compatibility is optional. Existing
touch behavior remains best-effort, without new headcount restrictions.

The primary CI survival journey now uses a real desktop input context with
trusted keyboard/mouse events and owned pointer lock:

```sh
xvfb-run -a -s '-screen 0 1280x900x24 -nolisten tcp' \
  env VOXEL_XDOTOOL=/usr/bin/xdotool \
  npm --prefix games/voxel run test:survival:desktop:browser
```

It runs the built client and packaged gateway/native workers on natural terrain,
starting with an empty inventory. All HTTP/assets/admission/gameplay traffic uses
the local 100 ms data-RTT, ±25 ms one-way read-chunk jitter, shared 10 Mbps profile.
The test drives WASD/jump, mouse look and held mining, hotbar keys, right-click
placement, E to open inventory and normal inventory clicks. It does not set body
positions, grant items, change the world or override the simulation clock.

The completed journey collects five logs and an apple, crafts through both grids,
places its owned workbench, selects its pickaxe, equips trail boots and a heavy
shield, and eats the apple after real simulation-time hunger while inventory is
open. A separately admitted peer verifies remote equipment, independent vision,
origin changes, UI unequip/selection, reconnect and teardown. Recorded PC input
includes 97 locked mouse moves, 7 held primary presses, 3 secondary presses, WASD/
jump, E and hotbar key events, with zero untrusted events.

Food returns from 19 to 20 through owned consumption. Both main and peer contexts
release tracked graphics/workers and close audio; the main context closes its
native worker and socket. All eight proxy connections close, with zero queued
bytes, flows or timers, and the gateway ends with zero rooms. An initial driver
assertion used a nonexistent debug field; the final driver checks the DOM's
actual pointer-lock owner, with that failed report retained separately.

Strict game/tool types, focused relay tests and unchanged source/content/12-file
release verification pass. Relay shutdown is now idempotent and runs in failure
cleanup too. The PC journey replaces the previous CI survival invocation, avoiding
a duplicate full hunger run. The dedicated existing touch smoke is optional.

Production build `7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc`
is unchanged. These are functional results in headed software Chromium on a private
Linux display, not measured frame-rate support on a physical school PC. Actual
school-device and hosted Auth/RLS/Storage/SFU/classroom validation, remaining
product decisions, cutover and legacy retirement remain. The previously rejected
temporary hosted-user/session write test still awaits explicit permission.
