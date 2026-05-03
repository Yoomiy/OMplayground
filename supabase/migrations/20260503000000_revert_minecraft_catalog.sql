-- Reverts catalog + DB state from 20260430000000_add_minecraft.sql.
-- Run after that migration has been applied (e.g. `supabase db push`).

DELETE FROM public.game_challenges
WHERE game_id IN (SELECT id FROM public.games WHERE game_url = 'minecraft');

DELETE FROM public.game_sessions
WHERE game_id IN (SELECT id FROM public.games WHERE game_url = 'minecraft');

DELETE FROM public.solo_game_saves
WHERE game_key = 'minecraft';

DELETE FROM public.games
WHERE game_url = 'minecraft';
