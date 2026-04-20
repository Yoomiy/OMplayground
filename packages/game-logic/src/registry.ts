/**
 * Game module contract shared by the server (for authoritative state) and
 * the client (for type-level snapshots). One module per game key, e.g.
 * "tictactoe", "connectfour". Room code is generic over <State> and
 * dispatches intents through the module.
 */

export interface GameSeat {
  userId: string;
  displayName: string;
}

export type GameOutcome =
  | { kind: "won"; winner: string }
  | { kind: "draw" };

export type ModuleApplyResult<State> =
  | { ok: true; state: State; outcome?: GameOutcome }
  | { ok: false; error: { code: string; message: string } };

export interface GameModule<State, Intent = unknown> {
  key: string;
  minPlayers: number;
  maxPlayers: number;
  initialState(players: GameSeat[]): State;
  applyIntent(
    state: State,
    playerId: string,
    intent: Intent
  ): ModuleApplyResult<State>;
  isTerminal(state: State): boolean;
}

/**
 * Registry populated at module load time. Kept in `index.ts` so that
 * registering a new game is a single-line addition and the registry has
 * no reverse dependency on individual games (avoids import cycles).
 */
export type AnyGameModule = GameModule<unknown, unknown>;
