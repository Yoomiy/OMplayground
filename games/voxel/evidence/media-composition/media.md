# Voxel voice and media policy

The platform service owns school authorization, durable student mute policy and
LiveKit signaling. The game exposes plain listener/player poses and a native
occlusion query through `runtime.voiceScene()`. It imports no LiveKit, Supabase
or React code. No player, observer or room count ceiling is imposed.

The browser requests `/api/voxel/voice-ticket` using its school bearer header.
The service repeats fresh Auth/recess checks, requires the same live gameplay
connection before/after asynchronous reads and verifies its owner epoch, original
admission revision and media cutoff inside SQL. The reply contains one opaque,
single-use ticket and plain permission/binding values. Reusable SFU credentials
remain in the independent backend signaling worker. Browser signaling uses
`/voxel-media/rtc[/v1]`; media flows directly to LiveKit. Refreshed tokens are
filtered, metadata/source forgery and migration credentials fail closed, and
compressed join queries preserve the SDK's padded URL-safe encoding.

Each upstream signaling connection has an independently enforced authorization
deadline of at most five seconds. It sends an SFU leave on expiry even if its
gateway parent is stalled. This is qualified against the configured provider;
whole-host loss or complete upstream network isolation has separate failure
bounds. The provider's original cached-token revocation gap is preserved in
`games/voxel/evidence/voice-provider-baseline/`. Short JWT expiry alone does not
enforce an active media session's lifetime.

Migration `20261025080000_voxel_media.sql` adds three private tables and six
functions. Browser roles cannot access these tables or invoke the service APIs.
Global student mute composes with individual mute and preserves staff speech and
supervision. Hidden staff are listen-only and absent from other peers' LiveKit
participant lists in the actual provider test. Commands use stable UUIDs with
atomic audit and immutable revision cutoffs. No-op or historical retries cannot
evict a later fresh listener. A five-second relay barrier also fences tickets
whose policy lookup was still in flight when mute committed.

`/api/voxel/media-state` and `/api/voxel/media-moderate` require current staff
authority. A receipt confirms persisted policy and requests transport revocation;
it does not claim an external physical audio acknowledgement or saved world.
Offline policy requires metadata, never a worker, owner lease or presence update.
Exact hosted function bodies/grants, table columns/constraints and private access
match the tested local schema. CLI and SDK target the same project. The user
applied the schema; agent verification is read-only.

The Hebrew voice dialog has explicit listening and microphone actions, output
selection, local output mute and confirmed staff commands with same-ID retry.
Reconnect obtains a fresh opaque ticket and leaves the microphone off. Background
or unavailable game scenes stop capture, including late permission replies.
Temporary game recovery preserves the user's listening preference; session end
and unmount close media. Poses and subscription sampling stay outside React.

The mixer owns one audible output and inaudible input drivers, spatial/filter/gain
nodes, and its output stream. It never stops transport-owned remote tracks. Real
software Chromium received RTP but produced silence for a WebAudio-only remote
consumer until a playing input element drove decoding. Input drivers use volume
zero; all audible output passes through the spatial mix. Their streams/elements
are detached on unsubscribe/replacement/close. Pending playback is distinguished
from rejected autoplay, which can be retried from a user gesture.

The actual React panel/coordinator/provider test uses generated audio, simulated
school policy and semantic game poses. It measures near/occluded/distant/muted
audio, verifies permission denial, hidden staff, fresh reconnect, policy retry,
late capture/activation and zero owned resources after teardown. A separate
real-SDK/local-SQL/native-actor test covers school binding and lost committed
mute replies. The composed React/native-game/local-SQL/configured-SFU browser
flow now also passes with generated microphone audio and actual native poses:
near audio, distance subscription removal, hidden staff, same-ID retry after a
committed mute reply is lost, explicit fresh joining, and provider-confirmed
removal of a banned media identity. Terminal school metadata releases game and
voice resources even when the gameplay socket disconnected before the end
notification. Three browser teardowns leave zero game resources; the unique
qualification SFU room is deleted and absence verified.

The composition uses fixture Auth/PostgREST/Storage transports and a local
PostgreSQL database. Its asynchronous school reads use a test-only connection
pool; the old per-query CLI process overhead produced authorization timeouts
under software rendering. The production five-second deadlines are unchanged.
Earlier failed runs remain evidence and are not treated as hardware performance
measurements. A complete actual-Auth/game/SFU journey, physical/mobile audio
routing, outage/load and deployment qualification remain required.
