# Current staging candidate evidence

Game build `c293fe5e2511` passes the actual React/native/local-PostgreSQL/configured
LiveKit browser flow with generated microphone audio. It checks near/distant
spatial behavior, hidden staff, lost committed mute reply with same-ID retry,
provider-confirmed banned identity removal, terminal disposal, trusted Exit and
two repeated mounts. All owned resources close. The single unique SFU room is
deleted and absence verified; the owned private database stops.

Auth/PostgREST/Storage are fixtures. This does not combine actual hosted school
Auth with SFU, prove physical-PC performance, or deploy staging. The earlier
authorized hosted school/recovery archive independently covers real Auth/Storage.
The exact compiled React fixture is preserved; the base commit identifies the
app source tested. Generated fixture identities/tokens are local test data.

The clean-checkout release restore tests and exact staging web build command
also pass. Hosting container execution still awaits CI or the user's Railway
build. User-directed next step: merge to dev/staging, manual hosting setup and
functional staging checks, then PR to main. No production switch is performed.
