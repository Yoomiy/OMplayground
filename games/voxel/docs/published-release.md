# Published release for hosting

`release/manifest.json` and its content-addressed payload contain the already
built and verified game release. Browser and server use the same Wasm, content,
protocol and build ID. The initial published snapshot is `c293fe5e2511`.

`npm run restore:release` restores generated `engine/pkg`, `artifacts`,
`dist-client` and `dist-server` from those repository files. It does not fetch
upstream engine code, compile Rust, copy credentials or contact providers.
This makes fresh Vercel/Railway builds work without depending on ignored files
that happened to exist in the developer's checkout.

Before overwriting generated directories, restoration checks the current game,
content, configuration, engine source/toolchain and compiler-input hashes, every
payload checksum and every destination path. Source edits require a new release;
changing metadata cannot silently choose another binary path. The existing full
release verifier then checks canonical content, runtime identity, hashed bindings/
Wasm and all 12 client/server release files. The payload is an integrity-checked
build artifact distributed through Git, not a signed provenance assertion.

When changing the game, maintainers use the pinned build toolchain and full
checks, then explicitly publish the matched outputs:

```sh
npm run check:voxel
npm --prefix games/voxel run freeze:release
```

Commit the updated snapshot with the source change. The release payload includes
only current artifacts, not the accumulated old Wasm versions in a local cache.
App/service-only changes can reuse a matching game release. Local development
can still use a fresh `build:voxel` without freezing it; the staging command and
source-based image intentionally require the published release to match.

`npm run test:release` proves a temporary source checkout with no generated
outputs or npm dependencies restores and fully verifies the release. It also
rejects source changes, payload corruption and traversal paths before replacing
existing generated output. CI runs this alongside the existing core checks.

The root `build:staging:web` command installs game build dependencies with
install scripts disabled, restores this snapshot and builds the app. The voxel
Dockerfile performs the same restoration before assembling its smaller runtime.
See [manual staging setup](../../../docs/voxel-staging-setup.md).
