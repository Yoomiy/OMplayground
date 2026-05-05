# 🎮 מגרש המשחקים (The Playground) — Detailed System Blueprint

This document provides a comprehensive technical and functional breakdown of the Playground application. It serves as a blueprint for the current architecture and a guide for future development.

---

## 🏗️ System Architecture

The application is structured as a modern **monorepo** consisting of three primary layers:

### 1. Frontend (apps/web)
A React-based Single Page Application (SPA) that provides the user interface for students, teachers, and admins.
- **Tech Stack:** React 18, Vite, Tailwind CSS, Lucide Icons.
- **Data Layer:** Supabase client for authentication, real-time database subscriptions, and CRUD operations.
- **Real-time:** Socket.io-client for authoritative gameplay communication with the game server.

### 2. Game Server (apps/game-server)
A Node.js authoritative server that manages the "hot path" of multiplayer gaming.
- **Tech Stack:** Express, Socket.io, TypeScript.
- **Responsibilities:** 
  - Room lifecycle management (waiting, playing, paused, completed).
  - Validation of game intents using the shared `game-logic` package.
  - Periodic persistence of game states to Supabase.
  - Enforcing recess-based session terminations.

### 3. Game Logic (packages/game-logic)
A shared TypeScript library containing the "rules of the game" for all custom multiplayer modules.
- **Pattern:** Redux-like `applyIntent(state, action)` pattern to ensure consistent state transitions on both client and server.
- **Supported Games:** Chess, Tic-Tac-Toe, Connect Four, Memory Match, Drawing.

---

## 🗄️ Database Schema & Security

The platform uses **Supabase (PostgreSQL)** with strict **Row-Level Security (RLS)** to enforce safety and gender segregation.

### Core Tables
| Table | Description |
| :--- | :--- |
| `kid_profiles` | Extends `auth.users` with student data (gender, grade, avatar, coins, etc.). |
| `game_sessions` | Metadata for game matches (host, players, status, final score). |
| `chat_messages` | Persisted in-game chat logs (moderated by teachers). |
| `private_messages` | Direct messages and friend requests between students. |
| `friendships` | Normalized table for social relationships. |
| `recess_schedules` | Configuration for "Playground Open" hours. |

### Safety Invariants
- **Gender Isolation:** RLS policies ensure that students can only query profiles and join sessions matching their own gender.
- **Synthetic Identities:** To protect student privacy, the system uses internal `username@playground.school.local` email addresses for authentication.

---

## 🕹️ Game Lifecycle

1. **Lobby:** A student creates a session (marked as `waiting`).
2. **Joining:** Other students in the same gender partition see the open session in their dashboard and join.
3. **Activation:** Once `minPlayers` is reached, the Game Server initializes the state.
4. **Authoritative Play:** 
   - Clients send `INTENT` events (e.g., "Place X at index 4").
   - Server validates the intent against `game-logic`.
   - Server broadcasts the updated `ROOM_SNAPSHOT` to all participants.
5. **Termination:** Upon win/loss or manual stop, the final state is persisted to the DB and the room is cleared from memory.

---

## 👩‍🏫 Role-Specific Features

### Student Experience
- **Home:** Dashboard showing open games, online friends, and remaining recess time.
- **Social:** Sending friend requests, private messages, and real-time game challenges.
- **Play:** Full-screen game view with integrated chat and voice messages (via audio upload).

### Teacher Supervision
- **Live Monitor:** Dashboard displaying all active games across both gender partitions.
- **Spectator Mode:** Teachers can join any room as a "spectator" to watch live gameplay and chat.
- **Moderation:** Direct buttons to delete specific chat messages or clear entire room histories.

### Admin Control
- **User Management:** CSV bulk import for students/teachers, manual banning, and grade promotion.
- **Catalog Management:** Adding new games (custom or embedded iFrame games).
- **Scheduling:** Drag-and-drop interface for configuring weekly recess windows.

---

## 🕒 Recess Enforcement Mechanism

The "Time-Lock" is enforced at multiple levels:
1. **Database:** A custom PG function `is_within_recess_now()` is used in RLS policies to prevent data modifications outside of recess.
2. **Game Server:** A "Recess Sweep" background task runs every minute. If a recess period ends, it gracefully pauses or terminates all active game rooms.
3. **Frontend:** A `RecessTimer` hook monitors the schedule and redirects students to the "Closed" screen when time expires.

---

## 📁 Repository Structure

```text
/
├── apps/
│   ├── game-server/        # Authoritative Node.js/Socket.io server (event-driven, all turn-based games)
│   ├── minecraft-server/   # Authoritative voxel server (tick-based, fullscreen 3D Minecraft)
│   ├── web/                # React frontend (Vite). PlayPage.tsx routes `game_url='minecraft'` to MinecraftSessionContainer.
├── packages/
│   └── game-logic/         # Shared game rules and state machines (turn-based games only)
├── supabase/
│   └── migrations/         # SQL schema, RLS policies, and triggers
└── docs/                   # Architecture and ADR documents
```

> **Voxel games (Minecraft)** run in their own Node service (`apps/minecraft-server`) deployed as a parallel Railway service. They reuse `game_sessions` rows, the recess gate, gender partitions, and the bearer-token auth from `apps/game-server`, but bypass `packages/game-logic` and `BOARD_REGISTRY` because their state model (sparse block deltas + positions at ~15 Hz) does not fit the `applyIntent(state) → snapshot` contract. See the `playground-add-game` skill for the rules.
