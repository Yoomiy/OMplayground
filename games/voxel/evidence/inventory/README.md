# Authoritative inventory evidence, 2026-10-22

Build `03f08068b9be` (full identity in `build.json`), protocol 4/environment 1,
inventory format 1. `source-release-verification.json` independently checks current
runtime bytes, freshly compiled authored content, Wasm/bindings, identity and all
12 packaged client/server files. `verification.json` hashes captured evidence and
the test/scenario sources. Historical presentation evidence retains its own build.

`check.txt` records the matching full build, type/import boundaries, 25 domain
tests, 79 native tests (three upstream debugging helpers ignored), 11 release-Wasm
tests and four gateway scenarios against both source and packaged server.
`domain-sockets-final.txt` records the final domain/socket rerun after adding the
real-world nonempty-chest removal assertion. The engine/bindings remain identical
to the preceding milestone; production content expands to 20 families/31 states,
21 items and five representative recipes.

The inventory tests cover canonical durable instances, equipment constraints,
split/merge/swap conservation, shaped translated/mirrored 2×2 recipes, reachable
3×3 workbenches, atomic batch crafting and full-output rollback. Competing chest
withdrawals use owner/chest revisions; replacement chests have new identities so
an old intent cannot apply even if revisions match. Closed workbench ingredients
remain owned and can be retrieved without another table. Snapshots cannot mutate
the server's stored stacks.

The actual socket scenario crafts once, returns cached outcomes, fills/evicts the
result cache and rejects retired replay. Reconnect rejects old-epoch mutations and
retains owned contents. It checks private inventories and forbidden creative
catalog grants for restricted/observer roles. Two participants open a real placed
chest without a whole-window lock; a nonempty removal fails, and concurrent
withdrawals yield exactly one copy of the stack with a conflict for the other.

The built browser scenario uses the actual Hebrew native dialog, trusted touch
resume/open and ordinary pointer slot actions. It splits a stack, crafts planks,
equips durable boots, places a workbench through normal authorized controls,
crafts a chest in 3×3, places/opens a chest, deposits and withdraws owned items,
and reconnects with the window open. Owned arrays/revision survive unchanged,
the window closes and no mutation is resubmitted. Local input/body freeze while
room time continues. Double disposal leaves zero tracked geometry, texture,
worker and audio resources, and removes the inventory dialog/launcher. Screenshots
show the crafting and shared chest dialogs. No test-only world mutation is used.

Release Wasm compute parity passes in Node, Chromium and module workers with the
expanded production content and high-ID fixture. Touch jump/look/flight,
blur/cancellation, actual WebGL loss/restoration and disposal pass with the
inventory adapter mounted. The final cancellation report includes grounded
position/velocity samples and retains the original stop-distance bound.

The first touch run cleared input but failed that distance assertion. Its failure
is retained in `browser-touch-failed.txt`. The diagnostic repeat passed with the
same assertion (`browser-touch-diagnostic-repeat.txt`). The engine intentionally
preserves airborne momentum on neutral input; the final test waits for grounded
rest before measuring the same displacement bound, so holding movement cannot
satisfy its precondition. The first run lacked body/velocity diagnostics, so this
record does not claim its precise cause has been proved. Final passing output is
in `browser-touch-final.txt`.

These are software-Chromium/SwiftShader functional checks on two ARM cores.
Hardware touch/keyboard ergonomics, physical audio quality, frame/readiness
budgets, memory plateau and genuine OS focus remain qualification work. Earlier
desktop reconnect latency concerns remain open.

The room is still creative. Owned survival hotbar/placement/mining/drop
transactions, tool wear/equipment effects, vitals/food/combat/death/TNT, complete
content/balance decisions, durable saves, actual school/Supabase/LiveKit adapters,
the final React session/HUD, classroom split and cutover remain in the
[implementation record](../../../../docs/voxel-runtime-rewrite-progress.md).
