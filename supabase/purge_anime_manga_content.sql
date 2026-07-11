-- Полная очистка контента аниме и манги (схему не трогаем).
-- Выполнить в Supabase SQL Editor или: psql / MCP execute_sql

BEGIN;

TRUNCATE TABLE public.watch_together_voice_signals CASCADE;
TRUNCATE TABLE public.watch_together_chat CASCADE;
TRUNCATE TABLE public.watch_together_participants CASCADE;
TRUNCATE TABLE public.watch_together_sessions CASCADE;

TRUNCATE TABLE public.watch_history;
TRUNCATE TABLE public.favorites_anime;
TRUNCATE TABLE public.favorites_manga;

TRUNCATE TABLE public.catalog_site_anime;
TRUNCATE TABLE public.custom_anime;

COMMIT;
