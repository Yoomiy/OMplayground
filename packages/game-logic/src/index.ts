export * from "./registry";
export * from "./chess";
export * from "./tictactoe";
export * from "./connectfour";
export * from "./memory";
export * from "./drawing";

import type { AnyGameModule } from "./registry";
import { chessModule } from "./chess";
import { connectfourModule } from "./connectfour";
import { drawingModule } from "./drawing";
import { memoryModule } from "./memory";
import { tictactoeModule } from "./tictactoe";

/**
 * Map of game keys (matches `games.game_url` in Supabase) → module. New
 * games register here once their rules live in `packages/game-logic`.
 */
const registry: Record<string, AnyGameModule> = {
  [chessModule.key]: chessModule as AnyGameModule,
  [tictactoeModule.key]: tictactoeModule as AnyGameModule,
  [connectfourModule.key]: connectfourModule as AnyGameModule,
  [memoryModule.key]: memoryModule as AnyGameModule,
  [drawingModule.key]: drawingModule as AnyGameModule
};

export function getGameModule(key: string): AnyGameModule | undefined {
  return registry[key];
}

export function registeredGameKeys(): string[] {
  return Object.keys(registry);
}
