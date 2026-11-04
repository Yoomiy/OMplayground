# Voxel PR preparation

- Implementation and complete information branch: `dev/voxel-runtime-rewrite`.
- PR preparation branch: `dev/voxel-pr-prep`.
- Split commit: `f19bccfa19797d57ec7243fe17fa85ebf7f2aea7`.
- Initial matched game release: `ea5aa575334d`.

Active application, service, engine, test, dependency, configuration and migration files
are unchanged by the archive trim. The current published release and the saved
checkpoint/provenance fixtures remain included.

The [evidence index](../games/voxel/evidence/README.md) retains historical findings,
structured reports, exact recovery commands and the existing benchmark's source
dependencies. Full snapshots and raw captures remain on the implementation branch.

Make real fixes and code cleanup in the implementation worktree, then bring the
selected commits, including any matching release updates, into the PR branch.
Keep editorial/archive trimming here. Commit descriptions should distinguish those
changes; do not merge archival trimming back into the information branch.

This is a local preparation branch. No staging update, push, PR creation or main
merge is performed by this checkpoint. Current deployment-document cleanup and
staging acceptance remain separate preparation steps.
