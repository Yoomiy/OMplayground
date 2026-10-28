# Development survival rules

These rules describe the new runtime's current authored survival loop.
They are deliberate implementation defaults, not final content/balance or
school-release approval. The authoritative systems are `src/sim/game-room.ts`,
`src/sim/vitals.ts` and `src/sim/inventory.ts`; content supplies item/tool/equipment
values. Clients submit intents, never health, damage, fall distance or food awards.

## Vitals and time

Health and food both start at 20. All durations below use 30 Hz room ticks.
Pausing the room freezes hunger, healing, air, damage, food cooldown, mining,
drop expiry and respawn wait. Opening an individual inventory freezes its body
and input while room time and its vitals keep running. Environmental queries
read authoritative blocks even when the body's native movement flags are frozen.
Disconnected actors' vitals freeze until reconnect. Checkpoints persist vitals,
timer phases, equipment, inventories and room time; saved pauses freeze them
through restart. See [checkpoint state](checkpoint-state.md).

| Rule | Current value |
| --- | --- |
| Passive hunger | One food per 120 simulation seconds |
| Movement effort | 0.01 per walked horizontal block; 0.1 while sprinting |
| Mining effort | 0.2 per completed block |
| Effort threshold | Four effort consumes one food |
| Sprint permission | Requires at least six food |
| Regeneration | At least 18 food restores one health per five seconds; costs one effort |
| Starvation | At zero food, one damage per four seconds; can cause death |
| Air | Ten seconds underwater; recovers ten ticks of air per exposed tick |
| Drowning | After air reaches zero, two damage per second |
| Lava | Four damage per half second in authoritative lava |
| Food | Owned food uses its authored nutrition, capped at 20; apple restores four |
| Eating cooldown | Half a simulation second; full-food/cooldown/conflict rejection consumes nothing |

All three leaf families retain guaranteed leaves and an apple. Grass supplies
plant fiber plus one deterministic weighted forage outcome. Tagged mixed-wood
recipes, refining, four tool tiers, body armor, prepared foods and reusable
water buckets are documented in [content progression](content-progression.md).
All 197 legacy content declarations have explicit decisions. Resource yield,
travel and final balance remain open. Models and the expanded palettes use
local primitives/procedural textures; no external art is imported.

## Equipment and falls

Four planks in the boot pattern at a 3×3 workbench craft trail boots with 120
durability. They replace the earlier catalog-only leather prototype. Equipped
boots multiply movement speed by 1.1 and reduce fall distance damage by 25%.
One landing with a damaging unreduced impact wears each contributing fall item once,
including protection that prevents all health loss; the last
durability removes it. Items in a bag or crafting grid supply no equipment effect.

The room tracks a falling body's maximum authoritative height through fixed
movement steps. A landing deals `floor(max(0, peak - landing - 3) * (1 - fallReduction))`
damage. Water, lava, climbing and authorized flight clear that fall segment.
Individual focus/inventory and room pause retain it. The client never reports a
peak or landing. Equipment movement multipliers compose and clamp to 0.25–2;
total fall reduction clamps to 90%. Armor data is bounded; environmental damage
does not use armor. Melee uses this data through
the [combat rules](combat-rules.md).

Equipment and hunger changes that affect movement rotate the input epoch and
send a fresh private movement baseline. Prediction, replay and authority pass
the same speed/gravity/control/sprint profile to the same Wasm movement helper.
Old-epoch controls/actions cannot apply after the change. Cosmetic interpolation
does not apply damage, wear, healing or food effects.

## Death and respawn

At zero health the room freezes the body, rotates its epoch, cancels mining and
queued actions, closes storage access and drops the bag, personal crafting grids
and equipped items once. Shared chest contents remain shared storage. Dead
actors cannot move, build, mine, craft, eat or pick up drops. Normal drop pickup
and expiry rules apply to the resulting stacks.

After two simulation seconds the player can request respawn. The server resets
vitals and movement state, starts a new epoch at the room's spawn area and finds
a supported collision-safe position. Movement remains frozen until the normal
server/client collision readiness exchange completes. Replayed or old-epoch
respawn commands cannot repeat the transition. The Hebrew React HUD displays
health, food, low air, eating, death/respawn and confirmed incoming/outgoing hit
feedback. The notice uses the existing HUD clock and never changes health or
replays a hit. Current PC input and local SQL/React checks are recorded in the
[progress record](../../../docs/voxel-runtime-rewrite-progress.md).

TNT now follows the [explosive rules](explosive-rules.md), including owned
crafting/ignition, room-time fuses/chains, native shape/material shielding,
atomic terrain/container/drop outcomes and capability-checked blast damage.
Durable vitals/timers, teacher lifecycle controls, school adapters and the
classroom service split are implemented and locally qualified. The approved
hosted Auth/mining/checkpoint/restart socket journey passes. Final balance and
extended natural progression, hosted browser/SFU/classroom composition, physical
school-PC qualification, product acceptance and cutover remain open. Large
synthetic scale and mobile/tablet qualification are not release gates.

## Equipment capability tracking

The authored equipment now covers all five intended special capabilities plus
trail boots, heavy shield and a body-slot vest. The table records current rules
and their evidence; final balance and actual school-device review remain open.
Old constants, slots and assets are not compatibility requirements.

| Legacy capability | Current implementation and remaining evidence |
| --- | --- |
| Swift pickaxe movement bonus while held | Owned selected-tool activation, speed ×1.5, normal mining/weapon wear and prediction epochs implemented; natural route verified in the equipment milestone |
| Heavy shield protection with movement cost | Craftable durable offhand shield with 50% melee reduction and a 0.8 movement multiplier; owned and remote rendered equipment checks pass; balance review remains open |
| Feather falling talisman | Explicit owned fall immunity and prevented-impact wear implemented; real-Wasm final-use/second-fall checks pass |
| Helios medallion | Room-time sunlight healing, glass/solid/night occlusion, owned heal wear and pause checks implemented |
| Helium boots | Shared native jump strength, accepted-takeoff wear, swimming rejection and prediction/replay implemented; natural touch route verified in the equipment milestone |
| Glow talisman | Owned local terrain/item visibility floor and room-time wear implemented; actual night framebuffer comparison verified in the equipment milestone |

The current heavy shield exercises bounded armor data, accepted-hit wear and
movement updates through the new authoritative combat path. The complete legacy block/item/recipe decisions are now recorded in
`content/disposition.json`; release balance remains open.
See [equipment-rules.md](equipment-rules.md) for the new contracts, fictional
natural recipes and current tuning. Current trusted PC input exercises owned
and remote equipment presentation; software Chromium is functional evidence,
not a physical school-PC frame-rate verdict.
