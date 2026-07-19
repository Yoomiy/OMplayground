-- Add pop-it-master as a solo game to the catalog
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
  'פופ איט מאסטר',
  'משחק פופ-איט קלאסי ומרגיע עם צבעים וצורות מגוונות (GameDistribution)',
  'custom',
  'pop-it-master',
  1,
  1,
  true,
  false,
  'both'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.games
    WHERE
      game_url = 'pop-it-master'
  );
