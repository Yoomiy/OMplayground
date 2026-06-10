-- Revert remaining tables to DEFAULT replica identity to reduce Realtime payload size where old row values are not needed.
ALTER TABLE public.friendships REPLICA IDENTITY DEFAULT;
ALTER TABLE public.game_challenges REPLICA IDENTITY DEFAULT;
ALTER TABLE public.game_sessions REPLICA IDENTITY DEFAULT;
ALTER TABLE public.kid_blocks REPLICA IDENTITY DEFAULT;
ALTER TABLE public.chat_messages REPLICA IDENTITY DEFAULT;
