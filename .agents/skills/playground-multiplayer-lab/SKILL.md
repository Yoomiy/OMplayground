---
name: playground-multiplayer-lab
description: Build, evaluate, publish, or maintain standalone multiplayer game labs only on the Oracle dev VPS at 84.13.78.187 in /home/ubuntu/OMplayground. Use for that environment’s cross-device playtests and labs hostnames; not for other checkouts, GitHub deployments, production hosting, or ordinary app integration.
---

# Playground multiplayer labs — this dev VPS only

This skill applies only to the Oracle dev VPS at `84.13.78.187`, with deployment checkout `/home/ubuntu/OMplayground`. Confirm the host and checkout before following its operational instructions. A clone containing this skill is not evidence that it runs on this VPS. In other environments, use their own workflow; do not install this hosting stack or change deployment settings based on this skill.

Keep game evaluation independent of the app, with reproducible development and public playtest builds. Honor the user's scope: experiment implementation does not automatically authorize public publishing or app integration. Continue already-authorized work without asking again.

## Read the right operational context

Resolve paths from the repository root; do not assume an agent's checkout is the deployment checkout.

- Read [the workflow](../../../docs/multiplayer-experiment-workflow.md) for experiment boundaries, current hosting, ports, release activation and evaluation criteria.
- For publishing or hosting changes on this VPS, also read local `ops/labs/README.md` and inspect local `ops/labs/Caddyfile`, the installed `/etc/caddy/Caddyfile`, actual listeners and services. `ops/` is ignored by Git and absent from ordinary clones. If these local files are missing, inspect the host configuration before reconstructing anything; do not assume the documented setup exists. Inventory in documents is dated evidence, not proof of current state.
- Read the target game's `LAB.md`, scripts, networking configuration and upstream license before choosing commands.

## Standalone implementation

Use `experiments/<slug>/` with independent dependencies/lockfile and an environment example. Keep experiments outside root npm workspaces. Preserve upstream provenance and licenses. Use native netcode while evaluating; defer app login, catalog migrations, registry entries and production data until integration is requested.

Check Git status and port ownership before changing files or launching processes. Other agents share the VPS, even across worktrees. Preserve unrelated unfinished work and running services. App ports 8080/8081 are reserved; forwarded 5173/3000 are explicitly assigned dev slots. For new playtest backends choose an available loopback port in 19000–19999 and record it. Caddy serves static clients without a separate web port.

## Public playtests on this VPS

The established default is direct Caddy hosting at `<slug>.labs.play-ormenachem.com`, backed by Porkbun wildcard DNS pointing to `84.13.78.187`. Caddy and inbound TCP 80/443 are already configured. Ordinary game publishing needs an explicit hostname block and backend service, not new DNS, firewall rules or tunnels. Recheck these facts if the environment changed.

Publish an identifiable source snapshot to a separate release directory. Build matching client/backend outputs; retain runtime dependencies where needed. Use persistent systemd service definitions with explicit executable path, working directory, loopback binding and environment. fnm's interactive PATH is not available by default in services. Transient units are temporary tests, not reboot recovery.

Caddy should serve built assets and proxy HTTP/WebSocket game routes on the same hostname. Browser endpoints use the page origin, never the tester's `localhost`. Inspect path semantics: Rocket Arena strips `/game`; Socket.io normally preserves `/socket.io`. Preserve unrelated site blocks, validate before installation, and reload Caddy only after validation passes. Follow the runbook for release switch and rollback; avoid serving active development files as a stable playtest build.

Keep the previous matching release. If activation fails, restore it, verify recovery, and diagnose before repeating mutations. Stop or unpublish only the requested game's service/route. Shared hosting, DNS and other games stay available.

## Evidence and handoff

Verify assets, matchmaking and an actual multiplayer WebSocket session. Check synchronized actions, scores and match lifecycle with two clients. Distinguish smoke testing in browser contexts from two physical devices on different networks. Measure CPU and memory during playtests; this VPS has two CPU cores, so idle RAM does not prove multiplayer capacity.

Write or update `LAB.md` with source/revision/license, exact commands, environment, ports and owner, URL/release, room joining, controls/device support, service/log/stop/rollback commands, checks actually run and limitations. Record feedback by release. If physical-device testing needs the user, finish independent checks and provide a concrete test scenario; do not claim that testing passed.

Report the usable URL when published, evidence collected and remaining work. Integration planning must account for Playground identity, room authorization, lifecycle/recess/pause, reconnect, teacher controls, Hebrew/RTL and observability; do not silently turn a lab into an app game.
