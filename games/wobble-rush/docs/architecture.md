# Runtime architecture

The React container obtains a short-lived launch ticket using the app’s Supabase identity. The embedded client attaches to `/app-ws/:sessionId` with that ticket. The native service rechecks session membership and role, owns the room, and provides explicit capabilities for the app UI. No anonymous room creation or transform relay is exposed.

Players send bounded, sequenced input commands, never positions or finish times. The server advances the shared actor world at 60 Hz and broadcasts authoritative frames at 15 Hz. Course obstacles, player contacts and NPCs run in the same deterministic world; the engine decides checkpoints, finishes and cup standings.

The playing client predicts the full actor world using shared movement/collision code and scheduled inputs. Authoritative acknowledgement corrects simulation history; visual correction remains separate and cannot blend through colliders or other runners. Observer teachers and pending spectators use a 100 ms buffered timeline, presenting runners and moving obstacles at the same world time. Rendering has its own clock; simulation uses the fixed-step pump.

Admission, role capabilities and social moderation belong to the platform layer. A teacher who is only observing cannot start, advance, pause, resume, end or remove players. A teacher admitted as a player has the normal player-host permissions. Administrator management remains a separate explicit capability. Clients cannot bypass these checks by sending hidden controls.

Checkpoints retain authoritative race state, membership and cup state. HMAC verification, content/protocol versions and a stable server secret protect restoration. The Supabase gateway supplies durable metadata and ownership leases; one process owns each active room. Bounded input queues, socket backpressure, reconnection grace and shutdown draining protect the service lifecycle.

Course definitions and deterministic mechanics live in `src/shared`. Add geometry through the course builders/catalog and verify classic/remix route reachability, NPC finishes and trajectory changes. Cosmetic labels remain separate from collision geometry. Player-facing menus, game discovery, saved games, chat and voice use the app’s existing flows.
