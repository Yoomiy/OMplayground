# Trusted roster departure

`POST /api/voxel/leave` accepts exactly `{room, requestId}` and a current Playground
bearer token. It derives the actor from verified Auth and an active profile; the
browser cannot name another actor or supply a role, lease, revision or save result.
The home page uses this endpoint for voxel rejoin cards and keeps the same request
UUID on retry. Other games continue to use their existing platform action.

Departure is available outside recess and after a partition change. It grants no
gameplay or cross-partition read authority. SQL checks the game, accepted roster,
fresh profile and a proof expiring within five seconds, including after lock waits.
Connected presence with an unexpired deadline returns `ROSTER_BUSY`. Stale presence
is cleared. A host leaving a nonempty roster transfers controls to the next roster
member, with profile-derived names and grade. Presence stays aligned with current
membership and active profiles. There is no minimum-player or admission-count rule.

The last member cannot dismiss a room with a live owner. Normal game Exit must
first finish its coherent checkpoint, final presence, worker stop and owner release.
The home action reports busy and allows retry while that retirement is pending.
After release it removes the empty roster and marks the session terminal. A crashed
owner must expire before that operation; its last committed checkpoint remains the
durable state. This endpoint returns no `saved` acknowledgement and does not delete
checkpoint objects or start a worker.

Every departure increments `voxel_roster_revision`. Admission carries that private
revision to the fenced membership RPC, which checks it with the owner and proof
deadline under database locks. A ticket from before removal cannot add the departed
identity back. Ticket renewal and connected-actor renewal have distinct contexts:
new tickets may seek open-room admission, while connected participants must still
be accepted roster members. Passive TNT-owner checks also require membership.
Revocation follows the existing bounded five-second authority deadlines. A new
explicit admission can rejoin an eligible open room; departure is not a ban.

Receipts are service-only and idempotent per session/request UUID. Replaying an old
receipt after a later rejoin returns that historical receipt without removing the
new membership. A different actor cannot reuse it. Missing-world departure creates
guarded metadata without an owner/worker so legacy browser writes cannot undo its
revision. The unversioned membership RPC loses its service grant; older service
builds cannot bypass the new fence.

This requires
[`20261025040000_voxel_roster_departure.sql`](../../../supabase/migrations/20261025040000_voxel_roster_departure.sql),
after the three previously installed voxel migrations. The fourth migration is
prepared and tested locally. A subsequent read-only check confirms the hosted
roster schema is now installed; the agent did not apply it. Current readiness
also requires the fifth [staff schema](staff-commands.md). Earlier
three-schema hosted PASS records retain their original build and scope. Rollout
requires the matching new service build and this migration, with normal drain.

SQL/SDK/HTTP tests cover host transfer, aligned profile names, stale revision and
proof rejection, row-lock expiry, connected/last-owner denial, normal terminal
departure, receipt replay after rejoin, forged targets, active-profile and browser
grant isolation, metadata creation and old-partition self-removal. School socket
tests cover accepted-member revocation and old-ticket rejection. Full hosted
school authorization/recovery and the actual authenticated catalog-shell journey
remain separate qualification gates. Staff mode/self-teleport are locally qualified in the fifth migration; removal/bans,
enforced media commands, chat, LiveKit and classroom extraction remain unfinished.
