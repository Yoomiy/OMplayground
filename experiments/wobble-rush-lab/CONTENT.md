# Wobble course pack 6

Twenty-three courses are available in solo practice or online rooms. The host chooses a
single race or a three-race cup. Its shared playlist starts with the selected course
and draws two different courses; every round has another ready check.

| Course | Difficulty | Main challenges |
| --- | --- | --- |
| Sunrise Scramble | Easy | Original spinning bars, islands and bumpers |
| Sky Hop | Medium | Island hops, quicker ferries and lookout stairs |
| Bumper Boulevard | Easy | Bumper slaloms and forward/sideways/reverse conveyors |
| Clockwork Crossing | Medium | Conveyor lanes, lifting gates and moving blocks |
| Ribbon Ridge | Tricky | Narrow winding bridges, stairs and islands |
| Festival Finale | Tricky | Longer sequence combining the original section families |
| Cloudline Fork | Medium | Low zigzag under a sky bridge; jump-dive gate bypass |
| Canopy Switch | Easy | Crossroads clearing and a backwards-facing hairpin |
| Twin Turbo | Medium | Horizontal speed strips, chicanes and gated outer loop |
| Switchyard Shuffle | Medium | Double X crossing, diagonal roadblocks and three shutter approaches |
| Sugar Skyways | Easy | Candy loop, island corner cut and figure-eight junction |
| Canyon Choices | Tricky | Backtracking hairpins below elevated canyon bridges |
| Triple Junction | Medium | Triangular approaches, central islands and three diverging exits |
| Harbor Hoppers | Medium | Diagonal ferries alongside staggered islands; dock-to-pier elevator |
| Terrace Tangle | Medium | Braided overpasses that swap the upper and lower roads |
| Finale Freeways | Tricky | Outer dance-floor loop, inside switchback and high crossing finale |
| Spiral Summit | Tricky | Four-metre corkscrew versus a ground road ending at a required elevator |
| Vault or Wait | Tricky | Island vaults versus gated loop; late-dive lane escapes |
| Tidal Twist | Medium | Counterflow, diagonal speed strips and a reverse turn |
| Lift Lock (new) | Medium | Two exclusive six/seven-metre elevators with opposite sky bends |
| Shutter Shuttle (new) | Tricky | Sideways arrow conveyor beside a cycling gate, then islands versus a boosted loop |
| Sky Transfer (new) | Tricky | Required elevator, then diagonal express ferry versus narrow jump islands |
| Pendulum Pier (new) | Tricky | Fast sideways ferry below a thin sky causeway, spinner and counterflow escape |

The previous ten parallel-lane races have been replaced with individually authored
routes. Their paths turn sideways, cross at real junctions, reverse direction and
pass above/below each other. Raised roads reach 3.4–4 m rather than repeating a
0.9 m lane offset. Shallow visible stairs connect the levels. Each new/reworked
race has two sections with shared checkpoint plazas; three route plans spread bots
across the roads, including actual third paths where available.

## Choices that reward skill

Each fork now trades time against width, obstacles or jump execution. Geometry
alone does not justify making a long road harder than its short bypass.

- Spiral Summit: the ground road is narrow with two slow-cycle shutters and ends
  at the elevator's lower dock. Its former direct exit is removed: ride four metres
  up, then leave on the upper pier and rejoin the descent. The longer spiral is
  wider, avoids the shutters and lift wait, and has a high-speed strip. The last
  fork trades a wide spinning road for island jumps.
- Canopy Switch and Canyon Choices: the long hairpins are wide and boosted.
  Shorter alternatives are narrower and gated; the canyon ridge also has a bar.
- Switchyard Shuffle: a wide counterflow road competes with a thin speed road;
  at the next fork, choose a short shutter, boosted spinner or calm outer track.
- Sugar Skyways and Vault or Wait: the broad loops now get boosts and fewer
  hazards, while the inside island paths demand accurate repeated jumps.
- Harbor Hoppers: waiting safely at the shore shutter competes with ferry/island
  jumps. The later high pier is a short, narrow, gated spinning route against a
  wider boosted dock hairpin. Its elevator remains an optional level transfer.
- Terrace Tangle: wider climbs avoid low-road shutters/spinners, while a narrow
  lower line trades the ascent for timing an obstacle. Dropping between supported
  roads remains an optional cut.
- Finale Freeways and Tidal Twist: extra distance can earn a forward belt and
  more width; short lines trade that for spinners, counterflow or shutter timing.
- Cloudline Fork and Vault or Wait still mark three one-way gate escapes. Hold
  jump, then dive late toward the other road. Diving early can overshoot.

Course instructions explain the immediate choice at each checkpoint. The aim is
credible alternatives: clean skill can win on a risky short road, while a longer
calm line protects against falls or removes waiting. Routes need not finish at
identical times, and a player can change roads at a junction.

The arrow-marked **conveyors** now supply at least three times their previous
sideways/reverse push. Their minimum base strength is 9.43 m/s, so even a 0.9×
remix remains stronger than the runner's 8.2 m/s. Classification uses the belt's
local frame: a forward boost on a diagonal road stays a forward boost. Players
need to jump, dive or leave the belt rather than simply overpower counterflow.
NPCs use ordinary jump inputs when strong flow threatens their footing.

