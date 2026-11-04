export const EXPLOSIVE_RADIUS = 48;
export const EXPLOSIONS_PER_TICK = 2;
export const CHAIN_FUSE = 30;
export type ExplosiveView = Readonly<{
  id: string;
  revision: number;
  state: number;
  position: readonly [number, number, number];
  remaining: number;
  total: number;
}>;
export type ExplosionEvent = Readonly<{
  sequence: number;
  id: string;
  position: readonly [number, number, number];
  radius: number;
  removed: number;
  cancelled: boolean;
  columns: readonly { x: number; z: number; revision: number }[];
}>;
