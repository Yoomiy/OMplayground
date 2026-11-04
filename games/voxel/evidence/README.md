# Voxel qualification records

This PR tree retains the written findings, structured result/audit reports and the
historical source dependencies still imported by `tools/benchmark-survival.ts`.
Repeated full application snapshots, old compiled client/server/React bundles,
compressed source copies, lock/build inventories, screenshots, profiles and raw
console logs are retained in the information branch rather than this PR tree.

The complete archive is preserved on **`dev/voxel-runtime-rewrite`**. The exact
pre-trim snapshot is **`f19bccfa19797d57ec7243fe17fa85ebf7f2aea7`**. No history is rewritten by this cleanup.

## Current implementation and historical evidence

The implementation at the split includes the test repairs and public movement
pose correction in `f19bccf`. Its matched game release is `ea5aa575334d`.
The current [failure-isolation contract and test repairs](../docs/resilience.md),
[movement synchronization](../docs/movement-sync.md), and
[world profile](../docs/world-profile.md) describe the relevant current behavior.

Each subdirectory records its own build, test conditions, failures and limitations.
These historical reports are not current release qualification or a deployment
approval. For example, the [hour-long resilience qualification](resilience/README.md)
belongs to release `b9438158d0e3`; its recorded eight baseline failures were later
repaired in `f19bccf`. Older voice proxy/media-policy and fixed-world reports also
remain useful history, while the current [voice documentation](../../../apps/voxel-server/docs/media.md)
and world profile supersede their behavior.

The reports retain their original data and hashes. An inventory or capture path
inside a historical report describes that snapshot, not files guaranteed to exist
in this trimmed tree. Removed Markdown link targets are marked `archived`.

## Recovering original material

Read a specific original file without changing either checkout:

```sh
git show f19bccfa19797d57ec7243fe17fa85ebf7f2aea7:games/voxel/evidence/ARCHIVE/PATH
```

For a full historical tree, create a detached worktree at that commit:

```sh
git worktree add --detach /tmp/voxel-information f19bccfa19797d57ec7243fe17fa85ebf7f2aea7
```

The source branch continues to retain the complete information collection and is
where implementation fixes and dead-code cleanup are made. Its existing untracked
review notes and local work are not copied into this PR worktree.

## Retained benchmark dependencies

`tools/benchmark-survival.ts` still selects five historical baselines:
`media-composition`, `worker-timings`, `room-reuse`, `drop-encoding`, and
`snapshot-pose`. Their entry modules, exact checked bytes and complete relative
import dependencies remain at their original paths (159 source files).
These are required by existing tooling; retiring that tool is a code change for
the source branch, followed by a separate synchronization into this PR branch.

## Trim inventory

The split started with 9,338 tracked evidence files. This cleanup
removes 8,556 files (223,800,502 logical bytes)
and retains 782 existing files plus this index. Git still retains the
removed objects in history; this reduces the final review tree and merge diff.

| Historical record | Retained files | Removed copies/captures |
| --- | ---: | ---: |
| [appearance](appearance/README.md) | 47 | 53 |
| [backend-retirement](backend-retirement/README.md) | 7 | 63 |
| [bucket-browser](bucket-browser/README.md) | 18 | 28 |
| [chat](chat/README.md) | 9 | 67 |
| [chat-installation](chat-installation/README.md) | 8 | 3 |
| [classroom-extraction](classroom-extraction/README.md) | 12 | 148 |
| [client-retirement](client-retirement/README.md) | 8 | 40 |
| [column-drain](column-drain/README.md) | 17 | 563 |
| [combat](combat/README.md) | 16 | 19 |
| [content](content/README.md) | 44 | 50 |
| [content-assets-retirement](content-assets-retirement/README.md) | 16 | 71 |
| [creative](creative/README.md) | 5 | 6 |
| [drop-encoding](drop-encoding/README.md) | 40 | 491 |
| [equipment](equipment/README.md) | 54 | 50 |
| [foundation](foundation/README.md) | 3 | 2 |
| [held-bucket](held-bucket/README.md) | 7 | 70 |
| [hosted-school-authorized](hosted-school-authorized/README.md) | 9 | 17 |
| [input](input/README.md) | 5 | 5 |
| [input-backlog](input-backlog/README.md) | 21 | 601 |
| [inventory](inventory/README.md) | 6 | 11 |
| [lifecycle-controls](lifecycle-controls/README.md) | 5 | 29 |
| [media](media/README.md) | 17 | 490 |
| [media-composition](media-composition/README.md) | 43 | 465 |
| [moderation](moderation/README.md) | 11 | 71 |
| [offline-owner](offline-owner/README.md) | 11 | 30 |
| [pacing](pacing/README.md) | 4 | 5 |
| [pc-school](pc-school/README.md) | 4 | 25 |
| [presentation](presentation/README.md) | 9 | 13 |
| [production-package](production-package/README.md) | 4 | 14 |
| [react-mounts](react-mounts/README.md) | 6 | 538 |
| [react-session](react-session/README.md) | 9 | 58 |
| [resilience](resilience/README.md) | 2 | 0 |
| [room-lifecycle](room-lifecycle/README.md) | 15 | 45 |
| [room-recovery](room-recovery/README.md) | 9 | 26 |
| [room-reuse](room-reuse/README.md) | 45 | 487 |
| [roster-departure](roster-departure/README.md) | 9 | 57 |
| [school-admission](school-admission/README.md) | 11 | 35 |
| [session-projection](session-projection/README.md) | 5 | 29 |
| [shaped-network](shaped-network/README.md) | 6 | 548 |
| [snapshot-pose](snapshot-pose/README.md) | 38 | 491 |
| [snapshot-scaling](snapshot-scaling/README.md) | 11 | 523 |
| [staff-commands](staff-commands/README.md) | 10 | 63 |
| [staging-candidate](staging-candidate/README.md) | 4 | 13 |
| [survival](survival/README.md) | 13 | 19 |
| [sustained-survival](sustained-survival/README.md) | 12 | 521 |
| [tnt](tnt/README.md) | 35 | 31 |
| [travel-memory](travel-memory/README.md) | 7 | 527 |
| [visibility-reuse](visibility-reuse/README.md) | 9 | 532 |
| [vitals](vitals/README.md) | 15 | 16 |
| [voice-provider-baseline](voice-provider-baseline/README.md) | 4 | 2 |
| [voice-signaling](voice-signaling/README.md) | 8 | 11 |
| [worker-timings](worker-timings/README.md) | 39 | 484 |
