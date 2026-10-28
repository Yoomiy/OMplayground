# Production runtime package

Build the game release once, then assemble the voxel service from that release:

```sh
npm run build:voxel
npm run package:voxel-server
```

The second command builds/typechecks the shared packages and school service,
verifies the current game source/content/release identities, and replaces only
its generated `apps/voxel-server/dist/runtime` directory after assembly succeeds.
It copies an explicit allowlist: service source, shared compiled packages, school
validators, game gateway/worker/Wasm, release manifests, pinned dependency manifests
and provenance. It does not copy `.env`, local dependencies, caches, historical
evidence, browser bundles, Rust build outputs or tests. Node **24.21.0** runs the
service's erasable TypeScript directly; Rust is needed at game build time only.

`runtime-package.json` inventories the package bytes and game build ID. The included
`verify-runtime.mjs` checks the inventory (excluding installed `node_modules`),
matching identities and the existing packaged gateway integrity checks. It is an
integrity check, not a signed provenance assertion or a replacement for installing
dependencies from the committed lockfiles.

To run the directory directly outside Docker, install its runtime dependencies
from inside `apps/voxel-server/dist/runtime`:

```sh
npm ci --workspace @playground/voxel-server --workspace @playground/game-logic --workspace @playground/observability --include-workspace-root=false --omit=dev --ignore-scripts
npm ci --prefix games/voxel --omit=dev --ignore-scripts
node verify-runtime.mjs
NODE_ENV=production node apps/voxel-server/src/index.ts
```

Supply the target's server environment before the last command. For a provider-free
check after dependency installation, run the repository's `smoke-package.mjs`
tool with the absolute path to this runtime directory instead.

## Container

From the repository root after packaging:

```sh
docker build -f apps/voxel-server/Dockerfile -t playground-voxel .
node apps/voxel-server/tools/smoke-package.mjs --container playground-voxel
```

The Dockerfile installs only production dependencies from both lockfiles, verifies
the package, and uses a separate Node runtime stage with the `node` user and a
direct Node entry point. Its readiness healthcheck follows `PORT`. Its
[Dockerfile-specific ignore file](https://docs.docker.com/build/concepts/context/#filename-and-location)
restricts the context to the assembled runtime, so the repository's large evidence
archives and credential files are not build inputs. Provider credentials are
supplied by the target's runtime environment, never build arguments.

On managed build hosts with a session CA, preserve the configured proxy and pass
the CA as a BuildKit secret:

```sh
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" \
  -f apps/voxel-server/Dockerfile -t playground-voxel .
```

The CA mount is optional on ordinary build hosts and is never copied into the
image. TLS verification stays enabled. Runtime proxy trust, if required by that
host, must likewise use its supported CA mount/configuration.

The image smoke test runs a read-only container, a small temporary `/tmp`, local
HTTP schema fixtures and synthetic credentials. It checks production startup,
the real signaling worker, all eight schema calls, liveness/readiness, missing
prototype route, unauthorized admin/media access, the image healthcheck, and
graceful SIGTERM exit. It does not contact Supabase or a real SFU, create a room,
or qualify hosted gameplay/recovery. CI now builds and runs this image check.

Allow at least the service's 60-second graceful drain deadline in the chosen
platform's termination grace. Route gameplay and media WebSockets as described
in the [staging handoff](../../../docs/voxel-staging-handoff.md). Do not run the
normal production entry against a school project merely to inspect the image:
normal service operation includes checkpoint garbage collection.

## Native package qualification

`npm run test:integration --workspace @playground/voxel-server` includes an isolated
package check. It installs production dependencies offline from the previously
installed lockfile cache, verifies that developer tools are absent, checks that
installation preserved every inventoried file, starts the actual entry outside
the checkout and rejects deliberate service-code and Wasm corruption. Its report
is `apps/voxel-server/test-results/production-package.json`.

The native check passes for game build `c293fe5e2511`. Docker CLI and daemon are
absent in the current workspace, so no local image build or container run is
claimed. Container validation awaits the CI run or the user's Docker host.
Platform routing, actual school Auth/SFU, device performance and operational
cutover remain separate checks.
