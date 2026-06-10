# Documentation index

Canonical product + architecture guide: **[`ARCHITECTURE.md`](../ARCHITECTURE.md)** (single source of truth).

## Operations & decisions

| Doc | Purpose |
|-----|---------|
| [`HARDENING.md`](HARDENING.md) | Production checklist — rate limits, health, logging, scaling |
| [`adr/001-websocket-socket-io.md`](adr/001-websocket-socket-io.md) | Why Socket.io; room naming |
| [`friends-deprecation.md`](friends-deprecation.md) | Friends UI temporarily disabled |
| [`DATA_MIGRATION.md`](DATA_MIGRATION.md) | Legacy Base44 → Supabase import runbook (if still needed) |

## Design specs (in progress / forward-looking)

| Doc | Purpose |
|-----|---------|
| [`../tmp/logging_coverage_prototype.md`](../tmp/logging_coverage_prototype.md) | Observability spec (`packages/observability`) — **implemented**; package unit tests still open |
| [`voxel_expansion_specification.md`](voxel_expansion_specification.md) | Biomes, tools, recipes, hunger |
| [`voxel_client_optimization_proposal.md`](voxel_client_optimization_proposal.md) | Client perf (worldgen worker done; instancing open) |

## Agent skills (not duplicated here)

Game and voxel how-tos live in `.cursor/skills/` — e.g. `playground-add-game`, `playground-voxel-blocks`.
