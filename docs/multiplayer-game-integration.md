# Open-source multiplayer game integration guide

Updated 2026-10-21. Audience: future agents evaluating and integrating multiplayer games into The Playground.

## Scope and decision status

This guide records the recommended integration direction discussed with the operator. It is a planning and acceptance guide, not evidence that the proposed infrastructure exists. Read `ARCHITECTURE.md`, the actual source, and applicable repository instructions before implementation. Follow the user's authorized scope: documentation or evaluation requests do not authorize code changes, production deployment, migrations, or catalog activation.

Current architecture: React/Vite frontend, Supabase identity and durable metadata, a Socket.io board/event game server, and a separate Socket.io Minecraft server. Integrated games with their own runtime live under `games/`, outside the root workspaces: [Rocket Arena](../games/rocket-arena/README.md) uses Colyseus/Rapier and [Wobble Rush](../games/wobble-rush/README.md) uses authoritative Node/WebSocket simulation with a shared predicted actor world. Each game includes its runtime, app integration and deployment documentation. Evaluation experiments remain separate from integrated game source.

Recommended general direction; do not assume a shared implementation exists:

- A common Playground integration contract for identity, admission, sessions, controls, persistence, and telemetry.
- A runtime-aware frontend registry and session-to-engine-room mapping.
- A separate action runtime, with Colyseus as the default for compatible TypeScript action games.
- Native game backends where preserving a working engine is cheaper and safer than rewriting it.

Do not interpret this as a migration of existing Socket.io services. ADR 001 remains applicable to those services; document any new runtime decision explicitly when implementing it.

Capacity planning means measuring increasing player/room workloads and improving or scaling the implementation. Do not introduce maximum-player, observer-count, or maximum-room caps as a default integration step, or turn benchmark sizes into join restrictions. Record intrinsic game participation rules and existing engine constraints separately; they do not establish platform-wide or per-service headcount ceilings.

A game-specific adapter does not establish a shared action runtime or universal registry. Read the relevant game's integration and operations records before reusing its implementation. Local code, running processes, applied catalog SQL and published lab releases can be at different versions.

## Architecture boundaries

```text
Playground frontend + Supabase catalog, identity and session metadata
                         |
              Shared integration contract
                         |
       +-----------------+------------------+
   Board runtime     Action runtime     Native runtimes
   Existing server   Colyseus default   Imported servers
```

Platform policy and game simulation have different responsibilities. The platform owns identity, permitted membership, invitations, recess, teacher roles and catalog visibility. The responsible game backend enforces these policies and owns live room state, simulation and accepted results. Supabase stores lifecycle metadata, results and necessary recovery checkpoints; it is not the per-tick transport or physics store.

Browsers connect directly to the selected backend for gameplay. Do not route every game's physics traffic through the board server. Do not add unrelated games to Minecraft merely because it has a tick loop: its voxel state, update cadence and survival systems are specialized. Sharing a process also shares CPU contention, crashes and restarts.

Share policy and adapter utilities where practical; do not require a universal physics engine or identical wire protocol. A shared action service can host compatible games initially. Separate processes/services when dependencies, CPU demand, failure isolation or release schedules warrant it.

## Runtime decision checklist

| Imported game | Default approach | Questions to resolve |
| --- | --- | --- |
| Event/turn-based game | Existing board runtime if its module contract fits | Can its transitions and lifecycle be represented without special tick machinery? |
| Browser game with reusable simulation and weak networking | Adapt to action runtime | Can simulation run headlessly, validate inputs and support authoritative results? |
| Working authoritative Node/Colyseus backend | Preserve engine and add platform adapter | Can admission, room mapping, controls and observability be integrated cleanly? |
| Mature backend in another language/engine | Native server in a separate service/process | Build reproducibility, browser compatibility, operational cost, room allocation? |
| Client-authoritative movement or position relay | Evaluate explicitly before production acceptance | Can movement, checkpoints, finish times and scores be forged? What validation is feasible? |
| Peer-to-peer/host-authoritative game | Evaluate connectivity and authority before retaining it | NAT/TURN needs, host departure, abuse, teacher access and IP exposure? |

