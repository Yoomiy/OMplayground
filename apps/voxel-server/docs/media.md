# Voxel voice

Voxel uses the same LiveKit token lifecycle as the other games. The browser posts
its school bearer token and room ID to `/api/voxel/voice-token`. The service verifies
the account and requires an existing game connection, then returns a two-hour
LiveKit JWT and `LIVEKIT_URL`. Only microphone publication is granted; staff in
observer mode remain hidden and listen-only. Rooms remain scoped to the world
and its owner epoch.

The browser connects directly to LiveKit. LiveKit owns token refresh and SDK
reconnection. An SDK reconnect preserves the current room and microphone; only
a complete disconnect requires another application token. The voxel server does
not proxy signaling, run a voice worker, or renew voice permissions against
Supabase. Its ordinary gameplay authorization is independent of voice.

There are no voxel voice permission-revocation or teacher-mute APIs. The earlier
`/voxel-media/*`, `/api/voxel/voice-ticket`, `/api/voxel/media-state`, and
`/api/voxel/media-moderate` routes are removed. Historical SQL migrations remain
installed but their media tables/functions are unused, and the media schema is
no longer a startup dependency. No database migration or world reset is needed.

`LIVEKIT_URL` must be reachable from browsers, as it is for the other games.
`LIVEKIT_API_SECRET` stays on the backend. Returning a participant JWT is part of
the normal LiveKit connection flow. Provider room deletion or participant removal
can still be performed through LiveKit's administrative APIs; token TTL does not
act as a deadline on an ongoing call.

Proximity subscriptions, spatial audio, occlusion, microphone selection and local
capture controls stay in the client. Losing game readiness stops local voice;
regaining readiness automatically rejoins for players. Session end and component
unmount release the room, microphone, audio graph, timers and media elements.

`apps/web/tools/voxel-voice-session-browser.ts` qualifies direct audio in an
isolated SFU room using generated microphones, fixture game poses and fixture
admission. It checks proximity subscriptions, hidden staff, SDK signaling
reconnection after the initial short test token expires, microphone continuity,
no additional application token requests during recovery, and teardown. Run with
`VOXEL_TEST_LIVEKIT=1` and explicit test LiveKit credentials. This fixture does not
qualify production networking or physical microphones.
