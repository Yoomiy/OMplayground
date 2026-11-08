# Frontend error recovery

Expected request failures stay in the feature that made the request. They must not throw during render, navigate away, clear drafts, or require a document reload. Keep the last successful data visible with an error and explicit retry. A failed lookup is different from a successful lookup that found nothing.

## Recovery scopes

| Scope | Behavior |
| --- | --- |
| Challenges | Validate list/entry responses before using them. Keep accepted invitations and cached rows on a failed refresh. The dock remains accessible even if the first load fails. Its panel offers Retry. |
| Direct messages | Validate threads, participants, messages and counts before updating state. Keep messages/drafts in the shared provider; retrying a failed panel does not discard the draft. Both the floating view and full inbox use the panel boundary. |
| Online players | Request errors and retries stay in the list on home and teacher pages. A rendering failure replaces the list only. |
| Room chat / voice | Independent rendering boundaries keep a chat or voice failure from unmounting the game connection. Room chat drafts live above its boundary. Board voice starts after successful room admission and stops on disconnect. Voice retry reconnects voice only. |
| Embedded games | Rocket/Wobble startup failures remove the failed frame and offer an in-app retry. Keep the canvas covered until a validated handshake and game state arrive. See [embedded game recovery](embedded-game-recovery.md). |
| Catalog / open rooms / saved sessions | Local errors with retry. Background request failures retain existing rows. Account changes clear account-scoped rows; stale responses cannot replace another account's session list. |
| Profile loading | Rejected requests settle the loading state. A failed refresh preserves the previous profile. An initial failure has a retry on protected routes instead of leaving home beneath a permanent loading overlay. |
| Room / invitation lookup | Failed requests have a retry. A transport failure is not labeled an invalid invitation. Successful empty lookups retain their normal unavailable/not-found behavior. |
| Any page | A route rendering error replaces that page, while shared widgets remain mounted. Retry recreates rejected React.lazy wrappers. Changing location or account clears the route boundary, so navigation is usable after an error. |
| App shell | The outer boundary remains a last resort for errors in the essential app/providers. It offers Retry; Home remains available even if the router itself failed. |

Request failures do not use rendering boundaries as normal control flow. Boundaries handle unexpected rendering and React lifecycle errors; async handlers still need their own catch/finally blocks. Retrying a page that owns a game connection can reconnect that game. Retrying a social widget or room-chat/voice panel leaves the game mounted.

An iframe navigation failure can display a browser error document without a
React exception. Its `load` event does not prove startup succeeded. Embedded
games need their own bounded readiness protocol, parent-owned fallback and
diagnostics; a React boundary alone cannot provide that recovery.

Challenge, inbox, and session-list polling use a retry gate: transient failures back off, and missing RPC/table/column responses pause automatic requests until an explicit retry. A schema mismatch cannot be repaired by retrying before the server migration is deployed. Malformed inbox/challenge responses are reported without logging payloads or message contents.

Boundary telemetry records `context.scope` plus the current route and component stack, using the current shell telemetry target. This distinguishes a page crash from a feature crash. The exact original exception behind a user's full-page error still requires its stack; a failed RPC alone does not establish that exception.

## Focused verification

Choose checks for the behavior changed. Documentation, labels and minor layout
edits do not require the browser recovery suites. Changes to request recovery,
iframe startup or draft preservation justify the corresponding focused fault
checks; full game suites are for changes that affect those games.

Unit checks: `npm test -w @playground/web -- src/lib/featureRecovery.test.ts src/lib/directMessages.test.ts`.

`node apps/web/tools/error-recovery-browser.mjs` injects failures into real app routes/widgets, with a stateful game stand-in. It checks missing migrations stop polling, malformed message responses stay local, feature retries preserve the game and DM draft, failed room/join/profile lookups recover, and navigation / rejected lazy-wrapper retries work in the same document. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using an existing Chromium installation. This is a recovery check, not a gameplay regression suite.
