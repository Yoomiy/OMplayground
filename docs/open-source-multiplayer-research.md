# Open-source multiplayer game acquisition research

**Updated direction:** See the [second pass: 30 additional action multiplayer games](open-source-action-multiplayer-research.md) for candidates 51–80, emphasizing 3D, racing, sports and cooperative action. Its implementation priorities supersede the card-heavy recommendations in this initial batch.

Research completed 2026-10-11 with **50 distinct nonviolent multiplayer acquisition candidates**, detailed source links, adaptation plans, estimates and explicit remaining checks. The research target is reached; this is not a claim that 50 imports have passed build, asset or playability acceptance. A search result, a framework, a variant pack, or a public repository without a reuse license does not establish a qualifying game. No candidates have yet been live-playtested or integrated.

## Scope and evidence standard

Prefer complete, playable products over tutorials and starter kits. Count distinct games, not multiple forks of the same game. Existing Playground chess is an upgrade opportunity, not a new-game count. Local multiplayer is distinguished from online multiplayer. Native games remain conditional until a credible browser and networking path is established. Gameplay quality assessments below are research judgments based on documented features, not claims of firsthand playtesting. Engineering estimates are preliminary person-weeks for one experienced engineer assisted by AI, including integration and basic QA, excluding upstream feature development.

Research qualification requires an identified game, explicit open-source code license, implemented multiplayer, meaningful gameplay, a concrete browser integration route and nonviolent recommended rules. Evidence depth is stated per entry: documentation, source inspection and executed tests are different things. Before importing, complete the remaining asset audit, pin the implementation, build it reproducibly and run a full two-client session. Copyleft code and separately licensed assets need their own implementation decisions; an iframe does not automatically resolve licensing obligations.

## Fit with the current app

Inspected `ARCHITECTURE.md`, `docs/adr/001-websocket-socket-io.md`, the root package manifest, and frontend bridge references. Playground uses React/Vite/TypeScript, Supabase identity/catalog, authoritative Railway Socket.io rooms, shared `packages/game-logic`, and `GameSessionContainer`/`BOARD_REGISTRY`. It already supports join, intent, snapshot, pause/resume, rematch, and teacher spectators. Existing iframe bridges include multiplayer Breakout and legacy Wasm teardown. The architecture records Breakout as hidden pending synchronization fixes, a useful reminder that embedding is only one part of an import.

Every adaptation must map platform session IDs and authenticated seats to upstream rooms, enforce existing access and roster boundaries, support recess pause and reconnect, filter hidden information per recipient, and report completion through the platform lifecycle. Persist at session boundaries rather than writing every tick to Postgres. Hebrew instructions and touch-friendly controls matter for the documented grades 1–7 audience.

Three routes are realistic: (1) reuse a browser renderer and rules through the existing GameModule/Socket.io contract; (2) retain an upstream authoritative service behind a platform-authenticated room gateway and self-host its client; (3) compile a native client to Wasm with a networking adapter. Route 3 needs a separate feasibility spike: native TCP/UDP and desktop UI do not become browser-compatible automatically. Remote rendering is technically possible but recurring cost, latency, and per-room GPU/process isolation usually make it a poor default.

## Selection guide and comparison

**Best first feasibility tests:** Set with Friends, SixPieces, Rummikub, Take Six, Chicken Roll, Quoridor, Cornerus/Blokus and Scribble.rs. Together they offer visual reasoning, tile rearrangement, group strategy, spatial planning and creative play. Scopa and Blitz are the most approachable additions from the larger traditional-card batch. Encrypto and Wavelength are especially interesting communication games for older pupils. Blobby Volley is the strongest researched sports option, with materially more integration risk.

The 50 entries are acquisition candidates, not a recommendation to ship all 50. Bridge, Skat, Pinochle and French Tarot are substantial but specialist; Merger/JSettlers require multi-recess saves. Prioritize breadth and pupil playtests before adding several similar card games. Sheep Tile and Yams have the weakest depth evidence in the shortlist and should be dropped from an implementation queue if a group trial feels thin. No duplicate forks, Mahjong presets, party prompt themes or chess variants contribute extra counts.

The grade bands and session lengths below are **planning judgments for this app, not measured playtests or verified publisher age ratings**. Minutes assume the short presets described in each entry; full matches may be much longer. “Shared +” means the collection adapter must be paid once first: GameNest 2–3 weeks, Delcard 2–3, Parlour 3–4, FBG 3–4, Doot 3–4. Do not mistake a one-week incremental title estimate for a one-week standalone import. Earlier entries 01–09 are primarily README/product evidence; later groups have the source audits and test evidence explicitly recorded. Every entry still needs a live multi-client acceptance session before an import decision.

| ID | Game | Suggested grades | Planning minutes | Engineer-weeks |
|---|---|---|---|---|
| 01 | Hanab Live | 3–7 | 20–40 | 3–5 |
| 02 | Hex / PlayHex | 2–7 | 5–15 on small boards | 2–4 |
| 03 | JSettlers2 | 5–7 | 45–90+; save across breaks | 6–10 |
| 04 | SixPieces / Qwirkle | 2–7 | 15–35 | 2–4 |
| 05 | Set with Friends | 2–7 | 5–10 timed room | 2–3 |
| 06 | Open Mercy | 3–7 | 10–25 | 3–4 |
| 07 | DoubleCube / backgammon | 3–7 | 10–20 per game | 3–5 |
| 08 | Woogles crossword | 5–7, English first | 20–45 | 4–6 English |
| 09 | GOPS | 3–7 | 5–15 | 2–3 |
| 10 | Hearts | 4–7 | 8–15 per hand | shared + 1–2 |
| 11 | Rummikub | 2–7 | 15–35 | shared + 2–3 |
| 12 | Numbered-tile deduction | 3–7 | 10–20 | shared + 1–2 |
| 13 | Dou Dizhu | 5–7 | 5–15 per hand | shared + 2–3 |
| 14 | Mahjong | 5–7 | 15–35 per hand | shared + 3–4 |
| 15 | Sudoku Race | 3–7, difficulty dependent | 5–15 | shared + 1–2 |
| 16 | Sheep Tile | 2–7 | 5–10 | shared + 2–3 |
| 17 | Yams | 3–7 | 15–25 | shared + 1–2 |
| 18 | Presidents | 4–7 | 5–10 per hand | shared + 1–2 |
| 19 | Blitz / 31 | 3–7 | 3–8 per hand | shared + 1 |
| 20 | Gin Rummy | 4–7 | 8–15 per hand | shared + 1–2 |
| 21 | Euchre | 4–7 | 5–10 per hand | shared + 1–2 |
| 22 | Cribbage | 5–7 | 15–30 | shared + 2 |
| 23 | Scopa | 3–7 | 10–20 | shared + 1–2 |
| 24 | Spades | 5–7 | 8–15 per hand | shared + 1–2 |
| 25 | Oh Hell | 4–7 | 10–25 shortened schedule | shared + 1 |
| 26 | Spite & Malice | 3–7 | 15–30 short stacks | shared + 1–2 |
| 27 | Pinochle | 6–7, specialist | 15–30 per deal | shared + 2–3 |
| 28 | Take Six | 3–7 | 8–15 | shared + 1–2 |
| 29 | Merger | 5–7 | 45–90; save across breaks | shared + 2–3 |
| 30 | Estate Buyer | 4–7 | 15–25 | shared + 1–2 |
| 31 | Picnic Go | 3–7 | 10–20 | shared + 2–3 |
| 32 | Cornerus / Blokus | 2–7 | 15–30 | shared + 2–3 |
| 33 | Mancala | 1–7 | 5–15 | shared + 1 |
| 34 | Nine Men's Morris | 3–7 | 10–25 | shared + 1–2 |
| 35 | Bridge | 6–7, coached club | 10–20 per deal | shared + 2–3 |
| 36 | Skat | 6–7, specialist | 10–20 per deal | shared + 2–3 |
| 37 | Sixty-Six | 4–7 | 5–15 | shared + 1–2 |
| 38 | French Tarot | 6–7, specialist | 15–30 per deal | shared + 2–3 |
| 39 | GeoGuess | 3–7 | 10–20 | 3–5 |
| 40 | Scribble.rs | 2–7, prompt dependent | 5–15 shortened rotation | 2–4 |
| 41 | Garlic Phone | 3–7 | 10–20 for 4–8 seats | 3–4 |
| 42 | Chicken Roll | 3–7 | 10–25 | 2–3 |
| 43 | Quoridor | 2–7 | 5–15 | 2–3 |
| 44 | Santorini base rules | 3–7 | 10–20 | 3–4 |
| 45 | Secret Codes | 4–7 | 10–20 | shared + 2–3 |
| 46 | Encrypto | 5–7 | 15–30 | 3–5 |
| 47 | Quip Clash | 4–7 | 5–15 | shared + 1–2 |
| 48 | Fib Finder | 4–7 | 8–15 | shared + 1–2 |
| 49 | Wavelength | 3–7 | 8–15 | shared + 1–2 |
| 50 | Blobby Volley 2 | 2–7 | 5–10 short target | 5–8 incl. spike |

