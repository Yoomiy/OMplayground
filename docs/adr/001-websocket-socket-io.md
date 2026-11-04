# ADR 001: WebSocket stack — Socket.io

## Status

Accepted for board/event-driven games. The voxel decision below is historical
and superseded by [ADR 002](002-voxel-native-websocket.md).

## Context

The Playground needs an authoritative Node server on Railway with rooms, intent validation, and broadcasts. The product plan called for a decision between **Colyseus** and **Socket.io**.

## Decision

Use **Socket.io** for WebSockets.

## Consequences

- **Positive:** Fine-grained control over rooms and emits; familiar middleware patterns; straightforward testing with `socket.io-client` in Jest (layer 3).
- **Positive:** Aligns with documented backend QA practices in `.cursor/skills/playground-backend-qa/`.
- **Negative:** More manual wiring than Colyseus for large synchronized state machines; if we outgrow this, we can evaluate migrating room sync to Colyseus or extracting a dedicated state module.

## Room model

### game-server (turn-based / event-driven)

- Namespace: default `/`.
- **Room name:** `session:{game_session_id}`.
- **Primary client intent:** `INTENT_GAME` with `{ sessionId, intent }`.
- **Authoritative state:** In server memory; `packages/game-logic` validates transitions.

### Retired voxel service (historical)

- **Room names:** `voxel:{sessionId}` (gameplay), `voxel-snapshot:{sessionId}` / `voxel-snapshot-teacher:{sessionId}` (filtered snapshots).
- **Logic:** `packages/voxel-content` + server tick loop — **not** `GameModule`.
- **Voice:** LiveKit SFU separate from Socket.io position sync (`POST /rtc/token`).

The old Minecraft service and content workspace are retired. The replacement
uses native WebSocket and its own compiled content; see ADR 002 and
`ARCHITECTURE.md` for current boundaries.

## Review

Revisit if horizontal scaling requires Redis adapter and we need stronger room semantics, or if we add many built-in matchmaking features Colyseus provides out of the box.
