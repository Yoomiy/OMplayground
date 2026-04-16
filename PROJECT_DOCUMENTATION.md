# 🎮 מגרש המשחקים — Complete Project Documentation

> **Language Note:** The application UI is in **Hebrew** (RTL layout). This documentation is written in English for technical clarity.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project File Structure](#3-project-file-structure)
4. [Authentication Architecture](#4-authentication-architecture)
5. [Database Entities (Schema)](#5-database-entities-schema)
6. [Pages (Routes & UI)](#6-pages-routes--ui)
7. [Backend Functions](#7-backend-functions)
8. [Frontend Components](#8-frontend-components)
9. [Real-Time Architecture](#9-real-time-architecture)
10. [Game System](#10-game-system)
11. [Social System](#11-social-system)
12. [Moderation & Safety](#12-moderation--safety)
13. [Recess Scheduling System](#13-recess-scheduling-system)
14. [Avatar System](#14-avatar-system)
15. [Admin Panel](#15-admin-panel)
16. [Teacher Role](#16-teacher-role)
17. [Data Export System](#17-data-export-system)
18. [Security Model](#18-security-model)
19. [Clock Skew & Time Handling](#19-clock-skew--time-handling)
20. [Analytics](#20-analytics)
21. [Key Design Decisions](#21-key-design-decisions)

---

## 1. Project Overview

**מגרש המשחקים** ("The Playground") is a school-based multiplayer gaming platform designed for children (grades 1–7). It allows kids to play browser-based games with each other **only during authorized recess periods**, enforced by a time-lock mechanism. The platform includes a rich social layer (friends, private messages, challenges), a teacher supervision dashboard, and a full admin control panel.

### Core Concepts

| Concept | Description |
|---|---|
| **Recess-gated access** | Kids can only log in and play during scheduled recess windows. Outside those windows, login is blocked server-side. |
| **Custom auth system** | Kids do NOT use the standard Base44 authentication. They have their own username/password system backed by `KidAccount` entities and server-side `Session` tokens. |
| **Gender separation** | Games, sessions, and the social graph are segregated by gender (`boy` / `girl`). Each kid only sees and interacts with kids of the same gender. |
| **Public / Private split** | Every `KidAccount` has a mirrored `PublicKidProfile` — a read-only public record used for real-time subscriptions. Sensitive data (password, blocked list) stays in the private account. |
| **Admin panel** | Admins (Base44 platform users with role `admin`) manage kids, games, schedules, and moderation from the admin panel pages. |
| **Teacher role** | A special `role: 'teacher'` inside `KidAccount` gives access to the teacher dashboard for monitoring live sessions. Teachers log in via the same kid login form and bypass the recess time check. |

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend framework** | React 18 + Vite |
| **Routing** | React Router v6 |
| **Styling** | Tailwind CSS v3 + shadcn/ui component library |
| **State management** | @tanstack/react-query v5 (server state) + React `useState` (local state) |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Backend runtime** | Deno Deploy (via Base44 backend functions) |
| **Database** | Base44 managed database (entity-based ORM) |
| **Real-time** | Base44 entity subscriptions (WebSocket-backed) |
| **File uploads** | Base44 Core integration (`UploadFile`) |
| **Auth** | Custom session-based auth for kids; Base44 platform auth for admins |

---

## 3. Project File Structure

```
/
├── index.html                    # HTML entry point (title, meta, favicon)
├── index.css                     # Tailwind base + CSS design tokens (HSL variables)
├── tailwind.config.js            # Tailwind theme: maps CSS vars to Tailwind classes
├── App.jsx                       # Application router: wraps all routes in Auth + QueryClient
├── Layout.jsx                    # Global layout wrapper (session validation + heartbeat init)
├── pages.config.js               # Auto-generated page registry + Layout wiring
├── main.jsx                      # React DOM entry point
│
├── pages/
│   ├── Home.jsx                  # Landing page: immediately redirects to KidLogin
│   ├── KidLogin.jsx              # Kid login form (username + password)
│   ├── KidHome.jsx               # Main kid dashboard (games, friends, social)
│   ├── KidGamePlay.jsx           # In-game page (hosts the actual game + controls)
│   ├── Inbox.jsx                 # Kid messaging inbox (messages + friend requests)
│   ├── Profile.jsx               # Kid profile editor (avatar, password, stats)
│   ├── TeacherHome.jsx           # Teacher monitoring dashboard
│   ├── TeacherGameWatch.jsx      # Teacher observation view of a single game session
│   ├── AdminGames.jsx            # Admin: manage Game catalog (CRUD)
│   ├── AdminKids.jsx             # Admin: manage KidAccounts (CRUD, CSV import, reports)
│   ├── AdminSchedule.jsx         # Admin: manage recess schedule (CRUD)
│   ├── GamePlay.jsx              # Legacy/alternate game play page
│   └── DataExport.jsx            # Admin: export all entity data as PostgreSQL SQL
│
├── components/
│   ├── AdminProtection.jsx       # HOC: redirects non-admins to KidLogin
│   ├── UserNotRegisteredError.jsx
│   ├── ProtectedRoute.jsx
│   │
│   ├── playground/
│   │   ├── GameLibrary.jsx       # Grid display of available games
│   │   ├── OpenGames.jsx         # List of joinable open game sessions
│   │   ├── SavedGames.jsx        # List of paused/saved game sessions
│   │   ├── OnlineUsers.jsx       # Sidebar: currently online kids
│   │   ├── FriendsList.jsx       # Friends, pending requests, blocked list
│   │   ├── KidAvatar.jsx         # Avatar renderer (photo > preset > emoji > initial)
│   │   ├── KidProfileCard.jsx    # Popup profile card with social actions
│   │   ├── ComposeMessage.jsx    # Message composition dialog
│   │   ├── MessageThread.jsx     # Message thread view
│   │   └── RecessTimer.jsx       # Countdown timer for remaining recess time
│   │
│   ├── game/
│   │   ├── GameRenderer.jsx      # Selects and renders the correct game component
│   │   ├── GameChat.jsx          # In-game chat panel
│   │   ├── PostGameOverlay.jsx   # Shown after game ends (score, play again)
│   │   ├── AudioPlayer.jsx       # Audio message playback
│   │   └── PlayerIndicator.jsx   # Shows player list and their status
│   │
│   ├── games/
│   │   ├── TicTacToe.jsx
│   │   ├── ConnectFourGame.jsx
│   │   ├── MemoryGame.jsx
│   │   ├── SnakeGame.jsx
│   │   ├── SimonGame.jsx
│   │   ├── WhackAMoleGame.jsx
│   │   ├── BalloonPopGame.jsx
│   │   └── DrawingGame.jsx
│   │
│   ├── hooks/
│   │   ├── useHeartbeat.js       # Periodic last_seen pings + offline signal on tab close
│   │   ├── useOnlineKids.js      # Query + real-time subscription for online kid list
│   │   ├── useRecessCheck.js     # Polls/checks if currently in a recess window
│   │   ├── useRecessLogout.js    # Forces logout when recess ends
│   │   ├── useUnreadMessages.js  # Subscribes to unread message count
│   │   └── constants.js          # Shared constants (e.g. ONLINE_THRESHOLD)
│   │
│   └── ui/                       # shadcn/ui components (button, card, dialog, etc.)
│
├── functions/                    # Deno backend functions (HTTP handlers)
│   ├── createSession.js          # Login: validate credentials → create Session record
│   ├── validateSession.js        # Validate session_id + return kid data
│   ├── deleteSession.js          # Logout: delete Session record + analytics track
│   ├── updateHeartbeat.js        # Update last_seen for a kid (periodic ping)
│   ├── clearLastSeen.js          # Set last_seen to null (tab close / logout)
│   ├── getOnlineKids.js          # Return IDs of kids with recent last_seen
│   ├── getMyPrivateProfile.js    # Return caller's own KidAccount data (via session)
│   ├── updateKidProfile.js       # Update avatar/password/best_scores (allowlist only)
│   ├── updateKidState.js         # Update challenge/friends/blocked fields (allowlist)
│   ├── sendPrivateMessage.js     # Send a private message to another kid
│   ├── adminSendMessage.js       # Admin sends a message to a kid (admin-only)
│   ├── markMessagesRead.js       # Mark specific messages as read + update counter
│   ├── sendFriendRequest.js      # Send or auto-accept friend requests
│   ├── respondToFriendRequest.js # Accept or decline a pending friend request
│   ├── blockKid.js               # Block a kid (removes from friends + pending)
│   ├── reportMessage.js          # Submit a moderation report
│   ├── clearSessionChat.js       # Teacher: clear all chat in a game session
│   ├── deleteChatMessage.js      # Teacher: replace a chat message with deletion notice
│   ├── clearAllSessions.js       # Admin: delete all sessions (only if not recess time)
│   ├── evictStalePlayers.js      # Admin: remove offline players from game sessions
│   ├── updateSessionExpirations.js # Admin: refresh session expiry to end of current recess
│   └── migratePublicProfiles.js  # One-time: create PublicKidProfile for all KidAccounts
│
├── entities/                     # JSON Schema definitions for database tables
│   ├── KidAccount.json
│   ├── PublicKidProfile.json
│   ├── Session.json
│   ├── Game.json
│   ├── GameSession.json
│   ├── ChatMessage.json
│   ├── PrivateMessage.json
│   ├── ModerationReport.json
│   ├── RecessSchedule.json
│   └── AvatarPreset.json
│
├── lib/
│   ├── AuthContext.jsx           # Base44 platform auth context (admin only)
│   ├── NavigationTracker.jsx     # Tracks current page for analytics
│   ├── app-params.js             # App config params (appId, token, etc.)
│   ├── query-client.js           # TanStack Query client singleton
│   ├── utils.js                  # cn() utility for class merging
│   └── PageNotFound.jsx          # 404 page
│
├── api/
│   └── base44Client.js           # Pre-initialized Base44 SDK client (no auth required)
│
├── hooks/
│   └── use-mobile.jsx            # Responsive hook (not custom, from shadcn)
│
└── utils/
    └── index.ts                  # createPageUrl() helper for routing
```

---

## 4. Authentication Architecture

This project uses **two separate authentication systems** in parallel:

### 4.1 Admin Authentication (Base44 Platform Auth)
Standard Base44 authentication is used only for admin users (teachers on the platform, app builders). This powers:
- The `AdminProtection` component (checks `user.role === 'admin'`)
- Admin-only backend functions (`base44.auth.me()` in Deno functions)
- The `DataExport` page, `AdminGames`, `AdminKids`, `AdminSchedule` pages

The admin users are managed via the Base44 dashboard invite system.

### 4.2 Kid Authentication (Custom Session-Based)

Kids have **completely separate credentials** stored in the `KidAccount` entity. There is no link to Base44 platform users.

**Login Flow:**
```
Kid enters username + password
        │
        ▼
createSession (Deno function)
  1. KidAccount.filter({ username, password })
  2. Check is_active (reject if banned)
  3. For non-teachers: check Israel time vs. RecessSchedule (reject if not recess)
  4. Create Session { session_id: UUID, kid_account_id, expires_at }
  5. Return { session_id, kid: { id, name, gender, avatar, role } }
        │
        ▼
Frontend stores session_id in sessionStorage
        │
        ▼
All subsequent requests pass session_id in the request body
Backend functions validate via: Session.filter({ session_id }) + expiry check
```

**Session Lifetime:**
- **Kids:** Session expires exactly when the current recess window ends (+ 59 seconds buffer)
- **Teachers:** Sessions last 8 hours

**Session Validation Pattern (used in all protected functions):**
```js
const sessions = await base44.asServiceRole.entities.Session.filter({ session_id });
if (!sessions.length || new Date(sessions[0].expires_at) < new Date()) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
const account = await base44.asServiceRole.entities.KidAccount.get(sessions[0].kid_account_id);
if (!account || !account.is_active) return Response.json({ error: 'Unauthorized' }, { status: 401 });
```

**Session Cleanup:**
- On logout: `deleteSession` function deletes the Session record
- On tab close: `clearLastSeen` sets `last_seen: null` (keepalive fetch)
- Probabilistic cleanup: 20% chance on each login, expired sessions are bulk-deleted
- Admin can force-clear all sessions via `clearAllSessions` (only allowed outside recess)

---

## 5. Database Entities (Schema)

### 5.1 `KidAccount` (Private)

The central user record for kids. Has strict RLS: only admins can read, write, update, or delete.

| Field | Type | Description |
|---|---|---|
| `id` | string (auto) | Primary key |
| `username` | string | Login username (unique) |
| `password` | string | Plaintext password (stored directly, no hashing) |
| `full_name` | string | Display name |
| `gender` | enum: boy/girl | Determines which gender partition the kid sees |
| `grade` | number | Grade level (1–7) |
| `role` | enum: kid/teacher | Kid or teacher privileges |
| `is_active` | boolean | If false, kid is banned |
| `avatar_color` | string | Hex color for avatar background |
| `avatar_preset_id` | string | Key of selected avatar preset |
| `avatar_url` | string | Custom photo URL (overrides preset) |
| `last_seen` | datetime | Last heartbeat timestamp (used for online detection) |
| `best_scores` | object | Map of `game_url → score` |
| `pending_challenge` | object | Incoming game challenge `{ from_kid_id, session_id, game_id, ... }` |
| `friend_ids` | array | List of accepted friend KidAccount IDs |
| `pending_friend_request_ids` | array | IDs of kids who sent pending friend requests |
| `blocked_kid_ids` | array | IDs of kids this user has blocked |
| `unread_message_count` | integer | Cached count of unread private messages |
| `created_date` | datetime (auto) | |
| `updated_date` | datetime (auto) | |

### 5.2 `PublicKidProfile` (Public read)

A mirror of the non-sensitive fields from `KidAccount`. RLS: **anyone can read**, only admins can write. This is the entity used for real-time subscriptions on the frontend (so kids can subscribe to each other's online status and challenges without exposing private data).

| Field | Description |
|---|---|
| `kid_id` | Foreign key to `KidAccount.id` |
| `full_name`, `gender`, `grade` | Mirror of KidAccount |
| `avatar_url`, `avatar_color`, `avatar_preset_id` | Avatar fields |
| `last_seen` | Mirrored from heartbeat (determines "online" status) |
| `best_scores` | Mirrored from KidAccount |
| `pending_challenge` | Mirrored so other kids can subscribe and detect challenges |
| `is_active`, `role` | Access control mirror |

**Dual-write pattern:** Whenever `updateHeartbeat`, `updateKidProfile`, `updateKidState`, or `clearLastSeen` write to `KidAccount`, they also write the same fields to `PublicKidProfile`. This keeps the public mirror in sync.

### 5.3 `Session`

Stores active kid login sessions.

| Field | Description |
|---|---|
| `session_id` | UUID string (the token kids carry in sessionStorage) |
| `kid_account_id` | FK to KidAccount |
| `expires_at` | Session expiration timestamp |

RLS: Kids can only read their own session. Write/delete require admin.

### 5.4 `Game`

The game catalog managed by admins.

| Field | Description |
|---|---|
| `name_he` | Hebrew game name |
| `description_he` | Hebrew description |
| `type` | `embedded` (iframe) or `custom` (React component) |
| `game_url` | URL for embedded games, or component key for custom games (e.g. `tictactoe`, `snake`) |
| `thumbnail_url` | Cover image |
| `max_players` | Maximum players (1 for single-player) |
| `min_players` | Minimum players (default 1) |
| `is_active` | Whether visible to kids |
| `for_gender` | `boy`, `girl`, or `both` |

RLS: All active games readable by anyone; create/update/delete admin only.

### 5.5 `GameSession`

An active or saved multiplayer game instance.

| Field | Description |
|---|---|
| `game_id` | FK to Game |
| `host_id` | Kid ID of the host (first to join) |
| `host_name` | Host display name |
| `player_ids` | Array of currently joined player IDs |
| `player_names` | Matching display names array |
| `status` | `waiting`, `playing`, `paused`, `completed` |
| `is_open` | If true, any kid in the gender partition can join |
| `invitation_code` | Unique code for share links |
| `game_state` | Arbitrary JSON blob — stores game-specific state |
| `started_at` | When game transitioned to `playing` |
| `last_activity` | Updated on any game state change |
| `gender` | Which gender partition this session belongs to |

No RLS restrictions on reading; write is open (kid-driven via SDK from KidGamePlay).

### 5.6 `ChatMessage`

In-game chat messages within a specific `GameSession`.

| Field | Description |
|---|---|
| `session_id` | FK to GameSession |
| `sender_id` | Kid ID (or `'system'` for system messages) |
| `sender_name` | Display name |
| `message` | Text content |
| `audio_url` | Optional voice message URL |
| `timestamp` | When message was sent |

RLS: Read is public; update and delete are blocked (teachers use backend functions to soft-delete).

### 5.7 `PrivateMessage`

Direct messages between kids, as well as friend request notifications.

| Field | Description |
|---|---|
| `from_kid_id` | Sender ID (`'admin'` for admin messages) |
| `from_kid_name` | Sender name |
| `to_kid_id` | Recipient ID |
| `to_kid_name` | Recipient name |
| `gender` | Sender's gender |
| `content` | Message text (max 300 chars for kids, 500 for admin) |
| `is_read` | Read status |
| `type` | `message` or `friend_request` |
| `friend_request_status` | `pending`, `accepted`, or `declined` (only for friend requests) |

RLS: Delete requires admin.

### 5.8 `ModerationReport`

Reports submitted by kids about other kids.

| Field | Description |
|---|---|
| `reporter_kid_id` | Who reported |
| `reporter_kid_name` | Reporter's name |
| `reported_kid_id` | Who was reported |
| `reported_kid_name` | Reported kid's name |
| `message_content` | The offending message text |
| `reporter_note` | Optional note from reporter |
| `status` | `pending` or `reviewed` |

RLS: Any kid can create (via `reportMessage` function). Read/update/delete require admin.

### 5.9 `RecessSchedule`

Defines when the playground is open.

| Field | Description |
|---|---|
| `day_of_week` | 0 (Sunday) – 6 (Saturday) |
| `start_time` | `HH:MM` string |
| `end_time` | `HH:MM` string |
| `name_he` | Hebrew label (e.g. "הפסקה ראשונה") |
| `is_active` | Whether this schedule entry is enforced |

RLS: Read is public; write requires admin.

### 5.10 `AvatarPreset`

Admin-defined avatar options (supplements the hardcoded built-in presets).

| Field | Description |
|---|---|
| `key` | Unique English identifier (e.g. `'fox'`) |
| `label_he` | Hebrew display label |
| `emoji` | Emoji character (used if no image) |
| `image_url` | Optional uploaded image URL |
| `is_active` | Whether visible to kids |
| `sort_order` | Display order |

RLS: Read is public; write requires admin.

---

## 6. Pages (Routes & UI)

### 6.1 Routing Architecture

Routes are defined in two places:
1. **`pages.config.js`** — auto-generated registry of page components. Wires in the `Layout` component.
2. **`App.jsx`** — the actual router. The `pagesConfig` loop creates routes for all pages. Additional explicit `<Route>` elements are added for pages not in the auto-generated config (e.g. `DataExport`).

The `Layout.jsx` wraps every page and handles session validation + heartbeat initialization.

### 6.2 `Home` — Landing Redirect
**Route:** `/Home` (mainPage)  
Immediately redirects to `/KidLogin` via `window.location.href`. No UI rendered.

### 6.3 `KidLogin` — Kid Login Page
**Route:** `/KidLogin`  
- Hebrew RTL login form with username + password
- Checks recess schedule and shows a warning if it's not recess time
- Existing valid session → auto-redirects to `KidHome` (or `TeacherHome` for teachers)
- Calls `createSession` backend function
- On success: stores `session_id` in `sessionStorage` and navigates

### 6.4 `KidHome` — Main Kid Dashboard
**Route:** `/KidHome`  
The central hub for kids. A complex page with many sub-features:

**Left sidebar:** Online kids list (`OnlineUsers`), friends list (`FriendsList`)  
**Main area:** Tabs for:
- **Game Library** (`GameLibrary`) — all available games for the kid's gender
- **Open Games** (`OpenGames`) — joinable sessions
- **Saved Games** (`SavedGames`) — paused sessions to resume

**Features:**
- Session validation on mount → redirects to login if invalid
- Real-time subscriptions on `GameSession` and `PublicKidProfile`
- Starting a new game: creates a `GameSession` and navigates to `KidGamePlay`
- Joining a game: adds player to existing `GameSession` → navigates to `KidGamePlay`
- Challenge system: receives real-time `pending_challenge` updates via `PublicKidProfile` subscription
- Recess timer (`RecessTimer`) showing time remaining
- Logout: calls `deleteSession`, clears sessionStorage, and navigates to `KidLogin`

### 6.5 `KidGamePlay` — In-Game Page
**Route:** `/KidGamePlay`  
Receives `sessionId` and `gameSessionId` from URL parameters (or sessionStorage).

**Lifecycle:**
1. Validate kid session → get kid data
2. Subscribe to `GameSession` real-time updates
3. If session status is `waiting` and enough players joined → transition to `playing`
4. Render the correct game component via `GameRenderer`
5. Pass game state callbacks: `onGameStateUpdate`, `onGameEnd`, etc.
6. Host controls: toggle privacy, share invite link, end game
7. Teacher view: read-only observation mode (no game controls)

**Cleanup on leave:** If kid leaves while `waiting` → session marked `completed`. If `playing` → `paused`.

### 6.6 `Inbox` — Private Messages
**Route:** `/Inbox`  
- Validates session on mount
- Two tabs: **Inbox** (received) and **Sent**
- Groups messages by conversation thread
- Friend request cards with Accept/Decline actions (calls `respondToFriendRequest`)
- Mark as read when thread is opened (calls `markMessagesRead`)
- Report button → calls `reportMessage`
- Block button → calls `blockKid`
- Compose new message → `ComposeMessage` dialog

### 6.7 `Profile` — Kid Profile Editor
**Route:** `/Profile`  
- Validates session on mount
- Shows kid's avatar (live preview as you change it)
- Avatar options: upload photo, select preset, choose background color
- Password change form (with validation)
- Game stats: best scores per game, total sessions played, favorite game
- Saves via `updateKidProfile` backend function

### 6.8 `TeacherHome` — Teacher Monitoring Dashboard
**Route:** `/TeacherHome`  
- Validates teacher session (role check: `role === 'teacher'`)
- Shows all active `GameSession` records split into boys/girls sections
- Displays which game, how many players, status
- Highlights sessions playing outside recess hours ("unauthorized")
- Link to `TeacherGameWatch` for observing individual sessions

### 6.9 `TeacherGameWatch` — Session Observation
**Route:** `/TeacherGameWatch`  
- Teacher-only: observe a running game session in real time
- Can read chat, delete individual messages (`deleteChatMessage`), or clear all chat (`clearSessionChat`)
- Read-only game view (no game controls)

### 6.10 `AdminGames` — Game Catalog Management
**Route:** `/AdminGames`  
Protected by `AdminProtection`.  
- Full CRUD for `Game` records
- Form fields: name (Hebrew), description, `game_url` / component key, thumbnail URL, player counts, gender filter, active toggle
- Create/Edit via dialog
- Delete with confirmation

### 6.11 `AdminKids` — User Management
**Route:** `/AdminKids`  
Protected by `AdminProtection`. The most complex admin page.

**Sections:**
- **Teachers** — shown separately at top
- **Boys** — grid of boy KidAccounts
- **Girls** — grid of girl KidAccounts
- **Avatar Presets** — manage built-in and custom presets

**UserCard actions (per kid):**
- ✏️ Edit (opens edit dialog with full form + avatar editor)
- 💬 Send admin message (via `adminSendMessage`)
- 🚫 Ban / Unban (toggles `is_active`)
- 🚩 View reports (per-kid report dialog)
- 🗑️ Delete (cascade: deletes messages, sessions, reports, then account)

**Features:**
- Search by name or username
- Filter by grade
- CSV bulk import (columns: username, password, full_name, gender, grade, role)
- Report bank (all pending moderation reports in one dialog)
- Avatar editor with photo upload + preset grid + color picker

### 6.12 `AdminSchedule` — Recess Schedule
**Route:** `/AdminSchedule`  
Protected by `AdminProtection`.  
- Full CRUD for `RecessSchedule` records
- Organized by day of week (Sunday through Saturday)
- Shows start/end times and calculated duration in minutes
- Active/inactive toggle per schedule entry

### 6.13 `DataExport` — SQL Export Tool
**Route:** `/DataExport`  
Protected by `AdminProtection`.  
- Exports all entity data as PostgreSQL-compatible SQL (CREATE TABLE + INSERT statements)
- Separate "Export Users" section for the Base44 User entity
- Handles PostgreSQL reserved words (e.g. `user` becomes `"user"`)
- Infers column types from data (TEXT, INTEGER, NUMERIC, BOOLEAN, JSONB, TIMESTAMPTZ)
- Downloads as `.sql` file

---

## 7. Backend Functions

All functions are Deno Deploy HTTP handlers, called from the frontend via:
```js
await base44.functions.invoke('functionName', payload)
```

### Session Management

| Function | Auth Required | Description |
|---|---|---|
| `createSession` | None | Login: validate credentials + recess time → create Session |
| `validateSession` | None (session_id in body) | Check if session is valid + return kid data |
| `deleteSession` | None (session_id in body) | Logout: delete Session record + analytics event |
| `clearAllSessions` | Admin (Base44 auth) | Delete ALL sessions — only allowed outside recess |
| `updateSessionExpirations` | Admin | Extend all active sessions to end of current recess |

### Heartbeat / Presence

| Function | Description |
|---|---|
| `updateHeartbeat` | Set `last_seen` to now on `KidAccount` + `PublicKidProfile`. Validates `x-session-id` header. |
| `clearLastSeen` | Set `last_seen: null` on both records. Called with `keepalive: true` on tab close. |
| `getOnlineKids` | Return kid IDs with `last_seen` within the last 90 seconds. Filters by gender. |

### Profile & State

| Function | Description |
|---|---|
| `getMyPrivateProfile` | Return caller's full `KidAccount` data (validates session). |
| `updateKidProfile` | Update avatar/password/best_scores — allowlist enforced. Dual-writes to public profile. |
| `updateKidState` | Update challenge/friends/blocked fields. Kids can only write `pending_challenge` to other kids. |

### Messaging

| Function | Description |
|---|---|
| `sendPrivateMessage` | Send a text message. Validates session, checks block list, enforces 300-char limit. Updates recipient's `unread_message_count`. |
| `adminSendMessage` | Admin-only. Sends a message from `'📢 הנהלה'`. Updates unread count. |
| `markMessagesRead` | Mark a list of message IDs as read. Recalculates and updates `unread_message_count`. |

### Social Graph

| Function | Description |
|---|---|
| `sendFriendRequest` | Create a `friend_request` PrivateMessage. Auto-accepts if a mutual pending request exists. Prevents duplicates. |
| `respondToFriendRequest` | Accept or decline. If accepted: adds to both `friend_ids` arrays. |
| `blockKid` | Add to blocker's `blocked_kid_ids`. Remove from `friend_ids` and `pending_friend_request_ids` on both sides. |

### Moderation

| Function | Description |
|---|---|
| `reportMessage` | Create a `ModerationReport` record (pending). |
| `clearSessionChat` | Teacher-only. Delete all `ChatMessage` records for a game session. Leave system notice. |
| `deleteChatMessage` | Teacher-only. Replace a chat message content with `"הודעה נמחקה על ידי מורה"`. |

### Admin Utilities

| Function | Description |
|---|---|
| `evictStalePlayers` | Admin. Find kids with stale `last_seen` (>90s) and remove them from `GameSession.player_ids`. If no players remain → mark session `completed`/`paused`. Transfers host if host leaves. |
| `migratePublicProfiles` | One-time admin migration. Creates `PublicKidProfile` for every `KidAccount` that doesn't have one yet. |

---

## 8. Frontend Components

### `AdminProtection`
A wrapper component that:
1. Reads the stored session from sessionStorage (kid session check)
2. Also checks Base44 admin auth (`base44.auth.me()`)
3. If user is not an admin Base44 user → redirects to `KidLogin`
4. Shows a loading spinner while checking

### `KidAvatar`
Renders a kid's avatar with a 4-level fallback chain:
1. `avatar_url` → renders `<img>` (personal uploaded photo)
2. `avatar_preset_id` + database preset with `image_url` → renders `<img>`
3. `avatar_preset_id` + emoji preset → renders large emoji text
4. Fallback → renders first letter of `full_name`

Built-in presets (hardcoded in component):
`fox, robot, cat, unicorn, lion, penguin, dragon, owl, bear, rabbit, shark, dinosaur`

### `KidProfileCard`
A popup card showing another kid's profile with action buttons:
- Challenge to a game (sends `pending_challenge` via `updateKidState`)
- Send message (opens `ComposeMessage`)
- Add / Remove friend
- Block kid

### `OnlineUsers`
- Calls `getOnlineKids` backend function (filtered by current kid's gender)
- Fetches `PublicKidProfile` data for each online kid ID
- Subscribes to `PublicKidProfile` real-time updates to keep the list current
- Each avatar is clickable → opens `KidProfileCard`

### `FriendsList`
- Shows friends, pending incoming requests, and blocked kids
- Subscribes to `PublicKidProfile` and `PrivateMessage` for real-time updates
- Friend items show online status dot
- Actions: message, unfriend, block, view profile

### `RecessTimer`
- Uses the `useRecessCheck` hook to compute remaining time in the current recess
- Shows minutes:seconds countdown
- Turns red (warning mode) when < 2 minutes remain
- Returns null if not in recess

### `GameLibrary`
Simple grid of game cards. Each card shows:
- Thumbnail or gradient placeholder
- Game name (Hebrew)
- Player count (`שחקן יחיד` or `עד N שחקנים`)
- "Start game" button → calls `onStartGame(game)` prop

### `GameRenderer`
Selects which React component to render based on `game.game_url`:
```
tictactoe → TicTacToe
snake → SnakeGame
connectfour → ConnectFourGame
memory → MemoryGame
simon → SimonGame
whackamole → WhackAMoleGame
balloonpop → BalloonPopGame
drawing → DrawingGame
(anything else) → iframe with the game_url
```

### `GameChat`
In-game chat panel:
- Subscribes to `ChatMessage` real-time updates for the current `session_id`
- Kids can type text or record voice messages (audio upload via `UploadFile`)
- Teacher controls: delete individual messages or clear all chat
- Renders audio playback for voice messages via `AudioPlayer`

### `useHeartbeat`
The most critical hook for presence:
- Runs in `Layout.jsx` (never unmounts between page navigations)
- On mount: starts a 30-second interval calling `updateHeartbeat`
- Computes clock skew from `server_time` returned by `validateSession` to correct for client clock drift
- On unmount / tab close: sends `clearLastSeen` via `fetch` with `keepalive: true` (ensures delivery even if tab is closing)

### `useRecessCheck`
- Fetches `RecessSchedule` from the database
- Computes whether the current time (Israel timezone) falls within any active schedule entry
- Returns `{ isRecess, currentRecess, timeRemaining, schedule }`

### `useRecessLogout`
- Uses `useRecessCheck` to monitor recess status
- When recess ends → auto-logs out the kid (calls `deleteSession`, clears sessionStorage, redirects)

### `useOnlineKids`
- Calls `getOnlineKids` backend function with gender filter
- Subscribes to `PublicKidProfile` entity changes to reactively update the list
- Returns the list of online kid IDs

---

## 9. Real-Time Architecture

The app uses Base44 entity subscriptions (WebSocket-backed) for real-time features. The pattern is:

```js
useEffect(() => {
  const unsubscribe = base44.entities.SomeEntity.subscribe((event) => {
    // event.type: 'create' | 'update' | 'delete'
    // event.data: current entity data
    // event.id: entity ID
    if (event.type === 'update') {
      // Update local state
    }
  });
  return unsubscribe; // cleanup on unmount
}, []);
```

**Real-time subscriptions in use:**

| Entity | Used by | Purpose |
|---|---|---|
| `PublicKidProfile` | `OnlineUsers`, `FriendsList`, `KidHome` | Detect when kids come online/offline, detect incoming challenges, update friend avatar changes |
| `GameSession` | `KidHome`, `KidGamePlay`, `OpenGames`, `SavedGames` | Detect new sessions, player joins, game state changes |
| `PrivateMessage` | `FriendsList`, `Inbox`, `useUnreadMessages` | Detect new messages, update unread badge |
| `ChatMessage` | `GameChat` | Real-time in-game chat |
| `KidAccount` | `AdminKids` | (via query invalidation, not subscription) |

**Why `PublicKidProfile` instead of `KidAccount`?**  
`KidAccount` has strict RLS (admin-only read). Kids cannot subscribe to each other's private accounts. `PublicKidProfile` has `read: true` RLS, so any kid can subscribe to it. This is why the dual-write pattern exists.

---

## 10. Game System

### Game Session Lifecycle

```
Kid clicks "Start Game"
        │
        ▼
GameSession.create({
  game_id, host_id, host_name,
  player_ids: [host_id], player_names: [host_name],
  status: 'waiting', is_open: false/true,
  gender: kid.gender,
  invitation_code: UUID
})
        │
        ▼
Navigate to KidGamePlay (passes gameSessionId in state/URL)
        │
  ┌─────┴─────┐
  │           │
Single      Multi-player
player        │
  │       Wait for others to join
  │       (via open session or invite link)
  │           │
  └─────┬─────┘
        ▼
Status → 'playing' (when min_players reached)
        │
        ▼
[Game renders, players interact, game state saved in game_state JSON]
        │
        ▼
Game ends → Status → 'completed'
OR
Player leaves → Status → 'paused' (can be resumed)
```

### Joining a Game

- **Open sessions:** Visible in `OpenGames` component. Any kid of the matching gender can join.
- **Invite link:** Sharing `invitation_code` in a URL. Recipient joins by clicking the link.
- **Challenge:** `pending_challenge` object set on the target kid's `KidAccount` + `PublicKidProfile`. The target kid sees a challenge popup and can accept (joins the specific session) or decline.

### Game State

Each custom game component receives:
- `sessionId` — the `GameSession.id`
- `kidId` — the current kid's ID
- `players` — array of player objects `{ id, name }`
- `isHost` — boolean
- `onGameStateUpdate(state)` — saves arbitrary JSON to `GameSession.game_state`
- `onGameEnd(winnerId)` — transitions session to `completed`

Real-time sync between players works by all players subscribing to the same `GameSession` entity and reacting to `game_state` changes.

### Built-In Games

| Game | Key | Players | Type |
|---|---|---|---|
| Tic Tac Toe | `tictactoe` | 2 | Custom React |
| Connect Four | `connectfour` | 2 | Custom React |
| Memory Match | `memory` | 1–4 | Custom React |
| Snake | `snake` | 1 | Custom React |
| Simon Says | `simon` | 1 | Custom React |
| Whack-a-Mole | `whackamole` | 1 | Custom React |
| Balloon Pop | `balloonpop` | 1–4 | Custom React |
| Drawing | `drawing` | 1–4 | Custom React |
| Embedded URL games | any URL | varies | iframe |

---

## 11. Social System

### Friends

**State stored on `KidAccount`:**
- `friend_ids`: array of accepted friend IDs
- `pending_friend_request_ids`: array of IDs of kids who sent a pending request to ME

**Sending a friend request:**
1. `sendFriendRequest` function called with `{ session_id, to_kid_id }`
2. Creates a `PrivateMessage` of `type: 'friend_request'`
3. Adds sender's ID to recipient's `pending_friend_request_ids`
4. **Auto-accept:** If a mutual pending request exists (A requests B while B already requested A), both are immediately added to each other's `friend_ids` — no inbox needed

**Accepting a friend request:**
1. `respondToFriendRequest` called with `{ session_id, message_id, accept: true }`
2. Updates the `PrivateMessage` status to `'accepted'`
3. Adds each other to `friend_ids` symmetrically
4. Removes from `pending_friend_request_ids`

### Private Messaging

- `sendPrivateMessage` function enforces a 300-character limit
- Checks if sender is in recipient's `blocked_kid_ids` — if so, returns 403
- Increments recipient's `unread_message_count`
- `markMessagesRead` recalculates the exact count from the database (not just decrements)

### Blocking

`blockKid` function:
1. Adds target to blocker's `blocked_kid_ids`
2. Removes target from blocker's `friend_ids` and `pending_friend_request_ids`
3. Also removes blocker from target's `friend_ids` and `pending_friend_request_ids`
4. Does NOT add to target's blocked list (one-directional)

### Challenges

Challenge flow:
```
Kid A clicks "Challenge" on Kid B's profile card
        │
        ▼
Kid A creates a GameSession (or uses an existing one)
        │
        ▼
updateKidState({
  kid_id: B.id,
  updates: {
    pending_challenge: {
      from_kid_id: A.id,
      from_kid_name: A.full_name,
      session_id: gameSession.id,
      game_id: game.id,
      game_name: game.name_he,
      created_at: now
    }
  }
})
        │
        ▼
Dual-writes to PublicKidProfile → Kid B's subscription fires
        │
        ▼
Kid B sees a challenge popup → Accept (joins session) / Decline (clears pending_challenge)
```

Stale challenges (older than ~2 minutes) are automatically cleared by the `KidHome` component on mount.

---

## 12. Moderation & Safety

### Content Moderation

- Kids can **report** any message via the `reportMessage` function
- Reports are stored as `ModerationReport` with status `pending`
- Admins review reports in the **Report Bank** (AdminKids page)
- Admin can mark reports as `reviewed`
- Reports show: who reported, who was reported, the message content, reporter note

### Teacher Chat Moderation

- Teachers (accessible via `TeacherGameWatch`) can:
  - Delete a single chat message (soft-delete: replaces text with `"הודעה נמחקה על ידי מורה"`, preserves the record)
  - Clear all chat in a session (hard-delete all `ChatMessage` records, leaves a system notice)
- Teacher role is verified server-side in `clearSessionChat` and `deleteChatMessage` — checking `account.role !== 'teacher'` after session validation

### Account Banning

- Admin can toggle `is_active: false` on a `KidAccount`
- `createSession` checks `is_active` and returns 403 if banned
- `validateSession` checks `is_active` and returns 401 if banned
- All backend functions that check session also verify `is_active`
- Banned kids see the message: `'המשתמש חסום. אנא פנה להנהלה.'`

### Admin Delete (Cascade)

When an admin deletes a kid, `deleteKidMutation` performs a cascade:
1. Delete all `PrivateMessage` records where `from_kid_id = kid.id`
2. Delete all `PrivateMessage` records where `to_kid_id = kid.id`
3. Delete all `GameSession` records where `host_id = kid.id`
4. Delete all `ModerationReport` records where `reported_kid_id = kid.id`
5. Delete the `KidAccount` itself

---

## 13. Recess Scheduling System

The recess schedule is the **access control mechanism** for the entire playground.

### How It Works

`RecessSchedule` records define time windows:
```json
{
  "day_of_week": 0,      // Sunday = 0
  "start_time": "10:00",
  "end_time": "10:15",
  "name_he": "הפסקה ראשונה",
  "is_active": true
}
```

The check is performed in **Israel timezone** (`Asia/Jerusalem`) on the server:
```js
function getIsraelTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
}
```

**Where the check happens:**
1. **`createSession`** (server) — primary enforcement. Kids cannot log in outside recess.
2. **`KidLogin`** (client) — shows a warning UI if not recess time (but real enforcement is server-side)
3. **`useRecessCheck`** (client) — monitors throughout the session for the recess timer and auto-logout
4. **`useRecessLogout`** (client) — logs out the kid when the recess window ends

**Teachers bypass this check** — `createSession` skips the recess check for `role === 'teacher'`.

### Session Expiry Alignment

Kids' sessions expire at the **exact end time of the current recess** (+ 59 seconds buffer), not a fixed duration from login. This means:
- If a kid logs in 5 minutes before recess ends, their session lasts 5 minutes
- The admin function `updateSessionExpirations` can refresh all sessions to the end of the current recess (useful if a recess is extended)

---

## 14. Avatar System

Kids can have one of three types of avatars (checked in priority order):

### Priority 1: Custom Photo (`avatar_url`)
- Admin can upload a photo on behalf of a kid in `AdminKids`
- Kid can upload their own photo in `Profile`
- Images are compressed client-side to max 512×512px before upload
- Stored via `base44.integrations.Core.UploadFile`

### Priority 2: Preset Avatar (`avatar_preset_id`)
A preset is identified by a `key` string (e.g. `'fox'`). The `KidAvatar` component resolves it:
1. Check `AvatarPreset` database records for matching `key`
2. Check `BUILT_IN_PRESETS` (hardcoded in `KidAvatar.jsx`)

Presets have:
- **Built-in presets:** Hardcoded in `BUILT_IN_PRESETS` array in the component (always available)
- **Database presets:** Created by admin via `AdminKids` → Avatar Presets section
- Admins can **hide** a built-in preset by creating an `AvatarPreset` record with `is_active: false`

### Priority 3: Color Initial
If no photo or preset → renders the first letter of `full_name` on a colored circle background (`avatar_color` hex).

### Background Color (`avatar_color`)
An 8-option color palette is available in the `AdminKids` editor:
`#3B82F6, #8B5CF6, #EC4899, #F59E0B, #10B981, #EF4444, #06B6D4, #6366F1`

---

## 15. Admin Panel

Accessible to Base44 platform users with `role: 'admin'` only, protected by `AdminProtection`.

### Navigation
- `AdminGames` → `AdminKids` → `AdminSchedule` (linked from each page's header)
- `DataExport` accessible via `/DataExport` route

### AdminGames
- Add new game with Hebrew name, description, game component key or external URL, thumbnail, player range, gender target, active flag
- Edit/Delete existing games
- Non-active games are hidden from kids

### AdminKids
- View all users organized by role + gender
- Search by name or username
- Filter by grade
- Per-user actions: edit, message, ban/unban, view reports, delete
- Bulk CSV import (columns: `username, password, full_name, gender, grade, role`)
- CSV preview shows first 5 rows before importing
- Report Bank: all moderation reports in one panel
- Avatar Preset Manager: add custom presets, delete/hide built-in presets

### AdminSchedule
- View recess slots grouped by day of week (Sunday–Saturday)
- Add/edit/delete schedule entries with times, name, active toggle
- Duration (minutes) auto-calculated from start/end time

---

## 16. Teacher Role

Teachers use the same `KidAccount` system as kids, but with `role: 'teacher'`.

**Differences from kids:**
- **Login:** Bypass the recess time check — can log in at any time
- **Session:** 8-hour session (vs. recess-length for kids)
- **Landing page:** After login → redirected to `TeacherHome` instead of `KidHome`
- **TeacherHome:** See all active `GameSession` records for both genders
- **TeacherGameWatch:** Observe any session in real time, moderate chat
- **clearSessionChat / deleteChatMessage:** Teacher role verified server-side

Teacher accounts are created in `AdminKids` by setting `role: 'teacher'`.

---

## 17. Data Export System

`pages/DataExport.jsx` provides SQL export for migration/backup to PostgreSQL (Supabase-compatible).

### Two Export Sections

**1. Entity Export**
Exports all records from 10 entities:
`KidAccount, PublicKidProfile, GameSession, Game, ChatMessage, PrivateMessage, ModerationReport, RecessSchedule, Session, AvatarPreset`

**2. User Export** (separate)
Exports Base44 `User` entity records (admin accounts).

### SQL Generation Logic

For each entity:
```
-- Table: kid_account (N records)

CREATE TABLE IF NOT EXISTS kid_account (
  id TEXT PRIMARY KEY,
  username TEXT,
  password TEXT,
  ...
  last_seen TIMESTAMPTZ,
  best_scores JSONB,
  created_date TIMESTAMPTZ,
  updated_date TIMESTAMPTZ
);

INSERT INTO kid_account (id, username, ...) VALUES ('...', '...', ...);
```

**Type inference** from sample values:
- `id` or `*_id` fields → `TEXT`
- Known timestamp fields → `TIMESTAMPTZ`
- `boolean` JS values → `BOOLEAN`
- Integer JS numbers → `INTEGER`
- Float JS numbers → `NUMERIC`
- Objects/arrays → `JSONB`
- Everything else → `TEXT`

**Reserved word quoting:** PostgreSQL reserved words are quoted with double quotes. The set includes: `user, order, group, table, select, where, from`. The `user` entity becomes `"user"` in both `CREATE TABLE` and `INSERT INTO` statements.

**Value escaping:** Single quotes within strings are escaped by doubling them (`'`→`''`). Objects are JSON-serialized. Null → `NULL`. Booleans → `TRUE`/`FALSE`.

---

## 18. Security Model

### What is enforced server-side

| Concern | Enforcement |
|---|---|
| Recess time check | `createSession` function — Israel timezone, server clock |
| Session validity | Every function validates `session_id` against `Session` table |
| Account active check | Every function checks `is_active === true` |
| Teacher role for chat moderation | `clearSessionChat`, `deleteChatMessage` — check `account.role === 'teacher'` |
| Admin functions | Check `user.role === 'admin'` via `base44.auth.me()` |
| Profile update field allowlist | `updateKidProfile` — only allows `avatar_color, avatar_preset_id, avatar_url, password, best_scores` |
| State update field allowlist | `updateKidState` — kids can only write `pending_challenge` to other kids |
| Block list enforcement | `sendPrivateMessage` — checks `recipient.blocked_kid_ids.includes(sender.id)` |
| Message length limit | 300 chars for kids, 500 for admin |
| Heartbeat authorization | `x-session-id` header validated against the kid being updated |

### What is NOT enforced (by design or limitation)

- Passwords are stored in plaintext (no hashing) — this is a school kids' app, not a banking system
- Kids can create and modify `GameSession` records directly via the SDK (no server-side game logic validation)
- `ModerationReport` can be created by any authenticated kid (no rate limiting)

### Data Segregation

- All backend functions that return or modify data for a kid only do so after validating the session
- `getOnlineKids` only exposes IDs, not profile data
- The `PublicKidProfile` entity is carefully curated to only include non-sensitive fields

---

## 19. Clock Skew & Time Handling

Kids' devices may have incorrect clocks. The heartbeat system accounts for this:

1. `validateSession` returns `server_time: new Date().toISOString()` in its response
2. `Layout.jsx` computes `skewMs = server_time - Date.now()` and stores it in `sessionStorage.clockSkewMs`
3. `useHeartbeat` reads `clockSkewMs` and adds it to `Date.now()` when sending `last_seen` timestamps
4. This ensures `last_seen` values are accurate server-side even if the client clock is wrong
5. The online threshold on `getOnlineKids` is 90 seconds — generous enough to handle minor skew

---

## 20. Analytics

The app tracks analytics events at two levels:

**Frontend (`base44.analytics.track`):**
- Game start events (logged in `KidHome` when a game session is created)

**Backend (`base44.asServiceRole.analytics.track`):**
- `kid_session_end` — logged in `deleteSession` with `kid_id`, `gender`, `grade`

These events feed into the Base44 analytics dashboard.

---

## 21. Key Design Decisions

### Why a custom session system instead of Base44 auth?

Base44's built-in auth system is designed for adult users with email addresses. School kids (grades 1–7) don't have email addresses and need a simple username/password flow. The custom `KidAccount` + `Session` system was built to support this.

### Why `PublicKidProfile` as a separate entity?

Real-time subscriptions in the frontend require readable RLS. `KidAccount` has strict admin-only read RLS (to protect passwords, blocked lists, etc.). A separate `PublicKidProfile` entity with `read: true` RLS allows any logged-in kid to subscribe to other kids' online status and challenge notifications without exposing sensitive data.

### Why dual-write instead of a database trigger?

Base44 doesn't support database-level triggers. All writes to `KidAccount` that affect public fields are manually dual-written to `PublicKidProfile` in the backend functions. This is explicit but requires discipline — every function that writes to `KidAccount` must also update `PublicKidProfile`.

### Why gender separation?

The app is designed for school-age children. Boys and girls have separate game sessions, social graphs, and friend lists. This is a school policy requirement built into the system at the data level (the `gender` field on `GameSession` and filtering in `getOnlineKids`, `KidHome`, etc.).

### Why probabilistic session cleanup?

Running a cleanup query on every login would add latency. A 20% random chance per login distributes the cleanup load across many logins without a dedicated scheduled task.

### Why keepalive fetch for clearLastSeen?

The browser's `beforeunload` event may not guarantee that async operations complete before the tab closes. Using `fetch` with `keepalive: true` tells the browser to deliver the request even after the page is unloaded. This is critical for accurate online/offline status.

### Why the `Layout.jsx` heartbeat instead of per-page?

If the heartbeat hook lived in each page component, it would restart (and briefly stop sending pings) every time the user navigates. Placing it in `Layout.jsx` (which wraps all pages) means it runs continuously for the entire session, preventing the race condition that would briefly show kids as offline during navigation.

---

*Documentation generated: April 2026*