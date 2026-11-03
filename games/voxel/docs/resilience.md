# Failure isolation and recovery

The game should keep its usable features running when another feature or provider
fails. A voice, chat, sound, presence or save error is not a reason to destroy a
healthy world connection. Errors remain visible and diagnosable. Ownership and
authorization deadlines remain authoritative; an outage cannot extend a proof.

## User-visible contract

| Failure | Expected behavior | Recovery and boundary |
| --- | --- | --- |
| LiveKit token or initial connection hangs | Voice reports unavailable; movement, editing and game sound continue | Token request ends after 15 seconds; initial SDK connection after 10 seconds; bounded retries with jitter. Late results cannot attach a discarded room. An SDK reconnect retains its room and microphone. |
| Session or chat refresh fails | Keep loaded session/chat content, display a feature-specific error, keep the same game mounted | Retry reads; preserve the existing presence TTL. Confirmed access denial retains its existing meaning. |
| Recorded sound fetch/decode hangs or a native audio call throws | The current event may be silent; gameplay continues | At most four loads, a five-second deadline, ten-second failed-load cooldown and at most 16 voices. Use a decoded variant when available. Do not replay an old event when its file finally arrives. |
| Save or presence write fails | Continue simulation while ownership is valid; show an unsaved-state warning after a failed autosave | Bounded IO; coalesce pending snapshots/views. Clear the save warning only after a confirmed commit. Retry an unconfirmed checkpoint with the same identity before capturing a newer one. |
| Input acknowledgements lag while snapshots arrive | Keep the rendered world, camera and voice; pause prediction/actions at the two-second input budget | Resume when backlog drains below 250 ms. After ten seconds waiting, request one baseline on the same socket; allow another ten seconds before readmission. Buffers remain bounded. |
| Incoming gameplay packets briefly stall | Pause prediction and world actions while retaining local focus/camera | Fresh packets resume gameplay on the same socket. Discard clicks made while state is stale instead of replaying them later. Explicit browser blur and user pause still require normal resume. |
| Gameplay transport needs readmission | Retain the old rendered world during admission | Replace resources when the new welcome arrives; do not replay uncertain world actions. Reconnect attempts use bounded backoff and jitter. |
| Ownership or actor authorization can no longer be confirmed | Stop affected authoritative activity by the last confirmed deadline | A late proof cannot revive an expired owner or actor. The existing worker deadline and fencing tests cover the necessary disconnect. Other authorized actors continue when the failure is actor-specific. |
| Saved checkpoint is missing/corrupt/incompatible | Reject recovery with a categorized error; retain the committed pointer | Never silently generate a replacement world. Allow only reviewed, directional engine compatibility. |

Every provider deadline bounds the caller even if the provider ignores abort.
Cancellation does not undo a remote transaction: immutable checkpoint identities,
sequence checks and owner fencing still decide which late writes are valid. A
late lease acquisition is explicitly released so it does not block later joins.

## Incident regressions

The previous release's Wasm/content generated
`tests/fixtures/prior-engine-checkpoint.json`; its commit, hashes and capture
contents are recorded in the adjacent provenance file. Tests restore its edited
terrain, player inventory, drops and primed TNT in the current engine, and load
its immutable storage graph. The compatibility exception is limited to the old
engine and the additive `biome_at` engine revision. Unrelated engine hashes and
malformed or corrupt saves remain rejected.

A delayed RAF callback used to move the update clock backwards after a fallback
timer had already advanced it. The next update could then predict movement time
twice. The clock now remains monotonic. A deterministic hour of interleaved timer
and stale RAF updates must earn exactly one hour of movement time.

The former fatal `input_acknowledgement_stalled` path is tested using real TCP
holds of five and fifteen seconds. Both recover on the existing connection while
the other player and camera continue. A separate held admission verifies that
the old meshes keep rendering until the next welcome and that both generations
of workers, sockets and audio resources are released after disposal.
An incoming TCP hold also verifies that a short snapshot interruption preserves
focus and camera control, drops stale action requests, and resumes automatically
without admitting another connection.
Safe, nonfatal action rejection remains
possible: an action whose preceding movement is not played within 500 ms returns
`input_timeout`. The soak records these and verifies a fresh explicit attempt
succeeds within three tries; it never retries an uncertain successful action or
silently tolerates another rejection reason.

## Running the evidence

From the repository root, with Node 24.21.0 and dependencies installed:

```sh
npm --prefix games/voxel run restore:release
npm --prefix games/voxel run test:resilience
npm --prefix apps/voxel-server run build:shared
node --test apps/voxel-server/tests/school-session.test.ts apps/voxel-server/tests/service-events.test.ts
npm --prefix apps/web test -- src/game/voxel/voice-session.test.ts src/game/voxel/world-audio.test.ts src/game/voxel/session-api.test.ts
VOXEL_TEST_PACKAGE=1 npm --prefix games/voxel run test:input-stalls:browser
VOXEL_TEST_PACKAGE=1 npm --prefix games/voxel run test:resilience:browser
npm --prefix apps/web run test:voxel:resilience
npm --prefix games/voxel run test:resilience:soak
```

The focused tests cover providers ignoring cancellation, late completions,
unresponsive storage read/upload/commit operations, retry identity, a late lease
acquisition, slow and permanently hung renewals, projection coalescing and late
write completion, diagnostics filtering and severity, input recovery, and audio
load/graph/cleanup failures. Existing packaged integration tests retain the
ownership-expiry, actor-expiry, revocation, worker-recovery and storage-integrity
checks.

The combined browser workload uses two Chromium processes, the packaged gateway
and worker, natural terrain, confirmed placement/removal, repeated save/presence
failures, policy read failures, short lease-renewal outages, voice/session requests
that exceed their deadlines, failed chat reads, and repeated TCP input holds. It
requires exactly two admissions throughout, stable actor/world identity, bounded
prediction/audio resources, a save warning and recovery, and complete teardown.
The default is 90 seconds; the soak is a real 60 minutes, not an advanced clock.

The separate React browser journey runs the actual session container, surface,
chat and voice components. It retains cached messages/presence through failed
refreshes without remounting the game, resumes movement, observes recovery and
checks teardown. An analyser observes nonzero PCM from actual decoded recorded
sound during the outage; this establishes browser audio production, not physical
speaker output.

Reports go to `games/voxel/test-results/browser-{input-stalls,resilience}.json`
and `apps/web/test-results/voxel-resilience-browser.json`. The resilience CI job
runs the short scenarios independently of the broader runtime job. A manual
workflow dispatch with `resilience_soak=true` adds the full hour and uploads the
reports.

These are controlled local provider failures and software-rendered browsers.
They do not diagnose production Supabase/LiveKit networking, establish device
performance, or prove that a real provider honors cancellation. Production
diagnostics therefore retain safe failure categories plus epoch, sequence, ack,
pending input seconds, acknowledgement/snapshot age and socket-buffer size.
Tokens, raw provider errors and chat content are not added to those diagnostics.

The [recorded qualification](../evidence/resilience/qualification.json) covers
release `b9438158d0e3`: a real 60-minute two-player run, 212 confirmed edits,
53 local input recoveries, no automatic readmissions or client errors, and
successful cleanup. It also records the focused checks and the eight broader
suite failures reproduced in the unchanged baseline.
