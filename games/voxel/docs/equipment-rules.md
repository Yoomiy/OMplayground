# Development equipment rules

These rules retain the intended legacy capabilities through the new owned item
model. Recipes and values remain development tuning; the per-entry decisions
are recorded in [content progression](content-progression.md), and release balance
is still pending. All effects
require an owned usable instance. Bag and crafting-grid contents supply no
equipment effect. Creative movement uses its own default profile.

| Item | Activation | Current effect | Durability use |
| --- | --- | --- | --- |
| Trail boots | Feet | Speed ×1.1, 25% fall reduction | One per landing whose unreduced impact would damage |
| Heavy shield | Offhand | Speed ×0.8, 50% melee/blast armor | One per accepted armored hit |
| Iron vest | Body | Speed ×0.95, 20% melee/blast armor | One per accepted armored hit; 240 uses |
| Swift pickaxe | Selected owned hotbar item | Speed ×1.5; pickaxe speed 8/tier 2 | Ordinary mining/accepted weapon wear; 80 uses |
| Feather talisman | Legs | Complete fall immunity | One per prevented damaging landing; 64 uses |
| Helios medallion | Head | One extra health after five continuous eligible room seconds | One per accepted heal; 120 uses |
| Helium boots | Feet | Native ground-jump speed ×1.6 | One per native ground takeoff; 120 uses |
| Glow talisman | Head | Local terrain/item visibility floor | One per 30 equipped room seconds; 120 uses |

Typed slots prevent combining both head items or both boot items. Movement
multipliers compose and clamp to 0.25–2; armor remains capped at 80% and partial
fall reduction at 90%. Fall immunity is a separate explicit capability. A
landing reports both its actual damage and unreduced impact, so protection can
wear even when it prevents all health loss. The final-use item protects that
landing and disappears before another can use it.

The server derives movement from equipped items plus a selected tool explicitly
marked for held activation. Held activation currently permits speed only; it
cannot supply armor, healing or jump power from a bag. Selection, breakage and
equipment changes install a new private profile/epoch when movement changes.
Prediction/replay and authority pass the same speed/gravity/control/jump/sprint
profile to the same Wasm primitive. The native step reports whether actual
ground takeoff occurred. Swimming, flight, airborne presses and stale dry-body
flags cannot forge equipment wear or a jump impulse. Breaking boots preserves
the earned takeoff velocity in the new baseline; no motion time is minted.

Helios requires a living connected survival participant, missing health, sun
height above 0.2, dry eyes, no lava exposure and direct overhead light. Authored
opacity and native shape intersection determine overhead obstruction. Transparent
glass passes; stone, foliage shade and water block. The column height envelope
bounds queries conservatively. Basic rain remains presentation only. A full
health bar, shade, night, removal or death resets the consecutive solar timer;
damage also restarts it. Successful healing is additional to normal food-based
regeneration and costs no food. Room pause freezes timers; an open individual
inventory does not. Disconnected actors earn no solar or visibility time.

Glow changes the owning viewer's terrain-light floor and nearby item/avatar
presentation. It retains terrain AO/depth cues, the real sky/day/night clock and
fog. It changes no native block light, emission, mesh journal or shared terrain.
Its private owned inventory view controls activation and expiration. Timers and
ownership survive room-local reconnect and coherent durable checkpoint restore;
saved pause preserves timer phases. Checkpoint/native tests cover these rules.

All five new items have 3×3 recipes from obtainable natural resources. Swift
uses three stone, two sticks and two charcoal. Feather uses four leaves and an
apple. Helios uses four sand and charcoal. Helium uses four planks and two leaves.
Glow uses four charcoal and a stick. Charcoal retains the existing log/plank
recipe. These fictional recipes are intentional starting balance, with final
resource progression/content decisions still required. Primitive models reuse
procedural texture arrays: Swift has a sand-colored blade, helium boots use the
glass palette, feather uses leafy geometry, Helios a sand medallion and glow an
emissive talisman. No external art is imported.

Domain and real-Wasm checks cover validation/ownership, selected activation,
native jumps and swimming, final-use takeoff/fall wear, solar/glass/solid/night
eligibility, fixed timers, pause/disconnect, visibility expiration and shared
prediction. The natural night browser route starts empty and crafts all five
items through normal resource gathering and the workbench dialog. Its actual
touch jump uses the authoritative profile and consumes one boot use; real
framebuffer samples show Glow brightening the same night viewpoint without
changing world light. The full check and all eleven browser commands pass for
the matched release in [equipment evidence](../evidence/equipment/README.md).
All 197 legacy content declarations now have explicit dispositions. School/HUD
adapters, checkpoints, teacher lifecycle and the classroom split are implemented
and locally exercised; the approved hosted socket save/restart journey passes.
Physical school-PC performance, final balance/product acceptance, actual hosted
browser/SFU/classroom composition and deployment remain open. Historical evidence
above retains its original build and input scope.