Colyseus is a preferred default for new compatible action integrations, not a mandatory conversion target. A transport library is not a physics engine: each game still needs appropriate simulation, validation, prediction and reconciliation. Preserve a good native implementation unless adaptation has a concrete benefit.

Record the decision, alternatives, estimated maintenance cost and known limitations in the game's integration handoff. Do not select an engine based only on language or the presence of WebSockets.

## Pipeline and stage gates

### 1. Intake and reproducible baseline

- [ ] Record source URL, pinned revision, license and asset/dependency licenses. Check redistribution requirements and separate trademarks from code permissions.
- [ ] Identify client/server languages, toolchains, browser target, dependencies and external services. Preserve upstream notices.
- [ ] Inspect network calls, telemetry, credentials and public matchmaking dependencies before connecting the game to platform identity.
- [ ] Install from a lockfile and document exact build/start/check commands and environment variables.
- [ ] Run independently under `experiments/<slug>/`; keep production credentials and app sessions out of evaluation.
- [ ] Record supported controls, browsers, devices, game participation rules, existing engine constraints and server requirements.

Exit evidence: reproducible build and a playable baseline, with failures and licensing questions recorded.

### 2. Multiplayer evaluation

- [ ] Identify authority for movement, collisions, scoring, time, randomness, roster and match transitions.
- [ ] Test creation/join, synchronized gameplay, completion and restart with two clients.
- [ ] Test physical devices on different networks. Browser contexts alone do not establish network quality or device performance.
- [ ] Test invalid/closed rooms, applicable game participation rules, host departure, leave, refresh and reconnect; distinguish supported behavior from assumptions.
- [ ] For action games, inspect input sequencing, bounded queues, tick scheduling, snapshot cadence, interpolation and correction behavior.
- [ ] Measure browser frame times, RTT, server tick overruns, CPU/memory and traffic. Separate background tabs, solo tests, automation and human multiplayer evidence.
- [ ] Decide continue, adapt, preserve native backend, or archive.

Exit evidence: multiplayer quality and integration cost are understood well enough to choose a runtime. Standalone success is not app readiness.

### 3. Integration design

- [ ] Choose runtime and hosting independently; describe why each fits.
- [ ] Define platform session mapping, admission, capabilities, lifecycle transitions and result ownership.
- [ ] Specify pause/recess policy, reconnect grace, late joining and restart recovery.
- [ ] Compare the app experience with existing games: host/participant controls, player identification, chat/voice, fullscreen, saved games and theme. Record missing required behavior before calling the integration ready.
- [ ] Choose native React/client integration or an iframe wrapper. For iframes, specify trusted origins, message validation, focus, resize and cleanup; avoid passing long-lived credentials through URLs.
- [ ] Define compatibility between client/server builds, measured workload behavior, scaling needs, deployment drain and rollback.
- [ ] Record measurable acceptance criteria before implementation; use expected school concurrency and target devices, not invented capacity claims.

Exit evidence: a reviewable integration plan and gap list. Implement only within the user's authorized scope.

### 4. Platform adapter and client integration

- [ ] Integrate backend admission and session mapping first; never trust a client-provided role or user ID.
- [ ] Add lifecycle, capability-aware teacher controls and bounded persistence.
- [ ] Connect through the existing catalog/invitation/session flow; avoid exposing a second unrelated public lobby.
- [ ] Add the selected client through a runtime-aware registry/container, with loading errors and teardown.
- [ ] Provide Hebrew UI, appropriate RTL text/layout, touch controls where required and accessible menus. Do not mirror game coordinates merely because UI text is RTL.
- [ ] Add structured logs and telemetry using `docs/LOGGING.md` and existing observability utilities where compatible.
- [ ] Supply a root development command that fits the existing multi-service workflow, builds/serves matching artifacts, uses readable development logs, and documents which background service must restart after a change.
- [ ] Keep Playground changes in a small adapter/module boundary where practical; retain upstream provenance and an update strategy.

