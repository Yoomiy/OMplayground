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

Inventory, help, chat and mouse release affect local controls. Session-wide pause
is a trusted HTTP operation. Escape releases pointer lock, and a world click restores
capture. Recovery releases blocked input so reconnect controls stay usable. Native
readiness gates resume after join, teleport or graphics restoration.

`VoiceSession` owns one direct LiveKit room, microphone, proximity subscriptions and
spatial mix. SDK reconnect retains the microphone; complete disconnect/readmission
uses a new token. Game readiness loss, session end and unmount release owned voice
resources. Recorded game sounds use a separate runtime-owned audio graph.

Abort stale reads and dispose the runtime, DOM adapters, subscriptions, timers,
audio tracks/elements and workers on unmount. Check `onRuntime` test hooks without
exposing developer fixtures in the production admission path.

See [runtime architecture](../../../../../games/voxel/docs/architecture.md),
[school APIs](../../../../voxel-server/docs/school-api.md),
[local development](../../../../../docs/local-development.md) and
[testing](../../../../../games/voxel/docs/testing.md).
