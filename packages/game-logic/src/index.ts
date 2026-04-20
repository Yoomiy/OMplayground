export * from "./registry";
export * from "./tictactoe";
export * from "./connectfour";

import type { AnyGameModule } from "./registry";
import { connectfourModule } from "./connectfour";
import { tictactoeModule } from "./tictactoe";

/**
 * Map of game keys (matches `games.game_url` in Supabase) → module. New
 * games register here once their rules live in `packages/game-logic`.
 */
const registry: Record<string, AnyGameModule> = {
  [tictactoeModule.key]: tictactoeModule as AnyGameModule,
  [connectfourModule.key]: connectfourModule as AnyGameModule
};

export function getGameModule(key: string): AnyGameModule | undefined {
  return registry[key];
}

export function registeredGameKeys(): string[] {
  return Object.keys(registry);
}
