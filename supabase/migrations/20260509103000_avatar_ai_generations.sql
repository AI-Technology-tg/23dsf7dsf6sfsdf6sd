-- Лимиты генерации аватара (Netlify minko-avatar-grok): записи только с service_role
CREATE TABLE IF NOT EXISTS public.avatar_ai_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avatar_ai_generations_user_created ON public.avatar_ai_generations(user_id, created_at DESC);

ALTER TABLE public.avatar_ai_generations ENABLE ROW LEVEL SECURITY;
