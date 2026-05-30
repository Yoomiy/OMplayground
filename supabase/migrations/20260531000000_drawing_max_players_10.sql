-- Bump max players for collaborative drawing to 10
UPDATE public.games
  SET max_players = 10
  WHERE game_url = 'drawing';
