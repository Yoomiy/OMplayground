# Friends Mechanism Deprecation (Temporary)

## Goal

Disable friend-request and friend-list behavior in production UX while keeping
enough code and schema artifacts to restore the mechanism later with minimal
risk.

## What was changed

### 1) Mutation hard-stop in API layer

- File: `apps/web/src/lib/friendsApi.ts`
- `sendFriendRequest`, `respondToFriendRequest`, and `unfriend` now throw a
  shared deprecation error before touching Supabase.
- `blockKid` and `unblockKid` are intentionally left active (safety control,
  not friendship lifecycle).

### 2) Single deprecation toggle/message

- File: `apps/web/src/lib/friendsDeprecation.ts`
- Added:
  - `FRIENDS_MECHANISM_DEPRECATED`
  - `FRIENDS_DEPRECATION_MESSAGE`

### 3) Active UI entry-points removed

- File: `apps/web/src/App.tsx`
  - Removed global `FriendRequestPopup` mount.
  - `/friends` route now renders a deprecation page.
- File: `apps/web/src/pages/HomePage.tsx`
  - Removed `friends` scope filter for open games.
  - Removed top-nav link to `/friends`.
  - Removed `useFriendships` dependency in this page.
- File: `apps/web/src/pages/PublicProfilePage.tsx`
  - Removed "send friend request" action.
  - After block action, redirect now goes to `/home` instead of `/friends`.
- File: `apps/web/src/components/KidActionSheet.tsx`
  - Removed "send friend request" action.
  - Updated section copy from "message + friendship" to "message".

### 4) User-facing deprecation surface

- New file: `apps/web/src/pages/FriendsDeprecatedPage.tsx`
- Purpose: explain that friendship is disabled, and send user back to Home.

## Intentionally preserved as dormant/dead code

These are kept on purpose to make rollback straightforward:

- `apps/web/src/pages/FriendsPage.tsx` (legacy friends UI implementation)
- `apps/web/src/components/FriendRequestPopup.tsx` (legacy popup)
- `apps/web/src/hooks/useFriendships.ts` (legacy query + realtime hook)
- `apps/web/src/hooks/usePendingFriendRequest.ts` (legacy pending request hook)
- Supabase friendship schema and RLS migrations remain untouched.

## Why this approach

- Prevents new friend lifecycle writes immediately (API guard).
- Reduces accidental use by removing UI entry-points.
- Keeps implementation artifacts for low-effort future restoration.
- Avoids risky data migration/deletion while product direction is uncertain.

## Rollback plan (when/if friends return)

1. In `apps/web/src/lib/friendsDeprecation.ts`, set
   `FRIENDS_MECHANISM_DEPRECATED` to `false` (or remove the guards).
2. In `apps/web/src/App.tsx`:
   - remount `FriendRequestPopup`
   - route `/friends` back to `FriendsPage`
3. In `apps/web/src/pages/HomePage.tsx`:
   - re-add `/friends` nav button
   - re-add `"friends"` filter scope and `useFriendships`
4. In `apps/web/src/pages/PublicProfilePage.tsx`:
   - restore friend-request action/button
5. In `apps/web/src/components/KidActionSheet.tsx`:
   - restore friend-request action/button
6. Run frontend smoke tests for:
   - sending/accepting/declining/unfriending
   - popup behavior
   - open-game friends filter

## Database status

- No SQL migration was applied for this deprecation.
- Existing friend data remains as-is in Supabase.
- If a future permanent removal is desired, plan a separate data/migration phase.
