-- Add all_colors_in_control as a solo game to the catalog
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
  'מלחמת צבעים',
  'משחק יריות חלל מאתגר ומלהיב שבו הסביבה והמוזיקה מוכתבות על פי צבעי האויבים והחלליות שלכם!',
  'custom',
  'all-colors-in-control',
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
      game_url = 'all-colors-in-control'
  );
