# Support-loss falling and world drops

Branch: `feat/voxel-support-drops`, based on `cb89065`.

Unfocused connected players now continue native gravity and fall-damage accounting. A short shape-aware support sweep skips movement for grounded bodies with support; airborne bodies use neutral controls. Explicit flight stays armed and global room pause freezes physics. Focused players continue the existing client prediction / numbered input playback; there is no new untrusted movement intent or extra physics time on that timeline.

Mined loot receives deterministic position/velocity scatter. Nearby matching stacks merge to item limits, preserving the earlier expiry and throw protection. Different bodies separate through collision-aware sweeps. Half-block spatial buckets restrict pair searches to neighboring cells. Attraction chooses the nearest eligible player within 3.2 blocks, requires clear sight and inventory capacity, moves at 9 blocks/second, and collects within 1.1 blocks. Partial pickups leave the remainder. Throws start ahead of the player through a collision sweep, launch at horizontal speed 5.2, and cannot return to their thrower until they leave the attraction radius. Existing checkpoint owner fields preserve that exclusion across restore.

Drops have smoothed presentation and one instanced halo batch. Successful collection emits validated private item/count feedback and a short synthesized sound; all audio and halo resources follow existing disposal ownership.

Protocol version is 15 because of the new pickup event. Build and restart client and server together. No engine changes or world reset are needed. This worktree deliberately starts from committed HEAD, leaving the original checkout's ongoing changes untouched.

Validation: game TypeScript and import boundaries pass; built-browser smoke covers an actual throw, persistence while standing still, submitted drop instances, absence of page errors, and worker disposal. Native checks cover focused/unfocused support loss, pause, damage, scatter, stack limits/conservation, restore, magnet collection, protection and existing movement prediction. The full Wasm suite has two failures reproduced against untouched HEAD: `checkpoint-world.test.ts` invalid checkpoint suffix validation and `progression.test.ts` instant-mining failed-write fixture. The separate inventory unit suite also has a pre-existing assertion rejecting coordinate 1000 despite streamed world bounds, reproduced against HEAD. These unrelated checks were left unchanged.

Browser smoke: `node games/voxel/tools/browser-support-drops.ts` after content/build-manifest generation and client build. Screenshot: `games/voxel/test-results/support-drops.png`.
