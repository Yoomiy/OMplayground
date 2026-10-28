# ADR 002: Dedicated voxel WebSocket runtime

## Status

Accepted for the voxel rewrite, 2026-10-22. Implementation is in progress.
This records the user's requested rewrite; it does not claim deployment or
supersede Socket.io for unrelated Playground services.

## Decision

The replacement voxel game uses `ws` on Node and the browser WebSocket API,
with one shared versioned protocol and server-owned fixed-step simulation.
The same forked Rust/Wasm movement primitive runs in authority and prediction.
Socket callbacks cannot allocate simulation time. Input samples carry controls,
a sequence and an epoch; they carry no authoritative duration or position.

Control/snapshot messages use bounded validated JSON. Bulk world data uses
versioned binary buffers. Room computation runs in supervised workers behind a
separate voxel gateway. Policy, persistence, audit and voice remain injected
platform services. Allowed joins are never gated on player or room headcounts.

## Scope and consequences

[ADR 001](001-websocket-socket-io.md) remains valid for the existing services and
their current deployment. Its Minecraft room description is historical context
for the runtime being replaced. Cutover, classroom extraction and retirement
remain gated by the [rewrite proposal](../voxel-runtime-rewrite-proposal.md).

The voxel runtime owns reconnect epochs, input acknowledgement, prediction,
interest management, snapshot backpressure and binary version checks. These
must be tested directly; a framework's legacy event names are not compatibility
requirements. No upstream public server/account services or arbitrary-code
development command endpoint is adopted.
