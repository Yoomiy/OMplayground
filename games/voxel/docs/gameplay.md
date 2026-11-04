# Gameplay and authored content

The school service starts normal Minecraft gameplay. Internal creative fixtures
and staff commands remain available to developers; the player UI presents one game.

## Source of truth

`content/index.ts`, `content/building.ts` and `content/progression.ts` author blocks,
items, recipes, tools, drops and equipment. `tools/compile-content.ts` validates
and compiles semantic definitions into one immutable manifest and engine state
mapping. Numeric template IDs in the imported generator are translated into that
mapping. Air is zero; 65535 is an unloaded/blueprint sentinel, never a saved state.

Use the authored values and `src/shared/gameplay.ts` when changing balance.
Geometry, semantics, recipes and generator changes require a save-compatibility
review. Existing exceptions in `checkpoint-content.ts` are explicit directional
transitions, not permission to accept arbitrary content hashes.

The frozen legacy declarations and provenance remain under
[legacy-content-reference](legacy-content-reference/README.md). They are inputs
to `inventory:legacy` and `check:content:complete`, not runtime registries.

## Inventory, crafting and mining

Owned stacks contain an item type, count and optional bounded durable instance.
The server validates quantities, slots, revisions and container incarnations.
Moves and crafting are atomic; a failed mutation consumes no owned items. Recipe
preparation uses acknowledged moves rather than concurrent stale revisions.
Personal crafting grids survive reconnect. Open station/container viewers do not.
Shared chest operations serialize by revisions and cannot duplicate contents.

Mining requires accepted input, current reach/aim, terrain/inventory revisions,
permissions and the required tool tier. `shared/mining-rules.ts` supplies the same
preferred-tool interpretation to authority and help. Correct tools are much faster
than hands or wrong tools. Earned mining time advances only on world ticks;
short input/aim gaps pause it, sustained interruption cancels it. Zero-duration
plants, leaves, torches and ladders still pass authoritative mutation checks.
Their selection/crack feedback is suppressed where a solid box is inappropriate.

Oak leaves roll a 10% apple or 5% sapling outcome in addition to their leaf block;
birch/spruce roll saplings without apples. Forage is deterministic from world seed,
cell and committed revision. Held food is eaten with right-click; R and the
mouse-free eating button use the same owned consume operation. Escape releases
the mouse; clicking the world restores capture.

## Vitals, equipment and combat

Room time owns health, hunger, air, regeneration, effort, damage and cooldowns.
Inventory/chat focus does not grant immunity from world hazards. Disconnected
bodies earn no vitals time. Fall history survives local focus and room pause.
Water, lava, climbing and authorized flight clear the appropriate fall segment.

Equipment effects require the proper worn slot or an explicit held activation.
Movement-affecting changes rotate the input epoch and give prediction a fresh
profile. Native ground takeoff determines jump-item wear; client flags do not.
Fall protection and armor wear once on the accepted event, including the last
usable instance. Glow affects local visibility without editing shared block light;
solar healing uses authoritative exposure. Values and combinations live in content.

Melee uses consumed look, owned equipment, native reach/occlusion and a separate
combat capability. Clients cannot choose victims or damage. Death drains personal
ownership once, cancels pending work and requires a fresh respawn/readiness path.
Observers remain hidden, cannot block placement and receive no gameplay rights.

TNT ignition validates permissions, aim, revisions and the owned ignition tool.
Room ticks own fuses, moving bodies, chain reactions, blasts and resulting damage
and drops. Passive owner policy is refreshed independently: unknown/expired proofs
hold due work; explicit denial can fizzle it. No policy proof is saved.

## Drops, weather and artwork

Drops use native shape-aware sweeps, bounded terrain depenetration and simulation
expiry. Compatible nearby stacks merge while conserving quantities. Attraction
requires line of sight and inventory capacity. A thrown item excludes its thrower
until it leaves attraction range; that exclusion survives checkpoint restore.

Weather is visual/audio presentation. Terrain-light/fog behavior remains unchanged
by the rewrite cleanup; distant unloaded cave frontiers can resemble bright exits.

Terrain uses the forked procedural texture generator. Avatars and selected item
sprites use the MIT Blockyard artwork described in [UPSTREAM.md](../UPSTREAM.md).
Sprite geometry uses UVs; block models use terrain texture layers. Authored material
tint/cutout is shared by icons, held models and drops. Game audio combines restored
recordings and synthesized biome ambience; voice has a separate LiveKit lifecycle.
