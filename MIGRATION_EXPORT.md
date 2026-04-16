# 🎮 Playground — Migration Export
### Architecture-Agnostic Product Specification for Node.js + WebSocket Rebuild

---

## Table of Contents

1. [Data Models](#1-data-models)
2. [Core Systems — Business Logic](#2-core-systems--business-logic)
3. [API Design](#3-api-design)
4. [Game Catalog](#4-game-catalog)
5. [Game Components — Full Source](#5-game-components--full-source)
6. [Frontend Structure](#6-frontend-structure)
7. [What Needs to Be Rebuilt](#7-what-needs-to-be-rebuilt)
8. [File References Used](#8-file-references-used)

---

## 1. Data Models

### 1.1 KidAccount
> Private user record. Contains credentials and all social graph data.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key (UUID) |
| `username` | string | Login username, unique |
| `password` | string | Password (currently plaintext, hash in rebuild) |
| `full_name` | string | Display name |
| `gender` | enum: `boy` \| `girl` | Determines which game/social partition the kid belongs to |
| `grade` | integer | School grade (1–7) |
| `role` | enum: `kid` \| `teacher` | `teacher` bypasses recess restrictions |
| `is_active` | boolean | `false` = banned, blocked from login |
| `avatar_color` | string | Hex color for avatar background (e.g. `#3B82F6`) |
| `avatar_preset_id` | string | Key of selected avatar preset (e.g. `'fox'`) |
| `avatar_url` | string \| null | Uploaded photo URL — takes priority over preset |
| `last_seen` | ISO datetime \| null | Last heartbeat timestamp; used for online detection |
| `best_scores` | `Record<string, number>` | Map of `gameKey → score` (e.g. `{ snake: 42 }`) |
| `pending_challenge` | object \| null | Incoming game challenge (see structure below) |
| `friend_ids` | string[] | IDs of accepted friends |
| `pending_friend_request_ids` | string[] | IDs of kids who sent a pending request to this kid |
| `blocked_kid_ids` | string[] | IDs of kids this user has blocked |
| `unread_message_count` | integer | Cached count of unread messages (for badge) |
| `created_at` | ISO datetime | |
| `updated_at` | ISO datetime | |

**`pending_challenge` object structure:**
```json
{
  "from_kid_id": "string",
  "from_kid_name": "string",
  "session_id": "string",
  "game_id": "string",
  "game_name": "string",
  "created_at": "ISO datetime"
}
```

**Relationships:**
- `friend_ids` → array of `KidAccount.id`
- `pending_friend_request_ids` → array of `KidAccount.id`
- `blocked_kid_ids` → array of `KidAccount.id`
- `pending_challenge.session_id` → `GameSession.id`

---

### 1.2 Game
> Admin-managed catalog of available games.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `name_he` | string | Hebrew display name |
| `description_he` | string \| null | Hebrew description |
| `type` | enum: `custom` \| `embedded` | `custom` = React component by key; `embedded` = iframe URL |
| `game_url` | string | For `custom`: component key (e.g. `tictactoe`). For `embedded`: full URL |
| `thumbnail_url` | string \| null | Cover image URL |
| `max_players` | integer | Max simultaneous players |
| `min_players` | integer | Minimum players to start (default 1) |
| `is_active` | boolean | Whether visible to kids |
| `for_gender` | enum: `boy` \| `girl` \| `both` | Which gender can see/play this game |
| `created_at` | ISO datetime | |

---

### 1.3 GameSession
> An active or saved multiplayer game instance.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `game_id` | string | FK → `Game.id` |
| `host_id` | string | FK → `KidAccount.id` — the kid who created the session |
| `host_name` | string | Denormalized display name of host |
| `player_ids` | string[] | All currently joined player IDs (includes host) |
| `player_names` | string[] | Matching display names (parallel array to `player_ids`) |
| `status` | enum: `waiting` \| `playing` \| `paused` \| `completed` | Lifecycle status |
| `is_open` | boolean | If `true`, any kid of the matching gender can join without an invite |
| `invitation_code` | string | Short unique code for share links |
| `game_state` | object \| null | Arbitrary JSON — game-specific state (see per-game structures) |
| `started_at` | ISO datetime \| null | When status transitioned to `playing` |
| `last_activity` | ISO datetime | Updated on any change |
| `gender` | enum: `boy` \| `girl` | Which gender partition this session belongs to |
| `created_at` | ISO datetime | |

**Relationships:**
- `game_id` → `Game.id`
- `host_id` → `KidAccount.id`
- `player_ids` → array of `KidAccount.id`

---

### 1.4 ChatMessage
> In-game chat messages within a specific GameSession.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `session_id` | string | FK → `GameSession.id` |
| `sender_id` | string | FK → `KidAccount.id` (or `'system'` for system messages) |
| `sender_name` | string | Display name of sender |
| `message` | string | Text content |
| `audio_url` | string \| null | Voice message URL |
| `timestamp` | ISO datetime | When message was sent |

---

### 1.5 PrivateMessage
> Direct messages between kids, and friend request notifications.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `from_kid_id` | string | Sender's `KidAccount.id` (or `'admin'` for admin messages) |
| `from_kid_name` | string | Sender's display name (or `'📢 הנהלה'` for admin) |
| `to_kid_id` | string | Recipient's `KidAccount.id` |
| `to_kid_name` | string | Recipient's display name |
| `gender` | string | Sender's gender |
| `content` | string | Message text (max 300 chars for kids, 500 for admin) |
| `is_read` | boolean | Whether recipient has read it |
| `type` | enum: `message` \| `friend_request` | Message type |
| `friend_request_status` | enum: `pending` \| `accepted` \| `declined` \| null | Only for `friend_request` type |
| `created_at` | ISO datetime | |

---

### 1.6 ModerationReport
> Reports submitted by kids about other kids.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `reporter_kid_id` | string | FK → `KidAccount.id` |
| `reporter_kid_name` | string | Denormalized name |
| `reported_kid_id` | string | FK → `KidAccount.id` |
| `reported_kid_name` | string | Denormalized name |
| `message_content` | string | The offending message that was reported |
| `reporter_note` | string | Optional note from reporter |
| `status` | enum: `pending` \| `reviewed` | Admin review status |
| `created_at` | ISO datetime | |

---

### 1.7 RecessSchedule
> Defines when the playground is open for kids.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `day_of_week` | integer | 0=Sunday, 1=Monday, … 6=Saturday |
| `start_time` | string | `HH:MM` format (24h, Israel timezone) |
| `end_time` | string | `HH:MM` format (24h, Israel timezone) |
| `name_he` | string | Hebrew label (e.g. "הפסקה ראשונה") |
| `is_active` | boolean | Whether this slot is enforced |

---

### 1.8 AvatarPreset
> Admin-managed avatar options, extending the hardcoded built-in presets.

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `key` | string | Unique English identifier (e.g. `'fox'`) |
| `label_he` | string | Hebrew display label |
| `emoji` | string | Emoji fallback if no image |
| `image_url` | string \| null | Uploaded image URL |
| `is_active` | boolean | Whether visible to kids |
| `sort_order` | integer | Display order |

**Built-in presets (hardcoded, not in DB initially):**
`fox, robot, cat, unicorn, lion, penguin, dragon, owl, bear, rabbit, shark, dinosaur`

---

### 1.9 AdminUser
> Platform administrator account (NOT a KidAccount).

| Field | Type | Description |
|---|---|---|
| `id` | string | Primary key |
| `email` | string | Admin email |
| `full_name` | string | Display name |
| `role` | string | Always `'admin'` |
| `created_at` | ISO datetime | |

---

## 2. Core Systems — Business Logic

### 2.1 Authentication System

**Requirements:**

1. **Kids** authenticate with `username` + `password`. Passwords are currently stored plaintext — the rebuilt system SHOULD hash them (bcrypt recommended).

2. **Teachers** are a special `role` value inside `KidAccount` (`role: 'teacher'`). They use the exact same login form and credentials as kids. The only differences are:
   - Teachers bypass the recess time check (they can log in at any time)
   - After login, teachers are redirected to the teacher dashboard, not the kid home
   - Teacher sessions last 8 hours; kid sessions expire when the current recess window ends

3. **Admins** are a completely separate user type (not `KidAccount`). They have their own login and access the admin panel.

4. **Login enforcement:** The server must check the current Israel time against the `RecessSchedule` table before issuing a token to a `kid` role. If it's not currently recess time, the login must be rejected with a clear error message.

5. **Banned accounts:** If `KidAccount.is_active === false`, login must be rejected regardless of credentials.

6. **Tokens:** On successful login, issue a short-lived session token (JWT or opaque UUID stored in DB). The token must be sent with every subsequent request. Session expiry is the end of the current recess window (for kids) or 8 hours (for teachers).

---

### 2.2 Game System

**Game Session Lifecycle:**

```
CREATE SESSION
  → status: 'waiting'
  → player_ids: [host_id]
  → is_open: true/false
  → invitation_code: <uuid>

PLAYERS JOIN (up to max_players)
  → player_ids grows
  → When player_ids.length >= game.min_players → allow start

START GAME
  → status: 'playing'
  → started_at: now

GAME RUNS
  → players call onStateUpdate(state) → saves to game_state JSON
  → Real-time sync via WebSocket: all players subscribe to session changes

GAME ENDS
  → onGameEnd(result) called
  → status: 'completed'

PLAYER LEAVES MID-GAME
  → Remove from player_ids
  → If player_ids.length === 0 and status was 'waiting' → 'completed'
  → If player_ids.length === 0 and status was 'playing' → 'paused'
  → If host leaves → transfer host to next player in player_ids

RESUME PAUSED GAME
  → Kid rejoins the session
  → game_state is restored from DB
  → status: 'playing'
```

**Host Responsibilities:**
- The host (first player, index 0) controls session-level actions: toggle privacy, share invite, end session
- On rematch: loser goes first (host role rotates)
- On host disconnect: host is transferred to the next player in `player_ids`

**Game State Structure** — each game serializes its own state into `game_state`. See per-game descriptions in Section 5.

**Joining Methods:**
1. **Open sessions list:** Sessions with `is_open: true` visible to kids of same gender
2. **Invite code:** URL containing `invitation_code` — anyone with the link can join
3. **Challenge:** Direct peer-to-peer invite stored in `KidAccount.pending_challenge`

---

### 2.3 Social System

**Friends:**
- `KidAccount.friend_ids` — bidirectional, both parties must have each other's ID
- `KidAccount.pending_friend_request_ids` — IDs of kids who have sent YOU a pending request

**Friend Request Flow:**
1. Kid A sends request to Kid B
2. A `PrivateMessage` of `type: 'friend_request'` is created
3. Kid B's `pending_friend_request_ids` gains Kid A's ID
4. Kid B's `unread_message_count` increments
5. Kid B can accept or decline via the Inbox

**Auto-Accept Logic:** If Kid A sends a request to Kid B, and Kid A already has Kid B in their own `pending_friend_request_ids` (i.e. Kid B had previously sent Kid A a request), then immediately:
- Accept both (skip the inbox step)
- Add each other to `friend_ids` symmetrically
- Remove from `pending_friend_request_ids`
- Mark the original request `PrivateMessage` as `accepted`

**Blocking:**
- Blocking adds the target to blocker's `blocked_kid_ids`
- Simultaneously removes target from blocker's `friend_ids` and `pending_friend_request_ids`
- Also removes blocker from target's `friend_ids` and `pending_friend_request_ids`
- One-directional: the blocked person does NOT get the blocker in their `blocked_kid_ids`
- Effect: Blocked person cannot send messages or friend requests to the blocker

**Challenges:**
1. Kid A wants to challenge Kid B to a game
2. Kid A creates (or uses existing) a `GameSession`
3. Kid A sets Kid B's `pending_challenge` field with session info
4. Kid B's client receives the update in real time (via WebSocket)
5. Kid B sees a challenge popup: Accept (join the session) or Decline (clear `pending_challenge`)
6. Stale challenges (older than ~2 minutes) should be automatically cleared on startup

---

### 2.4 Messaging System

**Private Messages:**
- A kid can send a text message to any other kid of the same gender
- Before sending, check if the sender is in the recipient's `blocked_kid_ids` → reject if so
- Maximum 300 characters for kid-to-kid messages
- Maximum 500 characters for admin messages
- On send: increment recipient's `unread_message_count`

**Unread Count:**
- `unread_message_count` is a cached integer on `KidAccount`
- It should be recalculated accurately by counting `PrivateMessage` records where `to_kid_id = me` and `is_read = false` (do not just decrement — always recount to avoid drift)

**Thread Structure:**
- Messages are grouped by conversation partner (both directions: `from_kid_id` and `to_kid_id`)
- No separate "thread" entity — threads are derived from `PrivateMessage` records

**Admin Messages:**
- Admins can send messages to any kid
- These appear as `from_kid_id: 'admin'` and `from_kid_name: '📢 הנהלה'`

---

### 2.5 Moderation System

**Kid Reports:**
- Any kid can report a message they received
- A `ModerationReport` record is created with `status: 'pending'`
- Admins see pending reports in the admin panel
- Admins can mark reports as `reviewed`

**Teacher Chat Controls:**
- Teachers can observe any game session's chat
- **Soft-delete a single message:** Replace the `message` text with `"הודעה נמחקה על ידי מורה"` and clear `audio_url`. The record stays in the DB.
- **Clear all chat in a session:** Delete all `ChatMessage` records for that `session_id`, then insert one system message: `{ sender_id: 'system', sender_name: 'מערכת', message: 'הצ'אט נמחק על ידי מורה' }`
- Teacher role must be verified server-side before any moderation action

---

### 2.6 Recess System

**Core Rule:** Kids (role: `kid`) can only access the platform during scheduled recess windows. Teachers are exempt.

**How to check:**
1. Load all active `RecessSchedule` records where `is_active = true`
2. Get current time in **Israel timezone** (`Asia/Jerusalem`)
3. Find a schedule entry where `day_of_week === current_day_of_week` AND `start_time <= current_time <= end_time`
4. If no match found → reject login, block access

**Session Expiry Alignment:**
- A kid's session token should expire at the `end_time` of the current recess window (not a fixed duration)
- This means: if a kid logs in with 5 minutes left in recess, their session expires in 5 minutes
- On recess end, all active kid sessions should be considered expired

**Auto-logout:**
- The client should monitor the recess status and automatically log out when the recess window ends
- This should be enforced server-side as well (expired token)

**Teacher Exception:**
- Teachers get a fixed 8-hour session regardless of recess schedule
- Teachers can log in at any time

---

## 3. API Design

All endpoints use JSON. Authentication via `Authorization: Bearer <token>` header (replace sessionStorage + body `session_id` pattern).

---

### 3.1 Auth Endpoints

#### `POST /api/auth/login`
**Purpose:** Authenticate a kid or teacher and receive a session token.

**Input:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Output (success):**
```json
{
  "token": "string",
  "expires_at": "ISO datetime",
  "kid": {
    "id": "string",
    "username": "string",
    "full_name": "string",
    "gender": "boy | girl",
    "grade": 1,
    "role": "kid | teacher",
    "avatar_color": "#3B82F6",
    "avatar_preset_id": "string | null",
    "avatar_url": "string | null"
  }
}
```

**Errors:**
- `401` — wrong username/password
- `403` — account banned (`is_active: false`)
- `403` — not recess time (for kids only)

---

#### `POST /api/auth/logout`
**Purpose:** Invalidate the current session token.

**Input:** (token from header)

**Output:** `{ "success": true }`

---

#### `GET /api/auth/me`
**Purpose:** Return the current authenticated kid's full private profile.

**Output:**
```json
{
  "kid": { /* full KidAccount object */ }
}
```

---

#### `POST /api/auth/admin/login`
**Purpose:** Admin-specific login (separate from kid login).

**Input:** `{ "email": "string", "password": "string" }`

**Output:** `{ "token": "string", "admin": { "id", "email", "full_name", "role" } }`

---

### 3.2 Games Endpoints

#### `GET /api/games`
**Purpose:** List all available games for the authenticated kid's gender.

**Output:**
```json
{
  "games": [
    {
      "id": "string",
      "name_he": "string",
      "description_he": "string | null",
      "type": "custom | embedded",
      "game_url": "string",
      "thumbnail_url": "string | null",
      "max_players": 2,
      "min_players": 1,
      "for_gender": "both | boy | girl"
    }
  ]
}
```

---

#### `POST /api/game-sessions`
**Purpose:** Create a new game session.

**Input:**
```json
{
  "game_id": "string",
  "is_open": true
}
```

**Output:**
```json
{
  "session": { /* full GameSession object */ }
}
```

---

#### `GET /api/game-sessions/open`
**Purpose:** List open (joinable) sessions for the kid's gender.

**Output:** `{ "sessions": [ /* GameSession[] */ ] }`

---

#### `GET /api/game-sessions/saved`
**Purpose:** List paused sessions the kid was part of.

**Output:** `{ "sessions": [ /* GameSession[] */ ] }`

---

#### `POST /api/game-sessions/:sessionId/join`
**Purpose:** Add the authenticated kid to a game session.

**Input:** `{}` (token identifies the kid)

**Errors:**
- `403` — session is full
- `403` — gender mismatch
- `404` — session not found

**Output:** `{ "session": { /* updated GameSession */ } }`

---

#### `PATCH /api/game-sessions/:sessionId`
**Purpose:** Update session state (game state, status, player list, etc.). Called by game components via `onStateUpdate`.

**Input:** (partial `GameSession` fields to update)
```json
{
  "game_state": { /* arbitrary object */ },
  "status": "playing | completed | paused",
  "player_ids": ["..."],
  "player_names": ["..."],
  "host_id": "string",
  "host_name": "string"
}
```

**Output:** `{ "session": { /* updated GameSession */ } }`

---

#### `DELETE /api/game-sessions/:sessionId/leave`
**Purpose:** Remove the authenticated kid from a session. Handles host transfer, status transitions.

**Output:** `{ "success": true }`

---

#### `GET /api/game-sessions/by-code/:invitationCode`
**Purpose:** Look up a session by invitation code (for join-by-link flow).

**Output:** `{ "session": { /* GameSession */ } }`

---

### 3.3 Social Endpoints

#### `GET /api/social/online`
**Purpose:** Return IDs of kids who are currently online (same gender as caller).

**Query:** `?exclude_self=true`

**Output:** `{ "kid_ids": ["string"] }`

**Online threshold:** A kid is "online" if their `last_seen` is within the last 90 seconds.

---

#### `POST /api/social/heartbeat`
**Purpose:** Update the kid's `last_seen` to now. Called periodically (every 30s) by the client.

**Output:** `{ "ok": true, "server_time": "ISO datetime" }`

---

#### `GET /api/kids/:kidId/profile`
**Purpose:** Get the public profile of a specific kid.

**Output:**
```json
{
  "kid": {
    "id": "string",
    "full_name": "string",
    "gender": "boy | girl",
    "grade": 1,
    "avatar_url": "string | null",
    "avatar_color": "string",
    "avatar_preset_id": "string | null",
    "last_seen": "ISO datetime | null",
    "best_scores": {},
    "is_active": true,
    "role": "kid | teacher"
  }
}
```

---

#### `GET /api/kids/profiles`
**Purpose:** Batch fetch public profiles for a list of kid IDs.

**Input (query):** `?ids=id1,id2,id3`

**Output:** `{ "kids": [ /* PublicProfile[] */ ] }`

---

#### `POST /api/social/friend-request`
**Purpose:** Send a friend request to another kid.

**Input:** `{ "to_kid_id": "string" }`

**Output:**
```json
{
  "success": true,
  "auto_accepted": false,
  "message": "בקשת חברות נשלחה"
}
```

---

#### `POST /api/social/friend-request/:messageId/respond`
**Purpose:** Accept or decline an incoming friend request.

**Input:** `{ "accept": true }`

**Output:** `{ "success": true }`

---

#### `POST /api/social/block`
**Purpose:** Block another kid.

**Input:** `{ "target_kid_id": "string" }`

**Output:** `{ "success": true }`

---

#### `POST /api/social/challenge`
**Purpose:** Send a game challenge to another kid.

**Input:**
```json
{
  "to_kid_id": "string",
  "session_id": "string",
  "game_id": "string",
  "game_name": "string"
}
```

**Output:** `{ "success": true }`

---

#### `DELETE /api/social/challenge`
**Purpose:** Clear the authenticated kid's own incoming `pending_challenge` (decline).

**Output:** `{ "success": true }`

---

#### `PATCH /api/kids/me/profile`
**Purpose:** Update own profile (avatar only — not role, is_active, etc.)

**Input:**
```json
{
  "avatar_color": "#hex | undefined",
  "avatar_preset_id": "string | undefined",
  "avatar_url": "string | null | undefined",
  "password": "string | undefined",
  "best_scores": { "game_key": number }
}
```

**Strict allowlist enforced server-side — no other fields accepted.**

**Output:** `{ "ok": true }`

---

### 3.4 Messaging Endpoints

#### `GET /api/messages`
**Purpose:** Get all messages for the authenticated kid (inbox + sent).

**Output:**
```json
{
  "messages": [ /* PrivateMessage[] sorted by created_at desc */ ]
}
```

---

#### `POST /api/messages`
**Purpose:** Send a private message to another kid.

**Input:**
```json
{
  "to_kid_id": "string",
  "content": "string (max 300 chars)"
}
```

**Errors:**
- `403` — recipient has blocked sender

**Output:** `{ "success": true }`

---

#### `POST /api/messages/mark-read`
**Purpose:** Mark a list of messages as read and recalculate unread count.

**Input:** `{ "message_ids": ["string"] }`

**Output:** `{ "success": true }`

---

#### `GET /api/chat/:sessionId/messages`
**Purpose:** Get all chat messages for a game session.

**Output:** `{ "messages": [ /* ChatMessage[] */ ] }`

---

### 3.5 Admin Endpoints

All admin endpoints require admin auth token.

#### `GET /api/admin/kids`
Get all `KidAccount` records.

#### `POST /api/admin/kids`
Create a new kid account.

**Input:** `{ username, password, full_name, gender, grade, role, avatar_color }`

#### `PATCH /api/admin/kids/:kidId`
Update any field of a kid account (no field restrictions for admins).

#### `DELETE /api/admin/kids/:kidId`
Delete a kid account. Must cascade-delete:
- All `PrivateMessage` where `from_kid_id = kidId` or `to_kid_id = kidId`
- All `GameSession` where `host_id = kidId`
- All `ModerationReport` where `reported_kid_id = kidId`

#### `POST /api/admin/kids/bulk`
Bulk-create kids from CSV data.

**Input:** `{ "kids": [ /* array of kid objects */ ] }`

#### `POST /api/admin/message`
Send an admin message to a kid.

**Input:** `{ "to_kid_id": "string", "content": "string (max 500 chars)" }`

#### `GET /api/admin/reports`
Get all `ModerationReport` records.

#### `PATCH /api/admin/reports/:reportId`
Mark a report as reviewed.

**Input:** `{ "status": "reviewed" }`

#### `GET /api/admin/games`
Get all `Game` records.

#### `POST /api/admin/games`
Create a game.

#### `PATCH /api/admin/games/:gameId`
Update a game.

#### `DELETE /api/admin/games/:gameId`
Delete a game.

#### `GET /api/admin/schedules`
Get all `RecessSchedule` records.

#### `POST /api/admin/schedules`
Create a recess schedule entry.

#### `PATCH /api/admin/schedules/:scheduleId`
Update a schedule entry.

#### `DELETE /api/admin/schedules/:scheduleId`
Delete a schedule entry.

#### `GET /api/admin/avatar-presets`
Get all `AvatarPreset` records.

#### `POST /api/admin/avatar-presets`
Create an avatar preset.

#### `PATCH /api/admin/avatar-presets/:presetId`
Update a preset (e.g. set `is_active: false` to hide a built-in preset).

#### `DELETE /api/admin/avatar-presets/:presetId`
Delete a preset.

#### `POST /api/admin/sessions/clear`
Delete all active kid sessions (only if it's not currently recess time).

#### `POST /api/admin/chat/:sessionId/clear`
Teacher-only (or admin). Delete all chat messages in a session and insert a system notice.

#### `PATCH /api/admin/chat/messages/:messageId`
Teacher-only. Soft-delete a message (replace content with deletion notice).

#### `POST /api/admin/kids/migrate-profiles`
One-time utility: create public profile records for all existing kids.

---

## 4. Game Catalog

| Game | Key (`game_url`) | Type | Min Players | Max Players | Notes |
|---|---|---|---|---|---|
| Tic Tac Toe (איקס עיגול) | `tictactoe` | custom | 2 | 2 | Turn-based, series score, rematch voting |
| Connect Four (ארבע בשורה) | `connectfour` | custom | 2 | 2 | Turn-based, series score, rematch voting |
| Memory Match (משחק הזיכרון) | `memory` | custom | 1 | 4 | Turn-based, per-player score |
| Snake (נחש) | `snake` | custom | 1 | 1 | Solo, persistent best score |
| Simon Says (סיימון אומר) | `simon` | custom | 1 | 1 | Solo, persistent best score |
| Whack-a-Mole (הכה בחפרפרת) | `whackamole` | custom | 1 | 1 | Solo, timed, persistent best score |
| Balloon Pop (פוצץ בלונים) | `balloonpop` | custom | 1 | 1 | Solo, lives-based, persistent best score |
| Drawing Board (לוח ציור) | `drawing` | custom | 1 | 4 | Collaborative, real-time canvas sync |
| Any external game | full URL | embedded | varies | varies | Rendered in iframe |

---

## 5. Game Components — Full Source

> All game components are located in `components/games/`. They are pure React components.
> **Base44-specific calls to remove during migration:**
> - `base44.functions.invoke('getMyPrivateProfile', ...)` → replace with `GET /api/auth/me`
> - `base44.functions.invoke('updateKidProfile', ...)` → replace with `PATCH /api/kids/me/profile`
> - `sessionStorage.getItem('sessionId')` → replace with your token from auth context
> - `window.location.href = createPageUrl('KidHome')` → replace with your router's navigate function
> - `toast.info(...)` → any toast notification library

---

### 5.1 Shared: PostGameOverlay Component

**Source:** `components/game/PostGameOverlay.jsx`

**Purpose:** Shown after any multiplayer game ends. Handles win/draw display, series score, and rematch voting.

**Props Interface:**
```typescript
interface PostGameOverlayProps {
  winnerName: string | null;     // null = draw
  isDraw: boolean;
  seriesScore: Record<string, number>; // { [playerId]: wins }
  playerIds: string[];
  playerNames: string[];
  myVote: null | 'rematch' | 'leave';
  otherPlayerLeft: boolean;
  onRematch: () => void;         // vote for rematch
  onLeave: () => void;           // vote to leave / mid-game leave
}
```

**Logic:**
- If `otherPlayerLeft` → show "other player left" message and a single Leave button
- If `myVote === 'rematch'` → disable the Rematch button and show "Waiting for other player..."
- Rematch is triggered when ALL `player_ids` have voted `'rematch'` (checked in the game component, not here)
- Leave during active game → calls `onLeaveGame()` prop (removes self from session)
- Leave after game ends → sets `status: 'completed'` on the session (broadcasts to all players)

**Full cleaned source** (remove `import { Button }` and replace with your own):

```jsx
// components/game/PostGameOverlay.jsx
import React from 'react';

export default function PostGameOverlay({
  winnerName,
  isDraw,
  seriesScore = {},
  playerIds = [],
  playerNames = [],
  myVote,
  otherPlayerLeft,
  onRematch,
  onLeave,
}) {
  const score0 = seriesScore[playerIds[0]] || 0;
  const score1 = seriesScore[playerIds[1]] || 0;
  const name0 = playerNames[0] || '';
  const name1 = playerNames[1] || '';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 rounded-xl">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        {isDraw ? (
          <div className="mb-4">
            <p className="text-4xl mb-2">🤝</p>
            <h2 className="text-2xl font-bold text-gray-700">תיקו!</h2>
          </div>
        ) : (
          <div className="mb-4">
            <span className="text-5xl">🏆</span>
            <h2 className="text-2xl font-bold text-green-600">{winnerName} ניצח!</h2>
          </div>
        )}

        {playerIds.length >= 2 && (
          <div className="bg-gray-100 rounded-lg px-4 py-2 mb-6 text-lg font-bold text-gray-700">
            {name0} {score0} — {score1} {name1}
          </div>
        )}

        {otherPlayerLeft ? (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">השחקן השני יצא מהמשחק</p>
            <button onClick={onLeave} className="w-full border rounded px-4 py-2">חזור למגרש</button>
          </div>
        ) : (
          <div className="space-y-3">
            {myVote === 'rematch' && (
              <p className="text-sm text-blue-600 font-medium">ממתין לשחקן השני...</p>
            )}
            <button
              onClick={onRematch}
              disabled={myVote === 'rematch'}
              className="w-full bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {myVote === 'rematch' ? 'ממתין...' : 'שחק שוב'}
            </button>
            <button onClick={onLeave} className="w-full border rounded px-4 py-2">
              צא מהמשחק
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 5.2 TicTacToe

**Source:** `components/games/TicTacToe.jsx`

**Props:**
```typescript
interface TicTacToeProps {
  session: GameSession;             // full session object (player_ids, player_names, game_state, status)
  onUpdateSession: (updates: Partial<GameSession>) => Promise<void>;
  currentPlayerId: string;          // the authenticated kid's ID
  onLeaveGame: () => void;          // called when player wants to leave mid-game
}
```

**Game State Structure:**
```json
{
  "board": [null, "X", null, "O", null, null, null, null, "X"],
  "isXNext": true,
  "winner": "kid_id | 'draw' | null",
  "rematch_votes": { "kid_id_1": "rematch", "kid_id_2": "leave" },
  "series_score": { "kid_id_1": 2, "kid_id_2": 1 }
}
```

**Rules:**
- 3×3 grid, 9 cells (index 0–8)
- Player at index 0 in `player_ids` is always X, index 1 is always O
- Player plays on their turn (`isXNext` determines turn based on player index)
- Win condition: any row, column, or diagonal of 3 matching symbols
- Draw: all 9 cells filled with no winner
- `winner` stores the winning player's **ID** (not symbol), or `'draw'`
- On rematch: loser goes first → player order in `player_ids` is swapped so loser is index 0 (always X)
- Rematch requires both players to vote `'rematch'` in `rematch_votes`

**Full cleaned source** (replace Base44 calls and routing as noted):

```jsx
// components/games/TicTacToe.jsx
import React, { useState, useEffect } from 'react';
import PostGameOverlay from '../game/PostGameOverlay';

export default function TicTacToe({ session, onUpdateSession, currentPlayerId, onLeaveGame }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [otherPlayerLeft, setOtherPlayerLeft] = useState(false);

  useEffect(() => {
    if (session?.game_state?.board) {
      setBoard(session.game_state.board);
      setIsXNext(session.game_state.isXNext);
      setWinner(session.game_state.winner);
      if (!session.game_state.winner) {
        setMyVote(null);
        setOtherPlayerLeft(false);
      }
    }
  }, [session?.game_state]);

  useEffect(() => {
    if (!winner) return;
    if ((session?.player_ids?.length ?? 2) < 2) {
      setOtherPlayerLeft(true);
      setTimeout(() => { /* navigate to KidHome */ }, 3000);
    }
  }, [session?.player_ids, winner]);

  useEffect(() => {
    if (!winner || !session?.game_state?.rematch_votes) return;
    const votes = session.game_state.rematch_votes;
    const otherIds = (session.player_ids || []).filter(id => id !== currentPlayerId);
    if (otherIds.some(id => votes[id] === 'leave')) {
      setTimeout(() => { /* navigate to KidHome */ }, 2000);
    }
  }, [session?.game_state?.rematch_votes]);

  const calculateWinner = (squares) => {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (let line of lines) {
      const [a, b, c] = line;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return null;
  };

  const handleClick = async (index) => {
    if (board[index] || winner || !currentPlayerId || !session?.player_ids) return;
    const currentPlayerIndex = session.player_ids.indexOf(currentPlayerId);
    const shouldBeX = currentPlayerIndex === 0;
    if (isXNext !== shouldBeX) return;

    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    const newWinner = calculateWinner(newBoard);
    const isDraw = !newWinner && newBoard.every(cell => cell !== null);
    const gameEndWinner = newWinner ? currentPlayerId : (isDraw ? 'draw' : null);

    setBoard(newBoard);
    setIsXNext(!isXNext);
    setWinner(gameEndWinner);

    const newSeriesScore = { ...(session.game_state?.series_score || {}) };
    if (gameEndWinner && gameEndWinner !== 'draw') {
      newSeriesScore[gameEndWinner] = (newSeriesScore[gameEndWinner] || 0) + 1;
    }

    await onUpdateSession({
      game_state: {
        board: newBoard,
        isXNext: !isXNext,
        winner: gameEndWinner,
        rematch_votes: {},
        series_score: newSeriesScore,
      }
    });
  };

  const handleVoteRematch = async () => {
    setMyVote('rematch');
    const newVotes = { ...(session.game_state?.rematch_votes || {}), [currentPlayerId]: 'rematch' };
    const allVotedRematch = session.player_ids.every(id => newVotes[id] === 'rematch');

    if (allVotedRematch) {
      const winnerId = session.game_state?.winner;
      let newPlayerIds = [...session.player_ids];
      let newPlayerNames = [...(session.player_names || [])];
      if (!winnerId || winnerId === 'draw') {
        newPlayerIds = [newPlayerIds[1], newPlayerIds[0]];
        newPlayerNames = [newPlayerNames[1], newPlayerNames[0]];
      } else {
        const winnerIndex = newPlayerIds.indexOf(winnerId);
        const loserIndex = winnerIndex === 0 ? 1 : 0;
        newPlayerIds = [newPlayerIds[loserIndex], newPlayerIds[winnerIndex]];
        newPlayerNames = [newPlayerNames[loserIndex], newPlayerNames[winnerIndex]];
      }
      await onUpdateSession({
        player_ids: newPlayerIds,
        player_names: newPlayerNames,
        host_id: newPlayerIds[0],
        host_name: newPlayerNames[0],
        game_state: { board: Array(9).fill(null), isXNext: true, winner: null, rematch_votes: {}, series_score: session.game_state?.series_score || {} }
      });
    } else {
      await onUpdateSession({ game_state: { ...session.game_state, rematch_votes: newVotes } });
    }
  };

  const handleVoteLeave = async () => {
    if (winner) await onUpdateSession({ status: 'completed' });
    else if (onLeaveGame) onLeaveGame();
    else { /* navigate to KidHome */ }
  };

  const isGameOver = !!winner;
  const currentPlayerIndex = session?.player_ids?.indexOf(currentPlayerId) ?? -1;
  const isMyTurn = !isGameOver && currentPlayerIndex >= 0 &&
    ((currentPlayerIndex === 0 && isXNext) || (currentPlayerIndex === 1 && !isXNext));
  const getWinnerName = () => {
    if (!winner || winner === 'draw') return null;
    const idx = session.player_ids.indexOf(winner);
    return session.player_names?.[idx] || '';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 p-4" dir="rtl">
      <div className="p-8 max-w-md w-full relative bg-white rounded-xl shadow">
        <h2 className="text-3xl font-bold text-center mb-6">איקס עיגול</h2>
        {!isGameOver && (
          <p className="text-center text-lg mb-4">
            {isMyTurn ? <span className="text-blue-600 font-bold">התור שלך!</span>
              : <span className="text-gray-600">ממתין לשחקן השני...</span>}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {board.map((cell, index) => (
            <button key={index} onClick={() => handleClick(index)}
              disabled={!isMyTurn || !!cell || isGameOver}
              className="aspect-square bg-white border-4 border-gray-300 rounded-lg text-5xl font-bold hover:bg-gray-50 disabled:cursor-not-allowed">
              {cell === 'X' && <span className="text-blue-600">X</span>}
              {cell === 'O' && <span className="text-pink-600">O</span>}
            </button>
          ))}
        </div>
        {isGameOver && (
          <PostGameOverlay winnerName={getWinnerName()} isDraw={winner === 'draw'}
            seriesScore={session.game_state?.series_score || {}} playerIds={session.player_ids || []}
            playerNames={session.player_names || []} myVote={myVote}
            otherPlayerLeft={otherPlayerLeft} onRematch={handleVoteRematch} onLeave={handleVoteLeave} />
        )}
      </div>
    </div>
  );
}
```

---

### 5.3 ConnectFour

**Source:** `components/games/ConnectFourGame.jsx`

**Props:** Same interface as TicTacToe.

**Game State Structure:**
```json
{
  "board": [ ["R","Y",null,...], [...], ... ],
  "currentTurn": "kid_id",
  "winner": "kid_id | 'draw' | null",
  "rematch_votes": {},
  "series_score": {}
}
```

**Rules:**
- 6 rows × 7 columns grid
- Pieces fall to the lowest empty cell in a column (gravity)
- Player at index 0 = Red (`'R'`), index 1 = Yellow (`'Y'`)
- Win: 4 in a row horizontally, vertically, or diagonally
- Draw: top row completely full with no winner
- `currentTurn` holds the active player's ID
- On rematch: loser goes first

**Win detection algorithm (check 4 connected in 4 directions from the placed piece):**
```js
const directions = [[0,1],[1,0],[1,1],[1,-1]];
function checkWin(board, row, col, player) {
  for (const [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r>=0&&r<6&&c>=0&&c<7&&board[r][c]===player) count++; else break;
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r>=0&&r<6&&c>=0&&c<7&&board[r][c]===player) count++; else break;
    }
    if (count >= 4) return true;
  }
  return false;
}
```

Full component source: see `components/games/ConnectFourGame.jsx`. Replace Base44 calls identically to TicTacToe above.

---

### 5.4 Memory Match

**Source:** `components/games/MemoryGame.jsx`

**Props:** Same interface as TicTacToe.

**Game State Structure:**
```json
{
  "cards": [
    { "id": 0, "emoji": "🎮", "matched": false },
    ...
  ],
  "matched": [0, 1, 4, 5],
  "scores": { "kid_id_1": 3, "kid_id_2": 2 },
  "currentTurn": "kid_id",
  "winner": "kid_id | 'draw' | null",
  "rematch_votes": {}
}
```

**Card emojis (8 pairs = 16 cards):** `['🎮','🎨','🎵','🎯','🎪','🎭','🎬','🎤']`

**Rules:**
- Cards are shuffled randomly at game init
- Player flips 2 cards on their turn
- If they match → player gets a point, keeps their turn
- If they don't match → cards flip back after 1 second, turn passes
- Game ends when all pairs are matched
- Winner = player with most pairs; tie = draw
- `matched` is an array of card indices

Full component source: see `components/games/MemoryGame.jsx`. Replace Base44 calls as above.

---

### 5.5 Snake

**Source:** `components/games/SnakeGame.jsx`

**Props:**
```typescript
interface SnakeGameProps {
  session: GameSession;
  onUpdateSession: (updates: Partial<GameSession>) => Promise<void>;
  currentPlayerId: string;
  // Note: onLeaveGame not used — snake is single-player
}
```

**Game State Structure (for save/resume):**
```json
{
  "snake": [{ "x": 10, "y": 10 }, ...],
  "food": { "x": 15, "y": 10 },
  "direction": { "x": 1, "y": 0 },
  "score": 42,
  "bestScore": 55,
  "gameOver": false
}
```

**Constants:**
- Grid: 20×20 cells, each cell 20px → canvas 400×400px
- Initial speed: 150ms interval; minimum: 60ms
- Speed increase: 3ms faster per food eaten
- Starting position: `{ x: 10, y: 10 }`, direction: right

**Rules:**
- Snake grows by 1 cell on eating food
- Collision with wall or self → game over
- Best score is persisted to `KidAccount.best_scores.snake`
- Game state is autosaved every 5 seconds and on tab close (for recess interruption)
- A paused (saved) game can be resumed

**Key behavior notes:**
- Uses `useRef` for game loop and snake state (not React state) to avoid re-render lag
- Canvas-based rendering via `<canvas>` element
- Keyboard: arrow keys + WASD
- On-screen D-pad for touch devices
- On game over → sets session `status: 'completed'`

Full component source: see `components/games/SnakeGame.jsx`. Remove `base44.functions.invoke` calls — replace `getMyPrivateProfile` with `GET /api/auth/me` and `updateKidProfile` with `PATCH /api/kids/me/profile`.

---

### 5.6 Simon Says

**Source:** `components/games/SimonGame.jsx`

**Props:**
```typescript
interface SimonGameProps {
  session: GameSession;
  onUpdateSession: (updates: Partial<GameSession>) => Promise<void>;
  currentPlayerId: string;
}
```

**Game State Structure:**
```json
{
  "sequence": [0, 2, 1, 3, 0],
  "score": 4,
  "bestScore": 12,
  "gameOver": false
}
```

**Colors (4 buttons):**
```js
[
  { id: 0, color: 'red' },
  { id: 1, color: 'blue' },
  { id: 2, color: 'yellow' },
  { id: 3, color: 'green' }
]
```

**Rules:**
- Each round: play the sequence with 500ms light-up per button
- Player must repeat the full sequence in order
- Correct full sequence → score + 1, add 1 random button to sequence
- Any wrong button → game over
- Best score persisted to `KidAccount.best_scores.simon`
- Also cached in `localStorage` as fallback
- On game over → session `status: 'completed'`
- Progress saved after each successful level (for recess resume)

Full component source: see `components/games/SimonGame.jsx`. Replace Base44 calls as above.

---

### 5.7 Whack-a-Mole

**Source:** `components/games/WhackAMoleGame.jsx`

**Props:** Same as Snake (single-player).

**Game State Structure:**
```json
{
  "score": 15,
  "bestScore": 28,
  "timeLeft": 22,
  "gameOver": false
}
```

**Constants:**
- Game duration: 30 seconds
- Grid: 3×3 = 9 holes
- Initial mole show time: 1200ms → minimum 500ms (gets shorter as game progresses)
- Initial mole interval: 1500ms → minimum 600ms

**Rules:**
- Moles pop up randomly in grid holes
- Click/tap a mole before it disappears → +1 score
- Time runs out → game over (not lives)
- Mole show time and spawn interval both decrease linearly as game progresses
- Best score persisted to `KidAccount.best_scores.whack_a_mole`
- Game state saved every 5 seconds for recess resume

Full component source: see `components/games/WhackAMoleGame.jsx`. Replace Base44 calls as above.

---

### 5.8 Balloon Pop

**Source:** `components/games/BalloonPopGame.jsx`

**Props:** Same as Snake (single-player).

**Game State Structure:**
```json
{
  "score": 20,
  "lives": 2,
  "bestScore": 35,
  "balloons": [{ "id": 0, "x": 120, "y": 300, "colorIdx": 3, "speed": 1.4 }],
  "gameOver": false
}
```

**Constants:**
- Arena: 350×450px
- Balloon size: 50px
- Initial lives: 3
- Spawn interval: 1500ms → minimum 600ms
- Rise speed: 1.2px/frame → maximum 3.0px/frame
- Speed increases by 0.05 per point scored

**Rules:**
- Balloons spawn at bottom, rise upward using `requestAnimationFrame`
- Balloon escapes top of screen → -1 life
- 0 lives → game over
- Click/tap balloon before it escapes → +1 score
- 8 color options; random per spawn
- Best score persisted to `KidAccount.best_scores.balloon_pop`
- Pop effect (💥) shown briefly at balloon position on click

Full component source: see `components/games/BalloonPopGame.jsx`. Replace Base44 calls as above.

---

### 5.9 Drawing Board

**Source:** `components/games/DrawingGame.jsx`

**Props:**
```typescript
interface DrawingGameProps {
  session: GameSession;
  onUpdateSession: (updates: Partial<GameSession>) => Promise<void>;
  // currentPlayerId not needed — all players draw freely
}
```

**Game State Structure:**
```json
{
  "drawings": [
    {
      "color": "#FF0000",
      "width": 3,
      "points": [{ "x": 120, "y": 80 }, { "x": 122, "y": 85 }, ...]
    }
  ]
}
```

**Canvas:** 800×600px (CSS responsive), `lineCap: round`, `lineJoin: round`

**Rules:**
- All players draw on the same shared canvas
- Each completed stroke is saved to `game_state.drawings` as a `points` array
- On session state update from server → redraw entire canvas from `drawings` array
- Conflict resolution: while a player is drawing, incoming server state is ignored (to prevent flicker)
- Clear all → sets `drawings: []` for all players
- Colors: `['#000000','#FF0000','#00FF00','#0000FF','#FFFF00','#FF00FF','#00FFFF','#FFA500']`
- Line widths: thin (3px) or thick (8px)
- Touch support: `onTouchStart`, `onTouchMove`, `onTouchEnd`

**Sync coordination:** Uses a `saveCounterRef` to prevent the real-time sync from overwriting local strokes mid-save.

Full component source: see `components/games/DrawingGame.jsx`. No Base44 calls to remove — only `onUpdateSession` is used.

---

## 6. Frontend Structure

### 6.1 Pages

| Route | Page | Description |
|---|---|---|
| `/` | `Home` | Immediately redirects to `/login` |
| `/login` | `KidLogin` | Username + password login form |
| `/home` | `KidHome` | Main kid dashboard (games, social, friends) |
| `/play` | `KidGamePlay` | In-game view with game rendering and controls |
| `/inbox` | `Inbox` | Private messages and friend requests |
| `/profile` | `Profile` | Avatar editor, stats, password change |
| `/teacher` | `TeacherHome` | Teacher monitoring dashboard |
| `/teacher/watch` | `TeacherGameWatch` | Observe a specific session's chat |
| `/admin/games` | `AdminGames` | Admin: game catalog CRUD |
| `/admin/kids` | `AdminKids` | Admin: user management |
| `/admin/schedule` | `AdminSchedule` | Admin: recess schedule CRUD |
| `/admin/export` | `DataExport` | Admin: SQL data export |

### 6.2 Main Components

| Component | Description |
|---|---|
| `GameLibrary` | Grid of available games with Start button |
| `OpenGames` | List of joinable active sessions |
| `SavedGames` | List of paused sessions to resume |
| `OnlineUsers` | Sidebar list of online kids (same gender) |
| `FriendsList` | Friends, pending requests, blocked list with actions |
| `KidAvatar` | Avatar renderer: photo > emoji preset > color+initial |
| `KidProfileCard` | Popup card: avatar, name, grade + action buttons (challenge, message, friend, block) |
| `ComposeMessage` | Message composition dialog |
| `MessageThread` | Thread of messages with a specific kid |
| `RecessTimer` | Countdown to end of current recess |
| `GameRenderer` | Selects and renders the correct game component based on `game.game_url` |
| `GameChat` | In-game chat panel with text + voice messages |
| `PostGameOverlay` | Win/draw/rematch screen for multiplayer games |
| `PlayerIndicator` | Shows player list, status indicators |

### 6.3 Navigation Flow

```
/login
  │
  ├── [kid role] → /home
  │     ├── Start game → /play?sessionId=...
  │     ├── Join game → /play?sessionId=...
  │     ├── Challenge accepted → /play?sessionId=...
  │     ├── → /inbox
  │     └── → /profile
  │
  ├── [teacher role] → /teacher
  │     └── Watch session → /teacher/watch?sessionId=...
  │
  └── [admin] → /admin/games
        ├── → /admin/kids
        ├── → /admin/schedule
        └── → /admin/export
```

### 6.4 Avatar Resolution Logic (KidAvatar)

```
1. If kid.avatar_url → render <img src={avatar_url}>
2. Else if kid.avatar_preset_id:
     a. Look up in DB presets (AvatarPreset) by key
     b. If found and has image_url → render <img src={image_url}>
     c. If found and has emoji → render emoji text
     d. Else look up in BUILT_IN_PRESETS by key → render emoji
3. Else → render first letter of full_name on colored circle (avatar_color)
```

**Built-in presets hardcoded array** (source: `components/playground/KidAvatar.jsx`):
```js
const BUILT_IN_PRESETS = [
  { key: 'fox', label_he: 'שועל', emoji: '🦊' },
  { key: 'robot', label_he: 'רובוט', emoji: '🤖' },
  { key: 'cat', label_he: 'חתול', emoji: '🐱' },
  { key: 'unicorn', label_he: 'חד קרן', emoji: '🦄' },
  { key: 'lion', label_he: 'אריה', emoji: '🦁' },
  { key: 'penguin', label_he: 'פינגווין', emoji: '🐧' },
  { key: 'dragon', label_he: 'דרקון', emoji: '🐉' },
  { key: 'owl', label_he: 'ינשוף', emoji: '🦉' },
  { key: 'bear', label_he: 'דוב', emoji: '🐻' },
  { key: 'rabbit', label_he: 'ארנב', emoji: '🐰' },
  { key: 'shark', label_he: 'כריש', emoji: '🦈' },
  { key: 'dinosaur', label_he: 'דינוזאור', emoji: '🦕' },
];
```

---

## 7. What Needs to Be Rebuilt

### 7.1 Real-Time System (WebSockets)

The current system uses Base44's proprietary real-time entity subscriptions. The rebuild must implement a WebSocket server.

**What real-time events are needed:**

| Event | Subscribers | Payload |
|---|---|---|
| `game_session:updated` | All players in a session | `{ session_id, game_state, status, player_ids, player_names, ... }` |
| `kid:online_status` | All kids of same gender | `{ kid_id, last_seen }` |
| `kid:challenge_received` | Target kid | `{ from_kid_id, session_id, game_id, game_name }` |
| `private_message:new` | Recipient kid | `{ message }` |
| `chat_message:new` | All players in a session | `{ message }` |
| `kid:unread_count` | Target kid | `{ count }` |

**Recommended approach:**
- Each authenticated WebSocket connection is scoped to a specific kid
- Rooms: `game_session:{id}`, `gender:{boy|girl}`, `kid:{id}`
- Use Socket.io or native `ws` with room management

---

### 7.2 Authentication System

**Must implement:**
- Custom username+password authentication for kids (NOT email-based)
- JWT or opaque session tokens stored in a DB table
- Token expiry aligned with recess window end time (for kids) or fixed 8 hours (for teachers)
- Password hashing (bcrypt)
- Recess time enforcement at login time (Israel timezone)
- Separate admin authentication flow

**Recess time check (server-side, Israel timezone):**
```js
import { DateTime } from 'luxon';

function isRecessTime(schedules) {
  const now = DateTime.now().setZone('Asia/Jerusalem');
  const dayOfWeek = now.weekday % 7; // luxon: 1=Mon, 7=Sun → convert to 0=Sun
  const currentTime = now.toFormat('HH:mm');

  return schedules.some(s =>
    s.is_active &&
    s.day_of_week === dayOfWeek &&
    s.start_time <= currentTime &&
    currentTime <= s.end_time
  );
}
```

---

### 7.3 Session Management

**Must implement:**
- DB table for sessions: `{ id, token, kid_id, expires_at, created_at }`
- Token validation middleware on all protected routes
- Probabilistic cleanup of expired sessions (~20% on each login)
- `clearAllSessions` admin endpoint (only when not recess time)
- `updateSessionExpirations` admin endpoint (extend all sessions to end of current recess)

---

### 7.4 Presence System (Online Detection)

**Must implement:**
- `PATCH /api/social/heartbeat` — update `kid.last_seen` to current server time
- Client sends heartbeat every **30 seconds**
- A kid is "online" if `last_seen >= now - 90 seconds`
- On tab close / logout → set `last_seen: null` (use `navigator.sendBeacon` or keepalive fetch for tab close reliability)
- Clock skew handling: the heartbeat response should return `server_time`; client should compute skew and adjust the timestamps it sends

**Clock skew pattern:**
```js
// After login/validate response:
const skewMs = new Date(serverTime) - Date.now();

// When sending heartbeat:
const adjustedTime = new Date(Date.now() + skewMs).toISOString();
fetch('/api/social/heartbeat', { body: { last_seen: adjustedTime } });
```

---

### 7.5 File Uploads

Current system uses Base44's `UploadFile` integration. In the rebuild:
- Use `multer` (Node.js) for multipart form handling
- Store files in S3, Cloudflare R2, or local disk
- Return a public URL
- Client-side compression before upload (max 512×512px, JPEG 0.8 quality) — this logic lives in `AdminKids.jsx` and `Profile.jsx` and can be reused as-is

---

## 8. File References Used

All source files read to produce this document:

```
components/games/TicTacToe.jsx
components/games/ConnectFourGame.jsx
components/games/MemoryGame.jsx
components/games/SnakeGame.jsx
components/games/SimonGame.jsx
components/games/WhackAMoleGame.jsx
components/games/BalloonPopGame.jsx
components/games/DrawingGame.jsx
components/game/PostGameOverlay.jsx
components/playground/KidAvatar.jsx
components/playground/GameLibrary.jsx
components/playground/FriendsList.jsx
components/playground/OnlineUsers.jsx
components/playground/KidProfileCard.jsx
components/playground/ComposeMessage.jsx
components/playground/MessageThread.jsx
components/playground/RecessTimer.jsx
components/hooks/useHeartbeat.js
components/hooks/useRecessCheck.js
components/hooks/useRecessLogout.js
components/hooks/useOnlineKids.js
components/hooks/useUnreadMessages.js
components/AdminProtection.jsx
pages/KidLogin.jsx
pages/KidHome.jsx
pages/KidGamePlay.jsx
pages/Inbox.jsx
pages/Profile.jsx
pages/TeacherHome.jsx
pages/TeacherGameWatch.jsx
pages/AdminGames.jsx
pages/AdminKids.jsx
pages/AdminSchedule.jsx
pages/DataExport.jsx
pages/Home.jsx
functions/createSession.js
functions/validateSession.js
functions/deleteSession.js
functions/updateHeartbeat.js
functions/clearLastSeen.js
functions/getOnlineKids.js
functions/getMyPrivateProfile.js
functions/updateKidProfile.js
functions/updateKidState.js
functions/sendPrivateMessage.js
functions/adminSendMessage.js
functions/markMessagesRead.js
functions/sendFriendRequest.js
functions/respondToFriendRequest.js
functions/blockKid.js
functions/reportMessage.js
functions/clearSessionChat.js
functions/deleteChatMessage.js
functions/clearAllSessions.js
functions/evictStalePlayers.js
functions/updateSessionExpirations.js
functions/migratePublicProfiles.js
entities/KidAccount.json
entities/PublicKidProfile.json
entities/Session.json
entities/Game.json
entities/GameSession.json
entities/ChatMessage.json
entities/PrivateMessage.json
entities/ModerationReport.json
entities/RecessSchedule.json
entities/AvatarPreset.json
Layout.jsx
App.jsx
pages.config.js
```

---

*Migration export generated: April 2026*