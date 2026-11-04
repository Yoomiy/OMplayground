---
name: playground-backend-qa
description: Validate Playground board, native voxel, classroom and observability backends through authority, isolation, durability and lifecycle behavior.
---

# Backend QA — The Playground

Use the current architecture and the user's authorized task to choose meaningful
checks. Board services use Jest/Socket.io; the voxel runtime uses Node tests,
Rust/Wasm and native WebSocket. The old Minecraft/content workspaces are retired.
Do not recreate their protocol or implementation tests.

## Test layers

| Layer | Current location | What it establishes |
|---|---|---|
| Board rules | `packages/game-logic/src/*.test.ts` | Legal transitions, turn ownership, terminal state |
| Board service | `apps/game-server/src/*.test.ts` | HTTP/auth/recess and Socket.io room scoping |
| Voxel domain | `games/voxel/tests/*.test.ts` | Time accounting, atomic inventory/craft, survival and authority |
| Voxel engine | `games/voxel/engine`, `games/voxel/tests/wasm` | Native and actual-Wasm world/movement/shape invariants |
| Voxel gateway | `games/voxel/tests/integration` | Admission, replication, multiple rooms, command replay and recovery |
| School adapters | `apps/voxel-server/tests` | Fresh identity/policy, roles, moderation/chat/media and persistence ports |
| Actual local SQL | `apps/voxel-server/tests/postgres` | Transactions, fencing, grants, concurrent commits and service composition |
| Classroom | `apps/classroom-server/src/*.test.ts` | Independent RTC, moderation, presentation and attendance |
| Observability | `packages/observability/src/__tests__` | Admin access, telemetry, correlation, lifecycle and classroom webhooks |

The frozen `.ts.txt` files in `games/voxel/docs/legacy-content-reference` are
historical inventory inputs. `check:content:complete` verifies the 197 decisions,
source hashes, current targets and potential obtainability; it does not establish
survival balance or actual play on school PCs.

## Behavioral priorities

- Verify server authority and room isolation before interface details. Client
  clocks, positions, actors, roles and inventory blobs are not trusted facts.
- Time-forgery/burst inputs cannot create movement time. Retried/retired commands
  and reconnect epochs cannot duplicate gameplay effects.
- Inventory moves, mining, crafting and concurrent containers conserve items.
  Check actual world/inventory results, not only a success receipt.
- Save success follows a coherent committed checkpoint. Test upload/commit
  failures, restart from the committed pointer, lease loss and process drain.
- Recheck active school identity, recess, membership, gender and staff capability.
  Reconnect and cached UI state cannot restore revoked authority.
- Exit/repeated mounts release owned workers, sockets, GPU objects and audio.
  Distinguish retained Wasm high-water memory from live resources.

## Current operational checks

Board/classroom observability uses `GET /api/admin/stats`; native voxel uses
`POST /api/voxel/admin-stats` with `{}`. Test missing credentials, wrong role,
fresh admin revocation and provider outage. Operations reads must not allocate
rooms or issue game/media capabilities. Classroom telemetry uses its own service;
admin federation isolates unavailable services and does not invent missing native
Socket.io rates/latency.

Classroom verification includes `npm run verify:boundary --workspace
@playground/classroom-server`: the RTC service must load no game modules and
preserve its 20-route contract.

## Choosing checks

Read the touched behavior and its invariants, then run the relevant suites.
Prefer deterministic state/tick checks and explicit event waits over sleeps.
Add tests when they establish a meaningful behavioral guarantee; do not mirror
implementation details or add tests solely for reversible documentation/metadata
changes. Do not modify source while tests/builds consume it. Keep timing/browser
workloads separate from competing jobs and do not restart a live run merely
because its observation handle times out.

PC keyboard/mouse is the primary school target. Existing mobile/tablet support
is optional. No large synthetic-scale release gate, scaling infrastructure or
voxel headcount caps are required. Software-rendered browser checks prove
functionality, not physical-school-PC frame performance. Fixture Auth/Storage
and local SQL do not prove hosted-provider behavior.

Use the exact commands in `games/voxel/README.md` and the service READMEs; the
reference file maps the main replacement scenarios to their suites.
