# Multiplayer experiment workflow — this dev VPS only

> Environment-specific reference for the Oracle dev VPS at `84.13.78.187` (`/home/ubuntu/OMplayground`). Apply this workflow only when working on that environment. It is not a repository-wide hosting policy, a production deployment guide, or configuration for GitHub, Vercel or Railway. Other environments must use their own deployment instructions.

`ops/` contains local hosting files and is excluded by the shared `.gitignore`. Those files are not delivered by a Git checkout; references to them below apply only on this VPS.

Evaluate and develop multiplayer games independently, publish them for cross-device playtests, then integrate selected games into Playground. The shared hosting is ready; individual games still need reproducible deployments.

## Current hosting — verified 2026-10-12

| Item | State |
| --- | --- |
| VPS | Oracle ARM64, Ubuntu 24.04, Jerusalem (`il-jerusalem-1`) |
| Public IP | `84.13.78.187`, confirmed stable by the operator |
| Capacity | 2 CPU cores, roughly 11 GiB RAM; 31 GiB free disk at inspection |
| DNS | Porkbun nameservers for `play-ormenachem.com` |
| Records | A `labs` and A `*.labs` → `84.13.78.187`; no AAAA on tested lab hostnames |
| Public entry | [labs.play-ormenachem.com](https://labs.play-ormenachem.com), readiness response |
| Web server | Caddy 2.11.7, official stable apt repository, enabled system service |
| HTTPS | Valid Let's Encrypt certificate; HTTP redirects to HTTPS |
| Firewall | TCP 80/443 allowed in persistent host IPv4 rules; operator configured Oracle ingress |
| Source config | `ops/labs/Caddyfile` (local, ignored) |
| Installed config | `/etc/caddy/Caddyfile` |

The operator verified the public readiness page in a browser. External ACME validation and HTTPS checks succeeded. This establishes hosting reachability; it does not establish game functionality or multiplayer capacity.

Use `https://<slug>.labs.play-ormenachem.com` for each game. Wildcard DNS routes names to this VPS, but each published game needs an explicit Caddy site block and its own certificate. No wildcard certificate, Porkbun API key or nameserver migration is needed. Keep the root domain and other subdomains outside this workflow.

The chosen stack is **Porkbun DNS + Caddy + persistent systemd backend services + separate release directories**. Caddy serves compiled static clients directly and proxies multiplayer endpoints to loopback backends. Keep each game's native multiplayer stack during evaluation. Containers are optional for incompatible dependencies; temporary tunnels are optional for short-lived tests. Public playtests do not use the forwarded ports.

## Experiment boundaries

Keep each game under `experiments/<slug>/`, with its own dependencies, lockfile, environment example and `LAB.md`. Experiments stay outside the root npm workspaces until integration. Preserve upstream licenses and record the source URL and pinned revision.

An experiment runs without the Playground frontend, catalog, login or production credentials. If it needs a database or identity provider, use a dedicated test environment. Do not add app registry entries, catalog migrations or production session dependencies during standalone evaluation unless the user explicitly changes scope.

Agents can retain their tooling. The common contract is reproducible commands, port ownership, test evidence and a handoff. Check `git status` before edits; do not commit another agent's unfinished files. Independent worktrees isolate code, but share VPS ports and services.

## Development and published playtests

| Mode | Purpose | Operation |
| --- | --- | --- |
| Development | Live edits and debugging | Forwarded 5173 or 3000, explicitly assigned; own backend |
| Published playtest | Shared URL and repeatable evaluation | Matching built client/backend release, explicit Caddy hostname, supervised backend |

A tester's browser derives its endpoint from the page URL (HTTPS/WSS). `localhost` in browser code points to the tester's machine. Use a same-origin multiplayer route and verify both HTTP matchmaking and WebSockets. Preserve the game's required path semantics: `/game` may need stripping, whereas `/socket.io` commonly needs preserving.

Published releases must not read a changing development source tree. Keep development and playtest backends separate if both are running. Deploy matching client/backend outputs together and record the tested revision or an identifiable source snapshot. Backend restarts may terminate rooms.

## Ports and existing processes

App reservations: 8080 for the main game server, 8081 for the voxel server. Forwarded 5173/3000 are development entry points. Choose unoccupied loopback backend ports in the 19000–19999 range for new published labs; record allocations before launching. Caddy uses public 80/443, so a static client needs no additional listener. Full HTTP applications may need another loopback port.

Rocket Arena's existing configuration defaults and running overrides differ:

| Item | Observed state on 2026-10-12 |
| --- | --- |
| Source | `experiments/rocket-arena-lab/` |
| Default development | client 5173, backend 2567 |
| Default preview | client 8080 |
| Running test backend | `127.0.0.1:2568` |
| Running test client | `127.0.0.1:8081`, Vite preview |
| Public test | Temporary Cloudflare URL recorded in its tunnel log |
| User services | `rocket-arena-test-server`, `rocket-arena-test-web`, `rocket-arena-test-tunnel` |
| Service durability | Transient units; `Restart=on-failure`; user lingering enabled |
| Stable game hostname | `rocket.labs.play-ormenachem.com` resolves to VPS; no Caddy game route deployed by this workflow yet |

Reinspect listeners and service definitions before using this inventory. Do not kill an unfamiliar process or replace another agent's service to free a port. Migrate the preview off 8081 as part of an agreed release deployment. `PORT` and `LAB_SERVER_PORT` must agree when using that lab's Vite proxy. Its full development and preview commands share a backend by default.

## Publishing a game

1. **Inspect:** read `LAB.md`, native scripts, networking config and license. Check `ss -ltnp`, user/system services and Git status. Select the hostname, owner, backend port and release identifier.
2. **Build separately:** assemble an identifiable source snapshot under `/srv/playground-labs/<slug>/releases/<release-id>/`. Install from its lockfile, run relevant checks and build. Retain its source/runtime dependencies as needed; do not assume a backend bundle contains them. Preserve the existing release for rollback.
3. **Supervise the backend:** install a persistent systemd unit from a repository-maintained definition. Set explicit runtime path, working directory, loopback host/port, environment and restart policy. Node is installed through fnm: do not rely on the interactive shell PATH. Keep credentials outside the repository. Use journal logs and document the actual unit name. User lingering is already enabled if choosing user units.
4. **Serve the release:** make built client assets readable by Caddy without giving Caddy write access to source. Use a per-game `current` release link. Add an explicit hostname block to the maintained Caddy source; inspect installed config first so unrelated changes are preserved.
5. **Activate together:** switch to the matching client/backend release and restart that game's service during an announced playtest gap. Validate and reload Caddy using the local hosting operations guide at `ops/labs/README.md`. Confirm backend health and inspect logs. If activation fails, restore the previous matching release and stop retrying the same failed deployment until its cause is understood.
6. **Verify:** HTTPS certificate, page/assets, HTTP matchmaking, actual WebSocket connection and two-client gameplay. Then test two physical devices on different networks. A page returning 200 alone is not multiplayer validation.
7. **Handoff:** record actual URL, release, ports, units, commands, evidence and remaining limitations in `LAB.md`; update the allocation inventory when it changes.

The following is an **example**, not a deployed Rocket Arena route. Replace the backend port and release path with actual allocations:

```caddyfile
rocket.labs.play-ormenachem.com {
    handle_path /game/* {
        reverse_proxy 127.0.0.1:19001
    }
    handle {
        root * /srv/playground-labs/rocket/current/client/dist
        try_files {path} /index.html
        file_server
    }
}
```

`handle_path` strips `/game`, matching Rocket Arena's current proxy. The browser must use `/game` on this public origin. Games using a native path such as `/socket.io/*` should normally use `handle` to preserve it. Games whose backend serves the whole application can use a full-site reverse proxy instead of a static file handler. See [Caddy path handling](https://caddyserver.com/docs/caddyfile/directives/handle_path) and [WebSocket proxy support](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

For systemd user units, install persistent definitions, run `systemctl --user daemon-reload`, then `systemctl --user enable --now <actual-unit>`. Transient `systemd-run` units are useful for temporary tests, not a reboot deployment. A game that only needs a backend has no separate web service: Caddy serves its client.

Rollback restores the previous matching client/backend release, restarts that backend and verifies the hostname again. Stop/unpublish only the requested game: stop its service and remove its Caddy block, then validate/reload. Leave shared DNS, Caddy and other games running.

## Experiment handoff and testing

Each `LAB.md` includes:

- Purpose, source, upstream revision, license and modifications.
- Runtime/toolchain, exact install/dev/check/build commands and environment example.
- Owner, dev/playtest ports, networking paths and supported devices/controls.
- Public URL, release identifier, room creation/join steps and player limits.
- Actual start/status/logs/restart/stop commands and rollback instructions.
- Automated checks actually run, human test results and known limitations.
- Integration dependencies and recommendation: continue, integrate or archive.

Use anonymous test identities and room codes where supported. Keep experiment data separate from app data. For an unattended build, document room/player limits and cleanup behavior.

Evaluate in stages:

1. Upstream baseline where practical, then two browser contexts for room join, synchronized actions, scoring, finish and restart.
2. Two physical devices on different networks; record input response, synchronization, latency, browser/device details and server CPU/memory. Two CPU cores are a practical constraint for simultaneous physics simulations.
3. Refresh, disconnect/rejoin, host departure, full rooms and invalid codes. Add controlled latency/disruption tests where timing matters; record unsupported behavior honestly.
4. Decide whether gameplay quality, networking, licensing and integration cost justify proceeding.

Use a feedback log containing date, release, devices/networks, player count, scenario, observation, severity and next action. Keep gameplay feedback, connection defects and integration gaps distinguishable. Report only evidence actually collected.

## Integration after evaluation

A reproducible multiplayer loop and a real cross-device playtest make an experiment ready for integration planning. App readiness additionally requires Playground identity, authorized room membership, session lifecycle, recess/pause policy, reconnect/leave behavior, teacher controls, Hebrew/RTL, device support and observability.

Choose whether the game adapts to the existing Socket.io server or remains a separate service. Integrate on a separate branch in small steps, adding registry entries and catalog migrations at that stage. Keep the standalone comparison release until the integrated version passes the same scenarios.

## Infrastructure maintenance

Normal game publishing needs no new DNS or firewall rule: wildcard DNS and TCP 80/443 are already configured. Keep backends on loopback. The persistent IPv4 rules live at `/etc/iptables/rules.v4`; preserve SSH and Oracle InstanceServices rules. Do not flush the firewall or introduce a second manager for routine deployment. Do not add AAAA records without verified public IPv6.

Caddy installation and certificate maintenance follow [official Caddy guidance](https://caddyserver.com/docs/install). DNS administration follows [Porkbun's subdomain guide](https://kb.porkbun.com/article/200-how-to-create-a-subdomain). The operator configured Oracle stateful ingress rules for TCP 80/443 from `0.0.0.0/0`; [Oracle security lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm) remain a separate layer from the host firewall.

Future agents can use [`playground-multiplayer-lab`](../.agents/skills/playground-multiplayer-lab/SKILL.md) for experiment work and publishing handoffs. The skill supports this workflow; it does not itself authorize publishing, restarting unrelated services or app integration.
