-- Розыгрыш видео-обзоров: участники, реф-ссылки, клики, регистрации, антифрод по device_hash

CREATE TABLE IF NOT EXISTS public.giveaway_campaign (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title TEXT NOT NULL DEFAULT 'Розыгрыш видео-обзоров Re-Minko',
  is_active BOOLEAN NOT NULL DEFAULT true,
  prize_usd NUMERIC(10, 2) NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

INSERT INTO public.giveaway_campaign (id, title, is_active, prize_usd)
VALUES (1, 'Розыгрыш видео-обзоров Re-Minko', true, 100)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.giveaway_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_code TEXT NOT NULL UNIQUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT giveaway_ref_code_fmt CHECK (ref_code ~ '^[a-z0-9]{10,12}$')
);

CREATE INDEX IF NOT EXISTS idx_giveaway_participants_ref ON public.giveaway_participants(ref_code);
CREATE INDEX IF NOT EXISTS idx_giveaway_participants_joined ON public.giveaway_participants(joined_at DESC);

CREATE TABLE IF NOT EXISTS public.giveaway_ref_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code TEXT NOT NULL REFERENCES public.giveaway_participants(ref_code) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  visitor_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  landing_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT giveaway_click_device_len CHECK (char_length(device_hash) BETWEEN 32 AND 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_giveaway_ref_clicks_dedup
  ON public.giveaway_ref_clicks(ref_code, device_hash);

CREATE INDEX IF NOT EXISTS idx_giveaway_ref_clicks_ref_created
  ON public.giveaway_ref_clicks(ref_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.giveaway_ref_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code TEXT NOT NULL REFERENCES public.giveaway_participants(ref_code) ON DELETE CASCADE,
  participant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  visitor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT giveaway_no_self_ref CHECK (participant_user_id <> registered_user_id),
  CONSTRAINT giveaway_reg_device_len CHECK (char_length(device_hash) BETWEEN 32 AND 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_giveaway_reg_one_device
  ON public.giveaway_ref_registrations(device_hash);

CREATE INDEX IF NOT EXISTS idx_giveaway_reg_participant
  ON public.giveaway_ref_registrations(participant_user_id, created_at DESC);

ALTER TABLE public.giveaway_campaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_ref_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_ref_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "giveaway_campaign_public_read" ON public.giveaway_campaign;
CREATE POLICY "giveaway_campaign_public_read" ON public.giveaway_campaign
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "giveaway_participants_own_read" ON public.giveaway_participants;
CREATE POLICY "giveaway_participants_own_read" ON public.giveaway_participants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "giveaway_participants_creator_all" ON public.giveaway_participants;
CREATE POLICY "giveaway_participants_creator_all" ON public.giveaway_participants
  FOR ALL TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()))
  WITH CHECK (public.is_site_creator_user_id(auth.uid()));

DROP POLICY IF EXISTS "giveaway_clicks_creator_read" ON public.giveaway_ref_clicks;
CREATE POLICY "giveaway_clicks_creator_read" ON public.giveaway_ref_clicks
  FOR SELECT TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()));

DROP POLICY IF EXISTS "giveaway_regs_creator_read" ON public.giveaway_ref_registrations;
CREATE POLICY "giveaway_regs_creator_read" ON public.giveaway_ref_registrations
  FOR SELECT TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()));

DROP POLICY IF EXISTS "giveaway_regs_own_read" ON public.giveaway_ref_registrations;
CREATE POLICY "giveaway_regs_own_read" ON public.giveaway_ref_registrations
  FOR SELECT TO authenticated
  USING (participant_user_id = auth.uid());

-- Участие: создать или вернуть ref_code
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

REVOKE ALL ON FUNCTION public.giveaway_join() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_join() TO authenticated;

-- Статус участника для UI
CREATE OR REPLACE FUNCTION public.giveaway_my_status()
RETURNS TABLE(
  is_participant BOOLEAN,
  ref_code TEXT,
  share_path TEXT,
  unique_clicks BIGINT,
  registrations BIGINT,
  joined_at TIMESTAMPTZ
)
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
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, 0::BIGINT, 0::BIGINT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT gp.ref_code, gp.joined_at INTO v_code, v_joined
  FROM public.giveaway_participants gp
  WHERE gp.user_id = v_uid;

  IF v_code IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, 0::BIGINT, 0::BIGINT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    v_code,
    '/r/' || v_code,
    (SELECT COUNT(*)::BIGINT FROM public.giveaway_ref_clicks c WHERE c.ref_code = v_code),
    (SELECT COUNT(*)::BIGINT FROM public.giveaway_ref_registrations r WHERE r.ref_code = v_code),
    v_joined;
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_my_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_my_status() TO authenticated;

-- Привязка регистрации к реф-коду (антифрод: 1 device = 1 регистрация в розыгрыше)
CREATE OR REPLACE FUNCTION public.giveaway_attribute_registration(
  p_ref_code TEXT,
  p_device_hash TEXT,
  p_visitor_id TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_participant UUID;
  v_code TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Требуется авторизация';
    RETURN;
  END IF;

  v_code := lower(trim(coalesce(p_ref_code, '')));
  IF v_code = '' OR char_length(v_code) < 8 THEN
    RETURN QUERY SELECT false, 'Некорректная ссылка';
    RETURN;
  END IF;

  IF p_device_hash IS NULL OR char_length(trim(p_device_hash)) < 32 THEN
    RETURN QUERY SELECT false, 'Некорректный идентификатор устройства';
    RETURN;
  END IF;

  SELECT gp.user_id INTO v_participant
  FROM public.giveaway_participants gp
  WHERE gp.ref_code = v_code;

  IF v_participant IS NULL THEN
    RETURN QUERY SELECT false, 'Ссылка не найдена';
    RETURN;
  END IF;

  IF v_participant = v_uid THEN
    RETURN QUERY SELECT false, 'Нельзя засчитать регистрацию по своей ссылке';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.giveaway_ref_registrations WHERE registered_user_id = v_uid) THEN
    RETURN QUERY SELECT false, 'Регистрация уже была привязана';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.giveaway_ref_registrations WHERE device_hash = trim(p_device_hash)) THEN
    RETURN QUERY SELECT false, 'С этого устройства регистрация уже учитывалась';
    RETURN;
  END IF;

  INSERT INTO public.giveaway_ref_registrations (
    ref_code, participant_user_id, registered_user_id, device_hash, visitor_id
  ) VALUES (
    v_code, v_participant, v_uid, trim(p_device_hash), NULLIF(trim(p_visitor_id), '')
  );

  RETURN QUERY SELECT true, 'Регистрация засчитана участнику';
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'Регистрация с этого устройства или аккаунта уже учтена';
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_attribute_registration(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_attribute_registration(TEXT, TEXT, TEXT) TO authenticated;

-- Запись клика (service_role / edge function)
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

-- Дашборд создателя
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

-- _allowed tables (database.sql sync comment)
-- ADD: giveaway_campaign, giveaway_participants, giveaway_ref_clicks, giveaway_ref_registrations
