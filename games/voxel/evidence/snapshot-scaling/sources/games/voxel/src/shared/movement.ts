import { MOVEMENT_DT, movementWish } from './input.ts';
import type { Controls } from './input.ts';
/** Narrow Wasm port shared by prediction and authority; rules supply modifiers. */
export type MovementWorld = {
  player_step(
    slot: number,
    x: number,
    z: number,
    jump: boolean,
    sneak: boolean,
    sprint: boolean,
    slide: boolean,
    speed: number,
    gravity: number,
    control: number,
    jumpPower: number,
    dt: number,
  ): boolean;
};
export type MovementModifiers = Readonly<{
  speed: number;
  gravity: number;
  control: number;
  jump: number;
  sprint: boolean;
}>;
export const DEFAULT_MOVEMENT: MovementModifiers = Object.freeze({
  speed: 1,
  gravity: 1,
  control: 1,
  jump: 1,
  sprint: true,
});
export function stepMovement(
  world: MovementWorld,
  slot: number,
  controls: Controls,
  modifiers = DEFAULT_MOVEMENT,
): boolean {
  const [x, z] = movementWish(controls);
  return world.player_step(
    slot,
    x,
    z,
    controls.jump,
    controls.sneak,
    controls.sprint && modifiers.sprint,
    false,
    modifiers.speed,
    modifiers.gravity,
    modifiers.control,
    modifiers.jump,
    MOVEMENT_DT,
  );
}
export type BoundedMovementWorld = MovementWorld & {
  player_state(slot: number): Float64Array;
  player_restore(slot: number, state: Float64Array): void;
};
/** The same playable bounds apply in authority and prediction, including creative flight. */
export function stepBoundedMovement(
  world: BoundedMovementWorld,
  slot: number,
  controls: Controls,
  modifiers = DEFAULT_MOVEMENT,
): boolean {
  const jumped = stepMovement(world, slot, controls, modifiers);
  const state = world.player_state(slot);
  let changed = false;
  const limits = [
    [-255.7, 255.7],
    [0, 254],
    [-255.7, 255.7],
  ];
  for (let axis = 0; axis < 3; axis++) {
    const bounded = Math.max(limits[axis][0], Math.min(limits[axis][1], state[axis]));
    if (bounded !== state[axis]) {
      state[axis] = bounded;
      state[axis + 3] = 0;
      changed = true;
    }
  }
  if (changed) world.player_restore(slot, state);
  return jumped;
}
