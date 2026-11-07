# Direct messaging

Apply `20261106120000_direct_messaging.sql` before releasing the updated client. It replaces direct message inserts and read updates with guarded RPCs; older browser tabs must reload. This migration follows the inbox write-permission migration from November 5.

Messages are individual conversations. Kids can contact eligible kids. Teachers can initiate with active same-gender kids, and administrators can initiate with any active kid. Kids can reply only after that identified staff member contacted them. Anonymous admin notices remain a separate read-only feed. Blocks, account activity, and current staff authority are rechecked on each send. Administrators use `admin_profiles`, not a new value in the kid/teacher role enum. Participant foreign keys reference authenticated identities so children can reply to identified administrators.

The global drawer, full inbox page, message shortcuts, drafts, send status, unread counts, and conversation paging share one account-scoped provider. The drawer uses a native modal with focus containment and Escape handling. Its trigger and alerts follow supported fullscreen game containers; opening messages exits fullscreen/pointer lock. Messages never automatically open the drawer. Drafts are held only in memory and cleared with the account state.

Conversation summaries use pages of 30, and message history uses pages of 50. Unread totals cover the entire inbox. Only visible incoming bubbles in a visible document are marked read. Send retries reuse a request UUID, and sender identity is derived in PostgreSQL.

Browser alerts are explicitly enabled per browser/account and require an open connected app tab. They include sender and a short preview, are silent, and focus/open the conversation on click. Foreground alerts appear in the app. BroadcastChannel shares visible conversations between tabs, and IndexedDB atomically claims message alerts to avoid duplicates. Claims expire after 24 hours and are cleared on account cleanup. Browser notification permission denial and unsupported platforms leave inbox delivery usable. Closed-app push, sounds, attachments, and group messaging are not included.

Validation:

- `npm run lint -w @playground/web`
- `npm run test -w @playground/web`
- `node scripts/check-dm-db.mjs /path/to/@electric-sql/pglite/dist/index.js` uses an isolated minimal PostgreSQL schema, never a deployed database.
- `node apps/web/tools/dm-browser.mjs` uses local fixture identities and RPC responses. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if the installed browser differs from Playwright's default. It uses the Playwright dependency already present in Wobble.

Rehearse the migration against the complete application schema before deployment. The local fixture tests do not establish deployed Supabase publication, permissions, or Realtime health. Monitor `Direct message operation failed` with operation/code and inbox connection transitions; telemetry omits message contents and identities.
