-- The Rocket catalog migration is already applied in some environments.
-- Serve its existing brand emblem from the app, independently of the game service.
UPDATE public.games
SET thumbnail_url = '/games/rocket-arena.png'
WHERE game_url = 'rocket-arena'
  AND (thumbnail_url IS NULL OR btrim(thumbnail_url) = '');
