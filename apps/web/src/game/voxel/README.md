# React voxel adapter

`VoxelSessionContainer` owns the authenticated school session scope. `VoxelSurface`
mounts one runtime and connects its HUD/commands to inventory, help, room controls,
chat and voice. The game package owns simulation/rendering and imports no React
or school providers.

The adapter obtains authoritative lifecycle/presence and stable request-ID receipts
from the voxel service. It does not mutate allocated voxel sessions directly through
browser database calls or optimistically acknowledge saves. Presence expires by its
server deadline. Temporary session/chat read failure retains loaded content and
keeps the same runtime mounted; confirmed access denial keeps its terminal meaning.

Committed chat sends/deletions/clears push a content-free `chat_changed` notification
through the admitted runtime socket. The dialog and closed recent-message preview
immediately reread authorized history. Reads coalesce notifications received while
a request is in flight, and reconnect/visibility changes plus a 10-second repair poll
recover missed notifications. Chat bodies and moderation remain in the trusted HTTP/SQL path.

Outgoing messages appear locally on submit while their requests run. Each has its
own delivery state; typing and sending another message stay available. The server
uses the same request/message ID, so a history update replaces the local row once,
whether it arrives before or after the HTTP receipt. Unconfirmed writes retry that
same ID; definitive rejections retain the text for editing. Acknowledged local rows
survive slow history reads and retire on a fresh read, including after moderation.

Board games, Rocket and Wobble share `SessionChatPanel` and `usePersistedSessionChat`:
board writes go through Socket.io, Rocket/Wobble through HTTP, into `chat_messages`.
Supabase Realtime triggers history reads. Old voxel also used that shared feed. Voxel uses
private `voxel_chat_messages`, participant/owner-fenced SQL, idempotent receipts and
runtime socket invalidation. The shared hook cannot read that private table; swapping
it in requires a storage/access migration rather than a UI replacement. All current
game chat UIs share `useChatOutbox` and `ChatDeliveryStatus` for immediate local display,
per-message delivery/retry state, reconciliation and cleanup. Public-table writes also
preserve client message IDs and acknowledge retries only when the original actor,
session and text match; retries never overwrite messages or undo moderation.

Inventory, help, chat and mouse release affect local controls. Session-wide pause
is a trusted HTTP operation. Escape releases pointer lock, and a world click restores
capture. Recovery releases blocked input so reconnect controls stay usable. Native
readiness gates resume after join, teleport or graphics restoration.

`VoiceSession` owns one direct LiveKit room, microphone, proximity subscriptions and
spatial mix. SDK reconnect retains the microphone; complete disconnect/readmission
uses a new token. Game readiness loss, session end and unmount release owned voice
resources. Recorded game sounds use a separate runtime-owned audio graph.
The game mix uses gain 0.9; voice keeps its own gain. Audio debug timing and bounded
`audio_output_delayed` diagnostics expose browser-reported base/output latency and
raw output-clock observations. Clock differences are diagnostic observations, not
measurements of physical Bluetooth/speaker latency; no automatic context reset is
performed. Reproduction of persistent delayed sound needs the affected browser and device.

Abort stale reads and dispose the runtime, DOM adapters, subscriptions, timers,
audio tracks/elements and workers on unmount. Check `onRuntime` test hooks without
exposing developer fixtures in the production admission path.

The React browser journey needs the SQL suite's isolated local PostgreSQL settings,
Chromium, Xvfb and `xdotool`. Run it in a private display so it can exercise trusted
mouse capture and keyboard input:

```sh
xvfb-run -a -s '-screen 0 1440x900x24 -nolisten tcp' env VOXEL_XDOTOOL=/usr/bin/xdotool npm run test:voxel:browser --workspace @playground/web
```

The required participant journey uses a 1440×900 desktop window. Narrow-screen
layout checks are deferred; `VOXEL_REACT_TOUCH=1` enables the optional 540px touch
scenario. The software-rendered fixture uses existing half-scale, 30 Hz graphics
settings; production rendering defaults are unchanged. Repeated desktop mounts
still check worker, socket, GPU and audio teardown.

See [runtime architecture](../../../../../games/voxel/docs/architecture.md),
[school APIs](../../../../voxel-server/docs/school-api.md),
[local development](../../../../../docs/local-development.md) and
[testing](../../../../../games/voxel/docs/testing.md).
