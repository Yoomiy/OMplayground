# Authored content and survival progression

The development registry has 112 families, 123 states, 172 items, 130 shaped
recipes and 149 procedural texture layers. `content/index.ts`, `building.ts`
and `progression.ts` compile into the one content manifest used by the server,
client and every Wasm instance. This completes the explicit legacy-content
decision inventory; it does not establish final balance or finish the rewrite.

`content/disposition.json` records all 197 legacy declarations: 111 blocks,
44 items and 42 recipes. Each has typed targets and a reason. There are 174
retain, ten replace, eleven combine and two remove decisions. The checker
verifies exact coverage, original source hashes, target references and Hebrew
item labels. `npm run check:content:complete` fails for unresolved targets or
items without a potential survival source. It is part of `npm run check`.

## Deliberate decisions

Three wood varieties retain their identity. Recipes accept compiled `#logs`,
`#planks`, `#leaves` and `#fuel` memberships, including mixed woods. The client
does not supply tags. The compiler rejects ambiguous literal/tag patterns even
when translated or mirrored. Charcoal and mined coal both supply the fuel tag;
recipes that specifically require charcoal keep that choice.

All sixteen wool, concrete and stained-glass colors have distinct texture
layers. Stained glass is a stationary solid cube with transparent rendering,
zero opacity and matching full selection/collision boxes. It has no water
physics or wave animation. Birch/spruce, ores, gravel and natural flowers are
no longer collapsed into the smaller foundation palette. Decorative snow, ice,
sponge, saplings, mushrooms, cane, pumpkins and melons have explicit definitions.
Sponge does not absorb water; saplings do not automatically grow. No old
absorption/growth implementation was found to preserve. Ice has ordinary solid
collision; no slippery-friction mechanic is claimed.

Rose is combined into poppy. Yellow grass/leaves use shared biome-tinted
families. Planks as a loose material combine into the placeable oak-plank item;
loose flint combines into the durable firestarter. Partial placed-cake states
combine into one portable cake food. The school preset uses plant-based foods
instead of a parallel meat/beef progression. The poisonous-potato trap is
removed. The old barrier block is removed in favor of authority-enforced bounds.
Mobs remain outside release scope.

Construction, dyes, food, tools and equipment use intentionally fictional
workbench recipes. Refining is ore plus fuel in personal crafting; there is no
furnace/timer claim. Stone/fuel makes pressure-worked obsidian, while sand/fuel/
glass makes glowstone. These choices make existing building capabilities
obtainable without adding unrelated machines or mob drops. Mineral storage
blocks exchange nine materials; their reverse recipes return the same nine.

## Owned resource loop

Bare hands harvest logs. Logs craft into four matching planks; planks make
sticks and a workbench. A placed reachable workbench enables 3×3 tool recipes.
Wooden pickaxes mine stone and coal; stone pickaxes enable iron, gold and lapis
ore; iron pickaxes enable diamonds; diamond pickaxes enable obsidian. Tools
retain content-defined speeds, tiers, durability, accepted-use wear and combat
profiles. Iron ore/fuel produces ingots for iron tools, a body-slot vest and a
reusable bucket. The vest gives 20% melee/blast armor, speed ×0.95 and 240 uses.
Special equipment keeps the rules in [equipment-rules.md](equipment-rules.md).

All three leaf families retain the existing guaranteed leaf plus apple drop;
five percent of completions additionally yield an oak sapling. Short grass
always yields one plant fiber and rolls once against this table:

| Extra outcome | Weight per 1,000 |
| --- | ---: |
| None | 695 |
| Wheat | 150 |
| Carrot | 40 |
| Potato | 40 |
| Cocoa | 20 |
| Sugar cane | 20 |
| Egg ingredient | 10 |
| Melon slice | 20 |
| Pumpkin | 5 |

These are game forage ingredients, including an egg without a mob simulation.
The roll is a deterministic function of room seed, cell and full committed
column revision. It uses no client randomness or transient global counter.
Guaranteed drops remain separate. Mining awards only after a committed world
edit; explosions use each committed affected column's revision. Failed/replayed
mutations cannot award another roll. Durable preservation of those inputs is
still part of checkpoint integration.

Bread restores five food; cookies two; melon two; carrots three; golden carrots
eight; potatoes one; baked potatoes five; cake ten. Apples retain four. Food
uses existing owned consumption/cooldown/full-food/revision rules.

## Reusable water buckets

