-- Храним в global_chat_messages только последние 50 неудалённых записей (по времени).
-- Выполнить в Supabase SQL Editor один раз.

CREATE OR REPLACE FUNCTION public._trim_global_chat_to_50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  surplus uuid[];
BEGIN
  SELECT array_agg(id) INTO surplus
  FROM (
    SELECT id
    FROM public.global_chat_messages
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    OFFSET 50
  ) x;

  IF surplus IS NOT NULL AND array_length(surplus, 1) > 0 THEN
    DELETE FROM public.global_chat_messages WHERE id = ANY(surplus);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_global_chat_retention_50 ON public.global_chat_messages;
CREATE TRIGGER tr_global_chat_retention_50
  AFTER INSERT ON public.global_chat_messages
  FOR EACH ROW
  EXECUTE PROCEDURE public._trim_global_chat_to_50();

-- Функция public.is_site_creator_user_id(uuid) используется только авторизованными RPC/RLS.
REVOKE ALL ON FUNCTION public.is_site_creator_user_id(uuid) FROM anon;
