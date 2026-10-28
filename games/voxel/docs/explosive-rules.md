# Development explosive rules

These are representative game rules, with final balance and hosted recovery
qualification still pending. Coherent checkpoints retain primed bodies and fuses.
The room owns ignition, moving primed
bodies, fuse time, blast planning, damage and all resulting item ownership.

One log and one plank craft two charcoal. Each charcoal plus stone crafts three
powder. Stone and a stick craft a firestarter with 64 durability. Five powder and
four sand in a checkerboard at a 3×3 workbench craft one TNT. These intentionally
simple game recipes make the feature obtainable from natural terrain without
mobs or creative grants. TNT uses two locally authored procedural texture layers;
charcoal, powder and the firestarter use local primitive item models.

Place TNT through the ordinary owned placement path. G, the touch ignition
button, or right-click with a held firestarter requests ignition of the aimed
block. The server requires participant, build and explosive capabilities,
consumed live input, native reach/selection, current terrain and inventory
revisions, and an owned usable firestarter in survival. Creative ignition needs
no tool. Success removes the static block, creates one primed body and wears the
tool once; rejection and replay consume nothing. The bottom world layer remains
immutable. Clients cannot specify fuse, radius, damage or body coordinates.

School gateways install fresh owner resolution on reconstruction and throughout
the room lifetime. The worker requests monotonic permission leases lasting at
most five seconds from request start. Unknown or expired ownership holds a due
body; provider failure never silently destroys it. Explicit denial fizzles,
while fresh permission allows its earned blast. A connected observer's current
restrictions still apply. This also runs during room pause, without advancing
the fuse. Proofs and policy callbacks never enter a checkpoint.

The normal fuse is 120 ticks (four seconds at 30 Hz). Native shape sweeps settle
the 0.9-block body under gravity. Room pause freezes it; individual inventory,
focus loss and owner disconnect do not freeze fuse time. Terrain readiness can
delay physics and a due explosion; unavailable terrain never becomes air. Primed
bodies retain terrain interest independently of their owner. At most two due
explosions execute per room tick; later bodies remain queued. This bounds internal
work and imposes no admission or primed-body count limit.

The blast considers cell centers within three blocks. Material resistance and
native shape intersections along each center ray spend blast energy. Stone
resists more than dirt; liquids and unbreakable cells shield terrain behind them.
Air, liquid and unbreakable cells are never removed. All selected cells validate
before any mutation, with rollback on a native write failure and one revision per
affected column. TNT reached by a blast becomes a separate 30-tick chained fuse,
never an immediate recursive explosion. Other destroyed blocks yield their
authored drops. A destroyed chest drains its owned contents once, closes every
viewer and invalidates that chest incarnation. Ordinary mining still refuses a
nonempty chest.

Blast damage also requires source and target combat capability, survival mode
and an eligible target. Three native body visibility samples use the terrain
*before* destruction, so a removed wall still shields that explosion. Damage
falls with distance over six blocks, starts from an authored maximum of 18,
uses equipment armor, and respects hit recovery and respawn protection. Accepted
damage wears contributing armor and follows the existing death/knockback/epoch
path. An inventory-frozen body receives damage without movement impulse.
Observers and combat opt-outs receive no blast damage. Revoked build or explosive
permission causes an already primed body to fizzle at expiry without terrain,
damage or refund; rejoining does not reset its fuse.

Nearby clients receive authoritative body/fuse views and a monotonic explosion
event. Camera-relative growable instances flash on fuse phases. One accepted
event emits bounded particles and absolute-position Web Audio; its column
revisions suppress duplicate per-block edit effects. Disconnect and disposal
release the primed instances, geometry, materials and audio resources.

Actual-Wasm scenarios cover fuse/replay/pause, chains and revocation, input and
ownership rejection, partial shapes and materials, cross-column high-state
transactions, queued work, owner disconnect, pre-blast shielding, armor/frozen
damage and shared-chest draining. Browser obtainability and matched release
evidence are tracked separately in the rewrite progress document.
