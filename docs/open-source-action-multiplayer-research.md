# Second pass: 30 additional action multiplayer games

Researched 2026-10-11, following the request for better playability, more 3D, and action rather than turn-based games. This adds **30 distinct acquisition candidates, numbered 51–80**, to the [first research batch](open-source-multiplayer-research.md). The earlier card-heavy recommendations should not drive the implementation queue.

**Start with Hurry Curry!, Rocket Arena, Wobble Rush 3D, Skyship and WebSoccer.** These have identifiable game loops, accessible controls or cooperative roles, and existing browser renderers. Blockyard Links, WebTennis and Mini Skate Jam are the next useful tests. The ranking reflects source inspection and documented gameplay; it is not a claim that pupil playtests have proved these games fun.

This is an acquisition shortlist, not 30 approved imports. Existing online multiplayer, local multiplayer, experimental online transport, and proposed port work are stated separately. Native games offer considerably more content than many browser demos, but several have high integration costs. Two physics sports use hot-seat turns; the remainder use simultaneous action, rhythm, or real-time cooperative simulation. No additional card or traditional turn-based board games are included.

## What changed in the selection

Look for control feel, physics, meaningful objectives, varied levels or courses, full scoring and replayable rounds. Prefer cooperation that changes how people play: sharing kitchen stations, crewing one airship, or combining grappling and movement. Distinct games sharing an engine can count separately when their rules and objectives differ: Skyship and Blockyard Links qualify on that basis. Variants, tracks, characters, and minigames within one product do not add counts. SuperTuxParty is one collection, not twelve games.

The prior nonviolent requirement remains. Falls, respawns and sports collisions are treated as obstacle or sports mechanics. Combat modes are excluded. SuperTuxKart qualifies only for its existing weapon-free Time Trial rules. DDNet requires a curated noncombat course selection and a decision on whether its hammer-shaped movement tool is acceptable; it is not a recommendation to import Teeworlds shooting. SuperTuxParty needs a whitelist of racing, food collection, hurdles and other noncombat activities. These content restrictions are explicit import conditions.

## Comparison and integration priority

Estimates are **planning judgments in engineer-weeks**, not measured delivery commitments. They include platform rooms, pause/resume, reconnect, touch controls where appropriate, completion reporting, basic QA and Hebrew instructions. They assume one experienced engineer with AI assistance. A feasibility spike precedes expensive native ports. Ages and short-session suggestions are app-specific judgments, not verified age ratings.

| ID | Game | Gameplay and graphics | Multiplayer actually present | Proposed route | Weeks |
|---|---|---|---|---|---|
| 51 | Hurry Curry! | 3D cooperative cooking; many kitchens | Online, browser build | Keep Rust/WebSocket server and Godot web client | 3–5 |
| 52 | Rocket Arena | 3D team car football | Online, up to 8 | Keep authoritative Rapier/Colyseus service | 3–5 |
| 53 | Wobble Rush 3D | 3D obstacle racing | Online rooms; local NPCs | Reuse TS simulation; add server movement/finish validation | 3–5 |
| 54 | Delixia | 3D cooperative sushi kitchen | Online Colyseus rooms | Retain cooking service; validate movement and assets | 3–5 |
| 55 | Skyship | 3D cooperative airship voyage | Online shared ship/objectives | Blockyard adapter, expose only Skyship | 4–6 first Blockyard title |
| 56 | Blockyard Links | 3D golf, carts, 18 holes | Online, simultaneous individual rounds | Same adapter, retain server ball physics | shared + 2–3 |
| 57 | WebSoccer | 2D full-team arcade football | Online 2; local 2 | Reuse deterministic simulation and renderer | 2–3 |
| 58 | WebTennis | 2D tennis with charge, lobs and aftertouch | Online 2; local 2 | Share sports adapter; keep actual tennis rules | shared + 1–2 |
| 59 | Wibbly / lumixed Tennis | 3D tennis; keyboard, touch or body swings | Experimental WebRTC 2 | Replace unproved peer transport with platform rooms | 3–5 |
| 60 | Mini Skate Jam / threejskate | 3D tricks, rails and timed park rounds | Online Node/WebSocket | Private round manager; validate tricks on server | 3–5 |
| 61 | Fugitive 3D | 3D flashlight hide-and-seek and rescue | Online native, dedicated server | Godot web export; replace ENet transport | 5–8 |
| 62 | StepFever | 2D dance/rhythm accuracy competition | Local 2–4 | Browser client; synchronized song start and input replay | 3–5 |
| 63 | Curvytron | 2D simultaneous curved-trail arena | Online; multiple local seats | Keep server rules, modernize room/UI integration | 2–4 |
| 64 | DDraceNetwork / DDNet | 2D cooperative grappling platformer | Online; official Wasm client | Existing Wasm + WebSocket-enabled native server | 3–5 |
| 65 | SuperTuxKart, Time Trial | 3D kart racing without bonus weapons | Native online/local; web networking unfinished | Finish browser transport or test a native streaming pilot | 8–14 |
| 66 | CannonSmash | 3D table tennis, spin and placement | Original native online 2; web remake is solo | Add multiplayer to GPL web renderer/rules or port original | 4–7 |
| 67 | Dust Racing 2D | Top-down racing, tire wear and pit stops | Local split-screen 2 | Qt/Wasm feasibility; shared authoritative simulation | 6–9 |
| 68 | X-Moto | 2D physics motorbike obstacle racing | Local multiplayer and network features | Wasm client; start with shared-session local rules | 5–8 |
| 69 | Ultimate Stunts | 3D loops, ramps, corkscrews and racing | Native online and split-screen | C++/SDL Wasm client + protocol gateway | 7–11 |
| 70 | Stunt Rally 3 | 3D off-road racing; extensive tracks | Native network and up to 6 split-screen | Native streaming pilot; renderer port is a larger project | 6–10 streaming; 16+ port |
| 71 | GNUjump | 2D simultaneous falling-tower platforming | Local up to 4 | SDL/Wasm + shared server simulation/input bridge | 3–5 |
| 72 | Block Attack: Rise of the Blocks | 2D real-time rising-block chains | Local versus 2 | SDL2/Wasm; authoritative matching and garbage rules | 4–6 |
| 73 | Quadra | 2D falling-block cascades and team competition | Native Internet/LAN | SDL2/Wasm + native protocol gateway | 5–8 |
| 74 | OpenTTD | Isometric real-time cooperative transport builder | Online; upstream Emscripten support | Official Wasm client + private WebSocket/TCP proxy | 4–6 |
| 75 | ClassiCube | 3D cooperative creative block building | Online; existing web client | Private compatible server + authenticated web launcher | 3–5 |
| 76 | NodeCore | 3D cooperative discovery, crafting and mechanisms | Luanti online multiplayer | MIT game in existing Luanti Wasm/proxy stack | 5–8 |
| 77 | Neverputt | 3D obstacle minigolf | Local hot-seat 1–4 | Compile the actual putt target; server owns strokes | 5–8 |
| 78 | FooBillard++ | 3D cue physics and full pool rules | Local hot-seat; native network beta | Wasm renderer; authoritative shot simulation and turns | 6–9 |
| 79 | Tux Football | 2D arcade football with aftertouch | Local human vs human | SDL/Wasm + shared input/physics room | 4–6 |
| 80 | SuperTuxParty | Mixed 3D/2D action party collection | Native multiplayer/local seats | Godot web export + noncombat minigame session launcher | 5–8 |

