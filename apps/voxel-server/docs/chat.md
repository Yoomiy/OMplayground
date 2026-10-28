# Persisted moderated chat

Chat uses private PostgreSQL tables and trusted voxel-service HTTP routes. It
does not use the legacy browser-writable chat feed, gameplay socket, simulation
state or checkpoint graph. Session deletion cascades through private world
metadata to chat; normal worker retirement preserves history.

The seventh migration is
[`20261025070000_voxel_chat.sql`](../../../supabase/migrations/20261025070000_voxel_chat.sql).
It is locally qualified and installed by the user. At 2026-10-26 14:56 UTC all
seven schemas/private bucket pass read-only readiness; linked history lists
001–007. Its five function bodies/grants, private RLS tables and history index
match the tested file. Guarded startup of packaged release `bedd62f9b37b` permits
only seven status calls, passes health/readiness and closes with zero rooms or
remote application writes. The [installation record](../../../games/voxel/evidence/chat-installation/README.md)
retains this separately from the earlier missing-schema capture. The agent did
not apply the migration, and the already applied sixth migration remains unchanged.

The routes accept exactly these bodies:

| Route | Body |
| --- | --- |
| `/api/voxel/chat-history` | `{room, before: null}` or a positive sequence cursor |
| `/api/voxel/chat-send` | `{room, requestId, message}` |
| `/api/voxel/chat-moderate` | `{room, requestId, action: "delete", target: messageId}` or `{room, requestId, action: "clear", target: null}` |

Every request verifies Supabase identity and current profile. Student history
also repeats school/recess policy and SQL roster, partition and access-cutoff
checks. Active teachers/admins can inspect and moderate without allocating a room
or acquiring its owner lease, including after completion. Removed or banned
students cannot read through old roster entries. No cached browser role grants
authority.

Posting requires a current live participant connection. The private gateway port
returns its connection identity, role, immutable admission generation and durable
owner epoch/deadline. The service repeats fresh school authorization, verifies the
same connection still exists and bounds the proof by all original deadlines.
Observers cannot post, even if a teacher remains rostered from earlier play.
SQL repeats owner, active profile, partition, membership, admission cutoff and
nonterminal-session checks. A paused world can still chat; chat never steps its
clock. Expired, released/replaced owners and old admissions cannot post.

Messages contain a server-derived name, at most 500 Unicode characters and a
canonical per-session sequence. Control characters, malformed Unicode, invalid
receipts and out-of-order pages are rejected. The server never accepts a sender
name, sender role, sequence or timestamp from the browser. History returns up to
100 messages per page with a stable keyset cursor; this bounds an individual
response and imposes no stored-message, player or room admission cap. A partial
index supports visible history after moderated messages accumulate.

One request UUID binds sender/action/target and, for posts, a content hash. Lost
provider responses remain unconfirmed. Explicit same-UUID retry recovers the
receipt without duplicating a message. Receipts acknowledge `persisted:true` for
the chat transaction; they contain no message body or checkpoint-save claim.
Delete/clear retain tombstones and write one staff audit atomically. A retry of a
completed clear cannot erase messages posted afterward. Proofs last at most five
seconds and are rechecked after locks, writes and audit waits; expired work rolls
back together. Private tables enable RLS and deny direct browser/service access;
the authorization helper is private even to service-role callers.

The Hebrew dialog pauses local input, renders message bodies as escaped text,
supports older/latest pages and gives explicit confirmation for deletion/clear.
History refreshes every three seconds while open and visible. Scope changes and
closure abort reads; unconfirmed writes keep an explicit same-request retry.
Hidden staff get a read-only composer view with moderation controls. Chat bodies,
names and provider messages never enter operational event logs.

Release `bedd62f9b37b` retains protocol 13 and existing engine/content/checkpoint
formats. Full gates pass 86 domain, 80 native/three ignored, 84 actual-Wasm,
40 source and 40 packaged integration, 38 SDK/policy, seven school gateway,
50 actual PostgreSQL/SDK/native-worker and 94 web tests. Final types and the
production web build pass with 43 game modules and no forbidden modules.
The built three-context React fixture verifies lost-response retry, reopen
persistence, literal HTML-shaped text, hidden staff read-only access, deletion
and clear, followed by existing moderation/lifecycle and complete disposal.

The [evidence archive](../../../games/voxel/evidence/chat/README.md) preserves
matched artifacts and earlier failures. Initial combined status/control markup
was corrected; an earlier fullscreen mouse Exit timeout has an unproven cause.
The final instrumented run passes with acknowledged trusted input and zero owned
GPU/worker/audio resources. Fixture Auth/PostgREST/Storage, actual local SQL and
packaged workers establish functionality separately from authenticated hosted
school, hardware/input performance and provider/deployment recovery. Rewritten
LiveKit proximity and server-enforced mute/media revocation remain required.
