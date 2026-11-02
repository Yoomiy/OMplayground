# Blockyard artwork and material lighting

The art comes from MIT-licensed Blockyard revision
`a79346108fc5ed3b68e3827608fdb448e5a7e5db`. See [UPSTREAM](../UPSTREAM.md) and
[the original license](../public/blockyard-LICENSE.txt). Reproduce the import with
`node tools/import-blockyard-art.mjs /path/to/blockyard`; no network request is needed.

Seven local item identities have exact upstream sprite matches:

| Our item | Blockyard Bed Wars sprite |
| --- | --- |
| `iron_ingot`, `gold_ingot`, `diamond` | Same names |
| `wooden_pickaxe`, `iron_pickaxe`, `diamond_pickaxe` | Same names |
| `iron_vest` | `iron_armor` |

These seven are the original RGBA pixels, without resampling or recolouring. A stone
pickaxe is generated with the same upstream `pickaxe` painter and a locally supplied stone
palette; the original silhouette, handle and outline rules are preserved. Other missing
items retain model thumbnails until an appropriate sprite or variant is added.

All sprite-backed items use the same pixels in inventory, first person, remote players'
hands and dropped-item batches. As in Blockyard's `EntityGraphics.itemLook`, sprites are
extruded one pixel thick unless there is a separate model to use. The original
`extrudeSprite` algorithm is imported from `src/platform/render/entities.ts`. Front/back
faces use the image and alpha cutout; exposed silhouette edges give the item thickness.
Worn armor continues to use its equipment model, while its held/dropped item uses the sprite.
Material disposal releases owned sprite textures without disposing borrowed terrain arrays.
Blocks and items without sprites retain their existing geometry.

Player figures use Blockyard's actual micro-voxel character builder and palette atlases,
with a local catalog in `src/render/avatar-presets.ts`. There are twelve presets: six male
and six female. The original eight IDs stay in place; Rose, Meadow, Marina and Sunflower
are appended as IDs 8–11. These four are local combinations of existing generator options,
not additional upstream artwork. The original imported files remain unchanged.

The male pool remains Classic, Hoodie, Sharp, Explorer, Punk and Vacation. The female pool
is Skater, Scholar, Rose, Meadow, Marina and Sunflower. All six female presets use the
builder's skirt option. Skater retains its original face/hair/colours with a denim skirt
replacing its shorts. Marina's matching navy tunic and skirt form a dress-like outfit;
the other new looks pair skirts with distinct tops, hair, skin tones and shoes. These are
explicit local categories for the game characters, not upstream gender metadata.

The school access service uses the verified existing profile `gender` field to select
an ID consistently from the matching pool. It sends only the preset ID through the private
admission grant and public welcome/actor updates. Clients render the assigned ID; they do
not infer gender or select a different pool. The same preset reaches first person,
third person and remote clients, including reconnects. The local hand/sleeve colours use
the selected preset. Guests/admins without profile gender use the stable full-set fallback.
No database migration or avatar picker is added. A profile change is rechecked during
normal school authorization; a changed selected avatar requires fresh admission.

`avatar-model.ts` adapts the original mesh to our coordinate system and existing head/limb
motion. Players sharing a preset use one instanced batch: at most twelve body draw calls.
Equipment follows the imported shoulder, hand and leg joints. GPU geometry, texture and
instance resources are released on shrink, disappearance and renderer disposal. CPU model
assets are cached for at most twelve presets. This differs from upstream's complete animation
and cosmetic systems; those services are not imported.

Terrain pixels come directly from the existing engine generator again. The experimental
renderer-side texture repainting was removed. Tangent-space normal lighting, restrained
smoothness highlights and improved filtering remain in the existing terrain pass.

Held sprite placement follows Blockyard's `armChain`/`attachedRest` right-hand pose:
melee tools use a grip at sprite pixel (3, 12.5), scale 0.68, and rotation (0, -90, 25)
degrees. Generic sprite items use (8, 13), scale 0.55 and rotation (0, -60, 20).
The item is translated so that exact point lands on the fist; it is not centred above it.
The sprite camera uses Blockyard's default 75-degree FOV. Existing block/bucket poses remain
separate. Remote sprite items follow `figures/held.ts::inFist` with scale 0.62 and its
lower-left handle grip, accounting for our opposite forward axis. Drops keep their spin.
The original poses are evaluated by the import tool to generate
`tests/fixtures/blockyard-hold-rest.json`; tests compare the local adaptation numerically.

Validation:

- `node --test tests/avatar-selection.test.ts tests/sprite-hold.test.ts tests/pixel-art.test.ts
  tests/sprite-items.test.ts tests/avatar-equipment.test.ts tests/wasm/appearance.test.ts`:
  upstream pose/pixel parity, exact fist contact, stable gender-pool assignment,
  admission validation, replication/reconnect, batching and cleanup.
- `node --test apps/voxel-server/tests/school-access.test.ts` from the repository root:
  verified school profile selection and rejection of browser overrides.
- `npm run test:art:browser`: headless WebGL comparison of the previous centred pose and
  corrected Blockyard grip pose, gender-selected models, all twelve presets, sprites,
  dropped batches and representative model thumbnails. Writes `test-results/pixel-art.png`.
  A separate `test-results/female-avatars.png` shows all six female outfits.
  It does not start a game gateway or dev server.
- `npm run typecheck` and `npm run check:boundaries`.

The software Chromium preview verifies rendering, not performance on physical school devices.
