-- Создатель может участвовать до официального старта (тест); остальным — только в окне 18–31 июля 2026 UTC+2

CREATE OR REPLACE FUNCTION public.giveaway_join()
RETURNS TABLE(ref_code TEXT, share_path TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
  v_joined TIMESTAMPTZ;
  v_is_creator BOOLEAN := false;
  v_starts_at TIMESTAMPTZ := TIMESTAMPTZ '2026-07-17 22:00:00+00';
  v_ends_at TIMESTAMPTZ := TIMESTAMPTZ '2026-07-31 21:59:59+00';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Требуется авторизация';
  END IF;

  v_is_creator := public.is_site_creator_user_id(v_uid);

  IF NOT EXISTS (SELECT 1 FROM public.giveaway_campaign WHERE id = 1 AND is_active = true) THEN
    RAISE EXCEPTION 'Розыгрыш сейчас не активен';
  END IF;

  IF NOT v_is_creator AND NOW() < v_starts_at THEN
    RAISE EXCEPTION 'Участие откроется 18 июля 2026';
  END IF;

  IF NOT v_is_creator AND NOW() > v_ends_at THEN
    RAISE EXCEPTION 'Розыгрыш завершён';
  END IF;

  SELECT gp.ref_code, gp.joined_at INTO v_code, v_joined
  FROM public.giveaway_participants gp
  WHERE gp.user_id = v_uid;

  IF v_code IS NOT NULL THEN
    RETURN QUERY SELECT v_code, '/r/' || v_code, v_joined;
    RETURN;
  END IF;

  LOOP
    v_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.giveaway_participants p WHERE p.ref_code = v_code
    );
  END LOOP;

  INSERT INTO public.giveaway_participants AS gp (user_id, ref_code)
  VALUES (v_uid, v_code)
  RETURNING gp.joined_at INTO v_joined;

  RETURN QUERY SELECT v_code, '/r/' || v_code, v_joined;
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_join() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_join() TO authenticated;
