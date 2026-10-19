# Retaining practice opponents in the integrated game

Implemented for app mode in `server/src/platform/bot-controller.ts` and
`playground-room.ts`: room-owned typed controllers, explicit human/bot metadata,
eight stable car slots, kickoff admission and reconnect reservation. Bots are
opt-in through the app waiting room; empty slots are disabled in physics and
omitted from rendering and prediction. The
standalone public practice buttons retain their existing socket-driver service
for comparison. See [app integration](APP-INTEGRATION.md).

The 2026-10-17 human playtest found one/seven-bot practice enjoyable and playable.
Keep that experience. Its simple ball-chasing, steering, boost, powerslide,
periodic jump and stuck-reverse behavior already exists in `scripts/bot-driver.mjs`.
No new AI research is needed to retain the tested behavior.

## Current implementation

A supervised process discovers opt-in practice rooms and joins one/seven ordinary
Colyseus clients over loopback. Bots occupy normal balanced roster slots, send
normal sequenced controls and use the authoritative physics. They do not run
their own prediction worlds. Human host admission precedes discovery, and the
supervisor cleans up when all humans leave. A room still has at most eight cars.

This is useful for standalone playtests, but makes permanent game operation depend
on an extra service and sends each bot full replicated snapshots. The last
functional-check sample used about 11% of one core for that process, including
one/eight-player loading and cleanup. This is not a fixed per-room CPU estimate.

## Preferred integration work

1. Move the tested driver into a typed engine module, preserving behavior first.
   The authoritative room supplies each bot with state and generates at most one
   control command per fixed input tick. Reuse the normal control validation,
   application ordering and physics. Remove the extra bot sockets/process from
   the permanent path. This saves redundant snapshot consumers, not the physics
   cost of simulating eight cars.
2. Represent bots explicitly in the server-owned roster, with stable IDs and a
   controller kind. Names are display values, never evidence of bot identity.
   Preserve capacity/team policies; only humans can host or use room controls.
   The server authorizes bot creation/removal under the eventual app room policy.
3. Keep clear practice options and balanced teams. The first version can retain
   the tested one/seven-bot presets. Allow friends to take bot seats in the lobby
   before starting. Mid-match replacement, difficulty levels and sophisticated
   team tactics are separate enhancements, not prerequisites for keeping practice.
4. Tie the driver to room/session lifecycle: countdowns and pauses neutralize
   controls; goals/kickoffs, restarts and disposals invalidate stale work; zero
   humans cleans up the room. Respect the app's identity, authorized membership,
   teacher controls and reconnect policy when those integration seams exist.
5. Report humans/bots separately in telemetry while retaining total physical car
   count. Localized bot labels must not change identity or be inferred from names.
   Hebrew/mixed-direction user names use browser text with isolation.

## Acceptance checks

- One human plus one/seven bots retains the current play experience and bounded
  queues, with ordinary authoritative goals, boosts, jumps and kickoff behavior.
- Human host remains human; teams/capacity stay valid; a lobby friend can replace
  a bot without consuming an extra physical slot or taking another user's identity.
- Pause/resume, match restart, host/human departure and disposal leave no input
  timers, bot actors, transports or stale callbacks.
- Compare current socket drivers with room-owned drivers using the existing
  two/eight-player harness, fixed behavior and matching conditions. Validate actual
  contacts/goals and client prediction/corrections; measure CPU rather than assume
  that removing sockets makes eight-car physics cheaper.
- Retain real remote-human network testing. Seven loopback bots exercise eight-car
  simulation/rendering, but do not reproduce seven remote connections' latency,
  jitter or human control changes.

This is a contained engine/roster/lifecycle task within the larger app integration.
The integration itself is not implemented by this plan. The standalone practice
service remains available until its replacement passes the same scenarios.
