# Documentation index

Canonical product + architecture guide: **[`ARCHITECTURE.md`](../ARCHITECTURE.md)** (single source of truth).

## Operations & decisions

| Doc | Purpose |
|-----|---------|
| [`multiplayer-game-integration.md`](multiplayer-game-integration.md) | Agent guide for open-source multiplayer imports: runtime decisions, integration contract, pipeline, acceptance and hosting |
| [`multiplayer-experiment-workflow.md`](multiplayer-experiment-workflow.md) | Environment-specific multiplayer labs on the Oracle dev VPS only |
| [`Wobble app integration`](../experiments/wobble-rush-lab/APP-INTEGRATION.md) | Wobble runtime, local development, saved sessions, validation and rollout gates |
| [`HARDENING.md`](HARDENING.md) | Production checklist — rate limits, health, logging, scaling |
| [`LOGGING.md`](LOGGING.md) | Contributor contract for logging, audit events, telemetry, privacy, and new processes |
| [`THEMING_AND_COMPONENTS.md`](THEMING_AND_COMPONENTS.md) | Contributor rules for switchable themes, color contrast, and future UI components |
| [`adr/001-websocket-socket-io.md`](adr/001-websocket-socket-io.md) | Why Socket.io; room naming |
| [`friends-deprecation.md`](friends-deprecation.md) | Friends UI temporarily disabled |
| [`DATA_MIGRATION.md`](DATA_MIGRATION.md) | Legacy Base44 → Supabase import runbook (if still needed) |

## Design specs (in progress / forward-looking)

| Doc | Purpose |
|-----|---------|
| [`../tmp/logging_coverage_prototype.md`](../tmp/logging_coverage_prototype.md) | Historical observability design; current contributor rules are in [`LOGGING.md`](LOGGING.md) |
| [`voxel_expansion_specification.md`](voxel_expansion_specification.md) | Biomes, tools, recipes, hunger |
| [`voxel_client_optimization_proposal.md`](voxel_client_optimization_proposal.md) | Client perf (worldgen worker done; instancing open) |
| [`virtual_classrooms.md`](virtual_classrooms.md) | Virtual Classrooms Specification and Walkthrough — **implemented** |

## Agent skills (not duplicated here)

Game and voxel how-tos live in `.cursor/skills/` — e.g. `playground-add-game`, `playground-voxel-blocks`.

For the Oracle dev VPS only: [`.agents/skills/playground-multiplayer-lab/SKILL.md`](../.agents/skills/playground-multiplayer-lab/SKILL.md). This skill does not apply to other checkouts or production deployments.
