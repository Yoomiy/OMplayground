-- Local / staging seed (run once after migrations).

DELETE FROM public.recess_schedules;

INSERT INTO public.recess_schedules (day_of_week, start_time, end_time, name_he, is_active)
VALUES
  (0, '00:00', '23:59', 'כל היום (פיתוח)', true),
  (1, '00:00', '23:59', 'כל היום (פיתוח)', true),
  (2, '00:00', '23:59', 'כל היום (פיתוח)', true),
  (3, '00:00', '23:59', 'כל היום (פיתוח)', true),
  (4, '00:00', '23:59', 'כל היום (פיתוח)', true),
  (5, '00:00', '23:59', 'כל היום (פיתוח)', true),
  (6, '00:00', '23:59', 'כל היום (פיתוח)', true);

INSERT INTO public.games (
  id,
  name_he,
  description_he,
  type,
  game_url,
  max_players,
  min_players,
  is_active,
  for_gender
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'איקס עיגול',
  'משחק לשני שחקנים',
  'custom',
  'tictactoe',
  2,
  2,
  true,
  'both'
)
ON CONFLICT (id) DO NOTHING;
