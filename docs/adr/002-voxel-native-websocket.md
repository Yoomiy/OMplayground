# ADR 002: Dedicated voxel WebSocket runtime

## Status

Accepted, 2026-10-22. Implemented in `games/voxel`.
This records the user's requested rewrite; it does not claim deployment or
supersede Socket.io for unrelated Playground services.

## Decision

The replacement voxel game uses `ws` on Node and the browser WebSocket API,
with one shared versioned protocol and server-owned fixed-step simulation.
The same forked Rust/Wasm movement primitive runs in authority and prediction.
Socket callbacks enqueue controls rather than stepping physics directly. Numbered
input samples carry bounded durations replayed by client and server using Blockyard
playback. World gameplay runs at 30 Hz. Inputs never carry authoritative positions.
See [movement synchronization](../../games/voxel/docs/movement-sync.md).

Control/snapshot messages use bounded validated JSON. Bulk world data uses
versioned binary buffers. Room computation runs in supervised workers behind a
separate voxel gateway. Policy, persistence, audit and voice remain injected
platform services. Allowed joins are never gated on player or room headcounts.

## Scope and consequences

[ADR 001](001-websocket-socket-io.md) remains valid for the existing services and
their current deployment. Its Minecraft room description is historical context
for the retired runtime. Classroom runs as an independent service.
Coordinated cutover and rollback follow the [deployment guide](../voxel-deployment.md).

The voxel runtime owns reconnect epochs, input acknowledgement, prediction,
interest management, snapshot backpressure and binary version checks. These
must be tested directly; a framework's legacy event names are not compatibility
requirements. No upstream public server/account services or arbitrary-code
development command endpoint is adopted.
