# Invitations, rematches, and inbox recovery

Apply `20261105140000_challenge_lifecycle.sql` before releasing the updated web and game services together. Existing browser tabs using direct challenge updates need to reload: writes now require guarded RPCs. The migration expires stale invitations and removes the old recipient-wide uniqueness rule.

Invitations are independent per sender, recipient, and game. Pending invitations last two minutes. Acceptance creates a five-minute ready window; automatic entry happens only from ordinary app pages, when the player is free. Multiple accepted invitations remain available, with one automatic destination selected deterministically. Entering a game never automatically enters another when it finishes. Accepted sessions with someone already waiting retain their invitation rather than stranding that player.

Game services renew admission through connected-membership writes. The main server refreshes every 30 seconds; claims expire after 90 seconds without renewal. The database enforces one claimed game per player. A paused or completed game releases its claim. This allows recovery after service crashes without trusting stale connected-player arrays forever.

Invitation cleanup runs every minute through pg_cron when installed, with a game-server timer as a fallback. Listing and responding also perform cleanup. Monitor `CHALLENGE_CLEANUP_FAILED` and `ADMISSION_HEARTBEAT_FAILED`.

Rematches use the canonical consent policy in `packages/game-logic/src/rematch.ts`. Wobble bundles that source. Rocket generates its isolated copy with `scripts/sync-rematch.mjs` before its root build, tests, and typecheck; Docker also generates it from the canonical source. Anyone playing can initiate. Votes have a 30-second deadline, transient departures receive ten seconds to reconnect, and only connected acceptors enter the next round. Commands referring to an older vote are rejected.

Inbox queries remain usable when realtime fails. A visible degraded inbox refreshes every 15 seconds, with channel recreation after a minute of continuous failure. Recovery reconciles a database snapshot with events that arrived during the request. Account changes remount the state owner. Subscription errors and recovery are logged; the supplied CHANNEL_ERROR still needs observation against the deployed Supabase service to establish its underlying cause.

## Database regression check

The PostgreSQL check uses a minimal isolated schema and never connects to a deployed database. It tests migration syntax, multiple invitations, deduplication, ownership, expiry, conflicting admission, claim expiry, and claim release. It does not replace a migration rehearsal against the complete application schema.

Install `@electric-sql/pglite` in a temporary directory, then run:

```sh
node scripts/check-challenge-db.mjs /tmp/playground-challenge-db-check/node_modules/@electric-sql/pglite/dist/index.js
```

Before deployment, rehearse the migration against the full schema and use two browser accounts to verify navigation, busy-player messaging, reconnect, and inbox behavior. The current local validation does not establish deployed publication, RLS, or Realtime service health.
