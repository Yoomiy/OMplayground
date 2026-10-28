# Production package evidence

Native isolated runtime qualification for game build `c293fe5e2511`.
The base commit is recorded in `verification.json`; source snapshots describe
the packaging follow-up, not a previously committed or deployed image.

The nine-test integration log includes offline production-only dependency
installation, source/inventory preservation, actual production startup through
local HTTP schema fixtures, signaling worker startup, auth rejection and
graceful SIGTERM cleanup. The test also rejects service/Wasm corruption.
`package-build.txt` records the public packaging command and typecheck.

`runtime-package.json` inventories the 165-file runtime before dependencies
are installed. Source and artifact SHA-256 values permit independent byte
comparison. This is an integrity record, not a signed provenance statement.

Docker CLI and daemon socket are absent locally. The Dockerfile and CI smoke
are prepared but unexecuted here. No container, actual hosted Auth/SFU/game
journey, school PC, provider outage or deployment claim follows from this proof.
No hosted requests/writes or user credentials are used by these tests.
