# Frozen legacy content source

These three `.ts.txt` files preserve the exact pre-rewrite block, item and recipe
source bytes. They are audit inputs, not TypeScript modules, runtime content or
an ID compatibility layer. The old `packages/voxel-content` workspace is retired.

`provenance.json` records each original path, source commit and SHA-256. Both
`content/legacy-inventory.json` and `content/disposition.json` refer to these frozen
paths with the same original hashes. Every one of the 197 inventory entries and
its retain/replace/combine/remove decision is preserved.

`npm --prefix games/voxel run inventory:legacy` verifies those provenance hashes
before parsing the declarations with the TypeScript AST; it never imports or
executes this old code. `check:content:complete` separately verifies source hashes,
decision coverage, current target definitions, labels and potential obtainability.
An isolated corruption check proves that both tools reject a changed reference.

Edit the replacement in `games/voxel/content`, not these historical snapshots.
The current compiled content, engine and release identity do not change when the
offline reference moves. Original source can also be recovered from the recorded
Git commit. Historical source import strings describe the old implementation and
are not active dependencies.
