# Invitations, rematches, and inbox recovery

Apply `20261105140000_challenge_lifecycle.sql` before releasing the updated web and game services together. Existing browser tabs using direct challenge updates need to reload: writes now require guarded RPCs. The migration expires stale invitations and removes the old recipient-wide uniqueness rule.

Invitations are independent per sender, recipient, and game. Pending invitations last two minutes. Accepted invitations remain durable entry points until both participants actually enter together, even if acceptance succeeds but redirection fails. Their old expiry timestamp does not hide them. The first simultaneous entry marks `fulfilled_at`; the dock then removes the invitation permanently. The accepted access record remains for private-room rejoining. Completed, expired, declined and withdrawn invitations never appear as history. Other accepted invitations remain available when choosing one.

Game services renew admission through connected-membership writes. The main server refreshes every 30 seconds; claims expire after 90 seconds without renewal. The database enforces one claimed game per player. A paused or completed game releases its claim. This allows recovery after service crashes without trusting stale connected-player arrays forever.

Invitation cleanup runs every minute through pg_cron when installed, with a game-server timer as a fallback. Listing also performs cleanup; responding validates the locked invitation and room directly. Monitor `CHALLENGE_CLEANUP_FAILED` and `ADMISSION_HEARTBEAT_FAILED`.

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


## Withdrawal and list removal

Apply `20261108100000_challenge_resolution.sql` after the earlier invitation migrations and before releasing this client. It adds fulfillment, withdrawal metadata, plus guarded operations and a departure lookup. A source-level reference to the obsolete history filter is not a migration requirement: no invitation records need deletion.

| Stage / action | Result |
| --- | --- |
| Pending or accepted, room still waiting | Either participant can withdraw. The invitation leaves both lists. Ordinary waiting rooms close; any participant currently in that room returns home with an explanation. Expiration also closes an unstarted waiting room. |
| Accepted, game running or paused | Either participant can withdraw. The withdrawing player leaves through that runtime's normal disconnect/leave path, including its other active tabs/devices. Other players retain the running game's normal departure behavior. SQL does not fabricate a completed result. A withdrawn actor's room is excluded from their saved-session list. |
| Completed / already withdrawn | No history is shown. A repeated withdrawal is an idempotent success and does not modify the completed result. |
| Remove one / Clean all | Always cancel or decline first, then remove the resolved invitations. Accepted invitations also leave their associated game. Clean all resolves one snapshot atomically, so new arrivals survive and a failed batch leaves every card available for retry. |
| Both players enter together | The invitation disappears for both users and stays gone after either leaves. If a redirect failed before entry, the invitation stays accessible. |

The UI uses this browser's current room route for “you are here,” rather than lagging server presence or another tab. Peer presence additionally requires a fresh admission lease.

Trusted invitation cleanup, response, and entry-switching functions use runtime transaction-local `set_config` around protected writes and explicitly restore the previous setting. Function-level `SET`/`ALTER FUNCTION SET` on this custom parameter is avoided because hosted migration roles cannot configure it that way. This fixes cancellation's `game_sessions_authoritative_field` HTTP 400 without enabling direct browser state writes. Session-first locking also matches the fulfillment trigger. Voxel projections retain their separate guard: allocated voxel worlds use their service's normal departure/projection path, and browser invitation RPCs never override that authority.

The shared departure hook uses local withdrawal events, Realtime, and a polling fallback on game routes. Hidden tabs process withdrawal too. Waiting-room withdrawal closes both participants' views; running-game withdrawal ejects only its actor. The server's existing leave path handles game presence and pause behavior. Cancellation/removal failures are caught locally and reported to the game server with the operation, challenge ID, error code, and a bounded database reason.

The isolated PostgreSQL check installs the actual latest authoritative-column guard and voxel guard, and applies the migration as a non-superuser owner. It reproduces the custom-parameter DDL permission failure and checks setting restoration before committing the caller transaction. It reproduces the old cancellation error before applying the new migration, then checks authorization, guarded switching, either participant withdrawing in every room phase, resolved removal, cleanup snapshots, expiry with someone waiting, and permanent fulfillment. It still uses a minimal schema rather than a full deployment rehearsal.

Focused browser check (real app controls/routes, stateful game stand-in):

```sh
node apps/web/tools/error-recovery-browser.mjs --challenges
```

## Social controls

Rematch results offer acceptance and one exit action. The exit declines the offer (through the vote or normal disconnect path); there is no second decline button beside Home. Challenge cleanup sits in the list toolbar and resolves only the selected category; the All category covers every visible invitation. Player action sheets close on outside pointer interaction or Escape and have no large footer close button.

Challenge events enqueue bounded, deduplicated toasts for incoming invitations, acceptance, decline, cancellation and expiry. Initial list loads, polling and Realtime share the same lifecycle comparison; a participant-visible lookup distinguishes removed invitations from fulfilled ones when Realtime was missed. Own withdrawal actions and fulfilled invitations do not produce misleading partner-decline alerts.
