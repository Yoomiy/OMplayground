/** Browser embedding API. No development launcher, platform SDK or simulation ownership. */
export { mountVoxel } from './runtime.ts';
export type { VoxelRuntime, RuntimeOptions, RuntimeCommand, HudState } from './runtime.ts';
export type { VoiceScene, VoicePoint } from './voice-scene.ts';
export { mountTouchControls } from './touch-controls.ts';
export { mountInventoryControls } from './inventory-controls.ts';
export { content, identity, supportProblem } from './engine.ts';
export { ITEM_LABELS } from './content-labels.ts';
