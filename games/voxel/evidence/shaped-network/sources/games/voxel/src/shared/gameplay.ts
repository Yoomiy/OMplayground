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
export const PICKUP_RADIUS = 1.75;
export const DROP_LIFETIME_TICKS = 30 * 300;