Exit evidence: integrated functionality meets the contract below in an isolated test environment.

### 5. Validation, rollout and maintenance

- [ ] Complete the acceptance matrix below and report untested cases honestly.
- [ ] Validate progressively increasing player counts and simultaneous rooms; measure resource behavior and scaling needs without converting tested workloads into headcount ceilings.
- [ ] Prepare matching client/backend releases, health/readiness checks, drain procedure and a tested rollback path.
- [ ] Retain the standalone comparison release until integrated play passes equivalent scenarios.
- [ ] Assign ownership for upstream updates, vulnerabilities, dependency/toolchain changes and abandoned-game retirement.

## Common integration contract

The following is a behavioral contract. Event names, schema fields and endpoints must be designed against the actual code; this document does not introduce an existing API.

### Admission and launch

1. The app creates or joins a Playground session through the platform's authorized flow.
2. The responsible backend verifies identity and admission: session/game match, membership or permitted joining, gender, role, recess and session status.
3. It creates or resolves the engine room and returns the backend endpoint, room identifier, compatible build/protocol information and admission credentials as needed.
4. The client connects directly to that backend. The backend validates admission again at connection/join and enforces policy during play.
5. The backend reports accepted lifecycle changes and results to platform storage.

Supabase JWT verification may be sufficient for a simple service. If using launch tickets, keep them short-lived and scoped to session, game, player, role and intended backend; define expiry, replay handling and reconnect issuance. Never put service-role keys in clients. A ticket is not a permanent bypass of membership revocation or recess enforcement.

### Session and room ownership

- Platform session ID remains the stable reference for invitations, teacher views, logs and results.
- Define how a session maps to engine rooms across rematches/rounds. Do not assume one permanent engine room per session.
- Resolve concurrent room creation idempotently. One authoritative process owns each live simulation; do not accidentally run duplicate matches for the same allocation.
- Persist routing/allocation metadata where required, with stale-allocation cleanup. Verify every join against the intended game and session.
- Define who writes roster and lifecycle fields and how retries/stale updates are rejected. UI and backend must not independently claim conflicting authority.
- Preserve native engine invariants when mapping platform roles, moving participants between actors, or filtering inactive actors out of published rosters. Keep host flags, control authority and serialized membership consistent. Exercise small and larger rosters, including reassignment and owner departure; a valid platform roster can still produce an invalid engine snapshot.

### Capabilities and lifecycle

Declare capabilities such as spectators, teacher observation, pause, durable resume, reconnect and mid-match joining. Document intrinsic game participation rules separately. The app should only expose supported actions; required product capabilities that are absent remain integration blockers unless explicitly accepted by the operator.

Map game phases to platform lifecycle states without storing high-frequency phases in Postgres. Define start, pause, resume, completion, cancellation, disconnect and host departure. For action games, specify whether pause freezes simulation and match clocks, how inputs are neutralized, and how clients rebase after resume. At recess end the backend must apply the agreed stop/pause policy even if a browser ignores the frontend gate.

Teacher observation must be authorized and must not displace students or alter the match unless intended. Removing a player must also define whether rejoining is permitted. A spectator view must not accidentally reveal hidden information in games where that matters.

### App experience and social features

Engine connectivity alone is insufficient. Confirm these behaviors against existing app components and the operator's instructions:

- A waiting/start flow appropriate to the game, with authorized host controls and catalog participation rules that agree with supported modes. Do not assume every imported engine's original lobby matches the app's participation policy.
- Team assignment where applicable, exercised at different roster sizes. Declare host controls separately from privileged teacher/admin moderation; changing teams does not grant permission to remove people.
- When late joining requires waiting, show that status, notify the host, and provide any agreed assignment controls. Apply changes at a safe gameplay boundary; do not silently change ownership during a contested play. Define the fallback when the host makes no choice.
- Identify the local player and friends both in play and in the roster. Show host, disconnected/reserved players, waiting arrivals and teacher observers. Keep platform user identity separate from transport IDs and engine actor slots.
- Reuse the shared persisted chat, moderation and voice components/policy where applicable. Verify real message delivery and microphone audio separately from token issuance. Authorize chat/voice against current membership and eligibility, including observer restrictions.
- Use app theme components for both light and dark modes. Where fullscreen is provided, include the surrounding game controls, roster and social panels. Small-screen panels must leave navigation and close controls accessible.
- Test Hebrew in the actual renderer/font path, not only React menus. Include mixed Hebrew/Latin names, bidi isolation, escaping, long names and in-game labels. Layout RTL must not reverse driving, coordinates or teams.

