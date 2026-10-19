-- Preserve the retired game's catalog state on existing and fresh databases.
UPDATE public.games SET is_active = false WHERE game_url = 'prism-team';
