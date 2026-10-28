# Documentation index

Canonical product + architecture guide: **[`ARCHITECTURE.md`](../ARCHITECTURE.md)** (single source of truth).

## Operations & decisions

| Doc | Purpose |
|-----|---------|
| [`multiplayer-game-integration.md`](multiplayer-game-integration.md) | Agent guide for open-source multiplayer imports: runtime decisions, integration contract, pipeline, acceptance and hosting |
| [`multiplayer-experiment-workflow.md`](multiplayer-experiment-workflow.md) | Environment-specific multiplayer labs on the Oracle dev VPS only |
| [`Wobble app integration`](../games/wobble-rush/README.md) | Wobble runtime, local development, saved sessions, validation and rollout gates |
| [`HARDENING.md`](HARDENING.md) | Production checklist — rate limits, health, logging, scaling |
| [`LOGGING.md`](LOGGING.md) | Contributor contract for logging, audit events, telemetry, privacy, and new processes |
| [`THEMING_AND_COMPONENTS.md`](THEMING_AND_COMPONENTS.md) | Contributor rules for switchable themes, color contrast, and future UI components |
| [`adr/001-websocket-socket-io.md`](adr/001-websocket-socket-io.md) | Why Socket.io; room naming |
| [`adr/002-voxel-native-websocket.md`](adr/002-voxel-native-websocket.md) | Accepted native WebSocket exception and voxel runtime/service boundaries |
| [`Voxel runtime`](../games/voxel/README.md) | Current engine/content/client/server commands and implementation contracts |
| [`Local development`](local-development.md) | One-command app dev stack and the replacement for `dev:minecraft` |
| [`Voxel staging handoff`](voxel-staging-handoff.md) | Checkpoint build order, service routing, environment and remaining staging checks |
| [`Asset retirement`](../games/voxel/docs/asset-retirement.md) | Removed unused old textures/audio/import tooling; preserved other public assets |
| [`Content retirement`](../games/voxel/docs/content-retirement.md) | Removed legacy content workspace; frozen source/disposition provenance |
| [`Backend retirement`](../games/voxel/docs/backend-retirement.md) | Retired backend workspace; independent classroom telemetry and admin operations |
| [`PC-first school qualification`](../games/voxel/docs/pc-school.md) | Trusted keyboard/mouse natural-survival journey; private-school scope and remaining gates |
| [`friends-deprecation.md`](friends-deprecation.md) | Friends UI temporarily disabled |
| [`DATA_MIGRATION.md`](DATA_MIGRATION.md) | Legacy Base44 → Supabase import runbook (if still needed) |

## Design specs (in progress / forward-looking)

| Doc | Purpose |
|-----|---------|
| [`../tmp/logging_coverage_prototype.md`](../tmp/logging_coverage_prototype.md) | Historical observability design; current contributor rules are in [`LOGGING.md`](LOGGING.md) |
| [`voxel_expansion_specification.md`](voxel_expansion_specification.md) | Historical, superseded legacy implementation design for biomes/tools/recipes/hunger |
| [`voxel_client_optimization_proposal.md`](voxel_client_optimization_proposal.md) | Historical, superseded NOA/Babylon optimization research |
| [`voxel-runtime-rewrite-proposal.md`](voxel-runtime-rewrite-proposal.md) | Full rewrite requirements, updated for private-school PCs and ordinary student/teacher workflows |
| [`Voxel rewrite progress`](voxel-runtime-rewrite-progress.md) | Implemented work, evidence and remaining release/cutover work |
| [`Voxel runtime experiment results`](../research/voxel-runtime/RESULTS.md) | Measured engine, room and prediction costs; browser smoke and known candidate failures |
| [`virtual_classrooms.md`](virtual_classrooms.md) | Virtual Classrooms Specification and Walkthrough — **implemented** |

## Agent skills (not duplicated here)

General game how-tos live in `.cursor/skills/`, such as `playground-add-game`.
The old NOA-specific voxel skills are retired; use `games/voxel/README.md` and its
content/presentation documentation for voxel changes.

For the Oracle dev VPS only: [`.agents/skills/playground-multiplayer-lab/SKILL.md`](../.agents/skills/playground-multiplayer-lab/SKILL.md). This skill does not apply to other checkouts or production deployments.
