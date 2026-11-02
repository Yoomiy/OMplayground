# Support-loss falling and world drops

Branch: `feat/voxel-support-drops`, based on `cb89065`.

Unfocused connected players now continue native gravity and fall-damage accounting. A short shape-aware support sweep skips movement for grounded bodies with support; airborne bodies use neutral controls. Explicit flight stays armed and global room pause freezes physics. Focused players continue the existing client prediction / numbered input playback; there is no new untrusted movement intent or extra physics time on that timeline.

Mined loot and death drops receive deterministic position/velocity scatter. Nearby matching stacks merge to item limits, preserving the earlier expiry and throw protection. Distinct drops may overlap; there is no drop-to-drop physical separation. Only compatible non-full stacks enter per-material half-block spatial buckets for merging at 5 Hz. Attraction chooses the nearest eligible player within 2.7 blocks, requires clear sight and inventory capacity, moves at 2.5 blocks/second, and collects within 1.1 blocks. Partial pickups leave the remainder. Throws start ahead of the player through a collision sweep, launch at horizontal speed 5.2, and cannot return to their thrower until they leave the attraction radius. Existing checkpoint owner fields preserve that exclusion across restore.

Drops retain one instanced visual per real body, with no halo or pile proxies. The old 0.28-block cube size, 0–0.022 upward bob and 2.1-radian/second alternating spin are restored. A shared 0.198 horizontal half-width reserves the full rotating diagonal. Both authoritative motion and the final smoothed/bobbing view resolve initial terrain overlaps and sweep against solid shapes, including slabs and stairs. Successful collection emits validated private item/count feedback and a short synthesized sound; all audio and item resources follow existing disposal ownership.

Protocol version is 15 because of the new pickup event. Build and restart client and server together. No engine changes or world reset are needed. This worktree deliberately starts from committed HEAD, leaving the original checkout's ongoing changes untouched.

Validation: game TypeScript and import boundaries pass; built-browser smoke covers an actual throw, persistence while standing still, submitted drop instances, absence of page errors, and worker disposal. Native checks cover focused/unfocused support loss, pause, damage, scatter, stack limits/conservation, restore, magnet collection, protection and existing movement prediction. The original full Wasm run had two failures reproduced against untouched HEAD: `checkpoint-world.test.ts` invalid checkpoint suffix validation and `progression.test.ts` instant-mining failed-write fixture. The separate inventory unit suite also has a pre-existing assertion rejecting coordinate 1000 despite streamed world bounds, reproduced against HEAD. These unrelated checks were left unchanged.

Browser smoke: `node games/voxel/tools/browser-support-drops.ts` after content/build-manifest generation and client build. Screenshot: `games/voxel/test-results/support-drops.png`.


## Simplified drops follow-up

The follow-up removes physical separation and halos, preserves stack merging and the current effective magnet speed, and restores rotation-safe terrain clearance. The native sweep intentionally permits escape from existing overlaps, so `shared/drop-physics.ts` first applies the old bounded depenetration behavior using authored solid shape boxes. This handles old narrow-body positions, scatter and newly placed terrain without changing the engine. Rendering uses one terrain sweep per visible item, with no pairwise visual comparisons. Gravity stays at 30 Hz, merging at 5 Hz, and collection at 10 Hz; magnet movement explicitly accounts for that collection cadence.

Native rendering regressions inspect transformed geometry through complete rotations beside walls, floors and ceilings, movement around corners, origin rebases, new block placement and slab overlaps. A 200-full-stack mixed pile retains all bodies in the same location and performs exactly one terrain sweep per body/tick, demonstrating that physical separation work is gone. Existing sprite batching/disposal checks assert no extra halo mesh.


Follow-up validation: the full Wasm suite reports the same checkpoint and mining failures plus the historical snapshot comparison's missing `avatar` key, also reproduced against untouched current HEAD. The direct visual check (`node games/voxel/tools/browser-drop-clearance.ts`) injects the real drop renderer, textures and Wasm into a browser page without starting any HTTP or development server; it renders 240 frames, checks the two item batches have no halo draw, and captures `test-results/drop-clearance.png`.
