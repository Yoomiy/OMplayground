# Legacy content workspace retirement

The old content workspace has no runtime consumers after the frontend/backend
retirement. Its remaining live consumer was the offline inventory extractor.
The three source files it needs are now exact, hash-pinned text snapshots under
[legacy-content-reference](legacy-content-reference/README.md).

All 197 entries and every disposition decision are unchanged. Only the three
source paths move; their hashes remain identical to the original Git bytes.
The extractor checks provenance before parsing and rejects changed snapshots.
The completion audit continues to check frozen source integrity independently.
Neither tool executes legacy definitions or maps old numeric IDs into the game.

The 26 unused package files (5,290 lines), including nine old implementation test
files, are removed with exact preimage backups and recorded Git provenance.
The root lockfile loses only the workspace and its link; retained package
versions, integrity and source addresses do not change. The old research-only
generator probe becomes a text snapshot with separate historical reproduction
instructions, so no executable research command imports a deleted workspace.
Other candidate research probes and their raw results remain intact.

Current architecture and backend QA guidance now point to the new domain/Wasm,
gateway, school-service and classroom suites. ADR 001 explicitly limits its old
voxel section to history and points to the accepted native-WebSocket ADR.

Validation passes: deterministic inventory regeneration, the complete 197-entry
content audit, import boundaries, strict game/web/service types, 109 domain tests,
92 actual-Wasm tests and matched 12-file release verification. A temporary fixture
proves both regeneration and completion audit reject corrupted reference text
without changing live sources. The production app and actual React/local-SQL
school journey also pass with the old package/assets absent.

The game runtime and compiled content are unchanged. This removes obsolete code
and build work; it adds no migration, hosted write, deployment, scale gate or
player/room ceiling. The subsequent [asset retirement](asset-retirement.md) removes
unused media after a separate consumer audit. Actual hosted/school-PC
qualification and routing cutover remain open.
