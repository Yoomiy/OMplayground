# Staff access moderation

`POST /api/voxel/moderation` accepts exactly `{room, requestId, target, action}`,
where action is `remove`, `ban` or `unban`. Fresh Supabase Auth and active
teacher/admin identity precede SQL. Child hosts cannot moderate. Browsers cannot
submit roles, revisions, owner leases or outcomes. The target must be a student
profile; staff cannot remove themselves or another staff member through this API.
`POST /api/voxel/moderation-targets` accepts `{room}` and returns fresh roster
names, ban status and pending-readmission status, including offline students.
Neither operation needs to allocate a simulation worker.

The installed sixth migration is
[`20261025060000_voxel_moderation.sql`](../../../supabase/migrations/20261025060000_voxel_moderation.sql).
Its private tables enable RLS and deny direct browser/service reads. Service-only
definer functions lock world, session and control rows and repeat the current
staff/game/target checks. School profiles take precedence over separate admin
records. Authorization lasts at most five seconds and is rechecked after lock,
target and audit waits. Expiry rolls back the policy and audit together.

Removal retains roster membership but advances the actor's admission cutoff.
Prior tickets, participant renewals, passive TNT-owner proofs and child-host
controls lose authority until a fresh eligible admission is accepted. Ban also
denies new entry until unbanned. Unban allows explicit fresh entry; it does not
automatically reconnect anyone. Redundant unban preserves a currently valid
admission instead of advancing its cutoff. These policies are per session.

The gateway records the cutoff before detaching old connections and immediately
stops their input/publication. The normal worker leave and last-leave retirement
paths retain checkpoint ownership. An admission awaiting membership IO cannot
attach past a newer cutoff. Retries cannot disconnect a later explicit admission.
Other gateways still enforce fresh policy through independently expiring actor
leases. SQL projection filters banned and pending-readmission actors so an older
queued presence view cannot restore them.

A request UUID binds actor, target and action to one policy change and one audit.
Lost provider replies remain unconfirmed; retrying the same UUID recovers its
receipt. `applied:true` acknowledges durable policy. `revocationRequested:true`
means the local gateway has been asked to disconnect the current old cohort.
`saved:false` makes no checkpoint promise or physical worker-disconnection claim.
Historical receipts report `current:false` and cannot evict a newer admission.
Offline changes remain possible during a worker-owner outage; they do not acquire
an owner lease or create a checkpoint. Completed-session new changes are denied,
while an existing receipt can still be recovered.

The Hebrew staff panel owns its confirmation dialog, refreshes eligible targets,
serializes with lifecycle/mode controls and retains the request UUID for retry.
It applies no optimistic access state. The student explicitly reconnects; a
banned join displays a fixed Hebrew denial.

The full local gates pass 85 domain, 80 native/three ignored, 84 actual-Wasm,
40 source and 40 packaged integration, 38 SDK/policy, seven school gateway,
42 actual PostgreSQL/SDK/native-worker and 92 web tests. Three built React contexts
exercise visible remove/ban/unban, a lost committed reply, blocked/fresh entry,
preservation of a nonempty bag, subsequent lifecycle saves and complete teardown.
Negative stale-ticket and redundant-unban reproducers are retained alongside
their passing regressions. Browser assertion failures and an earlier unexplained
end-confirmation/browser-close failure are also retained.

The user reported migration six applied. Read-only readiness finds all six
schemas/private bucket ready; history versions 001–006, nine relevant function
bodies/grants and two private moderation tables match the tested SQL. Guarded
six-status-only startup passes health/readiness with zero rooms and no remote
application writes. The [evidence archive](../../../games/voxel/evidence/moderation/README.md)
retains matched release/source/browser/production bytes and the terminal checks;
an independent audit compares them with current inputs. Final service/web
typechecks pass after the temporary approval-review availability failure resolved.

Combined browser tests use fixture Auth/PostgREST/Storage, actual local SQL/SDK and
packaged workers, and software Chromium. They do not establish the authenticated
hosted school journey, device performance or deployment recovery. Voice grant/
mute enforcement and persisted moderated chat remain separate required work;
gameplay bans do not yet prove LiveKit revocation. There are no player, observer,
object or room-count admission caps.
