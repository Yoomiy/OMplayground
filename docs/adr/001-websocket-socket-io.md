# ADR 001: WebSocket stack — Socket.io

## Status

Accepted.

## Context

The Playground needs an authoritative Node server on Railway with rooms, intent validation, and broadcasts. The product plan called for a decision between **Colyseus** and **Socket.io**.

## Decision

Use **Socket.io** for WebSockets.

## Consequences

- **Positive:** Fine-grained control over rooms and emits; familiar middleware patterns; straightforward testing with `socket.io-client` in Jest (layer 3).
- **Positive:** Aligns with documented backend QA practices in `.cursor/skills/playground-backend-qa/`.
- **Negative:** More manual wiring than Colyseus for large synchronized state machines; if we outgrow this, we can evaluate migrating room sync to Colyseus or extracting a dedicated state module.

## Room model

- Namespace: default `/`.
- **Room name:** `session:<game_session_id>` for game session isolation.
- **Authoritative state:** Held in server memory per session; clients send **intents** only; `packages/game-logic` validates transitions.

## Review

Revisit if horizontal scaling requires Redis adapter and we need stronger room semantics, or if we add many built-in matchmaking features Colyseus provides out of the box.