The separate moving tiles return to the pre-misunderstanding travel rhythm
(authored travel × 0.7 and dwell × 0.65). Ferries and lifts have shallow rectangular
docking footprints with visible edge seams, rather than pushing into fixed decks.
Harbor's raised ferries have separated endpoints, its optional lift has an outer
shaft and extended high pier, and Spiral's lift sits clear of its piers. Sky
Transfer's diagonal ferry now uses the opposite side from its jump islands.
Sliding roadblocks have the same playable top height but clear the deck below,
and Switchyard blocks stay over the broad crossings. All 30 moving tiles clear
static decks, visual skirts and each other's full travel envelopes.

Lift Lock has no static ramp or stepping stones into either upper dock. Its lifts
are the only way through the six/seven-metre climbs. Sky Transfer also begins with
a required lift. Shutter Shuttle now places an **arrow-marked sideways conveyor**
right before its full-width gate: countersteer and hop while waiting for green,
then run through. Beyond it, clean island jumps save the boosted loop's distance.
Sky Transfer trades a wide diagonal ferry ride for narrower jump islands. Pendulum
Pier's sky causeway avoids the ferry but requires a climb and repeated jumps. Its
second fork trades a wide counterflow curve for a narrow boosted road; both now
join one straight approach before the full-width shutter. The old partial gate
on the edge of the merge has been removed.

Bots use explicit boarding, riding and departure waypoints on these courses,
with height-aware elevator exits and normal player physics. The coplanar carry fallback remains covered by a regression test, although
authored tile tracks now have clearance instead of relying on that overlap.

Actual overlap polygons receive one common junction paint surface, so different
route colours do not compete at the same depth. The paint stays inside both
walking footprints and does not bridge gaps or connect separate height levels.
Stable depth priorities and thin render skins protect the remaining deck seams.
Walking colliders stay at their authored heights; paint stays below floor markings.
The camera first tries a lower full-distance viewing angle under a static bridge.
Only when no clear low view fits does it shorten its distance; it eases back out
after clearing cover. Q/E rotates the view without dragging; C centres behind the
runner's facing direction. Mouse drag remains available. The camera does not
automatically swing around strafing/backpedalling input and bend a held movement
key into a circle. Tight cover can still require a manual orbit.

The countdown updates and animates once per number instead of restarting its
opacity animation on every 60 Hz simulation tick.

White floor arrows appear at forks, sharp turns, gap approaches and marked cuts.
They are sized to fit a complete supported slab with an inset from its edges.
Conveyor paint is similarly scaled in the belt's rotated local space; fixed
three-lane spacing no longer spills onto narrow paths. Belt arrows communicate
surface motion, while floor arrows communicate route direction.

Remix preserves all static geometry, checkpoint pads and finish positions. A shared
seed varies obstacle phases and bounded speeds. Personal bests are stored per
course/content version; remix records are separate by seed. Cups score 10, 8, 6,
5, 4, 3, 2, 1 by finishing place, with unfinished racers receiving zero points.
Every online round has a three-minute server deadline. Results remain based on the
native client-reported finish times; reconnect and anti-cheat are later integration
work.

## Authoring and validation

`src/shared/creative-courses.ts` and `mechanism-courses.ts` own explicit world-coordinate roads and hazards.
`route-builders.ts` lays rotated slabs, shallow stairs, landing pads, optional
piers, checkpoint volumes and separate NPC routes. Gaps are explicit; no path is
inferred from increasing Z. Each route records exact checkpoint waypoint indices,
so respawning works even after a backwards leg. Ground probes use the same box
rotation convention as actual sphere collision.

Keep turns supported, overpasses clear, checkpoint pads safe and alternative
routes useful. Paint a direction only where a choice or unusual turn needs it.
Bump `COURSE_PACK_VERSION` whenever playable geometry or obstacle timing changes;
old clients receive a reload message before joining.

Run `bun test`, `bun run typecheck`, `bun run lint` and
`bun run scripts/qa/course-pack.ts`. The pack has 736 actual-physics race runs:
twenty-three courses × classic/remix × four seeds × four racers, checking finishes
and every checkpoint. `scripts/qa/route-tradeoffs.ts` additionally compares all route plans with equal
0.92 driving skill over four remix seeds, recording section splits, width, gaps,
length, falls and finish times. Camera segment tests cover rotated cover and an
actual cloud underpass. Regression tests cover rotated support, upper/lower crossing
clearance, exact rewind, platform/belt paint containment, elevator carry and all
three late-dive cuts at four obstacle phases. These checks establish reachability;
human playtesting still decides difficulty, camera comfort and fun.

`Road.omitLandings` prevents a ride waypoint from accidentally creating a fixed
floor inside the lift shaft. `Road.rides` identifies the mover, exit waypoint and
optional shutter; it changes AI input decisions, never collisions or finish rules.
`scripts/qa/mechanism-controls.mjs` checks actual countdown DOM mutation counts,
Q/E/C camera behavior and full physics finishes on the four new courses.

`scripts/qa/docking-audit.ts` checks each complete linear travel segment against
rotated deck boxes expanded to include visual skirts. The separating-axis interval
check is continuous, independent of speed or phase, rather than a few sampled
frames. Distinct mover tracks also clear each other's conservative envelopes,
including independently remixed phases. `scripts/qa/docks-render.mjs` separately
poses actual render meshes at endpoints/midpoints and gates open/closed for visual
inspection; these images are not gameplay race evidence.
