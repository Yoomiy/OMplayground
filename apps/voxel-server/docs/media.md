# Direct LiveKit voice

`POST /api/voxel/voice-token` accepts `{room}` and the school bearer token.
The service verifies the active account and an existing current game connection,
then issues a two-hour microphone-only LiveKit JWT and the configured endpoint.
The SFU room is scoped to world identity and owner epoch. Staff observers are
hidden and listen-only. Data publication and client metadata updates are denied.

The browser connects directly to LiveKit. The SDK owns token refresh and reconnect;
signaling recovery keeps the room and microphone. A complete disconnect uses fresh
application admission. Token TTL is not a deadline on an ongoing call. The endpoint
must be reachable from the browser and support the deployment's WebRTC paths.

The client owns proximity subscriptions, occlusion, spatial audio and local capture
controls. Game readiness loss, session end and unmount release local voice resources.
These client lifecycle rules do not provide provider-side revocation or teacher mute
APIs. Gameplay policy remains independent of voice; SFU administration uses LiveKit's
own APIs. The old custom signaling worker, ticket/proxy routes and media-policy
renewal are removed. Their historical SQL migration is not a startup dependency.

`apps/web/tools/voxel-voice-session-browser.ts` tests direct media using an explicitly
selected test SFU, generated microphones and fixture poses/admission. See
[testing](../../../games/voxel/docs/testing.md) for opt-in settings and scope.
