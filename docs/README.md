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
| [`Voxel deployment`](voxel-deployment.md) | Service configuration, migrations, acceptance and coordinated rollback |
| [`Voxel maintenance`](../games/voxel/docs/architecture.md) | Runtime boundaries, with links to gameplay, movement, persistence and testing |
| [`School service APIs`](../apps/voxel-server/docs/school-api.md) | Admission, sessions, trusted controls, moderation and private chat |
| [`friends-deprecation.md`](friends-deprecation.md) | Friends UI temporarily disabled |
| [`DATA_MIGRATION.md`](DATA_MIGRATION.md) | Legacy Base44 → Supabase import runbook (if still needed) |

## Design specs (in progress / forward-looking)

| Doc | Purpose |
|-----|---------|
| [`../tmp/logging_coverage_prototype.md`](../tmp/logging_coverage_prototype.md) | Historical observability design; current contributor rules are in [`LOGGING.md`](LOGGING.md) |
| [`virtual_classrooms.md`](virtual_classrooms.md) | Virtual Classrooms Specification and Walkthrough — **implemented** |

## Agent skills (not duplicated here)

General game how-tos live in `.cursor/skills/`, such as `playground-add-game`.
The old NOA-specific voxel skills are retired; use `games/voxel/README.md` and its
content/presentation documentation for voxel changes.

For the Oracle dev VPS only: [`.agents/skills/playground-multiplayer-lab/SKILL.md`](../.agents/skills/playground-multiplayer-lab/SKILL.md). This skill does not apply to other checkouts or production deployments.

## Historical voxel research

Experiments, raw qualification captures, superseded proposals and development
journals remain on `dev/voxel-runtime-rewrite`. The PR tree carries maintained
guides and actual regression fixtures. Put validation results in PR descriptions
and CI artifacts rather than rebuilding a committed evidence archive.
