# Failure isolation and recovery

Optional voice, chat, sound, presence and save failures retain a healthy game
connection. Errors remain visible and diagnosable. Durable ownership and the last
confirmed actor cutoff still bound authoritative work independently.

| Failure | Expected behavior | Recovery boundary |
| --- | --- | --- |
| LiveKit token/connect hangs | Voice becomes unavailable; gameplay and game audio continue | Token deadline 15 seconds; initial SDK connect 10 seconds; bounded retries. Late results cannot attach a discarded room |
| Session/chat refresh fails | Keep loaded data and the same mounted game; show feature error | Retry reads within their scope; confirmed denial and presence expiry remain authoritative |
| Recorded sound load/decode fails | Drop the affected event; gameplay continues | Four loads, five-second deadline, failed-load cooldown and 16 voices. Never replay stale events after loading |
| Save/presence write fails | Continue while ownership remains valid; expose unsaved feedback | Bound IO and coalesce work. Retry the same uncertain checkpoint graph before capturing a newer one |
| Input acks lag behind snapshots | Retain world/camera/voice and pause prediction/actions at the two-second budget | Resume below 250 ms backlog; after ten seconds request a baseline, then allow another ten before readmission |
| Incoming game packets briefly stall | Pause prediction/actions while retaining local focus/camera | Fresh packets resume on the same socket. Drop stale clicks; explicit blur/pause still needs resume |
| Transport needs readmission | Retain old rendered terrain during admission | Replace resources on new welcome; never replay uncertain world actions; bounded retry backoff/jitter |
| Ownership or actor cutoff expires | Stop affected authoritative activity by its last confirmed deadline | Both gateway and worker enforce it; late results cannot revive an expired owner/actor |
| Committed checkpoint is invalid | Reject categorized recovery and retain the pointer | Never silently replace it with a fresh world |

Provider deadlines bound the caller even if cancellation is ignored. Cancellation
cannot undo a committed remote transaction. Immutable identities, sequence checks
and owner fencing govern late writes. A late lease acquisition is released explicitly.
The update clock remains monotonic across fallback timers and delayed RAF callbacks.

Private self snapshots retain acknowledged state for prediction replay. Public
introductions and subsequent deltas use one consistent playback-lead timeline.
Independent feature recovery and graphics restoration retain owned resource cleanup.
A safe `input_timeout` rejection can require a fresh explicit action; uncertain
successful actions are not retried automatically.

Regression fixtures cover late provider responses, unchanged checkpoint retry
identity, independent worker deadlines, stale RAF time, former-engine saves,
actual TCP stalls and complete teardown. Reproduction commands and fixture limits
are in [testing](testing.md). Keep generated reports in CI artifacts or ignored
`test-results` directories. Manual staging acceptance verifies actual providers,
physical audio and school devices; synthetic/browser checks do not establish those.
