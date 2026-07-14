-- Fix: column reference "ref_code" is ambiguous in giveaway_join (RETURNS TABLE ref_code vs table column)

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Требуется авторизация';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.giveaway_campaign WHERE id = 1 AND is_active = true) THEN
    RAISE EXCEPTION 'Розыгрыш сейчас не активен';
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

CREATE OR REPLACE FUNCTION public.giveaway_record_click(
  p_ref_code TEXT,
  p_device_hash TEXT,
  p_visitor_id TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_landing_path TEXT DEFAULT NULL
)
RETURNS TABLE(recorded BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  v_code := lower(trim(coalesce(p_ref_code, '')));
  IF v_code = '' OR NOT EXISTS (
    SELECT 1 FROM public.giveaway_participants p WHERE p.ref_code = v_code
  ) THEN
    RETURN QUERY SELECT false, 'invalid_ref';
    RETURN;
  END IF;

  IF p_device_hash IS NULL OR char_length(trim(p_device_hash)) < 32 THEN
    RETURN QUERY SELECT false, 'invalid_device';
    RETURN;
  END IF;

  INSERT INTO public.giveaway_ref_clicks (
    ref_code, device_hash, visitor_id, ip_hash, user_agent, landing_path
  ) VALUES (
    v_code,
    trim(p_device_hash),
    NULLIF(trim(p_visitor_id), ''),
    NULLIF(trim(p_ip_hash), ''),
    left(coalesce(p_user_agent, ''), 400),
    left(coalesce(p_landing_path, ''), 512)
  )
  ON CONFLICT (ref_code, device_hash) DO NOTHING;

  RETURN QUERY SELECT true, 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_record_click(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_record_click(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.giveaway_creator_stats()
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  email TEXT,
  ref_code TEXT,
  joined_at TIMESTAMPTZ,
  unique_clicks BIGINT,
  registrations BIGINT,
  last_click_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_site_creator_user_id(auth.uid()) THEN
    RAISE EXCEPTION 'Доступ только для создателя сайта';
  END IF;

  RETURN QUERY
  SELECT
    gp.user_id,
    coalesce(p.username, '—') AS username,
    coalesce(u.email::text, '—') AS email,
    gp.ref_code,
    gp.joined_at,
    (SELECT COUNT(*)::BIGINT FROM public.giveaway_ref_clicks c WHERE c.ref_code = gp.ref_code),
    (SELECT COUNT(*)::BIGINT FROM public.giveaway_ref_registrations r WHERE r.ref_code = gp.ref_code),
    (SELECT MAX(c.created_at) FROM public.giveaway_ref_clicks c WHERE c.ref_code = gp.ref_code)
  FROM public.giveaway_participants gp
  LEFT JOIN public.profiles p ON p.id = gp.user_id
  LEFT JOIN auth.users u ON u.id = gp.user_id
  ORDER BY 7 DESC, 6 DESC, gp.joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_creator_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_creator_stats() TO authenticated;
