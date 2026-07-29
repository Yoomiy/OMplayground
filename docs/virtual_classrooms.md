# Virtual Classrooms with LiveKit

The Virtual Classrooms platform enables dynamic, standalone virtual classrooms built on shared platform infrastructure (LiveKit SFU + Supabase DB/Auth). Decoupled from the main playground user authentication, any student or substitute teacher can join a classroom using only an invite link and display name.

---

## 🚀 Key Features

### 1. Guest Entry and Host Authority
- **Unauthenticated Entry**: Guests can join any active classroom by opening the invite link (`/classroom/:roomCode`) and entering a display name.
- **Server-issued Hosts**: Authenticated teachers and admins receive host authority in their LiveKit token. Host metadata is issued and updated only by the application server.
- **Guest Co-hosts**: An authenticated teacher or admin can promote a connected guest through the server. The server updates LiveKit metadata and the classroom's delegated identity list, so browsers cannot self-promote. Guest co-hosts do not receive database lifecycle authority: settings changes, further promotions, and ending a class remain authenticated teacher/admin actions.

### 2. High-Quality Video, Audio & Presentation Stage
- **LiveKit SFU Integration**: High-definition video/audio streaming with active speaker highlight badges and dynamic grid layouts.
- **Screen Share Focus**: Dedicated presentation stage when a host or permitted student shares their screen.
- **Microphone & Camera Toggles**: Media controls with visual status indicators.
- **Robust Hardware Init**: Safely handles missing camera/mic hardware or browser permission blocks (`Starting videoinput failed`) without blocking room connection.
- **Connection Timeout Race**: WebRTC connection is raced with a 10s timeout to prevent page freezes when PeerConnection negotiation fails.

### 3. Integrated Excalidraw Whiteboard
- **Collaborative Real-time Board**: Embedded Excalidraw canvas uses the game-server Socket.IO drawing session (`class-draw-{roomCode}`) for Yjs deltas; LiveKit is reserved for media, chat, and room controls.
- **Viewport Focus Sync & Lock**:
  - The teacher's scroll position and zoom level are synchronized to all students in real-time.
  - Students without drawing privileges have their board locked to the host's view, preventing them from panning or zooming away from the teacher's focus point.
- **Clean Whiteboard UI**: Hides all redundant top bars, headers, and footer statistics to maximize board real estate inside the classroom.
- **Durable Active State**: Authorized host checkpoints and clears are written to the drawing `game_sessions.game_state`, so a reconnect or game-server restart restores the board. A monotonic clear revision permits an explicit remote clear without allowing an empty late-join snapshot to erase existing content. The board is cleared when the classroom ends.

### 4. Comprehensive Host Control Panel
- **Grant Host Status**: Promote substitute teachers / co-presenters to server-backed in-room Hosts.
- **Kick Participant (`הוצא מהכיתה`)**: Instantly evict any participant from the room.
- **Host-Permission Gated Student Chat**: Chat disabled by default for students, unlocked only with host permission.
- **Host-Permission Gated Screen Share**: Screen sharing locked by default for non-hosts, unlocked only with host permission.
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
| **Database** | `supabase/migrations/` | Schema/RLS for `classroom_sessions`; lifecycle maintenance functions are service-role only |
| **Backend API** | `apps/minecraft-server/src/livekitService.ts` | LiveKit classroom token issuance, cleanup, and trusted participant promotion via `RoomServiceClient` |
| **Backend API** | `apps/minecraft-server/src/index.ts` | Authenticated `/rtc/classroom-token`, `/rtc/classroom-end`, `/rtc/classroom-cleanup`, and `/rtc/classroom-promote` routes; background cleanup |
| **Frontend UI** | `apps/web/src/pages/ClassroomPage.tsx` | Interactive classroom page: authenticated lifecycle calls, server-issued host controls, and Socket.IO board hydration |
| **Frontend UI** | `apps/web/src/pages/TeacherPage.tsx` | Teacher tab for creating classrooms (scoped to creator `teacher_id`) & copying links |
| **Frontend UI** | `apps/web/src/pages/AdminPage.tsx` | Admin tab for real-time monitoring, stealth modes, persistence toggles, and manual cleanup |
| **Frontend UI** | `apps/web/src/games/drawing/DrawingCanvas.tsx` | Yjs state sync, authoritative clear revision handling, and viewport controls |
| **Routing** | `apps/web/src/App.tsx` | Public route `/classroom/:roomCode` |
