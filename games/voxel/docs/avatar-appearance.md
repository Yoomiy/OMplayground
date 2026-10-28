# Public avatar appearance

Protocol 10 adds `appearance` to a full remote actor and optionally to an actor
delta. It contains only `held: itemType | null` and five named equipment item
identities: head, body, legs, feet and offhand. Counts, durability, bag slots,
crafting grids, container contents and inventory revisions are excluded. Those
views retain their existing owner/authorized-viewer delivery rules. The wire
validator rejects extra actor/appearance fields; the client also checks every
identity and worn slot against its matched content manifest.

In survival, the room derives appearance from the selected owned hotbar stack
and the actual equipped stacks. An item in another bag slot supplies no visible
attachment. Ownership changes, selection and breakage update the next normal
snapshot; count/durability changes alone produce no appearance delta. Late joins
get the current full appearance. Existing interest, hidden-observer, death and
disconnect rules determine which actors exist for a viewer. Removing an actor
or rebuilding the client world clears its attachments. Interpolation keeps the
latest discrete appearance while interpolating body pose.

Creative catalog selection is separate from owned stacks. The client sends an
epoch-scoped monotonic `palette` assignment containing only a compiled block
state. The server accepts a current participant's valid placeable catalog block
in a playing, unpaused creative room, then resolves its semantic placeable item.
Unknown/nonplaceable states, duplicates, stale epochs and survival palette
messages cannot change that view. Selection creates no item and edits no terrain.
Its independent assignment counter neither consumes a gameplay action sequence
nor enters the input queue, renews held controls or advances physics. The client
resends its current selection after a new baseline epoch. Creative worn gear
still comes from actual equipment ownership.

Third-person gear reuses the local held/drop item primitives, face texture layers
and shared world-item material styling. Feet render one boot on each articulated
leg; held tools and the offhand shield follow their arm joints. Head and belt
attachments follow the corresponding body/head pose. The authored iron vest now
uses the body attachment; its owned slot and armor/movement rules are checked
by the content progression route. Item visibility and Glow emission do not give another
viewer the owning player's private visibility perk.

Growable instance batches group visible item models, with a separate geometry
for a worn boot versus a held pair. They grow and shrink with visible instances,
release absent groups and dispose owned mesh/material/geometry resources. Shared
terrain textures remain renderer-owned. Diagnostic samples read submitted
instance matrices; their small sample limit does not limit rendered/admitted
actors. Gear shares body visibility and uses camera-relative coordinates. The
renderer retains no player or observer count ceiling.

First-person GPU startup happens before admission/input: render into a tiny
offscreen target with the normal output color space, wait on a zero-timeout
completion fence, then release the temporary target. This prepares shader,
uniform, texture and buffer work without showing an unowned item. Failure or
context loss cleans up the renderer and native world. `prepareMs` records the
startup duration; it does not establish a device performance verdict.

Domain/Three checks cover private-field rejection, owned selection, discrete
appearance changes, joint coordinates, origin invariance, 129-avatar growth,
buffer release and shared texture ownership. Actual-Wasm rooms check private
inventory isolation, quiet count/wear changes, final-use breakage, late joins,
disconnect/rejoin, hidden observers, creative selection validation and exact
movement-trace equality with or without catalog traffic. Built browser scenarios
use naturally crafted survival gear, an independently admitted viewer, real UI
unequipping, selection, origin movement, reconnect and cleanup; creative clients
cycle catalog shapes across the actual network. Current terminal results and
remaining device/performance/content/integration gates are tracked in the
[implementation record](../../../docs/voxel-runtime-rewrite-progress.md).
The complete matched check and all eleven final browser commands pass for the
release captured in [appearance evidence](../evidence/appearance/README.md).
