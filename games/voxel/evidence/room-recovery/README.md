# Coherent room recovery milestone

Build `afd3a9b33e5e2c39f88b4e0f31fa53fdaa0b1605aef14a3621f948666174ca77`
passes the complete nonbrowser gate: 72 domain/rendering, 79 native (three upstream
debug helpers ignored), 74 actual-Wasm and 17 integration scenarios against both
source and packaged servers. The full check has terminal exit zero and no signal.
The built creative and inventory browser regressions also exit zero with no
browser errors. This is a milestone within the full rewrite, not completion.

The private schema-1 checkpoint captures the coherent world/clock/actor/ownership/
container/vitals/drop/TNT boundary. Objects are immutable, changed columns reuse
references, and only a fenced metadata commit acknowledges saving. Tests exercise
real worker crashes, fresh epochs/authorization, exact fall and timer recovery,
paused/fractional reconnect grace, corrupt state/objects, old-owner fencing,
commit ambiguity, immediate pause during blocked IO, bounded/coalesced saves,
live autosave, last-player save/rejoin races, drain failure and lease loss. A
blocked supervisor cannot keep its worker running past the confirmed deadline.
See [implementation details](../../docs/checkpoint-state.md).

The storage/metadata backend in these tests is a fault-injectable contract
fixture. It is not Supabase or a real transactional database. Actual private
Storage/Postgres adapters and migrations, RLS/grants, retention cleanup, provider
outages, process/deployment overlap and school lifecycle/save UI remain pending.
The regular loopback launcher remains volatile. The browser regressions exercise
its ordinary movement/edits/inventory/reconnect path; they do not prove durable
backend browser recovery. The archived complete eleven-scenario browser capture
still belongs to [content build e4f100782c69](../content/README.md).

Creative rose approximately 1.20 blocks, retained catalog nodes, shared edits and
reconnected; its sampled frame gap reached 700 ms on Chromium/SwiftShader. The
inventory scenario used the actual Hebrew crafting/equipment/chest UI, retained
ownership through reconnect without resubmitting operations and disposed its
resources. Software-browser passes do not establish hardware FPS, physical
input/audio ergonomics, school capacity or latency. No player, observer, object
or room-count admission cap was introduced.

`verification.json` records artifact/scenario hashes and screenshot run times.
`source.tar.gz` and `source-inputs.json` preserve repository-relative source,
tests, content, toolchain inputs and provenance for this build; all archived files
were compared byte-for-byte at capture. Historical milestones retain their own
identities and have not been relabeled as current.