## Multiplayer shortlist with primary-source evidence

### 01. Hanab Live — cooperative deduction cards

**Sources:** [repository and README](https://github.com/Hanabi-Live/hanabi-live), [live product](https://hanab.live), [license](https://github.com/Hanabi-Live/hanabi-live/blob/main/LICENSE). Inspected 2026-10-11. GPL-3.0; TypeScript client and game package, Go server, PostgreSQL. README explicitly identifies online cooperative play and separates `packages/client`, `packages/game`, and `server`.

**Why investigate:** team reasoning and constrained clues offer substantial replayability; the existing variant collection can support progression without counting variants as separate games. Nonviolent. Start with the base rules and an introductory tutorial rather than the advanced variants. Player-count limits and asset licenses still need source inspection.

**Adaptation (estimated 3–5 weeks):** first run upstream locally; inspect the shared game package's server dependencies and hidden-hand projection. Reuse its client and rules, either behind the Go service or through a Socket.io adapter; decide after tracing one full move. Replace upstream account/lobby navigation with platform seats and invite flow. Implement per-seat snapshots, pause/resume, reconnect, save/restore, teacher visibility, and Hebrew clue instructions. Validate that a player never receives their own hidden cards, including replay and spectator messages. Preserve GPL notices and audit client assets. **Priority: high; strong reuse prospect, runtime route not yet proven.**

### 02. Hex — PlayHex

**Sources:** [repository](https://github.com/playhex/playhex), [product](https://playhex.org), [license](https://github.com/playhex/playhex/blob/master/LICENSE). Inspected 2026-10-11. TypeScript/Node browser application with Vue UI, human online play and bots. AGPL-3.0, with an explicit `assets/sounds/lisp/` exception under CC BY-NC-SA 4.0.

**Why investigate:** connection strategy has simple onboarding and considerable depth. Two-player abstract, nonviolent play; short boards suit recess better than large correspondence games. Upstream documents localization, API endpoints, tests, and separately published packages, supporting a focused import rather than copying the whole platform.

**Adaptation (estimated 2–4 weeks):** identify reusable board/rules packages; embed the Vue board in an isolated bundle or wrap it from React. Adapt legal placement, win detection, swap rule and clock handling into authoritative rooms. Keep upstream public profiles, notifications, rankings and chat outside the first import. Add smaller boards, Hebrew tutorial, reconnect and pause-safe clocks. Replace the noncommercial sound folder with independently licensed audio. Test both connection directions, swapped seats, clock expiration during disconnect, and late spectator joins. **Priority: high; asset exception is explicit and manageable.**

### 03. Settlement trading — JSettlers2

**Sources:** [repository and README](https://github.com/jdmonin/JSettlers2), [official project](https://nand.net/jsettlers/), [developer documentation](https://github.com/jdmonin/JSettlers2/blob/main/doc/Readme.developer.md). Inspected 2026-10-11. Java client/server, GPLv3 as identified by upstream; human network play and optional robot opponents. README shows classic four- and six-player boards and additional scenarios. This is the Catan-style board game, distinct from the combat-oriented Settlers III remake.

**Why investigate:** resource planning, trade and spatial development provide a much richer loop than elementary board demos. Nonviolent board-game presentation; inspect scenario content before selecting expansions. Longer matches require robust multi-recess persistence and probably fit older pupils better.

**Adaptation (estimated 6–10 weeks):** retain the Java authority and bots; implement a private gateway translating authenticated platform actions to the upstream protocol. Build a browser client around board state and trading, using the existing implementation as behavioral reference. This loses much of the desktop UI reuse, so compare browser-native alternatives before committing. Validate resource privacy, trade cancellation, turn timeouts, disconnect/rejoin and saved games. Use original branding and audited artwork. **Priority: medium; mature rules/server, substantial frontend work.**

### 04. SixPieces — Qwirkle-style spatial tile strategy

**Sources:** [repository and full instructions](https://github.com/fuenfundachtzig/SixPieces). Inspected 2026-10-11. README explicitly specifies GPLv3, TypeScript, Babylon.js/WebGL rendering and boardgame.io network synchronization. Human online play, rejoin by match ID, hidden hands, tile exchange, legality highlighting, scoring and end-of-game behavior are documented. Maximum player count needs code inspection. Development began in 2020; current maintenance and dependency viability are unverified.

**Why investigate:** multi-tile combination planning and shared-board spatial tactics, with low reading requirements and no violence. Existing 3D renderer and alternate distinguishable shapes offer more reusable presentation than a basic rules-only implementation. Camera interaction could be awkward for younger children.

**Adaptation (estimated 2–4 weeks):** run the two-client build; reuse board and move/scoring logic. Replace unauthenticated match IDs with platform room seats and the boardgame.io transport with a Socket.io adapter, or retain an isolated upstream authority. Add explicit touch controls, constrained camera, Hebrew help and score display. Test compound placements, perpendicular scoring, invalid placements, tile exchanges, empty bag endings and hidden hands on rejoin. Audit shapes and dependencies. **Priority: high-medium, subject to dependency and usability checks.** [Qwirky](https://github.com/ashkenas/qwirky) is an AGPL alternative implementation of the same game, not another count.

### 05. Set with Friends — simultaneous visual pattern recognition

**Sources:** [repository](https://github.com/ekzhang/setwithfriends), [product](https://setwithfriends.com). Inspected 2026-10-11. MIT source; React/Material UI JavaScript client in `src/`, TypeScript Firebase functions in `functions/`. README establishes a complete online real-time Set implementation and local emulator build instructions.

**Why investigate:** simultaneous pattern search creates an engaging competitive loop with almost no language dependence. A finished multiplayer product rather than a generic card demo. Complexity comes from combinatorial recognition; include a guided introduction for younger pupils. Number of simultaneous seats needs inspection.

**Adaptation (estimated 2–3 weeks):** preserve board/cards and interactions; move Firebase transactions and sensitive operations to existing server-authoritative rooms. Resolve competing claims atomically, seed/shuffle on server, and prevent stale-board selection. Replace accounts, database subscriptions and lobby navigation with platform session state. Add Hebrew tutorial, keyboard/touch selection and accessible card encoding. Test simultaneous claims, no-set deals, reconnect, pause, and deck exhaustion. **Priority: high; clean license and good frontend fit.**

### 06. Open Mercy — advanced shedding-card game

**Sources:** [repository](https://github.com/alii13/open-mercy), [product](https://open-mercy.com). Inspected 2026-10-11. MIT; Vue 3/TypeScript/Vite frontend, generated SVG cards, 2–10 online players and bots. Includes stacking draws, skips, swaps and hand rotation. Card penalties are abstract and nonviolent despite aggressive marketing language. README contains both legacy Supabase Realtime instructions and a `shared/` engine/protocol plus Cloudflare Durable Objects `game-server/`; deployment architecture needs source tracing.

**Why investigate:** polished cards, responsive presentation and richer rules than basic shedding-card clones. Larger friend groups can participate. Elimination and large draw penalties may frustrate younger pupils; evaluate actual round lengths and waiting time.

**Adaptation (estimated 3–4 weeks):** identify the current authoritative engine; reuse shared rules and Vue renderer in an isolated client bundle. Adapt protocol to Socket.io or retain a private Worker gateway. Replace anonymous auth/public rooms with platform identity; add pause-safe turns, rejoin and Hebrew rules. Verify hidden hands, deck recycling, stacked penalties, direction changes and swaps across disconnects. Audit generated and reference artwork separately. **Priority: high-medium; newer project requires playtesting.**

### 07. DoubleCube.gg — full backgammon matches

**Sources:** [repository and component map](https://github.com/GarrettBeatty/doublecube.gg), [product](https://doublecube.gg), [license](https://github.com/GarrettBeatty/doublecube.gg/blob/main/LICENSE). Inspected 2026-10-11. AGPL-3.0; .NET rules/server, SignalR multiplayer and React/TypeScript/Vite client. Documented rule coverage includes dice use, forced bar entry, bearing off, doubling cube and Crawford rule. Upstream also supports asynchronous play, spectators and analysis. Two players; expected match length depends on selected points target.

**Why investigate:** deep positional and probability decisions, with strong regional familiarity. This is board strategy, not violent play. Use points-only matches with no monetary stakes.

**Adaptation (estimated 3–5 weeks):** keep .NET rules/SignalR service behind platform authentication; reuse React board and replace upstream social navigation. Alternatively port the pure core after establishing a differential rules test suite. Replace DynamoDB persistence with a platform-compatible storage boundary or retain an isolated store. Add Hebrew onboarding and pause/save. Validate maximum-dice-use cases, higher-die preference, doubles, blocked bar entry, cube decisions, Crawford games and reconnect. **Priority: high-medium; extra runtime but strong browser client reuse.**

### 08. Woogles / liwords — competitive crossword board game

**Sources:** [repository](https://github.com/woogles-io/liwords), [product](https://woogles.io), [rules engine](https://github.com/domino14/macondo). Inspected 2026-10-11. AGPL-3.0 code; Go API and socket services, TypeScript frontend in `liwords-ui`, NATS/PostgreSQL infrastructure. README confirms two-human-player sessions and Macondo rules/bots.

**Why investigate:** substantial vocabulary and spatial scoring strategy with an established complete UI. Nonviolent. Language dependence is a significant school-fit issue: a Hebrew dictionary, tile distribution and RTL placement need verification, not merely translated buttons. English mode could be valuable for older learners.

**Adaptation (estimated 4–6 weeks for English; Hebrew effort unestimated):** retain Go authority and browser UI, introduce platform seat provisioning and private-room launch. Add pause-safe clocks, saved matches and teacher visibility. Audit dictionaries independently of code licensing. Validate private racks, exchanges, challenges, score multipliers, blank tiles and replay visibility. Prototype Hebrew alphabet/dictionary support before promising Hebrew gameplay. **Priority: medium; quality prospect, comparatively heavy service stack.**

### 09. GOPS / Goofspiel — simultaneous secret-bid strategy

**Source:** [amsanghi/gops](https://github.com/amsanghi/gops), MIT; browser ESM and PeerJS/WebRTC. README documents 1v1 and 2–8-player rooms, reconnect, replay, coaching, touch confirmation and onboarding. Nonviolent bidding with spent cards creates meaningful prediction and resource-allocation decisions. Unlike poker, monetary bets are not part of the game. Current code has not been locally exercised.

**Adaptation, 2–3 weeks:** reuse presentation and bid-resolution logic, move secret bids and prize shuffling to the existing authoritative server, and reveal only after all required players commit. Replace PeerJS room creation with platform seats, add pause/reconnect, and integrate Hebrew guidance. Validate simultaneous commits, ties/carryovers, duplicate bids and end-of-deck scoring. **Priority: high-medium; unusually suitable short strategy sessions.**

### Source-audited GameNest acquisitions

Downloaded and inspected [GameNest](https://github.com/absswds/GameNest) at commit `914d34a7f724ef9baf93473bb165269a6d15133a`. Apache-2.0; browser HTML/CSS/JavaScript, Express and `ws`. Rules are separate CommonJS modules with `createState`, `initGame`, `handleMove` and, where needed, `playerView`; browser renderers are separate files. Inspected `server.js` seat projections and [NOTICE](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/NOTICE). NOTICE identifies vendored chess.js/BSD-2-Clause and Matter.js/MIT; neither grants rights to unrelated commercial game branding. Reuse generic cards/tiles and audit cover art before distribution.

Ran upstream Hearts, rules-audit, hidden-hands, Sudoku, Rummikub bot, Mahjong core/Cantonese/wildcard tests: **104 passed, 0 failed**. These establish selected rules/privacy behavior, not visual quality, complete network sessions or platform compatibility. Tests for excluded titles within shared suites do not promote those titles into this list.

Shared adaptation work, roughly 2–3 weeks once for the selected collection: wrap CommonJS rules in `GameModule`, retain per-seat views, mount renderer in a bundled iframe or convert its shell to React, and replace room-client `ws` messaging with authenticated platform intents/snapshots. Preserve runtime options, bots and server-owned randomness; add pause/save/rejoin and teacher visibility. Per-game estimates below are **additional** to that common adapter. Each game remains a candidate pending human playtesting; the common source does not make its titles equally good.

### 10. Hearts — four-player trick-taking

**Sources:** [rules](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/hearts.js), [renderer](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/public/js/renderers/hearts.js), [tests](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/tests/hearts.test.js). Exactly four players. Inspected passing, suit/rank comparisons, trick scoring, rotating pass direction and private hands; relevant tests passed.

**Value:** substantial card tracking, avoidance and timing without violence. Best for older children; use one-hand sessions initially rather than an extended target-score match. **Additional work: 1–2 weeks**, adapting hand selection and pass submission, language, trick animations and shortened session configuration. Validate hearts breaking, queen penalty, shooting the moon, seat loss during simultaneous passing and private spectators. **Priority: high within this collection.** Boardzilla Hearts is another implementation of the same game, not a new count.

### 11. Rummikub-style tile rummy — table rearrangement

**Sources:** [rules](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/rummikub.js), [renderer](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/public/js/renderers/rummikub.js), [bot tests](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/tests/rummikub-bot.test.js). Up to four players; target 2–4. Source implements two jokers, opening threshold, legal runs/groups and a cancelable table-manipulation workspace. Selected rules, hidden-rack and complete bot-game tests passed.

**Value:** genuinely rich recombination planning, familiar locally and language-light. **Additional work: 2–3 weeks**, improving touch rearrangement, clear commit/cancel and restoring unfinished workspaces after disconnect. Validate tile conservation, joker substitutions, opening requirements, canceled edits and depleted-pool stalemates. Audit artwork/name separately from Apache code. **Priority: high; strong school-fit prospect.**

### 12. Da Vinci Code-style numbered-tile deduction

**Sources:** [rules](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/davinci.js), [renderer](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/public/js/renderers/davinci.js). Two to four players; hidden ordered black/white numbers, optional jokers, guesses and reveal penalties. Inspected sorting with fixed joker positions and guess/penalty/end transitions; selected elimination test passed.

**Value:** number inference and deciding whether to continue guessing produce a deeper deduction loop than basic memory. Nonviolent; tile elimination is abstract. **Additional work: 1–2 weeks**, adding numbered-tile tutorial, readable reveal history, source-level privacy audit and phase restoration. Validate hidden tile IDs cannot reveal numbers, drawn-tile visibility, wrong-guess penalties and joker repositioning. **Priority: high-medium.** Current implementation has its own penalty behavior; document the exact rules rather than claiming perfect fidelity to every physical edition.

### 13. Dou Dizhu — asymmetric partnership climbing cards

**Sources:** [rules](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/doudizhu.js), [renderer](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/public/js/renderers/doudizhu.js), [privacy tests](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/tests/hidden-hands.test.js). Exactly three players. Inspected 54-card deal, role auction, private bottom cards during bidding, optional turn deadline and multi-round state. Privacy tests passed; combination correctness requires further targeted tests.

**Value:** one-versus-two cooperation, role bidding and hand planning offer substantial replayability. Card combination names such as “bomb” describe abstract rankings, not depicted violence; inspect renderer effects before release. **Additional work: 2–3 weeks**, adding a guided Hebrew combination reference, partnership indicators and points-only scoring. Validate combinations, consecutive passes, auction restarts, deadlines and nested snapshot privacy. **Priority: medium; substantial but unfamiliar rules need onboarding.**

### 14. Multiplayer Mahjong — Sichuan and Cantonese rules

**Sources:** [Sichuan module](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/mahjong-sichuan.js), [Cantonese module](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/mahjong-cantonese.js), [shared core](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/lib/mahjong-core.js), [renderer](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/public/js/renderers/mahjong.js). 2–4 supported seats; four preferred. Count as **one game**, with selectable rules. Inspected deck/hand setup and rule toggles; executed tests cover meld claims, priority, minimum scoring threshold, special hands, wildcards, hidden hands and wall exhaustion.

**Value:** deeply replayable nonviolent set building with competing claims and inference. Numeric tile overlays and a simplified tutorial are essential for pupils unfamiliar with the symbols. Use score-only rounds. **Additional work: 3–4 weeks**, binding claim timers to pause, restoring pending claims, teaching one ruleset first and verifying regional scoring against a reference. Validate multiple winners, dealer rotation and reconnect during claims. **Priority: medium; sophisticated, highest onboarding burden in this batch.**

### 15. Sudoku Race — identical puzzles, independent progress

**Sources:** [rules](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/sudoku.js), [generator](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/lib/sudoku-gen.js), [renderer](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/public/js/renderers/sudoku.js), [tests](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/tests/sudoku.test.js). 2–4 for platform multiplayer; upstream allows solo too. Real simultaneous race, server-checked answers, limited mistakes/hints and unique-solution generation. Relevant tests passed.

**Value:** substantial logic rather than an elementary click race, but appeal depends on puzzle difficulty and interface. **Additional work: 1–2 weeks**, adding pencil marks if absent, difficulty selection, pause-adjusted elapsed time and class-friendly non-elimination options. Validate identical starting puzzles, private solutions, atomic finishing, hint limits and malicious invalid inputs. **Priority: medium; playtest whether racing enhances or distracts from solving.**

### 16. Sheep Tile — layered triple-matching race

**Sources:** [rules/generator](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/games/sheeptile.js), [renderer](https://github.com/absswds/GameNest/blob/914d34a7f724ef9baf93473bb165269a6d15133a/public/js/renderers/sheeptile.js). Up to six seats; target 2–6. Source generates occluding layers with a solvable removal order, seven-slot capacity, independent player progress, two levels and limited undo/shuffle/pop powers. Inspected generator and move handling; no targeted suite executed.

**Value:** occlusion and constrained storage require advance planning; nonviolent and minimal language dependence. Two levels constrain content variety, even though layouts vary. **Additional work: 2–3 weeks**, validating solvability across seeds, equal-board fairness, power behavior and accessible tile contrast, plus pause/rejoin of each private progress state. Keep the upstream design as a starting point; promotion depends on human testing of difficulty and replayability. **Priority: medium, weaker evidence than Rummikub/Hearts.**

### Source-audited Delcard acquisitions

Inspected [Delcard Games](https://github.com/LucaDeltort/delcard_games) at `c196c7f7e9d143a0fadf1c8d25bfbb9cdd66bfb4`: MIT, SvelteKit/TypeScript, PeerJS host-authoritative networking. Individual games implement pure `GameDefinition` objects; sources include regular and edge-case test files. Inspected rules and scoring, but have **not run** its TypeScript suites. Common adaptation, 2–3 weeks once: reuse Svelte game presentation and pure definitions, move host authority to Railway, apply per-seat projections, map room seats to platform JWT identities and add boundary saves. Peer-to-peer host migration is upstream behavior; platform import should instead use server persistence.

### 17. Yams — multiplayer dice-category planning

**Sources:** [rules/scoring](https://github.com/LucaDeltort/delcard_games/blob/c196c7f7e9d143a0fadf1c8d25bfbb9cdd66bfb4/src/lib/games/yams/yams.ts), [rule text](https://github.com/LucaDeltort/delcard_games/blob/c196c7f7e9d143a0fadf1c8d25bfbb9cdd66bfb4/src/lib/games/yams/rules.json). 2–6 players. Inspected 13 categories, three-roll turns, held dice, upper bonus and completion logic. Nonviolent probability/commitment decisions; modest depth relative to the strongest shortlist but a complete game rather than a dice demo.

**Additional work: 1–2 weeks:** keep animated dice and score sheet, make rolls server-owned, add Hebrew category guidance and turn continuation after reconnect. Validate roll limits, category locking, bonus thresholds, full-house semantics and tied final scores; do not claim rules not present upstream. **Priority: medium-low until presentation/playability review.** This is one game across Yams/Yahtzee implementations.

### 18. Presidents — climbing cards across repeated rounds

**Sources:** [definition](https://github.com/LucaDeltort/delcard_games/blob/c196c7f7e9d143a0fadf1c8d25bfbb9cdd66bfb4/src/lib/games/presidents/presidents.ts), [rules](https://github.com/LucaDeltort/delcard_games/blob/c196c7f7e9d143a0fadf1c8d25bfbb9cdd66bfb4/src/lib/games/presidents/rules.json). 3–6 players. Inspected combo comparisons, same-value locking, finish order and inter-round card exchange. Distinct from Dou Dizhu: no fixed partnership/role auction, and success shapes the next round's starting resources. Nonviolent card play.

**Additional work: 1–2 weeks:** adapt shared engine, private hands and exchange steps; replace insulting/profane rank labels in upstream English/French text with neutral school-friendly ranks. Validate finish-on-two behavior, quadruple overrides, lock/pass chains, last-player removal and reconnect mid-exchange. **Priority: medium; test whether inherited rank advantages frustrate pupils over repeated rounds.**

### Source-audited Parlour acquisitions — reusable React presentation

[Parlour](https://github.com/braedonsaunders/parlour), inspected locally at `e0e38e961f096116d3875d7c19802c8e4fb5f49d`, is MIT-licensed TypeScript/React/Next.js with deterministic game packages and explicit multiplayer table bindings. Verified `LICENSE`, per-game packages, catalog seat counts and `apps/web/src/lib/games/tablePacks/` room-render functions. Inspected the included Blitz table screenshot: illustrated scene, clear cards, score/lives and turn indicator; this supports presentation quality, **not** a claim of live playtesting. These are newer AI-assisted sources and still need independent rule and human UX verification. pnpm is absent locally; package tests have not been run.

Common import plan, estimated **3–4 weeks once**: reuse React table screens, card motion/audio and per-game deterministic definitions through a Vite-compatible bundle. Strip Next routing and upstream profiles; replace peer-host/P2P transport and veiled-deck ceremony with server-owned seeds, authoritative moves and strict per-seat projections. Restore events/snapshots through existing room lifecycle and persist at recess boundaries. Catalog variants/presets do not count as separate games. Audit fonts, audio and illustrations independently of the root MIT code grant. Additional per-title estimates below assume the common adapter exists.

### 19. Blitz / Thirty-One — draw/discard and knock timing

**Sources:** [rules package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-blitz/src), [React table pack](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/blitz.tsx). **2–4 players**, nonviolent. Source separates suit totals, knocking, match formats, bot personas and replayable definitions. Short tactical decisions and deciding when to end a round suit recess; the existing illustrated table is a clear acquisition advantage.

**Additional work: 1 week:** translate suit-total/knock explanation, use timed or points matches to reduce time spent sitting out, adapt round transitions. Verify knock grants the proper final turns, ties/lives, eliminated-seat skipping and private draws after reconnect. **Priority: high-medium.**

### 20. Gin Rummy — meld optimization and knock risk

**Sources:** [rules/meld/score package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-gin/src), [table](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/gin.tsx). **Two players**, nonviolent. Inspected exports for best meld partition, deadwood, layoffs, undercut and match scoring; includes bots and rules tests. This is distinct from Rummikub's public-table rearrangement.

**Additional work: 1–2 weeks:** render meld/deadwood explanations, legal discard cues and short match presets. Validate overlapping meld choices, layoffs, undercut bonuses, stock exhaustion and knock thresholds against reference deals. Hide deck order and both players' private hands in every transport message. **Priority: high-medium for older pupils.**

### 21. Euchre — compact partnership trick-taking

**Sources:** [game package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-euchre/src), [table](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/euchre.tsx). **Four players**, nonviolent. Separate rule/config/catalog files, trump selection and matching room presentation; audio event files cover order-up, alone and trick collection. Team inference with short hands is the attraction; unfamiliar trump/jack rules raise onboarding cost.

**Additional work: 1–2 weeks:** Hebrew trump/bower tutorial, stable partner seats and explicit bid/pass actions. Validate left-bower suit, dealer pickup, going alone, march/euchre scoring and rejoin during trump selection. **Priority: medium; choose alongside Spades only if playtests support both.**

### 22. Cribbage — pegging and combination counting

**Sources:** [rules/score package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-cribbage/src), [table](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/cribbage.tsx). **Two players**, nonviolent. Inspected scoring exports for fifteens, runs, pairs, flush, nobs, pegging and show; complete match definitions exist. Arithmetic, discard tradeoffs and sequential counting provide substantial skill.

**Additional work: 2 weeks:** Hebrew visual scoring breakdown and assisted counting for beginners, plus shorter target-score option after rules validation. Test pegging “go”, 31, last card, starter-jack score, crib-specific flush and immediate match-ending scores. Save mid-pegging totals and dealer identity. **Priority: medium; stronger educational fit than immediate familiarity.**

### 23. Scopa — arithmetic capture and table control

**Sources:** [game package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-scopa/src), [verified solo/room render binding](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/scopa.tsx). Catalog permits **2, 3, 4 or 6**, with partnerships at 4/6; nonviolent. Selecting equal-value cards or sums, planning future captures and round scoring are meaningful decisions.

**Additional work: 1–2 weeks:** numeral-forward cards and selectable capture groups, Hebrew scoring guide and partner indicators. Validate mandatory single-card capture, sum choices, last capture, sweep exceptions and primiera scoring. Preserve discard-table state and private deal on reconnect. **Priority: high-medium; arithmetic and low language dependence.**

### 24. Spades — partnership bidding and trick planning

**Sources:** [package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-spades/src), [table](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/spades.tsx). **Four players**, nonviolent. Source/catalog covers partnership seats, bid/nil and play-card events; room table and view tests are present. Distinct from Hearts: contract planning and shared score rather than avoiding penalty cards.

**Additional work: 1–2 weeks:** partner bidding display, trick forecast explanation and short matches. Verify follow-suit, spades breaking, nil, undertricks, bags and partner-total scoring. Ensure bid and play clocks pause consistently and spectators do not expose hands. **Priority: medium-high within partnership cards.**

### 25. Oh Hell — exact-trick prediction

**Sources:** [package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-ohhell/src), [table](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/ohhell.tsx). **3–7 players**, nonviolent. Package defines bid legality including dealer hook and variable hand sizes. Predicting exactly, rather than maximizing tricks, gives it a distinct decision loop; small starting hands provide a gentle introduction.

**Additional work: 1 week:** present under a neutral localized name, show target/current tricks and hand progression; shorten the round schedule for recess. Verify dealer-forbidden totals, trump handling, zero bids and tied match ends. Restore current bid order after disconnect. **Priority: medium-high; broad group size with clear goals.**

### 26. Spite & Malice — competitive shared-foundation sequencing

**Sources:** [package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-spite/src), [table](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/spite.tsx). **2–4 players**, nonviolent card placement despite the title. Config exposes payoff-stack size, starting hand and discard piles. Planning pile access and shared foundations creates a competitive sequencing puzzle rather than solitary solitaire.

**Additional work: 1–2 weeks:** clearly distinguish private discard/payoff piles and shared builds, expose legal destinations, shorten stacks for first matches. Validate foundation resets, wildcards, refill timing and winning from payoff pile. Never send future payoff cards to a browser. **Priority: medium; good acquisition if touch pile layout holds up.**

### 27. Partnership Pinochle — meld, auction and trick strategy

**Sources:** [rules/meld/scoring package](https://github.com/braedonsaunders/parlour/tree/e0e38e961f096116d3875d7c19802c8e4fb5f49d/packages/game-pinochle/src), [table](https://github.com/braedonsaunders/parlour/blob/e0e38e961f096116d3875d7c19802c8e4fb5f49d/apps/web/src/lib/games/tablePacks/pinochle.tsx). **Four players**, nonviolent. Source separates bidding, trump, meld scoring, legal play, bot bidding/play and privacy tests. More sophisticated than elementary card clones, but the double deck and scoring make it a specialist older-pupil option.

**Additional work: 2–3 weeks:** interactive meld explanation and bidding tutorial, short match targets and fixed partnerships. Validate duplicate-card meld scoring, obligatory trump/overtrump rules of the chosen preset, failed contracts and match completion. **Priority: lower than Scopa/Blitz for this audience; substantial game with higher teaching cost.**

## FreeBoardGames source audit — shared browser route

Inspected the cloned [AGPL-3.0-or-later repository](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5) at revision `41a0077b7e76c1050b28f67537f00705a9095ed5`. These are individual published games with React/TypeScript boards and boardgame.io rules, not a count of framework examples. Rules/UI tests were located but not executed. The old Next/Material UI stack should be extracted selectively rather than installed as a second platform. Audit each game's media and upstream attribution separately from the root code license.

**Shared adaptation: 3–4 engineer-weeks once**, then the additional estimates below: host deterministic rules behind Playground's authoritative room lifecycle, replace boardgame.io transport/events with an adapter, bring boards into Vite, bind authenticated seats, and implement per-seat/spectator snapshots, pause, restore and rematch. Preserve AGPL source obligations. Estimates are planning ranges, not successful build or playtest results.

### 28. Take Six

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/takesix). **2–10 players.** Simultaneous number-card selection followed by ascending row resolution; choosing low cards can force a row pickup, while the sixth card incurs penalties. This is a complete short strategy game, with AI and rules/UI tests in source.

**Additional work: 1–2 weeks; priority: high.** Replace the commented-out player projection: keep hands and unrevealed selections private until everyone commits. Validate forced row choice, sixth-card collection, simultaneous completion and penalties. Use large numbered cards and a short score target.

### 29. Merger — hotel chains and shares

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/mergers). **3–6 players.** Acquire-style tile placement, chain formation, stock purchases, merger survival choices and majority/minority payouts. Rules, hotel connectivity and multi-client test utilities are present. Longer economic strategy, better for older pupils and saved clubs than a single recess.

**Additional work: 2–3 weeks; priority: high for depth; medium for recess.** Keep closed-information configuration, strip tile racks and audit stock disclosure. Test tied majority bonuses, multi-chain mergers, safe chains, unplayable tiles and final liquidation. Provide a guided first round and persistent matches.

### 30. Estate Buyer — two-stage property auctions

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/estatebuyer). **2–6 players.** For Sale-style ascending property auctions followed by simultaneous property sales for checks. Passing costs half the bid; buying cheaply does not guarantee the best sale. Complete auction/sale phases and a React board distinguish it from a Monopoly reskin.

**Additional work: 1–2 weeks; priority: high.** Add per-seat projection for remaining property hands, future decks and committed sales. Validate half-bid rounding, final bidder cost, lowest-to-highest check assignment and final cash. Show spending and net earnings clearly; short auctions fit recess.

### 31. Picnic Go — food-card drafting

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/picnicGo). **2–5 players.** Three-round pick-and-pass drafting with set scoring, modifiers, forks and retained dessert totals. Published online metadata, rules and board tests exist. Nonviolent picnic art and simultaneous decisions suit classroom groups.

**Additional work: 2–3 weeks; priority: medium-high after fixes.** Clone defaultDeck before destructive dealing and create separate player records instead of shared fill objects. Add private rotating hands and simultaneous selections. Validate forks, modifiers, tied collections, round scoring, dessert end score and two rooms running concurrently.

### 32. Cornerus / Blokus — polyomino placement

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/cornerus). **2–4 players.** Twenty-by-twenty board, full piece inventory, rotation/reflection, corner-touch placement, blocked-seat skipping and leftover-square scoring. Browser rules and board tests are present. Count this and Freebloks as one distinct game, with Cornerus the easier browser route.

**Additional work: 2–3 weeks; priority: high.** Start with four-player mode; independently verify the unusual two/three-player color assignment and turn rotation before exposing them. Add touch preview, rotate/flip buttons, valid-placement highlighting and saved board state. Audit artwork and use neutral branding.

### 33. Mancala / Kalah — sowing strategy

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/mancala). **2 players.** Full sowing loop, skipping the opponent store, own-store extra turns, opposite-pit capture, final sweep and scored/drawn endings. Online metadata and board/rules tests exist. Familiar arithmetic masks considerable move-planning depth.

**Additional work: 1 weeks; priority: high for younger pupils.** Bind seat identity on the server rather than accepting playerId from the move. Validate hole bounds, captures, multi-lap sowing, extra turns and total seed conservation. Animate sowing without delaying authoritative state and supply an optional move preview.

### 34. Nine Men's Morris — mills and movement

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/ninemensmorris). **2 players.** Placement followed by movement, mill-triggered removal, blocked-player loss and low-piece end conditions. Source includes rules/UI tests and board connectivity. Abstract piece removal, with no depicted violence; appropriate only under the same abstract-board interpretation as existing chess.

**Additional work: 1–2 weeks; priority: medium-high.** Verify three-piece flying, protected mills and blocked positions; resolve existing TypeScript casts during extraction. Add repetition/no-progress draws and move hints. Keep clear mill and legal-destination highlights; ten-minute match suitability needs playtesting.

### 35. Contract Bridge

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/bridge). **4 players.** Full bidding, declarer/dummy exposure after the opening lead, trick phases and round-summary scoring. Published online client and separated moves/scoring utilities give a real foundation. High teaching burden: primarily an older-pupil partnership club candidate.

**Additional work: 2–3 weeks; priority: lower for general recess.** Replace null/spectator full-state return with a safe projection; reveal only legally visible dummy cards. Validate doubles/redoubles, passed-out deals, contract scoring, revoke prevention and declarer control of dummy. Start with a tightly defined scoring preset and coached single deals.

### 36. Skat — auction and solo contracts

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/skat). **3 players.** Three-seat bidding with a two-card kitty, hand/ouvert options, contract selection, legal tricks and round summaries. Distinct from partnership cards: a successful bidder plays against two defenders. Complex, nonviolent and better suited to older pupils.

**Additional work: 2–3 weeks; priority: specialist.** Fix spectator full-state exposure and audit kitty/discard visibility. Validate bid ceilings, matadors, suit/grand/null contracts, hand/ouvert modifiers and failed-contract scoring against reference deals. Add a tutorial and one-deal rooms before full matches.

### 37. Sixty-Six

**Source:** [rules, React board, metadata and tests](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/sixtysix). **2 players.** Twenty-four-card duel with stock draws, marriage declarations, stock closing and a 66-point target. Source has separate moves and scoring helpers and a published online board. Shorter, more approachable decisions than the larger regional card games.

**Additional work: 1–2 weeks; priority: medium-high.** Fix spectator privacy; retain visible trump while hiding the rest of stock. Validate declarations, trump exchange, early close, mandatory follow/trump after closure, mistaken victory claims and match points. Teach stock-open versus stock-closed rules visually.

## Further audited multiplayer candidates

### 38. French Tarot

**Source:** [pinned repository](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/frenchTarot). **License:** AGPL-3.0-or-later; same audited FBG revision. **Players:** 3–5. Full 78-card game with trumps, Excuse, bidding, kitty/discard, handful declarations, called-partner handling and contract summaries. A complete online React board with substantial scoring utilities, not fortune-telling. Older-pupil specialist rather than a broad recess launch.

**Adaptation: FBG shared adapter plus 2–3 additional weeks.** Replace spectator full-state return and audit kitty, called partner and discard visibility. Verify forced trump/overtrump, Excuse handling, bouts, petit-au-bout and contract multipliers against reference deals. Provide a short single-deal preset and guided trump controls.

### 39. GeoGuess

**Source:** [pinned repository](https://github.com/GeoGuess/GeoGuess/tree/692bf60d4a402ab70c6b9a4c8862e5aef156a2ee). **License:** MIT code; Google imagery/API is a separate service, not an open asset pack. **Players:** 2–5 initially (README says up to five friends; confirm total-seat cap). Five-round shared-location geography guessing with distance scores, custom GeoJSON maps, room readiness, history and responsive Vue UI. Inspected Maps.vue, settings room subscriptions and score utilities. Existing Hebrew locale is a useful starting point. Tests located, not run.

**Adaptation: 3–5 weeks.** Retain the Vue game as a self-hosted browser bundle or migrate its map screen; replace Firebase room mutation with platform authority for round selection, guesses and scoring. Current clients write distances/results, so validate them server-side. Meter Maps API usage and choose a permitted imagery plan before rollout. Test identical panoramas, late guesses, host departure, restricted classroom regions and mobile RTL.

### 40. Scribble.rs — live drawing and guessing

**Source:** [pinned repository](https://github.com/scribble-rs/scribble.rs/tree/1bda7ed8b880bb598dede5096c0e2f3f58abe0b8). **License:** BSD-3-Clause. **Players:** 2–24 upstream; target 3–8. Substantial Go/WebSocket Pictionary implementation with timed turns, drawer selection, word packs, guess comparison, scoring, canvas synchronization and room settings. Source includes Hebrew translation and Hebrew words. Lobby/word/parser tests exist; Go is unavailable here, so these were not run.

**Adaptation: 2–4 weeks.** Retain the Go authority behind a gateway that maps Playground room/seat tokens, or port the room state machine while retaining browser canvas code. Add recess pause, disconnect recovery and bounded canvas history. Keep the word private from guessers/spectators, curate Hebrew prompts, and expose existing teacher room controls. Validate repeated strokes, reconnect canvas replay, near guesses, round completion and drawer departure.

### 41. Garlic Phone — sketch telephone

**Source:** [pinned repository](https://github.com/durancristhian/garlicphone/tree/03364fd3142e6f4b71f18cdcaa3ea183037b0386). **License:** MIT. **Players:** 2+ upstream; target 4–8. Alternating write/draw chains: participants receive a sentence, draw it, then another participant describes the image; finished albums reveal how meaning changed. Source has assignment shuffling, batched answer writes, timed phases and album/reaction/GIF views. Distinct from live Pictionary: private chains and delayed reveal, without speed guessing.

**Adaptation: 3–4 weeks.** Reuse drawing and album UI in Vite, replace old Next/Firebase room hooks with server-owned assignments, deadlines and completion. Freeze seat order once a game starts: the current phase derives from activity length divided by live player count, so dropout can corrupt progression. Send only the assigned preceding item, bound image sizes, and make GIF generation optional. Validate timeout blanks, duplicate submissions, odd/even chains, disconnects and ordered final albums.

### 42. Chicken Roll / Can't Stop — push-your-luck climbing

**Source:** [pinned repository](https://github.com/simlmx/chickenroll/tree/30bfe728c5753010e9dccea25c8305aecd1050fe). **License:** MIT root; game package declares ISC, both permissive; verify bundled dependencies/media. **Players:** 2–5. Complete TypeScript engine and React board in separate game/ui packages. Roll four dice, choose pair sums, advance temporary climbers, then bank or risk busting; claimed columns close options. Source includes probability math, bots, rules, move history and victory tests. Real strategic risk decisions rather than a random dice spinner.

**Adaptation: 2–3 weeks.** Adapt @lefun/game turn/random/board interfaces to Playground, or use the old boardgame.io branch only after a separate pin/audit. Start with standard mountain/preset, retain optional probability hints for teaching. Server owns dice. Verify blocked sums, doubles, three active climbers, banking, bust rollback and target columns; pause before rolling and restore unbanked progress.

### 43. Quoridor — paths and walls

**Source:** [pinned repository](https://github.com/cygnan/quoridor-multiplaying/tree/a3038ed5e5253be639ed68ff7b814074c1476d83). **License:** GPLv3 server/wrapper; MIT inherited client/core/agents, with file-specific notices. **Players:** 2. Complete browser pawn-racing game with wall inventories, path search, legal moves, jumping, goal detection and alpha-beta/naive agents. Node/Express/Socket.io network wrapper is present. Public board state simplifies integration; winning requires reaching the far edge, with no combat.

**Adaptation: 2–3 weeks.** Move quoridor_core.ts into server-side authority and treat the existing chat/socket wrapper as replaceable: inspect rather than assume it validates client state. Verify every wall leaves both goal paths, crossing/overlapping walls, diagonal jumps when blocked, remaining wall counts and goal rank. Add touch wall preview, legal pawn targets, rematch and stable saves.

### 44. Santorini — move and build, base rules

**Source:** [pinned repository](https://github.com/mbrinkl/santorini/tree/a086bd7586f69e98a672a36d900f9fc3bf18ddc8). **License:** MIT declared in package.json; capture attribution and separately audit models/media. **Players:** 2 initially. React/Three.js browser board with boardgame.io rules and PostgreSQL backing. Source includes placement, movement, building, validity checks, level-three wins and immobility loss. Select the existing Mortal/base rules; several optional god powers remove workers or have other unsuitable effects, and are excluded from this recommendation.

**Adaptation: 3–4 weeks.** Extract the Vite/React renderer and core behind platform rooms; lock base-rule configuration on the server. Provide an overhead touch view, level cues and clear worker selection. Verify climbing limits, domes, build adjacency, win versus blocked state and turn recovery. Replace publisher branding or artwork lacking separate permission. Source tests exist but were not run.

### 45. Secret Codes — team word deduction

**Source:** [pinned repository](https://github.com/freeboardgames/FreeBoardGames.org/tree/41a0077b7e76c1050b28f67537f00705a9095ed5/web/src/games/secretcodes). **License:** AGPL-3.0-or-later; same audited FBG revision. **Players:** 4–20 upstream; target 4–8. Codenames-style 25-word board, two teams, clue-giver roles, hidden colors, guesses/pass and team endings. React lobby/play board and rules/UI tests are present. Upstream expects clues to be spoken; add a room-bound written clue/count so remote pupils can play. Use a neutral trap tile/name rather than assassination language.

**Adaptation: FBG shared adapter plus 2–3 additional weeks.** Fix projection: null spectators and pre-guess phases currently receive the full color map. Only clue givers may see unrevealed colors in every phase. Add server-validated clue/count and guess budgets, curated Hebrew word sets, fixed teams and pause. Verify accidental role swaps, trap loss, tie/finish semantics and spectators. Spoken-only upstream clues must not be represented as already implemented network clue submission.

### 46. Encrypto — teams decoding one another's clues

**Source:** [pinned repository](https://github.com/ZinkLu/decrypto-the-game/tree/9f990f173de3945e5ec232ffc4ac9d3cb20bd26e). **4–8 players. MIT code and author-owned content**, with separate CC0 audio and OFL font credits inspected. Go authority/SQLite, React/TypeScript browser console. Each team has four secret keywords; rotating encoders issue three clues for a private three-digit sequence, teammates decode and opponents use the public history to intercept. Two interceptions win; two miscommunications lose. Substantial repeated reasoning and team communication, without combat.

Inspected role-specific views in `server/internal/game/state.go`: only the correct team gets its keywords and only the encoder receives secret digits; private guess progress has a separate filtered representation. Resume-token hashing, persisted rooms, core/session/snapshot tests and compact mobile UI exist. Tests not run because Go is unavailable. The polished modeled-console presentation deserves a usability check on small screens.

**Adaptation: 3–5 weeks; priority high for grades 5–7.** Retain Go rules and console behind an authenticated platform gateway, mapping persisted upstream rooms to Playground sessions. Add recess pause, teacher spectator projection and Hebrew word packs/RTL instructions. Human-only seats avoid any AI API dependency; optional voice is unnecessary for written clues. Verify simultaneous guesses, role rotation, interception ties, score thresholds, restart/resume and private historical messages. Source explicitly says “non-commercial” describes its current operation and does not narrow MIT; publisher marks/art are separately excluded.

## Doot source audit — three distinct party games, not 30 counted blocks

Inspected [revision `0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b`](https://github.com/virgilvox/doot-games/tree/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b). MIT source, Vue 3/Nuxt/TypeScript, composable rules with complete player/host/reveal views. Current runtime is browser-host authority over CLASP pub/sub; reconnect identity derives from room/name. This is usable gameplay evidence, **not secure Playground seat authorization or durable server authority**. Reuse the games/SDK/views and replace that room runtime; do not import the whole catalog indiscriminately.

**Shared adapter: 3–4 weeks once**, then 1–2 additional weeks per selected game: run phase transitions, seeded content, scoring and hidden answers on the platform server; create an in-room shared host/reveal view visible to every participant, removing dependence on a physical projector. Bind platform user IDs rather than reconnect-by-name; restore timers and submissions, disable audience voting initially, and save at round boundaries. Audio credits identify CC BY 3.0 crowd recordings; preserve attribution or replace them. Curate/localize content: a “family-friendly” label is not a fact-check or school-content review.

**Executed verification:** six selected upstream Vitest files passed, **65 tests, zero failures**: wavelength, fibvote, vote, collectvote integration, engine identity and state-machine tests. Ran with isolated temporary dependencies; no Playground dependency files changed. This establishes tested logic for those cases, not production relay security, a complete hosted game or firsthand social playability.

### 47. Quip Clash — writing and anonymous judging

**Sources:** [game composition](https://github.com/virgilvox/doot-games/blob/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/games/src/games/quip-clash/index.ts), [vote rules/tests](https://github.com/virgilvox/doot-games/tree/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/games/src/blocks/vote). **3+ upstream; target 4–8.** Each round collects original short answers to a prompt, shuffles them anonymously, then awards points through votes; final-round multipliers and reduced-score timeout answers support a complete match. Source has server-reusable tally logic rejecting self-votes. Count one writing/judging game, not every prompt theme or caption mode.

**Additional adaptation: 1–2 weeks.** Curated Hebrew prompts, readable answer galleries, private submission snapshots and safe text rendering. Validate self-votes using identity, author attribution after a disconnect, duplicate answer text, empty rounds, final multipliers and timed locks. Social appeal depends on group playtesting; suitable for confident readers/writers, not a universal grades 1–2 launch.

### 48. Fib Finder — invented answers and finding the truth

**Sources:** [game](https://github.com/virgilvox/doot-games/blob/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/games/src/games/fib-finder/index.ts), [fib rules and tests](https://github.com/virgilvox/doot-games/tree/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/games/src/blocks/fibvote). **3+ upstream; target 4–8.** Participants write believable answers to a factual blank; the game mixes these with the hidden correct answer. Players score both for recognizing truth and for attracting others to their own invention. Distinct from Quip Clash: objective answer plus dual scoring, not subjective funniest-answer voting.

**Additional adaptation: 1–2 weeks.** Fact-check and translate the deck before use—several packaged factoids are oversimplified; authoring a curated deck is necessary. Hide the truth and author map until reveal, normalize Unicode/spacing, reject self-votes and truth-equivalent fakes, preserve tied/duplicate submissions fairly. Validate scoring, blank guesses, timeout answers and recovery between writing and voting. Strong older-pupil language/reasoning fit.

### 49. Wavelength — clue-giver spectrum deduction

**Sources:** [game](https://github.com/virgilvox/doot-games/blob/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/games/src/games/wavelength/index.ts), [private assignment/scoring/tests](https://github.com/virgilvox/doot-games/tree/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/games/src/blocks/wavelength). **3+ upstream; target 3–8.** A rotating clue giver sees a private target on a 0–100 scale between two concepts, writes a clue, and others estimate where it belongs. Closeness scores guessers; average accuracy rewards the clue giver. Source implements private target assignment, paired clue/guess rounds, rotation, reveal and scoring tests. This implementation's individual closeness scoring differs from the physical game's team rules; do not claim exact compatibility.

**Additional adaptation: 1–2 weeks.** Generate targets and private assignments on the server; the upstream target pool/shuffle is seeded, so public room-derived configuration must not reveal answers. Curate Hebrew axes, make dial direction clear in RTL, support keyboard/touch and persistent clue display. Verify only the clue giver sees the target, they cannot score a self-guess, non-finite/out-of-range inputs are rejected, and rotation survives dropout. A strong communication game with minimal asset burden.

### 50. Blobby Volley 2 — arcade volleyball

**Sources:** [pinned C++ repository](https://github.com/danielknobe/blobbyvolley2/tree/c28c5fa87872b7592f34f5f86196e93d127b6cf9), [official browser release](https://blobbyvolley.de/), [existing Wasm client](https://blobbyvolley.de/data/bv2wa/index.html). **Two players; GPL-2.0-or-later in inspected core headers.** Mature head-to-head volleyball, local humans/bots and native network play, with replay and rule tests. Nonviolent sport: jump, position and return the ball. The official website establishes an actual Emscripten browser build. This does **not** establish that its browser build supports the native network protocol.

Source gives a concrete bridging route: `DuelMatch` owns rules and score, `PhysicWorld` accepts player inputs and returns/restores physics state, and `server/NetworkGame.cpp` advances authority, broadcasts state, records replays and pauses on victory. Snapshot and pause/unpause interfaces are present. No port compiled or live match tested in this research.

**Adaptation: 5–8 weeks, including a mandatory 1-week browser feasibility spike; priority medium-high for variety.** Wrap the native match core as Wasm for prediction/rendering and a retained native worker for authoritative rooms, replacing RakNet UDP with explicit WebSocket/Socket.io input and snapshot transport. Alternatively expose the core through Node Wasm if runtime dependencies permit. Reproduce fixed simulation cadence, interpolate opponents, authenticate seats, pause both simulation and timers, and save match state at breaks. Verify rules/serve faults, latency and input ordering, browser focus loss, touch controls and reconnect. The existing official browser artifact's exact build provenance is not established; plan a reproducible source build, not copying the hosted binary. If the spike cannot reproduce the build/transport within this range, demote it rather than extending indefinitely.

## Conditional leads and alternatives — excluded from the shortlist count

| Game / source | Evidence and attraction | Missing proof / next action | Tentative adaptation |
|---|---|---|---|
| [OpenTTD](https://github.com/OpenTTD/OpenTTD) | Mature transport simulation; README documents free OpenGFX/OpenSFX/OpenMSX assets and durable save compatibility. | Verify network behavior, exact license, browser-port source and networking feasibility; inspect crash/disaster settings for nonviolent classroom configuration. | Wasm client plus authenticated private native-server gateway; disable unsafe content and external downloads; persistent small maps. Likely 6–12+ weeks if an existing browser port is reusable. |
| [Simutrans](https://github.com/simutrans/simutrans) | Transport-network economics; README explicitly references joining network games and strict version matching. C++/SDL2 and pakset assets. | Inspect license and chosen pakset, find a maintained browser export, verify two-client network path and pause/save semantics. | Wasm/SDL client and gateway to native simulation, version-pinned assets and small maps. Likely 8–14+ weeks; not yet established as reasonable. |
| [Carcassonne by tsaglam](https://github.com/tsaglam/Carcassonne) | Complete main game, up to five shared-screen players; source page now confirms EPL-2.0. | Original board-game artwork is prominently reused; code licensing does not establish artwork rights. Online play is absent. | Reuse/port deterministic rules and create an original browser board after a source audit. Likely 5–8 weeks plus an art replacement; do not count yet. |
| [Splendor by boardgamers](https://github.com/boardgamers/splendor) | README describes 2–4-player base game on boardgamers.space and server-side engine package. | No explicit license visible in inspected repository page; inspect package-level licenses and asset rights before counting. | Reuse engine and frontend packages after license confirmation; adapt platform rooms and private reserves. Likely 3–5 weeks. |
| [Catanova](https://github.com/shashwtd/catanova) | Latest primary README describes an early browser playtest with 2–4 invited players, authoritative recovery and MIT original contributions, with third-party exceptions. | Source/rules and hosted play quality still need audit; original board-game compatibility includes army/robber content that needs classroom assessment. | Compare against JSettlers before selecting one settlement-trading implementation; never count both. |
| [Freebloks](https://github.com/shlusiak/Freebloks-Android) | GPL-2.0 Android app documents online play, save/restore, touch rotation, board sizes and compatible [native backend](https://github.com/shlusiak/Freebloks-3D). Deep nonviolent polyomino placement. | Inspect native backend/license and browser compilation route; Android UI is not reusable in React. | Reuse native rules/bots as Wasm or retained authority; create browser board from proven interaction design and private room gateway. Estimated 4–7 weeks after feasibility spike. One game count only across all Blokus implementations/modes. |
| [Neverputt](https://github.com/Neverball/neverball/tree/0c217048a92b5b353c5e35858ea98522c4e368a9/putt) | GPL-2.0-or-later family; inspected actual hot-seat player rotation, strokes, course/par scoring, penalties and ball positions. A complete companion minigolf game. | Existing Emscripten build targets Neverball, not proven Neverputt. No network authority yet; this cannot be counted as an existing online minigolf import. | Adapt the shared C/OpenGL/SDL browser build to putt sources, then authoritative shot simulation and per-player balls. Estimated 5–8 weeks after build spike; credible lead, less established than counted volleyball. |
| [Frozen Bubble SDL3](https://github.com/dchau360/frozen-bubble-sdl3/tree/f1dd04d351d65b3d9bd9ad9f6005c3a005a4ec80) | Real C++/SDL3 Wasm/WebSocket code and native server; rich online modes and touch UI. Inspected transport, CMake and server documentation. | Main headers explicitly say GPLv2; README identifies a GPLv3-derived bot-scoring model. Clarify compatibility/provenance before distribution. Winners are client-reported, so server scoring needs work too. | Reproduce build, resolve/remove the licensing ambiguity, then reuse browser client with server-owned input simulation/results. Approx. 4–7 weeks, not counted until the licensing question is resolved. |
| [fbjs](https://github.com/zepr/fbjs/tree/295b065b41a6a8dbb4a3d2a7cf6f715b962746c0) | GPLv3 Java/Spring authority plus browser JavaScript Frozen Bubble; documented local two-player and network up to five. | README explicitly says synchronization needs a complete review and beta integration/tests are incomplete. Do not use as proof of a stable online bubble-game acquisition. | Inspect network.js and game manager, run two clients and establish consistent boards before estimating a 3–5-week adapter. Same game as the SDL3 lead, not an extra count. |
| [18xx.games](https://github.com/tobymao/18xx/tree/46a592e40494368390c9a731978a577ac4ecb1e0) | Mature Ruby/Opal browser railway economics, with production 1830 and 1846 engines and real multiplayer. | LICENSE explicitly limits MIT to the software platform; README says titles on other websites may need their designers/publishers' permission. Never infer blanket game/asset rights or count dozens of variants. | Retained engine/service and original browser client behind private rooms; potentially 4–7 weeks once title rights are established. Long club sessions rather than general recess. |
| [Mosaic](https://github.com/maciejmatu/mosaic/tree/910068dd9d5214dcb4f09449c2f668db2bea2e40) | Attractive, complete-looking React/TypeScript online Azul-style tile drafting. | No explicit license found in root or package manifest; README says inactive maintenance. Excluded despite a very good genre fit. | Seek an explicitly licensed implementation; likely a 2–4-week adapter once code and art rights are clear. |
| [Forbidden Desert](https://github.com/hwabis/forbidden-desert/tree/72b3d83878af6cf863e48da435823ca4a9ba7cee) | Cooperative 2–5-person local React/boardgame.io game, a desirable genre. | No root/package reuse license found; README credits MapleStory art and changes several original rules. | Do not copy. A clean licensed implementation with original assets is needed before this can join the shortlist. |

## Existing-game upgrade opportunities — do not count as new games

**[Lichess / lila](https://github.com/lichess-org/lila):** README establishes Scala authority, TypeScript/snabbdom browser client and a separate WebSocket server, with AGPL-3.0-or-later licensing. Mature chess UX, analysis and internationalization could improve existing Playground chess. Extracting a board component is more plausible than operating the entire MongoDB/Redis/Scala stack. Next inspect the dedicated board repository and license, then assess a 1–3 week presentation upgrade while preserving current authority. Do not count chess variants or multiple chess forks to inflate the target.

## Rejected or outside scope

- [Vimvim Racing](https://github.com/MumenOsman/vimvim-racing): promising browser racing, documented WebSocket synchronization and checkpoints, but README explicitly includes rockets fired at other vehicles. Excluded from the nonviolent shortlist as shipped; removing combat would require a separate reviewed fork.
- [What The Hex?](https://github.com/bw-yuhogg/what-the-hex): Apache-2.0 Godot/C# local two-player score attack, but documented gamepad-only multiplayer activation, no network play, and uncertain browser path. Do not count without stronger quality and adaptation evidence.
- [boardgame.io](https://github.com/boardgameio/boardgame.io): framework, not a qualifying finished game.
- Settlers III remakes, FreeOrion, Veloren, shooters and war strategy: combat themes fall outside this mission; source availability is insufficient to override that exclusion.
- Large newly generated game collections discovered through search remain unverified. A claim of 34 games is not evidence of 34 substantial, playable, licensed games.
- [OMI by MythKid](https://github.com/MythKid/omi-multiplayer): looks technically suitable but its own license section explicitly says source-available, reserves redistribution/public redeployment and commercial use. Excluded as an open-source acquisition.
- [Terraforming Mars](https://github.com/terraforming-mars/terraforming-mars): substantial GPLv3 browser game, but candidate content and asset provenance need closer review (README lists personal-use fonts); attacks/destructive card effects also need a strict nonviolence assessment. Keep outside the count pending that review; forks do not add distinct games.

## Single-player discoveries — separate, zero contribution to MP target

**Neverball — strongest separate native/browser lead.** [Pinned source](https://github.com/Neverball/neverball/tree/0c217048a92b5b353c5e35858ea98522c4e368a9), [official browser game](https://play.neverball.org/), [official September 2026 browser announcement](https://neverball.org/). Tilt the floor to roll a ball, collect coins and solve timed obstacle courses; substantial skill progression and level content, without combat. Inspected Emscripten makefile and licensing: GPL-2.0-or-later overall, GPLv3 easings, MIT miniz, font exceptions and an Octocat trademark exception. Prefer a GPLv3-compatible build and omit the Octocat skin. **2–3 weeks** to reproduce/self-host the existing browser build, wrap the iframe lifecycle, connect pause/save/completion, localize menus and validate touch, audio unlock, mobile performance and persistent progress. Neverball is single-player; Neverputt is the separate conditional multiplayer companion.

**Open Golf — polished 3D minigolf prospect.** [Source](https://github.com/mgerdes/Open-Golf), [author's browser build](https://mgerdes.github.io/minigolf.html), [MIT license](https://github.com/mgerdes/Open-Golf/blob/master/LICENSE). C/Sokol game with original ball collision physics, terrain/course editor and baked lighting; upstream explicitly publishes an HTML build. The attractive 3D course presentation and aiming/physics offer more than a starter golf demo. No implemented multiplayer was established, so it contributes zero to the MP count. **2–3 weeks** to reproduce the web build, self-host courses, bind pause/resume/progress and score completion, add touch/Hebrew instructions and audit Kenney/third-party library notices. Test course endings, out-of-bounds penalties, save continuity and browser rendering. These are source/product-based prospects, not firsthand playtested recommendations.

## Research ledger and next steps

Final research shortlist: **50 distinct multiplayer games**, plus **two separately listed single-player prospects**, one existing-game upgrade and 11 distinct conditional leads/alternatives across 12 table rows (Frozen Bubble's two implementations count as one lead; Freebloks is an alternative to counted Cornerus/Blokus). The numbered multiplayer target is reached without counting single-player titles, forks, frameworks or variant packs. Evidence supports researching these acquisitions; it does not establish 50 classroom-ready imports.

**Verification completed:** reviewed the existing platform architecture; primary repository/product research for all entries; local source audits for GameNest, Delcard, Parlour, FBG, GeoGuess, Scribble.rs, Garlic Phone, Chicken Roll, Quoridor, Santorini, Encrypto, Doot and Blobby Volley. Selected upstream test suites: **169 passed, zero failed** (104 GameNest, 65 Doot). No new platform tests, imports, deployments or app dependencies. Other source tests were located but not executed.

**First implementation decision:** run the strongest browser candidates with two real clients, select roughly five varied titles, complete asset/dependency audits and lock source revisions. Use a playable pupil trial to decide whether reusable presentation actually meets the desired quality. Verify hidden-state filtering, invalid moves, disconnect/restore, teacher spectators, pause at recess end, mobile controls, Hebrew RTL and persisted rematch for each selected title. Native volleyball gets its bounded build/transport spike before a full import commitment.

**Uncounted future discoveries:** [Play a Duet](https://github.com/Ian2x/play-a-duet), [Poorup](https://github.com/jeremy341/Poorup), [Tetrominet](https://wjordan.github.io/tetrominet/), [LAN games](https://github.com/kbennett2000/lan-games). Tetrominet's advertised browser client is a legacy Java applet, not modern browser compatibility. LAN games includes combat and elementary titles. Keep seeking more native sports, cooperative puzzles and music games to improve genre breadth; they were not silently inferred from single-player or unfinished code.

Source-audit exclusions: GameNest Suika trusts client merge/overflow reports, so a multiplayer scoreboard is not a complete authoritative physics import; leave it outside the count. GameNest Go9 uses a simplified end/scoring model that needs rules correction/reference checks. Big Two has comparison behavior that may not match standard five-card hierarchy; inspect/fix before promotion. Delcard Purple is dominated by blind color guessing and is too thin for this mission. Werewolf, weapon-themed games, combat card games and elementary War are excluded. Play a Duet has genuine two-person information asymmetry but explicitly uses offline pages and verbal codes, not synchronized networking; evaluate separately before counting its rooms as games. Poorup has an explicit MIT grant inside its README, but includes optional casino features and a documented broken mode; isolate the property-game core and assess it before promotion.
