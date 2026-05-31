# Raspberry Pi LiveKit Prototype

## Goal

Create a local proof-of-concept voice chat system for the web game.

The objective is NOT production readiness. The objective is:

* Get browser-to-browser voice communication working.
* Keep the architecture close to what production will eventually use.
* Run entirely on a Raspberry Pi on the local network.
* Verify integration with the existing web application.
* Learn the operational requirements of LiveKit and TURN.

Success criteria:

1. Two browser tabs can join the same room.
2. Users can hear each other.
3. Voice works through LiveKit.
4. Authentication is handled by a simple backend endpoint.
5. The system is containerized with Docker Compose.
6. The setup can later be moved to a VPS with minimal changes.

---

# Background

Existing stack:

* Frontend: Vercel
* Backend: Railway
* Database/Auth: Supabase

Production concerns:

* Some users are located in the Russian Federation.
* Reliability across restrictive networks is important.
* Minimize dependency on third-party infrastructure.
* Self-hosting LiveKit is preferred.

For this prototype, everything runs locally on a Raspberry Pi.

---

# Architecture

## Prototype Architecture

```text
Browser
    |
    | WebRTC
    |
LiveKit Server
    |
    +---- Token Endpoint
```

Initial prototype intentionally excludes TURN.

The first milestone is:

* Voice works on LAN.
* Voice works between browsers on the same network.

After success:

```text
Browser
    |
    | WebRTC
    |
LiveKit
    |
    +---- coturn
```

---

# Technology Choices

## Required

* Docker
* Docker Compose
* LiveKit Server
* Node.js token server
* livekit-client SDK

## Not Required Yet

* Kubernetes
* Redis
* PostgreSQL
* TURN
* Nginx
* TLS certificates

---

# Project Structure

```text
rtc-prototype/
│
├── docker-compose.yml
│
├── livekit/
│   └── livekit.yaml
│
├── token-server/
│   ├── package.json
│   ├── server.js
│   └── .env
│
└── test-client/
    ├── index.html
    ├── app.js
    └── style.css
```

---

# Milestone 1 - LiveKit Running

Create a docker-compose stack containing:

* LiveKit server

Expose:

```text
7880/tcp
7881/tcp
50000-50100/udp
```

Requirements:

* Start with a single command:

```bash
docker compose up -d
```

Verify:

```bash
curl http://localhost:7880
```

returns a response.

---

# Milestone 2 - Token Server

Implement a minimal Node.js service.

Purpose:

Generate LiveKit access tokens.

Endpoint:

```http
GET /token?room=test&user=alice
```

Returns:

```json
{
  "token": "<jwt>"
}
```

Requirements:

* No database.
* No authentication.
* Hardcoded API key and secret.
* Minimal dependencies.

---

# Milestone 3 - Browser Client

Create a simple HTML page.

Requirements:

Fields:

* Username
* Room Name

Button:

* Join Room

After joining:

* Request microphone permission.
* Connect to LiveKit.
* Publish microphone audio.
* Subscribe to remote audio.

No styling required.

Functionality only.

---

# Milestone 4 - Local Network Test

Test:

Browser A:

```text
http://raspberrypi-ip:3000
```

Browser B:

```text
http://raspberrypi-ip:3000
```

Expected:

* Both join same room.
* Both hear each other.

Document any issues.

---

# Milestone 5 - Diagnostics

Add logging.

Log:

* Room joins
* Participant joins
* Participant leaves
* Audio publication
* Audio subscription

Provide clear console output.

Example:

```text
[room] alice joined test-room
[room] bob joined test-room
[audio] subscribed to bob
```

---

# Future Milestone - TURN

DO NOT IMPLEMENT YET.

Prepare architecture notes only.

Future addition:

* coturn container
* TCP fallback
* TLS
* public domain

Expected future topology:

```text
Browser
    |
    +---- LiveKit
    |
    +---- TURN
```

---

# Deliverables

The agent should provide:

1. Docker Compose file.
2. LiveKit configuration.
3. Node token server.
4. Browser test client.
5. Setup instructions.
6. Troubleshooting guide.

---

# Definition of Done

The prototype is complete when:

* Docker Compose starts successfully.
* LiveKit is reachable.
* Token endpoint works.
* Two browsers join the same room.
* Microphone audio is exchanged successfully.
* Everything runs on a Raspberry Pi without external services.

```
```