The Blockyard adapter is paid once. The WebSoccer/WebTennis adapter is also paid once. Estimates for the second game exclude that initial adapter. No common adapter has been implemented in this research pass.

## Browser-first candidates

### 51. Hurry Curry!

**Why try it:** A substantial cooperative cooking game rather than a kitchen networking tutorial. The official site describes 26 recipes and more than 20 restaurant layouts, including conveyor-linked split kitchens. Taking orders, preparing ingredients, coordinating workstations and serving before customers lose patience give a team several simultaneous jobs. Bots help when the room is small. Suggested start: a simple kitchen, 2–4 pupils, grades 3–7.

**Source and rights:** [Original repository](https://codeberg.org/hurrycurry/hurrycurry), snapshot `bae9a9e419b6`; **AGPL-3.0-only** in `COPYING`. [Official gameplay and browser link](https://hurrycurry.org/), [browser build](https://hurrycurry-web.metamuffin.org/client.html). Inspected root/client/data documentation, `protocol.md`, Rust server socket handling and Godot `client/multiplayer.gd`: the protocol really uses JSON WebSockets, not browser-incompatible ENet. Individual dependency/asset notices still need a release audit.

**Adaptation:** Keep the Rust authority and Godot renderer. Map platform sessions to private games; self-host the web bundle and WSS endpoint. Add pause to cooking, customer patience, round clocks and conveyors together, snapshot reconnect state, and submit server-confirmed team results. Publish the modified upstream source as required. This is a strong 3–5-week candidate because the browser/network path already exists.

### 52. Rocket Arena

**Why try it:** Drive, boost, jump and flip to move a football into the other goal. Team spacing and ball control produce sustained action without weapons. Custom rooms support up to four per side; the upstream rules include a five-minute match, scoring cutoff and tied-game overtime. Demolition is listed as unfinished, so the current car-football implementation is the candidate, not a future demolition mode. Suggested start: 1v1 or 2v2 custom rooms, grades 3–7.

**Source and rights:** [Source](https://github.com/EndPx/Rocket-Arena), snapshot `1aead71579bc`; **MIT** in `LICENSE`. [Live game](https://rocket-arena.endpx.cloud/). Inspected room, shared protocol, input and lobby code. Gameplay geometry and audio are procedural; branded presentation images are locally bundled. The server advances Rapier at 60 Hz and owns cars, ball, boosts, scores and phases. **Executed:** production build passed; all **382 upstream tests passed**. This establishes build/rule evidence, not pupil playability or latency acceptance.

**Adaptation:** Retain the service instead of rewriting physics into the React app. Gate custom rooms using platform seats; replace quick-match/public discovery, add recess pause, reconnect and teacher spectating, and provide practical touch driving. Snapshot interpolation and the smaller custom match roster should receive the first two-device trial. Locked dependencies currently report vulnerabilities; dependency remediation belongs in the import scope. Estimate 3–5 weeks.

### 53. Wobble Rush 3D

**Why try it:** A colorful obstacle race with dives, variable-height jumps, checkpoints, rotating sweepers, moving platforms and bumpers. Controls include coyote time and jump buffering; falling means a quick checkpoint respawn. One authored course, Sunrise Scramble, contains several obstacle sections, so this has a complete race but less content breadth than the mature native racers. Seeded NPCs fill otherwise empty races. Suggested start: grades 2–7, keyboard first.

**Source and rights:** [Source](https://github.com/code-yeongyu/wobble-rush-3d), snapshot `b395e4a91ebd`; **MIT**, original procedural presentation and synthesized audio. [Live game](https://wobble-rush.mengmota.com/). Inspected shared simulation, protocol, room reducer and the upstream two-browser QA scenario; viewed its gameplay screenshots. The 15 Hz online service relays client-authoritative movement; server ownership of lobby/results is not proof of validated finishes. The live menu loaded in our browser smoke check; a separate two-browser attempt timed out before joining.

**Adaptation:** Reuse the pure TS movement/course simulation in the authoritative room. Validate checkpoint order, movement and finish timing, rather than trusting client position or completion messages. Keep seeded obstacles on one paused world clock, add room rejoin and touch controls, and bridge results. A mobile performance and short-course enjoyment test should precede additional course authoring. Estimate 3–5 weeks.

### 54. Delixia

**Why try it:** A multi-level Japanese kitchen with distinct stock, processing, plating, serving and cleanup tasks. Preparing onigiri and several sushi recipes, passing partially prepared dishes, then serving the correct customer seat gives cooperation a concrete purpose. The game implements lobby/playing/finished phases and a final score. One kitchen is currently documented; do not present it as a large campaign. Suggested start: 2–4 pupils, grades 3–7.

**Source and rights:** [Source](https://github.com/TriForMine/Delixia), snapshot `053256fc5939`; **Apache-2.0** in `LICENSE`. [Live client](https://delixia.pages.dev/). Inspected `src/server` service layout, shared recipes/maps and documented architecture. Babylon supports WebGPU with WebGL fallback; Colyseus owns orders, interactions and timers while character movement uses client-side Havok. The public naming screen loaded without a page exception.

**Adaptation:** Keep cooking services; authenticate room access, validate interaction reach and movement, freeze all processing/patience clocks at recess, and reconnect held items and stations correctly. The README says assets are “royalty-free” without a complete per-asset grant: **model, texture, sound and Havok redistribution audit is a real prerequisite**, not covered automatically by the code license. Estimate 3–5 weeks after that gate.

### 55. Skyship

**Why try it:** A genuine shared-vehicle objective: crew an airship, steer alongside five sky islands, disembark and light their beacons. One pupil takes the helm while others handle the landing and exploration. The source rewards lighting a beacon while a crewmate steers, so cooperation is implemented rather than inferred from avatars being in the same world. A five-beacon voyage has a server-triggered completion screen. Suggested start: 2–4 pupils, grades 2–7.

**Source and rights:** [Blockyard source](https://github.com/Potrock/blockyard), snapshot `bc641e92819f`; **MIT**. [Game server code](https://github.com/Potrock/blockyard/blob/bc641e92819fde0efb599d7332f55fb387ef1196/src/games/skyship/server.ts), [live collection](https://blockyard.gg/). Inspected helm ownership, moving ship, beacon activation and `finish()`. Three.js renders the client; the engine contains Rust/Wasm. This selection contains no combat objectives; do not expose Blockyard's combat game menu through the integration.

**Adaptation:** Introduce a platform-authenticated Blockyard session adapter; pin the selected game at room creation, map seats and teacher spectators, freeze the shared clock/ship and save voyage progress. Retain authoritative ship and beacon logic. Prove standing on a moving ship stays stable at school-device frame rates. First adapter plus title: 4–6 weeks.

### 56. Blockyard Links

**Why try it:** Full 18-hole par-72 golf with carts, variable clubs, wind, drag/lift, slopes, bunkers and readable greens. A pullback/upward swing determines power and direction; a click-meter alternative lowers the input barrier. Each player plays their own round in the same world, with shared scores, so friends can swing simultaneously rather than waiting for a traditional board-game turn. Suggested start: 3–6 chosen holes, grades 3–7.

**Source and rights:** [Source](https://github.com/Potrock/blockyard/tree/bc641e92819fde0efb599d7332f55fb387ef1196/src/games/golf), **MIT**, same pinned engine as Skyship. Inspected server swing validation, ball stepping, scoreboard, hole progression and `finishRound()`, plus course/club data. The original procedural art/model tooling is in the repository; confirm notices for the actual release bundle.

**Adaptation:** Reuse the Blockyard adapter. Keep the server ball simulation, clamp swing messages, record course selection and finish stroke totals, and pause carts/balls rather than just the HUD. Touch swing controls and green readability need actual phone trials. Add configurable short rounds without changing golf physics. Incremental 2–3 weeks after the shared adapter.

### 57. WebSoccer

**Why try it:** Actual eleven-player arcade football with formation selection, offside options, pass assistance, keeper goal kicks, charged shots and aftertouch. The pupil controls the active player rather than directing turn-by-turn tactics. Its one-button approach, gamepad support and mobile controls make it a practical first sports trial. Suggested start: short matches, grades 2–7.

**Source and rights:** [Source](https://github.com/markclausing/websoccer), snapshot `e3628948208c`; **MIT**, author explicitly describes original code/art rather than copied retro-game assets. [Play](https://markclausing.github.io/websoccer/). Inspected deterministic lockstep network design and viewed actual gameplay art. **Executed `npm test`: all four suites passed**, including full-match simulation, difficulty checks, room-capacity/disconnect checks and a 6,000-tick two-client synchronized match. Worker announcement tests use mocks; no real announcement was sent.

**Adaptation:** Put the existing deterministic rules under server-owned input ticks, retaining local prediction and replay/hash checks. Authenticate two seats, implement an online pause agreed by server epoch, remove upstream public scores/optional announcements from the platform path, and report confirmed full-time results. Estimate 2–3 weeks, creating the shared sports adapter.

### 58. WebTennis

**Why try it:** Full tennis scoring and a readable timing game: prepare a swing, plant your feet, steer placement, bend the shot after contact and lob someone crowding the net. Two-press serves, faults, deuce, advantage and set wins are implemented. It shares low-level code with WebSoccer but is a distinct original tennis game, not another football mode. Suggested start: short sets, grades 2–7.

**Source and rights:** [Source](https://github.com/markclausing/webtennis), snapshot `5db16942744d`; **MIT**, original tribute artwork. [Play](https://markclausing.github.io/webtennis/). Existing local and room-code online human-vs-human modes. **Executed `npm test`: passed**, with deterministic complete matches, faults, scoring and rallies; the shared-file check reported no drift from WebSoccer. The CPU simulation measured 5.8 shots per rally; that is a test statistic, not a human enjoyment measurement.

**Adaptation:** Reuse the sports adapter, with tennis-specific serve, shot and set intents. Server owns timing/scoring; replay both players' inputs on reconnect and pause between physics ticks. Preserve the portrait touch layout that keeps thumbs below the court. Incremental 1–2 weeks after the adapter, or 2–4 standalone.

### 59. Wibbly / lumixed Tennis

**Why try it:** A different 3D tennis interpretation: the avatar runs to meet the ball while the player chooses swing timing, spin, pace and aim. Keyboard and touch adapters use the same swing-event contract as camera gestures, so **a webcam is optional**. Fixed-step ball physics includes drag, Magnus force and spin-dependent bounce; match summaries and replays give useful feedback. Suggested start: touch/keyboard, grades 3–7.

**Source and rights:** [Source](https://github.com/lumixed/tennis), snapshot `9e510e8ef439`; **MIT**, procedural scene without downloaded gameplay models. [Author's Wibbly page](https://vulos.org/projects/wibbly/). Inspected controls, deterministic simulation contract and the unusually candid limitations: host/guest tests use in-memory transport, WebRTC has never been proved between machines, and no TURN server is supplied. **This is implemented but experimental multiplayer, not a proved online product.**

**Adaptation:** Use Railway room signaling or, preferably, run the pure simulation on the server and accept normalized swings. Synchronize song-free match clocks and render interpolation. Keep camera processing optional/local; test keyboard first. Required gate: a complete two-device match with equal scores and working disconnect recovery. Estimate 3–5 weeks.

### 60. Mini Skate Jam / threejskate

**Why try it:** Ollies, flips, grabs, rail grinds and trick chains on skate parks, with two-minute competitive rounds and a winner. Different parks and an editor offer more variety than a car driving around an empty plane. Suggested start: short warmup plus one round, grades 3–7.

**Source and rights:** [Source](https://github.com/lalomorales22/threejskate), snapshot `742d49dbed34`; **MIT**. Bundled Kenney Mini Skate assets have their own **CC0** notice. [Public preview](https://lalomorales22.github.io/threejskate/) is **single-player only** because GitHub Pages cannot run the backend. Inspected Node/WebSocket server and `RoundManager`: multiplayer rounds, winners and scores exist when self-hosted. Client-reported trick scores are only rate-capped; the README's HMAC-related settings do not establish authoritative trick validation.

**Adaptation:** Self-host private rooms and start rounds from platform readiness instead of a global five-minute schedule. Validate air time, rail contact, trick combinations and landing before awarding points; discard client score claims. Pause physics/round time, bridge results, add touch inputs and reuse the original park assets. Estimate 3–5 weeks.

### 61. Fugitive 3D

**Why try it:** Hide behind neighborhood bushes, avoid flashlight patrols, rescue frozen teammates and reach a safe zone. The other team searches on foot or uses a car to coordinate patrols. Tag/freeze and rescue are the mechanics; there is no combat objective. It has actual maps, teams, lobby, bots and a round replay, not just a prop-hunt networking sample. Suggested start: flat-screen clients, small map, grades 3–7.

**Source and rights:** [Source](https://github.com/FugitiveTheGame/Fugitive3D), snapshot `7d7f8501e472`; the [author explicitly states MIT code and CC0 art](https://darkrockstudios.com/projects/fugitive-3d). The inspected root checkout has no top-level license file, so **carry forward the author's grant and resolve the release notice before redistribution**. Inspected dedicated lobby/server, networking, exports and Godot version. Current transport is ENet/UDP; available desktop/Android/VR builds do not prove a browser build.

**Adaptation:** Export the flat Godot client to web, replace ENet peer setup with a supported WebSocket/WebRTC transport and retain server tag/rescue/finish decisions. Disable proximity voice and upstream discovery for the school route; map platform seats to teams, implement all-clock pause and reconnect. Browser graphics and car/foot interpolation are the first spike. Estimate 5–8 weeks.

### 62. StepFever

**Why try it:** A full rhythm game with holds, timing windows, difficulties, audio calibration, dance-pad/gamepad support and 2–4 split-screen players. Everyone performs the same chart simultaneously; accuracy determines the result. This gives an action category that does not depend on navigating a 3D camera. Suggested start: easy charts, grades 2–7, no specialist pad required.

**Source and rights:** [Source](https://github.com/religa/stepfever), snapshot `bfc323222aae`; **MIT**. Inspected `MultiplayerEngine`, player states, layout and multiplayer test files. **Local**, not existing online, multiplayer. The generated song catalog names commercial recordings: the MIT code license does **not** clear those songs/charts for hosting. Use a separately cleared original/CC music-and-chart pack; do not ship the upstream catalog as-is.

**Adaptation:** Keep note judgment local against a calibrated audio clock; schedule a future room start and verify results through timestamped input replay against the common chart. Network round synchronization is needed, not per-frame audio streaming. Pause/restart the shared track consistently, support spectators and cap latency assumptions. Content pack and actual audio-device trials are part of the 3–5-week estimate.

### 63. Curvytron

**Why try it:** Simultaneous steering, curved trails, temporary gaps and arena survival make a compact, instantly readable competitive action game. Elimination is a trail/line collision, without characters fighting. Multiple people can share a keyboard or join online. Suggested start: 3–6 pupils, short rounds, grades 2–7.

**Source and rights:** [Source](https://github.com/Curvytron/curvytron), snapshot `0051e59b173c`; **MIT** in `LICENSE`. Inspected package/build layout and actual server/client sources. This is the original open-source product, not a claim that the advertised Curvytron 2 sequel is open source. Older Angular and network dependencies warrant an import-time compatibility/dependency pass.

**Adaptation:** Retain server collision/scoring and map one platform seat to each curve. Use the platform room UI, configurable round length, authoritative pause and reconnect, and two large touch steering buttons. Keep scoring private to the classroom. Estimate 2–4 weeks.

## Existing browser ports and richer native products

### 64. DDraceNetwork / DDNet

**Why try it:** Substantial cooperative movement puzzles using grappling, momentum, freezing/defrosting and coordinated passages. Easier curated courses can create teamwork that card games do not. The enormous general map pool is unsuitable as an unfiltered school catalog; skill difficulty varies greatly. Suggested start: grades 4–7 and a tested novice course.

**Source and rights:** [Source](https://github.com/ddnet/ddnet), snapshot `e0ed6d998de4`; **zlib** code, separately licensed art/maps (including CC BY-SA), notices in the project. [Official downloads include a working Wasm distribution](https://ddnet.org/downloads/) and [browser client](https://client.ddnet.org/). Inspected Emscripten paths, `WEBSOCKETS` build option and character damage handling. Damage applies movement force/emotes rather than a health combat system, but hammer and weapon-shaped tools still appear.

**Adaptation:** Use the official browser client and a private native server built with WebSockets. Bind launch credentials to platform seats, restrict maps to completed noncombat courses, configure hits/tool use consistently with their mechanics, and support team saves/pause. **Content gate:** review actual tool visuals and maps; do not silently relabel shooting as platforming. The browser transport exists, so estimate 3–5 weeks after course approval.

### 65. SuperTuxKart — existing Time Trial rules only

**Why try it:** Mature kart handling, drift/boost, many tracks and sustained 3D racing. The recommended Time Trial rules remove bonus weapon boxes; source `StandardRace::haveBonusBoxes()` explicitly returns false in this mode. Native multiplayer supports simultaneous racing, so this need not mean pupils taking turns doing solitary laps. Do not expose weapon racing or battle arenas. Suggested start: one short track, grades 2–7.

**Source and rights:** [Original GPL-3.0-or-later code](https://github.com/supertuxkart/stk-code), snapshot `5e7a54420a27`; assets have independent free licenses and attribution requirements. [Existing Emscripten fork](https://github.com/ading2210/stk-code), snapshot `43d3673a765d`; inspected `wasm/README.md`, scripts and race code. **The fork explicitly lists networking as TODO**, warns of poor performance and hanging online options. A publicly playable web menu is not proof of browser multiplayer.

**Adaptation:** First prove one weapon-free two-client race using a browser-compatible transport to the native service. Retain native authority, authentication and mode locking; cut the downloadable asset set to the chosen tracks/karts. If graphics/networking spikes fail, a native streaming pilot is an alternative with recurring GPU and latency costs, not a free shortcut. Budget 8–14 weeks; defer behind browser-first games.

### 66. CannonSmash

**Why try it:** Real 3D table tennis rather than Pong with a different background: placement, topspin/backspin, reach, positioning and serves make rallies a skill game. The original has human-vs-human LAN/Internet play. The modern touch-focused web remake supplies an easier input/rendering starting point. Suggested start: short games, grades 3–7.

**Source and rights:** [Original author's game, GPL and multiplayer instructions](https://cannonsmash.sourceforge.net/). [GPL web remake](https://github.com/jgbrwn/cannonsmash-web), snapshot `7e9055fd1f22`, [playable solo preview](https://cannonsmash.exe.xyz/). Inspected remake rules, controls and `NOTICE`; its project notice specifies GPLv2-or-later and dependencies carry separate notices. **The web remake is single-player**, not an existing online port. Count original and remake once.

**Adaptation:** The promising route is retain the remake's pure ball/shot rules and Three.js renderer, run a two-human match authority on Railway, and send paddle/swing intents. Preserve spin, service rotation, deuce and match completion; validate timing/reach and pause the ball consistently. Compare physics against the original before accepting a port. The alternative is C++/SDL Emscripten plus a native network gateway. Estimate 4–7 weeks.

### 67. Dust Racing 2D

**Why try it:** Complete top-down racing against a full field, with several tracks, three difficulties, unlock progression, tire wear and pit stops. Duel and split-screen modes provide real two-human racing. This is an independently implemented game, not another track pack for the kart racers. Suggested start: one track, grades 2–7.

**Source and rights:** [Source](https://github.com/juzzlin/DustRacing2D), snapshot `06da67229775`; **GPLv3** code, images generally **CC BY-SA 3.0** with stated exceptions. Inspected README/license and Qt/OpenGL dependency layout. Existing multiplayer is **local split-screen**, not Internet rooms.

**Adaptation:** Spike Qt/Wasm and the MiniCore renderer first. Move local two-seat input into server-owned ticks with matching Wasm physics, or initially host the full split-screen simulation through the native streaming adapter. Hide desktop editor/UI, maintain tire wear and lap validation, add pause and a readable per-seat camera. Estimate 6–9 weeks, conditional on the Qt/rendering spike.

### 68. X-Moto

**Why try it:** Motorbike throttle, braking, lean and direction changes over handcrafted obstacle landscapes. Collect the strawberries and reach the sunflower; physical handling creates a different challenge from circuit racers. The source implements race/time multiplayer game modes and multiple scenes. Select approachable levels; many community courses are brutally difficult. Suggested start: grades 3–7.

**Source and rights:** [Source](https://github.com/xmoto/xmoto), snapshot `539984a84e8b`; **GPL-2.0-or-later** code, asset/level notices need per-selected-pack verification. Inspected `XMSession` multiplayer mode state, scene/main-menu integration and renderer multiplayer handling. It is a native SDL/OpenGL physics game; a high-score ghost is not being counted as live multiplayer proof.

**Adaptation:** Start from existing local multiplayer rules, not global community servers. Compile SDL/physics to Wasm, add the main-loop/browser filesystem boundary, then feed authenticated per-seat inputs into shared authoritative ticks. Curate short levels, restart falls without a public failure feed, preserve finish ordering and freeze the physics at recess. Estimate 5–8 weeks; renderer/network proof first.

### 69. Ultimate Stunts

**Why try it:** A complete 3D stunt racer: loops, corkscrews, bridge jumps, multiple cars, track editing and replays. It supports split-screen and LAN/Internet sessions, including computer opponents. It is an original free implementation inspired by Stunts; **do not package proprietary original Stunts assets or imported tracks**. Suggested start: wide, slow beginner tracks, grades 3–7.

**Source and rights:** [Author's repository](https://github.com/cornwarecjp/ultimatestunts), snapshot `0212a71b2e5d`; **GPLv2** license file, verify headers and data-pack notices when pinning a release. [Official product](https://ultimatestunts.nl/index.php?lang=en&page=0). Inspected source library split and English developer/file-format docs describing multiplayer object updates. Use the OpenAL audio build, not optional proprietary FMOD.

**Adaptation:** Compile the SDL/C++ client with Emscripten, prove the legacy OpenGL renderer and browser loop, and retain native race logic through a private protocol gateway. Validate laps/checkpoints/replays, reduce assets to a small track/car set and add school room lifecycle. Existing network support saves rule invention; it does not eliminate browser socket work. Estimate 7–11 weeks.

### 70. Stunt Rally 3

**Why try it:** A much deeper 3D driving product: the current README describes 232 tracks, 40 scenery themes and 33 vehicles, plus a track editor. Off-road surfaces, jumps and wide scenery give genuinely varied driving. Native multiplayer and up to six split-screen seats are documented. Suggested start: ordinary cars and beginner tracks; skip extreme sci-fi challenge content.

**Source and rights:** [Source](https://github.com/stuntrally/stuntrally3), snapshot `fe3ecd73fff6`; **GPL-3.0-or-later** for project code, per-folder data licenses. Inspected `docs/Multiplayer.md`: peer-to-peer **ENet/UDP**, direct connection and readiness/start flow. It uses **Ogre-Next**, not a browser-ready rendering engine. No shipping Wasm multiplayer build was established.

**Adaptation:** Prefer a limited native streaming feasibility pilot: isolate one full game process per room, deliver cropped split-screen views over WebRTC and map each authenticated browser seat to a controller. Keep native physics, enforce the native pause and checkpoint lifecycle, and measure actual latency, GPU cost and classroom concurrency before scaling. Shared streaming infrastructure plus this pilot: 6–10 weeks. A native browser renderer/network port is **16+ weeks and uncertain**, so it is not an early import recommendation.

### 71. GNUjump

**Why try it:** A compact but complete simultaneous platforming contest. Jump upward through a falling tower whose floors accelerate; outlast the other players. Four independent key sets, replays and configurable presentation make it more than a one-screen networking example. Its content is intentionally narrow, so a group trial must establish replay appeal. Suggested start: grades 1–7 with an easy falling speed.

**Source and rights:** [Source](https://github.com/arximboldi/gnujump), snapshot `e3f3ee9ae1bc`; current README/source headers **GPL-3.0-or-later**. Older bundled manpage wording references GPLv2+, so use the pinned current code and correct the redistributed notice. Inspected goal, controls, source and replay structure. Multiplayer is **local up to four**.

**Adaptation:** SDL/Wasm client plus server-owned shared platform generation and player inputs. Reuse the existing local multiplayer rules; do not invent an asynchronous leaderboard and call it multiplayer. Add touch left/right/jump, an agreed pause tick, checkpoint-free short round termination, and teacher spectators. Estimate 3–5 weeks; reject if the group trial feels too thin.

### 72. Block Attack — Rise of the Blocks

**Why try it:** Swap neighboring colored blocks while rows continuously rise; chains and combos produce pressure in versus play. The action requires timing and spatial reading rather than choosing a board-game turn. There are full game modes, keyboard/gamepad controls and a mature implementation. Suggested start: slow speed, short rounds, grades 2–7.

**Source and rights:** [Actual original project](https://github.com/blockattack/blockattack-game), snapshot `f65ed23e760a`; **GPL-2.0-or-later** in source headers. Inspected `BlockGame`, main and controller assignment code establishing two-player play. This is **not** the unrelated JavaScript “Block-Attack” repository that copies Nintendo sprites/music and only lists multiplayer as a future feature. Assets have source files in this project but still need bundle-level notice verification.

**Adaptation:** Compile SDL2 and packaged game resources to Wasm, isolate board state/RNG and run match/garbage decisions on the server. Local prediction can animate swaps immediately while authority checks legality. Add reconnect board snapshots, touch cursor/swap controls and pause row-rise/chain clocks together. Estimate 4–6 weeks.

### 73. Quadra

**Why try it:** A complete real-time falling-block game with cascading line clears and Internet/LAN competition. It supports actual shared multiplayer rather than independent single-player score uploads. The block cascade rules are distinct from Block Attack's adjacent swapping. It is the single falling-tetromino product counted here; multiple Tetrinet/Tetris clones would not earn additional counts.

**Source and rights:** [Source](https://github.com/quadra-game/quadra), snapshot `d6c7226a25a2`; **LGPL-2.1** license file, exact source-header/data obligations to confirm at import. Inspected README, resource inventory and native SDL2/network source structure. Native multiplayer exists; an established browser build was not found.

**Adaptation:** Emscripten/SDL2 renderer with an authenticated WebSocket gateway to the existing native protocol, or a shared authoritative board core. Remove upstream auto-update/public server discovery, pin common seeds and versions, validate inputs and cascade/garbage outcomes, and stop all boards on the same pause tick. Estimate 5–8 weeks, subject to a two-client protocol spike.

### 74. OpenTTD

**Why try it:** A real-time cooperative builder with trains, bridges, stations, road vehicles, cargo networks and a large progression space. Multiple pupils can build one company's network simultaneously. This is deliberately a slower, deeper alternative to twitch games, but it is not turn-based. Suggested start: a tiny map and a prebuilt station/vehicle challenge, grades 4–7; save across breaks.

**Source and rights:** [Source](https://github.com/OpenTTD/OpenTTD), snapshot `d48d693d7ff0`; **GPL-2.0-or-later**. Use independently cleared OpenGFX/OpenSFX/OpenMSX data, never proprietary Transport Tycoon files. Inspected official `os/emscripten` Docker/build instructions and `pre.js`: it explicitly supports private WebSocket proxies in front of native servers. Master coordinator discovery does not supply browser servers automatically.

**Adaptation:** Official Wasm build plus a private native dedicated server and WSS/TCP gateway. Authenticate launch/companies, turn off disasters, restrict to cooperative construction, pause the whole simulation and persist saves at recess. Provide zoom/touch instructions and a teacher-friendly scenario. Estimate 4–6 weeks. Keep below action games in the first trial queue.

### 75. ClassiCube

**Why try it:** Lightweight, mature 3D multiplayer building with terrain, custom blocks and immediately visible shared creations. This is an intentional sandbox exception: it has deep construction tools but no inherent finish condition. A classroom build challenge can make the session purposeful, but that challenge is a platform addition rather than an existing scored mode. Suggested start: private flat world, team roles, grades 2–7.

**Source and rights:** [Source](https://github.com/ClassiCube/ClassiCube), snapshot `d41c3f7eef20`; **BSD-3-Clause** code. Inspected official web-hosting guide, Emscripten instructions and credits. The desktop launcher downloads Minecraft resources; **do not reuse those proprietary assets**. The web credits identify independently designed textures but need an explicit release grant for the selected pack. A fully cleared original/CC0 pack is an import prerequisite.

**Adaptation:** Host the existing browser client and a private compatible server; replace public login/discovery with platform credentials, limit each room to its class, persist worlds and connect teacher spectating. Disable damage/combat server extensions; implement recess input locking, not just a hidden iframe. Review the selected server's independent license. Estimate 3–5 weeks including a cleared texture pack.

### 76. NodeCore

**Why try it:** A peaceful 3D discovery/crafting game with in-world experimentation and mechanisms, rather than survival fighting. Players combine knowledge and labor to discover materials and build working contraptions. The author describes a deliberately difficult, unfamiliar world; it is best for patient older pupils rather than instant all-ages recess play. Suggested start: grades 4–7 with a guided discovery scenario.

**Source and rights:** [Original source](https://gitlab.com/sztest/nodecore), snapshot `9477a34cdec6`; **MIT** game, inspected README and contributor/license notice. The game runs in the separately licensed **LGPL Luanti engine**. [Existing Luanti Wasm port](https://github.com/paradust7/minetest-wasm), snapshot `3d6796615a8f`, explicitly documents network play via a WebSocket socket proxy and OPFS persistence. That port is experimental and does not prove this particular NodeCore bundle works unchanged.

**Adaptation:** Bundle the pinned game into the existing Wasm pack loader and run a private native Luanti server through a locally hosted proxy. Verify Lua/engine compatibility before planning the full import. Use server saves, pause/input-lock semantics, private seats and a short discovery objective; curate mods without importing combat packs. Estimate 5–8 weeks, conditional on NodeCore running through the browser proxy.

### 77. Neverputt

**Why try it:** Mature 3D minigolf with elevated paths, slopes, moving obstacles and varied course design. Aim and shot power are physical skills; holes provide clear completion and repeated improvement. **This is hot-seat golf**, so it is less simultaneous than Blockyard Links and lower priority under the new brief. Suggested start: a short course, grades 2–7.

**Source and rights:** [Source in Neverball](https://github.com/Neverball/neverball), snapshot `0c217048a92b`; **GPL-2.0-or-later**, with GPLv3 easing/font exceptions recorded in `LICENSE.md`. Inspected `putt` target and shared/doc layout. The game supports up to four local players. The official Neverball browser build is the **rolling-ball game, not proof that Neverputt's separate executable is already ported**. Count only Neverputt here; do not inflate the total with its courses.

**Adaptation:** Compile the actual putt target with the shared SDL/OpenGL Emscripten infrastructure. Server owns active seat, ball simulation, stroke count and hole advancement; send aim/power intents and render the authoritative shot in both clients. Pause a moving ball and retain scores/reconnect state. Port the camera and touch aim controls, audit selected course/assets, omit unnecessary mascot exceptions. Estimate 5–8 weeks.

### 78. FooBillard++

**Why try it:** Full 3D cue sports with spin, strength, jump shots, camera control, realistic ball interaction and pool rules. Its local two-human play is meaningful, but native IP networking is explicitly beta. Like minigolf, it uses sports turns, not simultaneous action; include it as one physics-sports alternative, not a first implementation. Suggested start: short pool games, grades 4–7.

**Source and rights:** [Original project](https://foobillardplus.sourceforge.net/), [inspected source mirror](https://github.com/drodin/billiards), snapshot `f438fbffe25a`; **GPLv2** in README/COPYING. Inspected listed full rules/features and SDL_net networking option. Bundle art and music notices need verification; omit optional band music unless its distribution grant is established. Original and enhanced FooBillard are counted once.

**Adaptation:** Emscripten/SDL renderer with server-run shot physics; clients send bounded cue strength, angle and spin, never final ball positions. Authoritative turn/rule outcomes and a snapshot at rest make latency less demanding than racing. Implement touch aiming, replayable shot events, pause and reconnect. A legacy OpenGL build spike comes first. Estimate 6–9 weeks.

### 79. Tux Football

**Why try it:** A complete independently developed retro arcade football game with active-player switching, separate kick/pass controls, charge and aftertouch. It is not a fork or skin of WebSoccer. Nevertheless they fill similar niches; use this as a native alternative if its feel wins a comparison, not an argument to ship two near-identical football experiences. Suggested start: grades 2–7.

**Source and rights:** [Source mirror](https://github.com/OSSGames/GAME-SDL-SPORTS-TuxFootball), snapshot `a0d47d3c6b20`, [original project](https://sourceforge.net/projects/tuxfootball/). `COPYING` is GPLv2 while the mirror adds a GPLv3 `LICENSE`; **resolve the original release's header/data notices before distributing this mirror** rather than assuming the new file relicenses everything. Inspected `src/menu/mainmenu.cpp`: “Player V Player” is an implemented selectable mode, with independent controls. Existing multiplayer is local.

**Adaptation:** Compile the original SDL/C++ game to Wasm and reuse its two-human match rules in an authoritative simulation/input room. Add reconnect, pause, full-time completion, safe resource loading and touch controls. Keep generic teams/assets whose rights are actually cleared. Estimate 4–6 weeks; WebSoccer remains the cheaper initial football choice.

### 80. SuperTuxParty — one curated action collection

**Why try it:** A real party product with action activities such as boat rally, forest running, hurdles, food collection, parkour and kernel-compiling timing challenges. These existing activities offer more variety than isolated tiny demos. **The full product includes a turn-based board:** the proposed Playground import is a session launcher for existing noncombat action minigames, not a recommendation to import that board. All activities together count as one candidate.

**Source and rights:** [Source](https://gitlab.com/SuperTuxParty/SuperTuxParty), snapshot `4812d74606bb`; **GPL-3.0-or-later** code, detailed per-asset art/music/shader/font manifests. Inspected Godot 4.2 requirement, ENet peer creation, minigame registry and debug code that launches already implemented minigames independently. There is no established production browser/free-play flow in this research. Network transport and a proper standalone session launcher are adaptation work.

**Adaptation:** Export a web client, replace ENet with a browser-capable peer, retain multiplayer activity logic, and build a short-round launcher with a whitelist of noncombat activities. Exclude knock-off fighting and spooky content from the recommended selection. Preserve each activity's genuine completion/team score, pause/rejoin cleanly and retain all asset notices. This is 5–8 weeks and a lower-priority collection, not thirty games hiding behind one easy iframe.

## Common integration work

Use the existing Playground identity/roster and authoritative Railway room lifecycle. An iframe loads graphics; it does not solve room authentication, cheating, pause, hidden state, disconnect or completion. Browser-first integrations should usually retain upstream authority behind a session gateway, replacing its public discovery/lobby path. Keep simulation ticks out of Postgres; persist at meaningful session boundaries.

For real-time action, server-confirm inputs, checkpoints, laps, goals and finish ordering. Interpolate snapshots and predict local control where the upstream design supports it. Freeze simulation time and all dependent timers at recess; a CSS overlay is insufficient. Restore paused snapshots with a new room epoch so stale input cannot resume movement. Teacher clients spectate instead of taking a player slot. Test actual school devices and touch layouts before adding polish or extra content.

For native-only games, use a **bounded feasibility gate**: one rendered round, two authenticated clients, valid finish, pause/reconnect, acceptable download/frame time. Keep the browser port optional until it passes. A native WebRTC streaming pilot preserves game quality but adds an isolated process/GPU allocation per room, TURN/video bandwidth and input latency. Estimate measured cost per concurrent classroom before selecting it. It is especially relevant to Stunt Rally; it is not the default for the whole catalog.

## Evidence and exclusions

Downloaded public source snapshots into temporary checkouts and recorded exact revisions. This pass inspected licensing, gameplay structures and actual networking paths, rather than relying on repository titles. Executed WebSoccer's full upstream test command, WebTennis's test command, and Rocket Arena's build plus 382-test suite. Inspected Wobble gameplay screenshots and its real browser menu. Public Delixia and Hurry Curry pages loaded in a browser smoke check. Attempts to complete two-browser Rocket Arena and Wobble sessions timed out during page navigation in the temporary headless environment; neither established successful multiplayer play. Complete human group playtests have **not** been performed. Browser smoke/load checks are not equivalent to full multiplayer matches.

Important rejected or conditional leads that **do not contribute to the 30 count**:

- **Inversion:** sixteen meaningful levels, but source uses the same keys for both mirrored characters. “Two players” in its description does not establish two independently controlled humans. Drop until actual multiplayer is implemented.
- **TB Racer:** unusually appropriate browser racing and apparent room authority, but no explicit project reuse license was found. Do not count public source without a grant.
- **REDLINE:** code/license are reusable and a race implementation exists, but the entry flow currently hides Race and defaults to Combat. Movement snapshots and lap scoring are client-reported. Keep as a conditional racing fork after proving a clean room-isolated noncombat flow; not a current recommendation to ship the public combat game.
- **SkyBloom:** polished procedural carpet flight and seeded gate races, but multiplayer synchronizes free-flight carpets; the README explicitly says races are best treated as async runs. Does not count as an already shared race.
- **Blockyard Sky Obby:** real ten-stage course and server finish handling, but a cannon-swept section creates a content question under the prior nonviolent requirement. It is not a third count for the Blockyard engine.
- **Veil of Colours:** promising two-player color-layer puzzles and original art, but no project reuse license found.
- **Minego:** author calls it a prototype; media is CC BY-NC-SA and its sabotage/killing premise conflicts with this selection.
- **Shapez multiplayer fork:** repo name suggests multiplayer; inspected tree exposed no implemented multiplayer transport. Do not infer networking from the fork name.
- **Speed Rivals:** `npm test` only prints “No tests specified”; attractive completion claims are insufficient quality evidence. Keep outside the shortlist until a real shared race is demonstrated.
- **Pocket Broomball:** license documentation explicitly reserves rights in team logos; no qualifying human multiplayer evidence established in this pass.
- **Mario/Sonic fan racers, commercial Marble Blast assets and ReSkate:** public engine/mod code does not grant rights to the original game data. Excluded from this reusable-content shortlist.

## First implementation experiments

1. **Hurry Curry!** — a two-pupil easy-kitchen browser session, including serving, team score, pause and reconnect. Best documented content breadth among the immediate cooperative games.
2. **Rocket Arena** — a private 1v1, then 2v2 on actual pupil devices. Measure control latency, rendering and whether novice players can sustain ball play.
3. **Wobble Rush 3D** — complete its one course with two humans, then test a server-run simulation and finish validation. Decide whether one course has enough replay appeal.
4. **Skyship** — two pupils complete all five beacons while switching helm/landing roles; deliberately pause with someone standing on the moving ship.
5. **WebSoccer**, followed by **WebTennis** — short synchronized matches, touch and keyboard, exploiting the common deterministic adapter if both feel good.

Choose imports after those trials. The main improvement in this pass is the gameplay mix and concrete multiplayer/port distinctions, not a promise to ship all thirty.
