# Testing and release checks

Use Node 24.21.0 with root and game dependencies installed. Restore the published
release for checks of unchanged source. A changed game needs a matched rebuild
using the pinned [toolchain](../UPSTREAM.md), followed by release verification.

## During a change

Run the tests affected by that behavior, game TypeScript and import boundaries:

```sh
npm --prefix games/voxel run typecheck
npm --prefix games/voxel run check:boundaries
node --test games/voxel/tests/wasm/snapshot-sharing.test.ts
```

The last command is an example of a focused actual-Wasm regression. Keep meaningful
checks of ownership, invalid inputs, failed mutations, clock boundaries and recovery.
Do not change historical fingerprints or skip failures solely to make a run green.

## Before merging

The voxel workflow runs the complete engine/domain/Wasm and source/packaged suites,
service/SQL/web tests, browser journeys and clean image startup/drain. The classroom
workflow checks its independent boundary. The short resilience job runs separately;
the hour-long soak is an optional manual dispatch.

```sh
npm run check:voxel
npm --prefix games/voxel run verify:release
npm --prefix games/voxel run test:release
npm test --workspace @playground/voxel-server
npm run test:integration --workspace @playground/voxel-server
npm run lint --workspace @playground/web
npm test --workspace @playground/web
```

`check:voxel` rebuilds the game and needs the pinned Rust toolchain. For local diagnosis
against an existing matched release, `npm test`, `test:wasm`, `test:integration` and
`test:server-bundle` in `games/voxel` select the corresponding runtime suites.
Run complete heavyweight suites separately so they do not contend for fixture deadlines.

The service PostgreSQL suite requires a local cluster with `psql`, `createdb` and
`dropdb`. Set `VOXEL_TEST_POSTGRES=1` and normal local `PGHOST`/`PGPORT`/`PGUSER`
credentials; `VOXEL_PG_BIN` can select binaries. It creates/drops random databases
and rejects remote database hosts.

## Browser and fault scenarios

The game scripts include `test:inventory:browser`, `test:survival:desktop:browser`,
`test:network:browser`, `test:input-stalls:browser`, `test:feedback:browser` and
`test:resilience:browser`. Install Playwright Chromium and its system libraries
on the test host. `VOXEL_TEST_PACKAGE=1` selects the packaged runtime where supported.
`apps/web` provides `test:voxel:browser` and `test:voxel:resilience` for the actual
React adapter. Direct voice testing is opt-in through `VOXEL_TEST_LIVEKIT=1` with
explicit test SFU credentials and generated audio.

The packaged worker workload uses `benchmark:survival:workers` and its separate
`check:survival:workers` report checker. `test:memory:browser` and
`check:memory:browser` check owned resources across travel/reconnect. Counts and
network shaping are fixture parameters, not school admission limits.

## Providers and regression data

Ordinary test fixtures do not establish hosted Auth/Storage/SFU behavior, physical
speaker output or school-PC performance. Keep results in ignored `test-results`
directories and CI artifacts; summarize validation in the PR description.

`apps/voxel-server/tools/check-supabase.ts` is an installation read check.
`hosted-school-journey.ts` is a separate opt-in mutation tool guarded by
`VOXEL_HOSTED_SCHOOL_CHECK=1`: it creates synthetic identities, one private session
and Storage data, journals marked resources and cleans them up. Review its scope,
matching linked project and cleanup requirements before explicitly running it.
Normal service startup also runs maintenance; it is not a provider-free smoke test.

Keep actual regression data under `tests/fixtures`, including prior-engine save
provenance. The frozen legacy content declarations are compiler audit inputs.
Historical qualification archives and research journals are retained on the
`dev/voxel-runtime-rewrite` information branch rather than in this PR tree.
