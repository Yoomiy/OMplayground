# Voxel UI review follow-up

Repairs for the 2026-10-29 source review of `90fe575`. The first batch is `6af8112`; this follow-up adds camera support, graphics restoration and confirmed station/mining presentation behavior.

| Review findings | Implemented behavior |
| --- | --- |
| UI-01, UI-06 | Item thumbnails use the actual world models and textures. Hotbar and inventory show stack counts and durability. Survival health, food and air have graphical meters; air also shows seconds. |
| UI-02, UI-03, UI-05 | Compact nine-slot hotbar, stone-colored inventory and smaller floating header. Session management lives in a menu. Mining progress stays beside the crosshair. |
| UI-04 | Confirmed mining progress drives a target-shaped crack overlay, repeating arm swings and digging effects. |
| UI-07, BUG-06 | Empty equipment destinations show their names. Selecting an item highlights compatible equipment destinations. |
| UI-08, BUG-05 | Searchable visual recipe grids, result thumbnails and ingredient availability. Recipe expansion/search survive pending transactions and inventory revisions. |
| UI-09 | Drag stacks, right-click a source to select half, right-click a destination for one item, and Shift-click for quick transfer. Transactions remain server-authoritative. |
| UI-10 | Searchable image catalog. Choosing a block replaces the current creative quick-access slot; digits always address the nine visible slots. |
| UI-11 | Right-click opens a targeted workbench or chest. Holding Shift bypasses opening and allows placement beside it. |
| UI-12 | Help explains survival hold mining, sprint, sneak, creative flight, slot selection and TNT ignition. |
| BUG-01, BUG-02 | A brief input gap or authoritative ray miss pauses mining for up to 200 ms before cancellation. No mining ticks accrue during that interruption. Movement still expires after 100 ms. Block replacement, tool changes, focus loss and permission loss still invalidate mining. |
| BUG-03 | Release may finish only the final two valid server ticks. Earlier release cancels immediately. |
| BUG-04 | Transient gameplay rejection messages remain visible during normal play, with three seconds to read them. |
| BUG-07, BUG-08 | E respects other open dialogs. Pointer-lock rejection displays retry guidance and freezes local input. |
| BUG-09 | A running session restores GPU resources from retained scene/texture data, including the CPU-backed biome atlas. Input stays frozen until rendering returns and the player explicitly resumes. Session/inventory stay in place; errors and ended sessions are preserved. |
| BUG-10 | Wheel, V and the session menu select first/third person. A native collision-volume query keeps the camera before walls and respects partial block shapes. The local avatar carries its held item/equipment. Movement, interaction reach and proximity voice remain at the player's position. |

## Local checks

- The 14 native survival tests pass, including new input-gap/aim-miss and near-completion release regressions.
- A focused local browser flow rendered the production React surface with the native game worker. It checked nine image slots, compact header geometry, inventory split/drag/quick transfers, durability bars, recipe state/search, modal shortcut isolation, survival meters, gameplay rejection text and pointer-lock retry guidance.
- A focused browser check opened the actual 3×3 workbench through the desktop right-click handler and rendered the local third-person avatar/held item. Native camera tests cover walls, slabs, negative coordinates, zoom bounds and unchanged player state.
- An actual software WebGL loss/restoration check retained the same actor/world, 32 owned planks and 49 loaded columns, with zero new admissions or remounts. Resume was blocked during loss and required an explicit entry action afterward. This check used the existing `renderScale: 0.5` / 30 Hz options; it is functional evidence, not school-PC performance evidence.
- The mining DOM input path confirmed server progress, repeated swings/digging effects and active cracks. Bare-hand swings now rise above the hotbar; crack textures use the correct color space.
- Game and web TypeScript checks and updated client/server packaging pass. Existing engine sources, toolchain configuration and Wasm artifacts match the prior published hashes; that unchanged engine is reused because this executor has no Rust compiler.

## Release and next step

The matched published game release is `ac2f7fb648a0afc81aea795dc1f9a975c06388368fa0163229ef17f9b55af8c1`.

Terrain artwork continues to use the procedural world-texture pipeline (UI-13). Continue with concrete staging feedback, then the requested main PR and manual deployment walkthrough. No additional broad qualification loop is required for these presentation repairs.
