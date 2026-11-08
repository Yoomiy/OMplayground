# Embedded game recovery and diagnostics

Rocket Arena and Wobble are separate services embedded into the React app. A connection reset during iframe navigation can display a browser error document without throwing a React error. An iframe's load event also fires for failed loads, so it cannot confirm readiness ([browser behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#error_and_load_event_behavior)).

The parent now checks the game's configuration before mounting the frame. The shared `embeddedGameRecovery` controller bounds HTTP requests to 10 seconds, frame readiness to 25 seconds and joining to 20 seconds. The frame must send an origin/source/attempt-checked ready message and then a valid game state. Rocket keeps its canvas covered until that state arrives; Wobble retains its opaque app overlay. Startup failures remove the failed frame and offer Retry inside the game view. Navigation away cancels the attempt. Explicit retries create fresh frame/attempt IDs without reloading the page or creating a new platform room.

The parent sends startup, failure, recovery and operation diagnostics through the main game-server telemetry endpoint, independently of the embedded service. Logs include the game, platform session, attempt ID, service origin, stage, elapsed time, safe error code, HTTP status when available and the service response correlation ID. Tokens and reservation contents are excluded. Retry-specific deduplication keys keep separate user attempts visible while retaining ordinary telemetry noise suppression. Errors before requests reach a service can only be reported by the parent; a stopped service cannot log a request it never received.

Both embedded services expose their response correlation header and log missing client assets and static response stream failures. A stream error after response headers have been sent may still reset the HTTP response; the server now records why instead of silently destroying it.

Board-game voice mounts after successful room admission and unmounts on disconnect, so an initial failed room join no longer produces a secondary voice-token error. Returned room-creation database errors are also forwarded to the game server rather than appearing only as inline UI feedback.

## Development checks

`npm run dev:app` starts the board, voxel and classroom services; Rocket and Wobble have separate commands:

```sh
npm run dev:rocket
npm run dev:wobble
```

Both currently default to port 3000 and are documented as separate development services. To run them together, use different service ports and set the matching `VITE_ROCKET_SERVICE_URL` / `VITE_WOBBLE_SERVICE_URL`; restart Vite after changing its environment. A port-forward reset, an unavailable service and an incompatible service on the same port are distinct failures. Check the dedicated service's `/health` and `/api/rocket/config` or `/api/wobble/config`, then compare its correlation ID with the parent failure log. A config-stage failure precedes iframe loading and authenticated launch; a frame-stage timeout means config succeeded but the embedded client never became ready.

The reported Firefox `about:neterror` / `chrome://...` warning comes from the browser error document. The original reset's cause was not established from the supplied logs. The quoted voice error used a different session and came from the board-game container. Inbox Realtime runs independently of room creation; its CHANNEL_ERROR may share a network cause, but does not establish one.

Focused verification:

```sh
npm test -w @playground/web -- src/lib/embeddedGameRecovery.test.ts src/utils/telemetry.test.ts
node apps/web/tools/embedded-game-recovery-browser.mjs
```

The browser check uses local fixture services and a stub frame. It covers failed config requests, reset frame responses, separate retries, successful Rocket recovery, no premature launch and keeping the same app document. It does not replay physics or full multiplayer matches.
