# Virtual Classrooms with LiveKit

The Virtual Classrooms platform enables dynamic, standalone virtual classrooms built on shared platform infrastructure (LiveKit SFU + Supabase DB/Auth). Decoupled from the main playground user authentication, any student or substitute teacher can join a classroom using only an invite link and display name.

---

## 🚀 Key Features

### 1. Guest Entry and Host Authority
- **Unauthenticated Entry**: Guests can join any active classroom by opening the invite link (`/classroom/:roomCode`) and entering a display name.
- **Server-issued Hosts**: Authenticated teachers and admins receive host authority in their LiveKit token. Host metadata is issued and updated only by the application server.
- **Persistent Co-hosts**: Promoting a connected participant now sends a one-time enrollment secret directly to that participant over a targeted LiveKit data packet. The browser exchanges it for a one-year, opaque `HttpOnly` cookie; no secret appears in the classroom URL. Future visits receive a stable delegated LiveKit identity and full room-management scopes.
- **Scoped Server Authority**: Delegates can change student chat, whiteboard, microphone, camera, and screen-share settings; promote another co-host; and remove a participant through server-authorized endpoints. They cannot end or archive the persistent classroom.

### 2. High-Quality Video, Audio & Presentation Stage
- **LiveKit SFU Integration**: High-definition video/audio streaming with active speaker highlight badges and dynamic grid layouts.
- **Screen Share Focus**: Dedicated presentation stage when a host or permitted student shares their screen.
- **Microphone & Camera Toggles**: Media controls with visual status indicators.
- **Robust Hardware Init**: Safely handles missing camera/mic hardware or browser permission blocks (`Starting videoinput failed`) without blocking room connection.
- **Connection Timeout Race**: WebRTC connection is raced with a 10s timeout to prevent page freezes when PeerConnection negotiation fails.

### 3. Integrated Excalidraw Whiteboard
- **Collaborative Real-time Board**: Each active drawing session (`class-draw-{roomCode}`) has one canonical Yjs document held by the game server. Permitted drawers send deltas to that server, which applies and broadcasts them; LiveKit is reserved for media, chat, and room controls.
- **Reliable Join and Reconnect**: On every connection, the server sends the full canonical state through `CLASSROOM_DRAWING_SYNC`. The canvas renders it before acknowledging readiness, and the server does not accept live deltas from that socket until the acknowledgement. This keeps late joiners and refreshed browsers from replacing the current board with empty or stale state.
- **Viewport Focus Sync & Lock**:
  - The teacher's scroll position and zoom level are synchronized to all students in real-time.
  - Students without drawing privileges have their board locked to the host's view, preventing them from panning or zooming away from the teacher's focus point.
- **Clean Whiteboard UI**: Hides all redundant top bars, headers, and footer statistics to maximize board real estate inside the classroom.
- **Durable Active State**: The drawing `game_sessions.game_state` is a periodic and lifecycle checkpoint of the server's live board, used to rebuild it after a game-server restart. It is not used to hydrate active joins. Explicit clears are persisted immediately, and the board is cleared when the classroom ends.

### 4. Comprehensive Host Control Panel
- **Grant Host Status**: Promote substitute teachers / co-presenters to server-backed in-room Hosts.
- **Kick Participant (`הוצא מהכיתה`)**: Removes the participant through LiveKit's server API and revokes their current room token, rather than relying on a client-side disconnect request.
- **Host-Permission Gated Student Chat**: Chat disabled by default for students, unlocked only with host permission.
- **Host-Permission Gated Screen Share**: Screen sharing locked by default for non-hosts, unlocked only with host permission. The backend updates participant publish-source permissions immediately when the setting changes.
- **Mute All Students (`השתק את כל התלמידים`)**: Global microphone mute trigger.
- **Lower All Hands (`הורד כל הידיים`)**: Clear hand raises.
- **End Classroom (`סים שיעור וסגור כיתה`)**: Authenticated teacher/admin action that terminates the session, deletes LiveKit room memory, and completes the drawing session.

### 5. Admin Monitoring, Spectating & Room Lifecycle (`/admin`)
- **Real-time Active Classrooms Monitor**: Displays active classroom count, titles, hosts, and room codes.
- **🕵️ Invisible Spectate (Stealth Mode)**: Join as a hidden observer (`spectate=invisible`) with camera and mic disabled, completely filtered from grids and lists.
- **👁️ Visible Spectate**: Join as an official supervisor with an Admin Badge (`spectate=visible`).
- **Room Persistence**: Configure classrooms as temporary (`⏳ זמנית`) or permanent (`📌 קבועה`). Permanent rooms are protected from cleanup.
- **Automated Background Cleanup (Cron)**: A 6-hour Node.js server interval removes non-persistent rooms that ended or have stale `last_activity`, then clears matching drawing sessions and LiveKit rooms.
- **Manual Cleanup Button (`🧹 ניקוי כיתות ישנות`)**: Authenticated administrators run the same cleanup with a validated 1-365-day threshold.
- **Security Check Optimization**: Short-circuits admin validations when `?spectate=...` is absent, preventing unnecessary external database lookups and optimizing connection speeds.

---

## 🛠️ Codebase Layout

| Layer | File / Component | Description |
|---|---|---|
| **Database** | `supabase/migrations/` | Schema/RLS for classrooms plus server-only delegate, enrollment, and cookie-session records |
| **Backend API** | `apps/minecraft-server/src/livekitService.ts` | LiveKit classroom token issuance, permission synchronization, removal, cleanup, and trusted enrollment delivery |
| **Backend API** | `apps/minecraft-server/src/index.ts` | Classroom token, delegate activation, settings, removal, promotion, lifecycle, and cleanup routes |
| **Frontend UI** | `apps/web/src/pages/ClassroomPage.tsx` | Interactive classroom page: authenticated lifecycle calls, server-issued host controls, and Socket.IO board hydration |
| **Frontend UI** | `apps/web/src/pages/TeacherPage.tsx` | Teacher tab for creating classrooms (scoped to creator `teacher_id`) & copying links |
| **Frontend UI** | `apps/web/src/pages/AdminPage.tsx` | Admin tab for real-time monitoring, stealth modes, persistence toggles, and manual cleanup |
| **Frontend UI** | `apps/web/src/games/drawing/DrawingCanvas.tsx` | Yjs state sync, authoritative clear revision handling, and viewport controls |
| **Routing** | `apps/web/src/App.tsx` | Public route `/classroom/:roomCode` |

## Deployment note

The classroom page must call the RTC service from an allowed `CORS_ORIGIN` with credentials enabled. In production, serve the web app and RTC service from the same site (or a same-site subdomain) so browsers retain the secure delegate cookie. The cookie is `HttpOnly`, `Secure`, `SameSite=None` in production, and is accepted only by delegate endpoints with an allow-listed browser `Origin`.
