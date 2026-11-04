# Persistence and recovery

## Saved state

A private schema-1 checkpoint captures world identity, seed, generator/content/
engine compatibility, bounds, room tick/pause, epochs, spawn, native player poses,
inventories, crafting grids, chests, vitals, drops, TNT and changed terrain.
Capture is synchronous at a worker message boundary; asynchronous storage runs in
the gateway. The seed and sparse edits regenerate terrain instead of storing a map.

Checkpoints contain no sockets, held input, action queues, replay ledgers, mining,
open container viewers, JWTs, roles or capability grants. Rejoining requires fresh
school admission, a new input epoch and collision readiness. Saved timers and
partial fall history earn no offline time. Primed TNT owners require fresh policy
resolution on restore and during simulation.

Reconstruction validates exact schemas, finite bodies, stack ownership, typed
slots, chest terrain/incarnations, drop IDs/order/timers and column revisions
before publishing a player. Replay failure removes the partially loaded native
column while preserving metadata for retry. Revision exhaustion rejects the whole
mutation rather than wrapping or partially clearing a blast.

## Compatibility

`src/shared/checkpoint-content.ts`, `checkpoint-engine.ts` and `world-bounds.ts`
list reviewed directional transitions. Runtime-only changes can load compatible
older saves; content, engine and generator changes need explicit review.
Historical centered finite worlds expand to streamed bounds while retaining their
seed and progress. The additive biome-query engine accepts its reviewed predecessor.
That does not imply reverse compatibility with older deployment binaries.

A missing, corrupt or incompatible committed checkpoint rejects startup. Recovery
never silently replaces it with a fresh world. The prior-engine save and provenance
under `tests/fixtures` are regression inputs and remain part of the repository.

## Objects and ownership

Changed columns are content-addressed JSON objects. A coherent manifest contains
private gameplay state and references the complete object graph, reusing unchanged
column hashes. Reads verify namespace, length and SHA-256 before decoding.
Uploads are create-only; duplicate objects are accepted only after byte verification.
Upload success alone never acknowledges saving.

Metadata transactions lock the world and check database time, owner UUID, owner
epoch, unexpired lease and prior sequence before committing the pointer and graph.
Identical commit retries are idempotent. A lost reply retries the same graph before
capturing a newer snapshot. Ownership deadlines use a monotonic clock with a safety
margin; both gateway and worker enforce them independently. Provider outages never
extend an unconfirmed lease, and an old owner cannot release its replacement.

The supervisor retains one captured/unconfirmed snapshot and one coalesced pending
save request. IO concurrency bounds work independently of collection size. There
are no player, room, chest, drop or TNT admission caps.

## Save semantics

| Trigger | Behavior |
| --- | --- |
| Healthy autosave | Runs every 15 seconds; only a committed pointer clears unsaved feedback |
| Explicit pause | Freezes immediately; successful save receipt follows the paused checkpoint commit |
| Resume | Changes running intent; makes no new-save claim |
| Explicit session end | Terminal and skips the final checkpoint; earlier/in-flight saves are not undone |
| Last-player departure | Normal retirement saves a pause, finalizes presence, stops the worker and releases ownership |
| Graceful service drain | Reports save/projection failure instead of acknowledging an unsuccessful drain |
| Crash or forced shutdown | Restores the last committed pointer; newer work can be lost |

The normal retirement path remains retryable if save or final presence fails.
A racing join waits for retirement and obtains fresh ownership. A completed school
session cannot be revived from an older saved pause. Forced termination can leave
public presence visible only until its explicit expiry.

## Supabase adapter and retention

`apps/voxel-server` supplies the private `voxel-checkpoints` bucket and transactional
metadata RPCs. Browser roles cannot invoke those service mutations or access private
objects. New worlds reserve unique seeds before the first checkpoint.

Retention keeps the active checkpoint and a 24-hour history. Garbage collection
locks/rechecks references, claims bounded deletion work, deletes Storage bytes and
then finalizes metadata. Failed deletions are retryable; active graphs and in-flight
uploads are protected. Session deletion retains orphan addresses for cleanup.
See [service APIs](../../../apps/voxel-server/docs/school-api.md) and
[deployment/migrations](../../../docs/voxel-deployment.md).
