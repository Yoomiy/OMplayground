-- Add ball2box as a solo game to the catalog
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
  'קליעה לסל',
  'משחק פאזל פיזיקלי תלת-ממדי מאתגר - הכניסו את הכדור לקופסה!',
  'custom',
  'ball2box',
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
      game_url = 'ball2box'
  );
