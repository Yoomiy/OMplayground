-- Update breakout solo game URL from 'breakout' to 'breakout-solo' to align naming conventions
UPDATE public.games
SET game_url = 'breakout-solo'
WHERE game_url = 'breakout' AND is_multiplayer = false;

-- Add breakout as a multiplayer game to the catalog
INSERT INTO
  public.games (
    id,
    name_he,
    description_he,
    type,
    game_url,
    min_players,
    max_players,
    is_active,
    is_multiplayer,
    for_gender
  )
SELECT
  gen_random_uuid (),
  'שבירת לבנים',
  'משחק שבירת לבנים שיתופי לשני שחקנים',
  'custom',
  'breakout',
  2,
  2,
  true,
  true,
  'both'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.games
    WHERE
      game_url = 'breakout' AND is_multiplayer = true
  );
