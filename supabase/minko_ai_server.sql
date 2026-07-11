-- Minko AI: удалённый «выключатель» чата + секреты создателя + логи
-- Выполните в Supabase SQL Editor после основного database.sql

-- Публичное состояние (читают все с сайта — anon)
CREATE TABLE IF NOT EXISTS public.minko_ai_public_state (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    chat_enabled boolean NOT NULL DEFAULT true,
    maintenance_message text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Секреты (только создатель): URL Build hook Netlify
CREATE TABLE IF NOT EXISTS public.minko_ai_creator_secrets (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    netlify_build_hook_url text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Логи (читает создатель; пишет создатель вручную или Netlify Function с service_role)
CREATE TABLE IF NOT EXISTS public.minko_ai_server_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    level text NOT NULL DEFAULT 'info',
    message text NOT NULL,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minko_ai_server_logs_created ON public.minko_ai_server_logs (created_at DESC);

INSERT INTO public.minko_ai_public_state (id, chat_enabled, maintenance_message)
VALUES (1, true, '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.minko_ai_creator_secrets (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.minko_ai_public_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minko_ai_creator_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minko_ai_server_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minko_public_state_select_anon" ON public.minko_ai_public_state;
DROP POLICY IF EXISTS "minko_ai_public_state_select" ON public.minko_ai_public_state;
CREATE POLICY "minko_ai_public_state_select" ON public.minko_ai_public_state
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "minko_public_state_creator_update" ON public.minko_ai_public_state;
DROP POLICY IF EXISTS "minko_ai_public_state_update_creator" ON public.minko_ai_public_state;
CREATE POLICY "minko_ai_public_state_update_creator" ON public.minko_ai_public_state
    FOR UPDATE TO authenticated USING ((SELECT public.is_site_creator_user_id(auth.uid())))
    WITH CHECK ((SELECT public.is_site_creator_user_id(auth.uid())));

DROP POLICY IF EXISTS "minko_public_state_creator_insert" ON public.minko_ai_public_state;
DROP POLICY IF EXISTS "minko_ai_public_state_insert_creator" ON public.minko_ai_public_state;
CREATE POLICY "minko_ai_public_state_insert_creator" ON public.minko_ai_public_state
    FOR INSERT TO authenticated WITH CHECK (
        (SELECT public.is_site_creator_user_id(auth.uid()))
        AND id = 1
    );

DROP POLICY IF EXISTS "minko_secrets_creator_all" ON public.minko_ai_creator_secrets;
CREATE POLICY "minko_secrets_creator_all" ON public.minko_ai_creator_secrets FOR ALL TO authenticated
    USING (public.is_site_creator_user_id(auth.uid()))
    WITH CHECK (public.is_site_creator_user_id(auth.uid()));

DROP POLICY IF EXISTS "minko_logs_creator_select" ON public.minko_ai_server_logs;
DROP POLICY IF EXISTS "minko_ai_server_logs_creator_select" ON public.minko_ai_server_logs;
CREATE POLICY "minko_ai_server_logs_creator_select" ON public.minko_ai_server_logs FOR SELECT TO authenticated
    USING ((SELECT public.is_site_creator_user_id(auth.uid())));

DROP POLICY IF EXISTS "minko_logs_creator_insert" ON public.minko_ai_server_logs;
DROP POLICY IF EXISTS "minko_ai_server_logs_creator_insert" ON public.minko_ai_server_logs;
CREATE POLICY "minko_ai_server_logs_creator_insert" ON public.minko_ai_server_logs FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_site_creator_user_id(auth.uid())));

DROP POLICY IF EXISTS "minko_logs_creator_delete" ON public.minko_ai_server_logs;
DROP POLICY IF EXISTS "minko_ai_server_logs_creator_delete" ON public.minko_ai_server_logs;
CREATE POLICY "minko_ai_server_logs_creator_delete" ON public.minko_ai_server_logs FOR DELETE TO authenticated
    USING ((SELECT public.is_site_creator_user_id(auth.uid())));

GRANT SELECT ON public.minko_ai_public_state TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.minko_ai_public_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minko_ai_creator_secrets TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.minko_ai_server_logs TO authenticated;