Three iron ingots craft one nonstacking empty bucket. Select it and use the
ordinary build/right-click control while aiming at water. The authority checks
build permission, consumed look/input, native reach/occlusion, the selected owned
container, inventory revision and column revision. It removes one water cell
and replaces the bucket in the same bag slot with one water bucket. Placing
that owned water replaces the filled item with the empty bucket. A full bag
needs no extra slot. Failed changes preserve the source and container; competing
collectors cannot both take the same source. Lava collection is not supported.

Protocol 11 adds a `collect` intent with state zero, without an item/result/count
claim. Epoch and action-ledger rules apply before its mutation, including replay
after cached results are evicted. Container definitions must be reciprocal,
single-item and fluid-only. Creative palette entries are unique by block state,
so the water bucket does not duplicate the water block or rebuild the catalog
on every HUD notification. Stable buttons update their text only when needed.
Native `raycast_liquids` includes liquids while
preserving model and solid occlusion. Normal mining/building selection still
passes through water. Exposed liquid targets use the mean rendered 7/8-block
surface; cosmetic waves do not move authority selection. Covered cells use the
full box. No flowing-water simulation or renewable source mechanic is implied.
Filled models show an opaque iron shell and a water-textured interior.

## Evidence and limits

Domain tests cover mixed-wood/fuel recipes, ambiguous tag patterns, forged stack
tags, container conservation in a full bag, rejected/throwing changes,
deterministic weighted forage and every authored item geometry/texture reference.
Actual-Wasm cases cover liquid/model/solid rays, same-source races, capability
revocation, inventory/column conflicts, collect/place replay and retired results.
The controlled empty-inventory native route earns and picks up its resources,
places its owned workbench, reaches all four tool tiers, refines iron, equips
the vest, crafts a bucket and cooks food. Its fixture arranges terrain blocks;
it does not grant inventory or claim natural cave traversal.

`npm run survey:content` records a bounded sample across seeds 4242, 42 and
20261024, including each clamped spawn's 7×7 neighborhood and a wider column
grid. The current 332-column sample contains all essential progression
resources and all three log/leaf species. Explicit wood aliases bridge the
native generator’s axis states to authored vertical log defaults. A native
regression also requires actual generated birch/spruce logs, guarding against
silent stone fallback. This establishes sampled presence, not every seed, navigable cave
entrances, adequate quantities, travel time or final distribution balance.
The potential-source graph has the same limitation and is not a gameplay proof.

The natural browser route now starts with empty inventory on seed 4242, harvests
six logs, crafts a workbench and wooden/stone pickaxes, mines three natural iron
ore, exits its shaft using earned blocks, refines exactly three ingots with
charcoal and crafts the bucket through the Hebrew inventory. Touch Build collects,
places and recollects water; reconnect preserves the filled container. A second
desktop context carries the same identity and earned inventory, then uses actual
OS pointer-lock movement, keyboard selection and right-click to collect/place.
Both contexts preserve other bag stacks and finish with zero owned rendering,
worker and audio resources. The touch cycle advances ownership by four revisions
and the desktop cycle by two. The replaced touch client's final snapshot retains
its pre-handoff revision; the desktop subsection records the final ownership.

Run `npm run test:bucket:browser` with a private X display and `VOXEL_XDOTOOL`
pointing to `xdotool`. For an environment with those tools installed:

```sh
xvfb-run -a env VOXEL_XDOTOOL=/usr/bin/xdotool npm run test:bucket:browser
```

The archived [bucket browser evidence](../evidence/bucket-browser/README.md)
includes the successful headed run, earlier touch-only passes, retained failures
and exact test sources. It uses software Chromium and a volatile development
gateway; it does not establish physical input ergonomics, actual school Auth,
durable hosted recovery, multi-seed progression or final balance.

The later [held bucket correction](../evidence/held-bucket/README.md) resolves the
front-view ambiguity. Actual rendered empty/filled models were pixel-identical
at rest on desktop, tablet and portrait viewports. The held bucket now tilts its
opening toward the camera and limits its forward swing. Held items use the
available horizontal room on narrow viewports. Six GPU raster cases at 900×650,
390×780 and 768×1024 verify visible water, an uncropped shell, a clear reticle,
empty/filled switching and resource cleanup. Run `npm run test:held:browser`.
The complete natural bucket route also passes on this rebuilt release. These
checks establish software-rendered presentation at the measured sizes; physical
device ergonomics and performance remain open.

Final resource/yield tuning, natural extended progression across seeds,
durable inventory/timer/revision recovery, school integration, hardware/input/
latency/load qualification and cutover remain required. No player, observer or
room-count admission limits are introduced.