React StrictMode, remounts and rapid re-entry can duplicate launch/token requests. Coalesce equivalent in-flight work where appropriate, keep backend authorization fresh, and use rate limits that allow normal lifecycle behavior. Close media connections that finish after their owner unmounts. For iframe bridges, validate origin, source, session and bridge generation; cleanup must address the captured old window and tolerate its initial `about:blank` navigation. Test retry creating a new frame, reconnect retaining the renderer, and complete worker/listener/media disposal.

### Simulation and result integrity

Validate message schemas, payload sizes, input rates, sequences and legal actions. Bound queues, catch-up work and room lifetime. Use server-owned clocks and randomness where results depend on them. Client prediction is presentation, not permission to award scores.

For client-authoritative imports, explicitly assess position/speed manipulation, checkpoint order, impossible finish times and forged scores. Do not describe a relay as authoritative merely because it owns the lobby. Decide what validation is required for the intended competitive use.

### Persistence and failure

Persist accepted results, lifecycle changes and necessary checkpoints at suitable boundaries or bounded intervals. Make result submission idempotent; do not accept browser-written rankings as authoritative. Define behavior on server restart: recover from a compatible checkpoint or close the session clearly. Reconnect support alone does not establish durable recovery.

Avoid claiming live matches survive rolling deployments unless that behavior has been implemented and tested. Snapshot storage needs a version and retention policy; do not assume full physics state is cheaply serializable.

Check the existing app's save/resume behavior before selecting a simpler policy. Closing every empty or restarted room is a product change when the app promises saved games. Use the actual contracts in [sessionPersistence.ts](../apps/game-server/src/sessionPersistence.ts), [lifecycle.ts](../apps/game-server/src/lifecycle.ts), and [useMyPausedGames.ts](../apps/web/src/hooks/useMyPausedGames.ts):

| Boundary | Expected platform mapping |
| --- | --- |
| Pause / final human leaves | Persist the resumable state in Supabase and retain the saved roster; distinguish it from currently connected players. Define memory-room cleanup separately. |
| Individual recess ends | Enforce that child's eligibility without stopping other eligible children. Define saving/cleanup when no eligible human remains, including simultaneous expiry. |
| Explicit stop | Mark completed, record `stopped_by`/`ended_at`, close joining and clear connected-player fields. Retain the session record. |
| Paused expiry | The current main server checks hourly for paused sessions whose `last_activity` is over 24 hours old, marks them completed, and excludes classroom drawing sessions (`class-draw-%`). This is a resumability rule, not database-row deletion. |

Keep `player_ids`/`player_names`, `connected_player_ids`/`connected_player_names`, host identity/display fields, status, timestamps and visibility consistent with their consumers. A durable save that is absent from the app's saved-games query is still a broken integration. Avoid refreshing paused expiry indefinitely through operational heartbeats. If a game uses an exact checkpoint deadline, document how it relates to the shared cleanup's last-activity deadline.

Describe recovery fidelity explicitly: exact live simulation pause, exact durable state restoration, and restoring logical progress at a safe restart boundary are separate capabilities. An empty room can release memory while its checkpoint remains in `game_sessions.game_state`. If checkpoints are signed, verification keys must remain available across restarts. Reauthorize returning users and honor roster removals instead of restoring obsolete membership blindly.

Checkpoint implementation pitfalls:

