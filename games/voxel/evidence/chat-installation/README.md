# Read-only chat installation verification

The user reported the seventh migration applied. At 2026-10-26 14:56 UTC all seven
voxel schemas and the private bucket pass read-only readiness. Linked history
lists 001–007; all five chat function bodies/grants, two private RLS tables and
the valid visible-history index match the frozen applied file. The private chat
authorization helper remains inaccessible even to service-role callers.

Guarded loopback startup of packaged chat release `bedd62f9b37b` permits only seven
status RPCs, passes health/readiness, allocates zero rooms and closes. No agent
hosted schema/object/application-row writes or deployment occurred. The complete
chat archive remains immutable, including its correct earlier missing-schema
observation. Current service-policy inputs and all twelve packaged release bytes
still match that archive; subsequent voice-client work is outside this startup
qualification. This does not establish hosted Auth/gameplay/chat mutation,
checkpoint recovery, LiveKit enforcement or hardware qualification.
