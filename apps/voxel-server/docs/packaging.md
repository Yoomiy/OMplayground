# Production runtime package

Install root/game dependencies and restore the published matched release before
assembling the service package:

```sh
npm ci
npm ci --prefix games/voxel --include=dev --ignore-scripts
npm --prefix games/voxel run restore:release
npm run package:voxel-server
```

The packaging command builds/typechecks shared packages and the school service,
verifies game source/content/release identity, and replaces only the generated
`apps/voxel-server/dist/runtime` directory after successful assembly. Its allowlist
includes service source, shared compiled packages, validators, gateway/worker/Wasm,
dependency manifests and provenance. It excludes credentials, local dependencies,
caches, historical evidence, browser bundles and tests.

`runtime-package.json` inventories package bytes and game identity.
`verify-runtime.mjs` checks those bytes, validates the game release and imports the
service without starting listeners/providers. Integrity checks do not replace
installing dependencies from the committed lockfiles. Node 24.21.0 runs the service's
erasable TypeScript. Hosting restoration needs no Rust compiler.

## Run the directory

From `apps/voxel-server/dist/runtime`, install runtime dependencies:

```sh
npm ci --workspace @playground/voxel-server --workspace @playground/game-logic --workspace @playground/observability --include-workspace-root=false --omit=dev --ignore-scripts
npm ci --prefix games/voxel --omit=dev --ignore-scripts
node verify-runtime.mjs
NODE_ENV=production node apps/voxel-server/src/index.ts
```

Supply the target's server environment before starting. Normal service startup
uses providers and schedules maintenance. For provider-free package validation,
use `apps/voxel-server/tools/smoke-package.mjs` with the absolute package path.

## Container

From the repository root:

```sh
docker build -f apps/voxel-server/Dockerfile -t playground-voxel .
node apps/voxel-server/tools/smoke-package.mjs --container playground-voxel
```

The builder restores the committed release and assembles the package. A dependency
stage installs production dependencies and verifies imports. The runtime uses the
`node` user, a direct Node entry and a readiness health check honoring `PORT`.
The Dockerfile-specific ignore file limits build inputs; credentials belong in
the runtime environment, never build arguments. The image smoke uses synthetic
local schema providers and checks startup, routes, health/readiness and drain.
It does not establish hosted school or SFU behavior.

Allow at least the 60-second graceful shutdown deadline in hosting. See
[deployment](../../../docs/voxel-deployment.md) for origins, routing, migration
requirements and coordinated rollback, and
[published releases](../../../games/voxel/docs/published-release.md) for rebuilding.
