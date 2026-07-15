-- Разовая очистка статистики розыgрыша (участники, клики, регистрации)
-- Применено на Supabase: 2026-07-14

TRUNCATE TABLE public.giveaway_ref_registrations, public.giveaway_ref_clicks, public.giveaway_participants;
