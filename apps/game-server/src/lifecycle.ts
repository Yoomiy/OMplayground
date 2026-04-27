import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persistence boundaries for the game session lifecycle. Kept in their own
 * module so the socket handlers in index.ts stay thin and each helper is
 * unit-testable with a mocked Supabase client (see lifecycle.test.ts).
 */

export interface PersistGameEndedArgs {
  supabase: SupabaseClient;
  sessionId: string;
  gameState: unknown;
  connectedPlayerIds?: string[];
  connectedPlayerNames?: string[];
  endedAt?: string;
}

export async function persistGameEnded(
  args: PersistGameEndedArgs
): Promise<void> {
  const endedAt = args.endedAt ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "completed",
      game_state: args.gameState as Record<string, unknown>,
      connected_player_ids: args.connectedPlayerIds ?? [],
      connected_player_names: args.connectedPlayerNames ?? [],
      ended_at: endedAt,
      last_activity: endedAt
    })
    .eq("id", args.sessionId);
}

export interface PersistGameStoppedArgs {
  supabase: SupabaseClient;
  sessionId: string;
  stoppedBy: string;
  gameState: unknown;
  endedAt?: string;
}

export async function persistGameStopped(
  args: PersistGameStoppedArgs
): Promise<void> {
  const endedAt = args.endedAt ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "completed",
      stopped_by: args.stoppedBy,
      game_state: args.gameState as Record<string, unknown>,
      connected_player_ids: [],
      connected_player_names: [],
      is_open: false,
      ended_at: endedAt,
      last_activity: endedAt
    })
    .eq("id", args.sessionId);
}

export interface PersistGameRematchArgs {
  supabase: SupabaseClient;
  sessionId: string;
  gameState: unknown;
  playerIds?: string[];
  playerNames?: string[];
  connectedPlayerIds?: string[];
  connectedPlayerNames?: string[];
  now?: string;
}

export async function persistGameRematch(
  args: PersistGameRematchArgs
): Promise<void> {
  const now = args.now ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "playing",
      game_state: args.gameState as Record<string, unknown>,
      ...(args.playerIds ? { player_ids: args.playerIds } : {}),
      ...(args.playerNames ? { player_names: args.playerNames } : {}),
      connected_player_ids: args.connectedPlayerIds ?? [],
      connected_player_names: args.connectedPlayerNames ?? [],
      ended_at: null,
      stopped_by: null,
      last_activity: now
    })
    .eq("id", args.sessionId);
}

export interface PersistRecessPauseArgs {
  supabase: SupabaseClient;
  sessionId: string;
  gameState: unknown;
  connectedPlayerIds?: string[];
  connectedPlayerNames?: string[];
  now?: string;
}

/**
 * Recess-end boundary: preserve the in-memory snapshot so kids can resume
 * next recess. One UPDATE per room; the caller iterates the live room map.
 */
export async function persistRecessPause(
  args: PersistRecessPauseArgs
): Promise<void> {
  const now = args.now ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "paused",
      game_state: args.gameState as Record<string, unknown>,
      connected_player_ids: args.connectedPlayerIds ?? [],
      connected_player_names: args.connectedPlayerNames ?? [],
      last_activity: now
    })
    .eq("id", args.sessionId);
}

export const persistGamePaused = persistRecessPause;

export interface PersistGameResumedArgs {
  supabase: SupabaseClient;
  sessionId: string;
  connectedPlayerIds: string[];
  connectedPlayerNames: string[];
  now?: string;
}

export async function persistGameResumed(
  args: PersistGameResumedArgs
): Promise<void> {
  const now = args.now ?? new Date().toISOString();
  await args.supabase
    .from("game_sessions")
    .update({
      status: "playing",
      connected_player_ids: args.connectedPlayerIds,
      connected_player_names: args.connectedPlayerNames,
      last_activity: now
    })
    .eq("id", args.sessionId);
}

export interface CleanupStalePausedArgs {
  supabase: SupabaseClient;
  /** Sessions untouched for longer than this roll over to 'completed'. */
  olderThanMs: number;
  now?: Date;
}

/**
 * Single UPDATE that ages out `paused` sessions so `SavedGames` doesn't
 * accumulate forever. Intended to run on a low-frequency timer.
 */
export async function cleanupStalePausedSessions(
  args: CleanupStalePausedArgs
): Promise<void> {
  const now = args.now ?? new Date();
  const cutoff = new Date(now.getTime() - args.olderThanMs).toISOString();
  await args.supabase
    .from("game_sessions")
    .update({ status: "completed", ended_at: now.toISOString() })
    .eq("status", "paused")
    .lt("last_activity", cutoff);
}
