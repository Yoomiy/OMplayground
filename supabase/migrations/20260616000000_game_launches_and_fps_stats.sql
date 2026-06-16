-- Migration: Add Game Launch Stats, Minecraft FPS Stats, and peak_player_count to game_sessions

-- 1. Alter game_sessions table to add peak_player_count
ALTER TABLE public.game_sessions ADD COLUMN peak_player_count integer NOT NULL DEFAULT 0;

-- 2. Create game_launch_stats table
CREATE TABLE public.game_launch_stats (
  kid_id uuid NOT NULL REFERENCES public.kid_profiles(id) ON DELETE CASCADE,
  game_url text NOT NULL,
  launch_count integer NOT NULL DEFAULT 0,
  last_launched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kid_id, game_url)
);

-- Enable RLS on game_launch_stats
ALTER TABLE public.game_launch_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for game_launch_stats
CREATE POLICY "game_launch_stats_select_own"
  ON public.game_launch_stats FOR SELECT
  USING (auth.uid() = kid_id);

CREATE POLICY "game_launch_stats_select_admin"
  ON public.game_launch_stats FOR SELECT
  USING (public.is_admin());

-- 3. Create minecraft_fps_stats table
CREATE TABLE public.minecraft_fps_stats (
  kid_id uuid NOT NULL REFERENCES public.kid_profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  loading_avg_fps real,
  loading_sample_count integer NOT NULL DEFAULT 0,
  runtime_avg_fps real,
  runtime_sample_count integer NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kid_id, session_id)
);

-- Enable RLS on minecraft_fps_stats
ALTER TABLE public.minecraft_fps_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for minecraft_fps_stats
CREATE POLICY "minecraft_fps_stats_select_own"
  ON public.minecraft_fps_stats FOR SELECT
  USING (auth.uid() = kid_id);

CREATE POLICY "minecraft_fps_stats_select_admin"
  ON public.minecraft_fps_stats FOR SELECT
  USING (public.is_admin());

-- 4. SECURITY DEFINER RPC to increment game launches (only for solo games)
CREATE OR REPLACE FUNCTION public.increment_game_launch(p_game_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.game_launch_stats (kid_id, game_url, launch_count, last_launched_at)
  VALUES (auth.uid(), p_game_url, 1, now())
  ON CONFLICT (kid_id, game_url)
  DO UPDATE SET
    launch_count = public.game_launch_stats.launch_count + 1,
    last_launched_at = now();
END;
$$;

-- 5. SECURITY DEFINER RPC to increment game launches from server (multiplayer games)
CREATE OR REPLACE FUNCTION public.increment_game_launch_server(p_kid_id uuid, p_game_url text, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.game_launch_stats (kid_id, game_url, launch_count, last_launched_at)
  VALUES (p_kid_id, p_game_url, p_amount, now())
  ON CONFLICT (kid_id, game_url)
  DO UPDATE SET
    launch_count = public.game_launch_stats.launch_count + p_amount,
    last_launched_at = now();
END;
$$;