- Postgres `jsonb` reorders object keys. Use canonical serialization when signing structured snapshots, and simulate that round trip in tests.
- Do not place an entire growing checkpoint in a PostgREST compare-and-swap filter URL. Use bounded revision/allocation conditions and preserve protection against concurrent roster/status changes.
- Test recovery allocation/initialization failure, database write failure and moderation races. Preserve the last usable save until its replacement succeeds, and distinguish save attempts, successful writes and fallback to an older checkpoint in logs and UI.

### Operational visibility and release identity

Use the canonical observability utilities in the standalone service build too; optimized game assets and readable development logs are independent choices. Log accepted/rejected controls with the action, stable error code, correlation ID, session/room and relevant phase. Preserve bounded database error codes without logging credentials, query values or response bodies. Staff audit requests must distinguish requested actions from completed effects.

Record bounded client performance windows and meaningful stall incidents, with client/server builds, settings, focus/visibility, occupancy and run identity. Include frame-time tails, prediction active time/work, input backlog, latency/snapshot age and correction frequency/size; average FPS alone cannot explain playability. Keep chat text, credentials and voice audio out of performance logs. Document whether evidence is in process output, hosting logs or saved reports, and their actual retention; gitignored local reports are not a durable handoff by themselves.

Expose the build loaded by the running process at startup and through health/config endpoints. A manifest rewritten by a newer build is not proof that an old background process loaded that code. Check required backend capabilities before launching unsupported controls, report actionable errors, and detect occupied development ports. Restarting the web frontend alone does not restart another background service.

## Performance evaluation and reproducible handoff

For action games, prioritize smooth gameplay and small/infrequent corrections over average FPS. Compare the same gameplay intensity and graphics/settings. A foreground/background tab comparison can reflect browser throttling or OS scheduling rather than a networking improvement. Solo results do not establish multiplayer contact/correction quality. Avoid competing builds or unrelated load while collecting timing-sensitive measurements.

When a group of human testers is unavailable, automate representative sessions with progressively increasing participation and compare against available human baselines. Record which participants run server-side simulation, headless network clients or fully rendered browsers: these exercise different costs. Record the remaining physical-device/network coverage instead of making an unavailable manual group the only route to useful evidence. Software-rendered browser FPS is not target-device performance evidence.

Preserve a reviewable tested baseline before substantial integration changes, following the requested branch/commit workflow. Keep per-game defaults, game-specific defects and detailed run evidence in that game's handoff; this guide should retain reusable platform requirements and engineering lessons. Exclude credentials and generated artifacts; summarize conclusions from gitignored raw reports in durable documentation.

Prepare catalog changes as Supabase migrations that match existing game conventions, distinguishing preparation from authorization to apply them. If remote migration history includes a missing local file, investigate and recover its actual contents before proposing a repair; do not invent a placeholder or silently rewrite history.

## Hosting and scaling considerations

- **Railway:** reasonable initial home for a compatible Node action service alongside existing services. Size the deployment from measured workloads and scale as demand requires. Verify current WebSocket, region, timeout, resource and pricing behavior before deployment.
- **Production VPS:** consider when measured local latency, sustained CPU cost or native runtimes justify its operational burden. Account for monitoring, patching, backups, restart supervision and capacity. The existing Oracle lab VPS is an evaluation environment, not established production capacity.
- **Native hosting platforms:** preserve them where their runtime is a good fit. A relay/lifecycle workload and a continuously running physics simulation have different resource and billing needs.
- **Static clients:** can use existing frontend/static hosting where appropriate; match client and server releases and configure trusted origins and HTTPS/WSS correctly.

For stateful scaling, ordinary load balancing is insufficient. Matchmaking/allocation must route players to the process owning their room. Redis adapters or shared presence do not distribute one game's physics simulation or automatically provide durable match recovery. Split load by rooms/processes and measure CPU contention; separate services may still share physical infrastructure.

Railway currently documents no sticky-session support; Colyseus documents single-process room ownership and shared coordination for scaling. Recheck these facts when implementing. Do not enable replicas without an explicit allocation/routing design. Drain old processes by stopping new admissions, allowing active matches to finish or following an agreed shutdown policy, and expiring stale allocations.

