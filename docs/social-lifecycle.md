# Invitations, rematches, and inbox recovery

Apply `20261105140000_challenge_lifecycle.sql` before releasing the updated web and game services together. Existing browser tabs using direct challenge updates need to reload: writes now require guarded RPCs. The migration expires stale invitations and removes the old recipient-wide uniqueness rule.

Invitations are independent per sender, recipient, and game. Pending invitations last two minutes. Accepted invitations remain durable entry points: their old expiry timestamp no longer hides them. Accepted playing and paused rooms remain accessible, and completed targets appear in the ended-history filter. Multiple accepted invitations remain available, with one automatic destination selected deterministically. Entering a game never automatically enters another when it finishes. Accepted sessions with someone already waiting retain their invitation rather than stranding that player.

Game services renew admission through connected-membership writes. The main server refreshes every 30 seconds; claims expire after 90 seconds without renewal. The database enforces one claimed game per player. A paused or completed game releases its claim. This allows recovery after service crashes without trusting stale connected-player arrays forever.

Invitation cleanup runs every minute through pg_cron when installed, with a game-server timer as a fallback. Listing and responding also perform cleanup. Monitor `CHALLENGE_CLEANUP_FAILED` and `ADMISSION_HEARTBEAT_FAILED`.

Rematches use the canonical consent policy in `packages/game-logic/src/rematch.ts`. Wobble bundles that source. Rocket generates its isolated copy with `scripts/sync-rematch.mjs` before its root build, tests, and typecheck; Docker also generates it from the canonical source. Anyone playing can initiate. Votes have a 30-second deadline, declining or leaving ends the offer immediately for everyone, and only connected acceptors enter the next round. The declining player returns home; other players see a closed-game explanation. The requester has an exit action without a decline action. Commands referring to an older vote are rejected.

Inbox queries remain usable when realtime fails. A visible degraded inbox refreshes every 15 seconds, with channel recreation after a minute of continuous failure. Recovery reconciles a database snapshot with events that arrived during the request. Account changes remount the state owner. Subscription errors and recovery are logged; the supplied CHANNEL_ERROR still needs observation against the deployed Supabase service to establish its underlying cause.

## Database regression check

The PostgreSQL check uses a minimal isolated schema and never connects to a deployed database. It tests migration syntax, multiple invitations, deduplication, ownership, expiry, conflicting admission, claim expiry, and claim release. It does not replace a migration rehearsal against the complete application schema.

Install `@electric-sql/pglite` in a temporary directory, then run:

```sh
node scripts/check-challenge-db.mjs /tmp/playground-challenge-db-check/node_modules/@electric-sql/pglite/dist/index.js
```

Before deployment, rehearse the migration against the full schema and use two browser accounts to verify navigation, busy-player messaging, reconnect, and inbox behavior. The current local validation does not establish deployed publication, RLS, or Realtime service health.


The invitation UI lives in `ChallengeDock` alongside Messages instead of above the page header. It uses a local one-second display clock independently of network refreshes. Apply `20261107120000_challenge_participant_presence.sql` for independent self/partner room presence. Copy distinguishes the challenger being busy in another game from the invitee being busy, and explicitly says who is waiting for whom. The display clock does not expire accepted invitations while either participant is already waiting inside that room.


Sending a challenge closes the player action menu and shows a brief success toast. Returning from another game produces an actionable reminder for an accepted outgoing invitation that was observed while busy. The reminder does not navigate automatically, replay on initial load, or appear after entering the invitation's own room. Expired empty invitations do not produce reminders. Clicking the invitation panel's backdrop or pressing Escape dismisses it.


## Entry and lifecycle classification

Apply `20261107140000_challenge_entry_navigation.sql` before deploying the updated client. The entry transaction locks and rechecks the old room, releases only the current user's old admission, and keeps the old invitation and saved roster intact. A start racing a waiting-room confirmation aborts the switch. Current completed/stopped, paused, or deleted rooms allow automatic entry; a waiting room asks; a playing room defers. Unknown status, solo games, and classroom editing routes are protected rather than guessed complete. Actual room status is observed through Realtime and polling, not inferred from the URL. A successful acceptance updates the local invitation immediately even if the subsequent list refresh fails. Other accepted invitations remain listed when one is chosen.

The main game server preserves never-started empty rooms as waiting, and retries failed natural-finish/stop writes through a completion queue, including after the in-memory room disappears. Rematch starts wait for pending final writes. Explicit terminal timestamps are repaired to completed during migration; ambiguous old paused data is preserved. Rocket and Wobble retain waiting-lobby checkpoints without classifying them as interrupted playing matches. Active-game disconnects remain resumable; they are not classified as successful completion.

The only generic DM entry is the bottom floating control. Header links and the home unread duplicate are removed. The drawer's expand action opens `/inbox` with the selected partner and shared draft state. Room chat/voice controls and recipient-specific message shortcuts retain their separate functions.


Accepted invitations now record `accepted_at`. If an unused accepted invitation is later cancelled, it remains in the ended-history filter with a cancelled explanation instead of disappearing. Existing rows already expired before this migration cannot reliably be identified as formerly accepted, so the migration does not resurrect them. An entry failure opens the relevant invitation category for retry; successful acceptance is not undone by that failure.
