# Virtual Classrooms with LiveKit

The Virtual Classrooms platform enables dynamic, standalone virtual classrooms built on shared platform infrastructure (LiveKit SFU + Supabase DB/Auth). Decoupled from the main playground user authentication, any student or substitute teacher can join a classroom using only an invite link and display name.

---

## 🚀 Key Features

### 1. Standalone Guest Student & Substitute Teacher Access
- **Unauthenticated Entry**: Students and substitute teachers without platform accounts can join any active classroom simply by opening the invite link (`/classroom/:roomCode`) and typing their display name.
- **Host Status Delegation**: Any Admin or Teacher host can promote a participant (e.g., a substitute teacher without an account) to full **Host Status** (`role: 'host'`), unlocking all host controls for them.

### 2. High-Quality Video, Audio & Presentation Stage
- **LiveKit SFU Integration**: High-definition video/audio streaming with active speaker highlight badges and dynamic grid layouts.
- **Screen Share Focus**: Dedicated presentation stage when a host or permitted student shares their screen.
- **Microphone & Camera Toggles**: Media controls with visual status indicators.
- **Robust Hardware Init**: Safely handles missing camera/mic hardware or browser permission blocks (`Starting videoinput failed`) without blocking room connection.
- **Connection Timeout Race**: WebRTC connection is raced with a 10s timeout to prevent page freezes when PeerConnection negotiation fails.

### 3. Integrated Excalidraw Whiteboard
- **Collaborative Real-time Board**: Embedded Excalidraw drawing canvas with LiveKit Data Channel delta sync.
- **Viewport Focus Sync & Lock**:
  - The teacher's scroll position and zoom level are synchronized to all students in real-time.
  - Students without drawing privileges have their board locked to the host's view, preventing them from panning or zooming away from the teacher's focus point.
- **Clean Whiteboard UI**: Hides all redundant top bars, headers, and footer statistics to maximize board real estate inside the classroom.
- **Ephemeral State**: Whiteboard drawings are bound to the session lifecycle and automatically destroyed when the classroom is ended. Host has an instant **"נקה/בטל לוח" (Clear/Dismiss Board)** button.

### 4. Comprehensive Host Control Panel
- **Grant Host Status**: Promote substitute teachers / co-presenters to full Hosts.
- **Kick Participant (`הוצא מהכיתה`)**: Instantly evict any participant from the room.
- **Host-Permission Gated Student Chat**: Chat disabled by default for students, unlocked only with host permission.
- **Host-Permission Gated Screen Share**: Screen sharing locked by default for non-hosts, unlocked only with host permission.
- **Mute All Students (`השתק את כל התלמידים`)**: Global microphone mute trigger.
- **Lower All Hands (`הורד כל הידיים`)**: Clear hand raises.
- **End Classroom (`סים שיעור וסגור כיתה`)**: Terminates session for all participants, deletes LiveKit server room memory, and wipes session state.

### 5. Admin Monitoring, Spectating & Room Lifecycle (`/admin`)
- **Real-time Active Classrooms Monitor**: Displays active classroom count, titles, hosts, and room codes.
- **🕵️ Invisible Spectate (Stealth Mode)**: Join as a hidden observer (`spectate=invisible`) with camera and mic disabled, completely filtered from grids and lists.
- **👁️ Visible Spectate**: Join as an official supervisor with an Admin Badge (`spectate=visible`).
- **Room Persistence**: Configure classrooms as temporary (`⏳ זמנית`) or permanent (`📌 קבועה`). Permanent rooms are protected from cleanup.
- **Automated Background Cleanup (Cron)**: 6-hour Node.js server interval automatically deletes rooms and LiveKit memory for non-persistent classrooms older than 7 days.
- **Manual Cleanup Button (`🧹 ניקוי כיתות ישנות`)**: Admin manually purges temporary, inactive rooms immediately.
- **Security Check Optimization**: Short-circuits admin validations when `?spectate=...` is absent, preventing unnecessary external database lookups and optimizing connection speeds.

---

## 🛠️ Codebase Layout

| Layer | File / Component | Description |
|---|---|---|
| **Database** | `supabase/migrations/` | Schema migrations for `classroom_sessions` table, RLS policies, functions, and indexes |
| **Backend API** | `apps/minecraft-server/src/livekitService.ts` | LiveKit JWT token generator; exports `deleteLiveKitRoom` helper using `RoomServiceClient` |
| **Backend API** | `apps/minecraft-server/src/index.ts` | `/rtc/classroom-token`, `/rtc/classroom-end`, `/rtc/classroom-cleanup` routes, background interval cron |
| **Frontend UI** | `apps/web/src/pages/ClassroomPage.tsx` | Interactive classroom page: safe device init, security checks, viewport sync, and chat locking |
| **Frontend UI** | `apps/web/src/pages/TeacherPage.tsx` | Teacher tab for creating classrooms (scoped to creator `teacher_id`) & copying links |
| **Frontend UI** | `apps/web/src/pages/AdminPage.tsx` | Admin tab for real-time monitoring, stealth modes, persistence toggles, and manual cleanup |
| **Frontend UI** | `apps/web/src/games/drawing/DrawingCanvas.tsx` | Viewport synchronization & lock; hides menu triggers and feedback buttons for users |
| **Routing** | `apps/web/src/App.tsx` | Public route `/classroom/:roomCode` |
