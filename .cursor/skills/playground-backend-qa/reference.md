# Backend QA references

## Replacement voxel behavior

| Concern | Current coverage |
|---|---|
| Content and recipes | `games/voxel/tests/content.test.ts`, `content-progression.test.ts`, `inventory.test.ts`; `check:content:complete` |
| Input time and authority | `games/voxel/tests/authority.test.ts`, gateway integration suites |
| Mining, food, drops, death | `games/voxel/tests/survival.test.ts`, `vitals.test.ts`, actual-Wasm survival tests |
| Equipment and combat | `games/voxel/tests/equipment.test.ts`, `combat.test.ts`, actual-Wasm progression/combat |
| World generation and movement | Native engine tests and `games/voxel/tests/wasm` |
| Explosives | `games/voxel/tests/explosives.test.ts` and Wasm explosives tests |
| Save/restart/fencing | Gateway durability/checkpoint integration and `apps/voxel-server/tests/postgres` |
| School policy and controls | `apps/voxel-server/tests/school-access.test.ts`, `school-control.test.ts`, `school-staff.test.ts` |
| Native admin reads | `apps/voxel-server/tests/school-operations.test.ts`, PostgreSQL production composition |
| Actual React session | `apps/web/tools/voxel-react-browser.ts` with local SQL fixtures |
| PC survival input | `npm --prefix games/voxel run test:survival:desktop:browser` with private Xvfb/xdotool setup |

Frozen pre-rewrite content is non-executable audit text under
`games/voxel/docs/legacy-content-reference`; no test should import the retired
Minecraft or content workspace.

## Other service boundaries

Board rules remain under `packages/game-logic/src`; board HTTP/Socket.io tests
remain under `apps/game-server/src`. Match their existing test fixtures and
assert server-computed transitions, per-room delivery and clean departure.

Classroom tests live under `apps/classroom-server/src`; its boundary verifier
checks independent dependencies and the RTC route contract. Shared observability
tests live under `packages/observability/src/__tests__`, including fresh admin
checks, telemetry sanitization, process shutdown and classroom webhooks.

Use deterministic policy clocks for Jerusalem recess boundaries. Use actual
local PostgreSQL for locking, grants and atomicity. Keep fixture-network results
separate from hosted Auth/Storage/SFU evidence, and never infer device performance
from software-rendered Chromium.