Measure school-network latency before choosing a region or host. Establish target concurrency, peak recess bursts, room sizes, tick-time budget, memory per room and bandwidth. No concurrency guarantee follows from a framework choice or a successful solo playtest.

## Production acceptance matrix

| Area | Minimum scenarios/evidence |
| --- | --- |
| Access | Invalid/expired identity, wrong game/session, unauthorized role, gender mismatch, closed room, applicable game participation rules, revoked membership |
| Gameplay | Two physical devices, meaningful interactions/collisions, scoring, finish, restart; latency/disruption scenarios for action games |
| Lifecycle | Leave, host departure, refresh/reconnect, grace expiry, per-class and simultaneous recess ending, live pause/resume, explicit stop and expiry, teacher removal |
| Authority | Malformed/oversized messages, excessive inputs, forged movement/results and duplicate/stale submissions as applicable |
| Teachers | Authorized observation across varied rosters, permitted controls and rejected unauthorized controls |
| Persistence | Exactly-once effect for retried results, checkpoint compatibility/expiry, saved-game discovery, empty-room release/reopen, fresh-service recovery, failed save/restore and concurrent moderation |
| Client | Target devices and controls, lobby/participant controls, Hebrew/RTL names and labels, themed UI, fullscreen/roster, StrictMode/remounts, retry and navigation cleanup |
| Social | Persisted chat/moderation, scoped voice tokens, duplicate-request tolerance, actual microphone/audio delivery and media cleanup |
| Capacity | Increasing concurrent rooms/players, peak joins, tick overruns/event-loop delay, CPU/memory, scaling behavior and cleanup |
| Operations | Health/readiness, logs correlated by session/room/build, deployment drain, matching releases and rollback |

Reuse upstream tests and add meaningful checks at integration boundaries. Do not create tests that merely mirror adapter implementation. Record commands actually run, build identifiers, test conditions and human evidence; distinguish planned checks from completed checks.

## Per-game handoff template

Store this in the game's integration documentation, linked from its `LAB.md` where applicable:

```text
Game / owner:
Source URL / pinned revision / license and asset notices:
Baseline and integrated release identifiers:
Client/server toolchains and reproducible commands:
Runtime decision / alternatives / hosting rationale:
Simulation and result authority / known trust gaps:
Platform adapter location / upstream update strategy:
Session-to-room allocation and routing:
Admission and reconnect credentials:
Capabilities / unsupported required behavior:
Lifecycle / recess / pause / host-departure policies:
Persistence / restart recovery / result idempotency:
Save location / recovery fidelity / expiry clock / cleanup owner:
Lobby / participant controls / late-arrival policies:
Chat / voice / roster / fullscreen / theme:
Devices / controls / localization:
Ports / endpoints / configuration names (no secret values):
Workload measurements / scaling needs / target audience:
Checks run / cross-device human evidence / untested cases:
Deploy / drain / rollback / health and logs procedures:
Loaded-build check / root dev command / service restart requirements:
Telemetry fields / evidence paths and retention / matched performance comparisons:
Outstanding work / recommendation / approval or scope needed:
```

## Related guidance and reference sources

- [`ARCHITECTURE.md`](../ARCHITECTURE.md): implemented platform architecture; confirm against source.
- [`multiplayer-experiment-workflow.md`](multiplayer-experiment-workflow.md): Oracle dev VPS evaluation and playtest hosting only.
- [`HARDENING.md`](HARDENING.md), [`LOGGING.md`](LOGGING.md): production and observability requirements.
- [`adr/001-websocket-socket-io.md`](adr/001-websocket-socket-io.md): existing Socket.io decision.
- [Colyseus scaling](https://docs.colyseus.io/scalability): room ownership and multi-process coordination.
- [Railway performance and replicas](https://docs.railway.com/deployments/optimize-performance): verify current routing constraints before scaling.
- [Cloudflare Durable Objects WebSocket hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/): idle WebSocket behavior; do not infer continuous simulation costs from idle behavior.

Read applicable game-addition and compiled-game import skills when implementation begins. The local multiplayer-lab skill applies only to its specified dev VPS; it is not a production hosting policy.
