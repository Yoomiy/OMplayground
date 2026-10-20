-- The initial Wobble migration prepared an inactive row. The catalog query and
-- games SELECT policy both hide inactive games. Enable the existing row without
-- changing its ID, display text or any game-session references.
-- Serve the existing gameplay screenshot from the app, independent of the game service.
UPDATE public.games
SET is_active = true,
    thumbnail_url = CASE
      WHEN thumbnail_url IS NULL OR btrim(thumbnail_url) = ''
        THEN '/games/wobble-rush.png'
      ELSE thumbnail_url
    END
WHERE game_url = 'wobble-rush';
