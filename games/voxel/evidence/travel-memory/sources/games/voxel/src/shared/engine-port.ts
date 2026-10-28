import type { MovementWorld } from './movement.ts';
export interface WorldPort extends MovementWorld {
  insert_column(x: number, z: number, data: Uint8Array): void;
  forget_column(x: number, z: number): void;
  remove_column(x: number, z: number): void;
  has_column(x: number, z: number): boolean;
  column_count(): number;
  get_block(x: number, y: number, z: number): number;
  set_block(x: number, y: number, z: number, state: number): boolean;
  mirror_block(x: number, y: number, z: number, state: number): boolean;
  extract_region(x: number, z: number): Uint8Array;
  player_add(x: number, y: number, z: number): number;
  player_remove(slot: number): void;
  player_state(slot: number): Float64Array;
  player_restore(slot: number, state: Float64Array): void;
  set_flying(slot: number, on: boolean): void;
  set_frozen(slot: number, on: boolean): void;
  set_ghost(slot: number, on: boolean): void;
  player_fits(x: number, y: number, z: number): boolean;
  player_overlaps(x: number, y: number, z: number, state: number): boolean;
  collision_top(x: number, y: number, z: number): number;
  target_boxes(x: number, y: number, z: number): Uint8Array;
  line_clear(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean;
  sweep_body(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    halfWidth: number,
    height: number,
  ): Float64Array;
  raycast(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    reach: number,
  ): Float64Array;
  raycast_liquids(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    reach: number,
  ): Float64Array;
  free(): void;
}
export interface GeneratorPort {
  generate(x: number, z: number): Uint8Array;
  find_spawn(): Int32Array;
  free(): void;
}
