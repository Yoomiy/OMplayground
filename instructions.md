You are refactoring a product specification document for a multiplayer web gaming platform used by a school.

## 🎯 Context

The current document was generated from a previous implementation built on a no-code/low-code platform (Base44).

That implementation had major architectural limitations:

* Realtime gameplay was implemented via database writes + subscriptions
* Complex RLS policies were used to simulate isolation
* Authentication was duplicated (admin + custom kids system)
* No WebSocket or authoritative game server existed

This led to:

* High complexity
* Poor scalability
* Difficult-to-maintain logic

The system is now being rebuilt from scratch using:

* Node.js backend
* WebSockets (authoritative game server, e.g. Colyseus)
* Clean authentication system (username/password, admin-controlled)
* Separation between:

  * Game server (realtime)
  * API server (CRUD, persistence)
  * Frontend (React/Next.js)

---

## 🎯 Your Task

Refactor the provided document into a **clean, architecture-ready specification**.

DO NOT preserve old implementation assumptions.

---

## ❗ Key Transformation Rules

### 1. Separate Systems Explicitly

Rewrite the document so that every feature clearly belongs to one of:

* Game Server (realtime, in-memory state, rooms)
* API Server (database, persistence, auth)
* Client (UI, input handling)

---

### 2. Remove DB-as-Realtime Assumptions

Any logic that implies:

* “write to DB → others get update”
  must be rewritten as:

* client → server (input)

* server updates state

* server broadcasts to clients

---

### 3. Redefine Game Architecture

For each game:

Define:

* Room lifecycle
* Player roles
* State structure
* State transitions
* Win conditions

Explicitly state:

* what lives in memory (server)
* what gets persisted (DB)

---

### 4. Authentication System (Rewrite)

Replace existing auth description with:

* Admin-created users only
* Username/password login
* Session via JWT or cookie
* Roles: student / teacher

Remove all hacks (PublicKidProfile, dual systems, etc.)

---

### 5. Social + Messaging Systems

Clarify:

* what is realtime (WebSocket events)
* what is persisted (messages, friendships)

---

### 6. Remove All Base44 Artifacts

Delete or rewrite:

* subscriptions
* RLS logic
* Base44 APIs
* function references

---

### 7. Add Missing Architectural Sections

You MUST add:

#### A. System Architecture Overview

* Diagram in text form
* Data flow (client ↔ game server ↔ API)

#### B. Game Server Responsibilities

* rooms
* matchmaking
* state sync
* reconnection

#### C. API Responsibilities

* auth
* persistence
* moderation
* stats

#### D. Scaling Strategy (basic)

* single server initially
* future horizontal scaling

---

### 8. Add Developer-Oriented Sections

#### A. State Management Rules

* server authoritative
* clients never trusted

#### B. Event Design

Define:

* client → server events
* server → client events

#### C. Error Handling Philosophy

---

## 🧾 Output Requirements

* Keep it as a single Markdown document
* Make it structured and hierarchical
* Prefer clarity over completeness
* Remove redundancy
* Make it usable as a blueprint for implementation

---

## 🧠 Goal

The final document should:

* Be independent of any platform
* Reflect a modern multiplayer architecture
* Be directly usable to build the system from scratch

