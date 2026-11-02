import type { Stack } from './content.ts';
export type GameMode = 'creative' | 'survival';
export type MiningView = {
  target: readonly [number, number, number] | null;
  elapsed: number;
  total: number;
};
export type DropView = {
  id: string;
  revision: number;
  stack: Stack;
  position: readonly [number, number, number];
};
export const DROP_RADIUS = 32;
export const PICKUP_RADIUS = 1.1;
export const DROP_LIFETIME_TICKS = 30 * 300;

export const MAGNET_RADIUS = 3.2;

/** The old drop cube and its full horizontal rotation envelope. Positions are feet. */
export const DROP_SIZE = 0.28;
export const DROP_HALF_WIDTH = 0.198;
export const DROP_HEIGHT = 0.284;
export const DROP_MERGE_RADIUS = 0.38;
export const DROP_MERGE_TICKS = 6; // 5 Hz; gravity remains 30 Hz.
export const DROP_PICKUP_TICKS = 3;
export const DROP_MAGNET_SPEED = 3; // Preserve the existing effective attraction speed.
