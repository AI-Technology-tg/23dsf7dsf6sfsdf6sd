-- Применено на проекте Supabase «Re - Minko» (ref ipsawgtsicxwkkkipchp) через MCP.
-- Локально: при наличии CLI — supabase db push / migration repair по документации Supabase.

CREATE TABLE IF NOT EXISTS public.minko_ai_public_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  chat_enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_message TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

INSERT INTO public.minko_ai_public_state (id, chat_enabled, maintenance_message)
VALUES (1, true, '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.minko_ai_server_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT minko_ai_server_logs_level_len CHECK (char_length(level) <= 32),
  CONSTRAINT minko_ai_server_logs_message_len CHECK (char_length(message) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_minko_ai_server_logs_created ON public.minko_ai_server_logs(created_at DESC);

ALTER TABLE public.minko_ai_public_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minko_ai_server_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minko_ai_public_state_select" ON public.minko_ai_public_state;
DROP POLICY IF EXISTS "minko_ai_public_state_update_creator" ON public.minko_ai_public_state;
CREATE POLICY "minko_ai_public_state_select" ON public.minko_ai_public_state FOR SELECT USING (true);
CREATE POLICY "minko_ai_public_state_update_creator" ON public.minko_ai_public_state FOR UPDATE TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()))
  WITH CHECK (public.is_site_creator_user_id(auth.uid()));

DROP POLICY IF EXISTS "minko_ai_server_logs_creator_select" ON public.minko_ai_server_logs;
CREATE POLICY "minko_ai_server_logs_creator_select" ON public.minko_ai_server_logs FOR SELECT TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()));
