-- =============================================================================
-- PATCH 2026-07-15 — Plan escalation fix
--
-- MASALAH: handle_new_user() sebelumnya menulis raw_user_meta_data->>'plan'
-- mentah-mentah ke profiles.plan. user_metadata bisa di-set bebas dari client
-- (anon key), jadi siapa pun bisa daftar langsung sebagai 'pro' tanpa bayar.
--
-- FIX: clamp plan dari signup ke 'free'/'trial' saja. Plan yang diminta user
-- disimpan di kolom baru `requested_plan` supaya admin bisa follow-up
-- (verifikasi student / pembayaran pro), lalu upgrade manual via SQL editor
-- atau service role.
--
-- CARA PAKAI: Supabase dashboard → SQL Editor → paste file ini → Run.
-- Idempotent — aman dijalankan ulang.
-- =============================================================================

alter table public.profiles
  add column if not exists requested_plan text not null default 'free';

-- Constraint (tambahkan hanya kalau belum ada)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_requested_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_requested_plan_check
      check (requested_plan in ('free', 'trial', 'student', 'pro', 'custom'));
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
    v_requested text := coalesce(new.raw_user_meta_data->>'plan', 'free');
    v_plan text;
begin
    -- Clamp: signup hanya boleh menghasilkan plan gratis.
    v_plan := case when v_requested = 'trial' then 'trial' else 'free' end;

    insert into public.profiles (id, email, name, plan, requested_plan, phone, social_media, nrp, institution, trial_ends_at)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        v_plan,
        case when v_requested in ('free','trial','student','pro','custom') then v_requested else 'free' end,
        new.raw_user_meta_data->>'phone',
        new.raw_user_meta_data->>'social_media',
        new.raw_user_meta_data->>'nrp',
        new.raw_user_meta_data->>'institution',
        case
            when v_plan = 'trial' and new.raw_user_meta_data->>'trial_ends_at' is not null
                then least(
                    (new.raw_user_meta_data->>'trial_ends_at')::timestamptz,
                    now() + interval '30 days'
                )
            else null
        end
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- OPSIONAL — repair user existing yang self-assign paid plan lewat signup.
-- HATI-HATI: jangan jalankan kalau kamu pernah kasih plan berbayar MANUAL ke
-- user yang sah. Review dulu:
--
--   select id, email, plan, created_at from public.profiles
--    where plan in ('student', 'pro', 'custom');
--
-- Lalu kalau memang semua hasil self-assign, downgrade:
--
--   update public.profiles
--      set requested_plan = plan, plan = 'free'
--    where plan in ('student', 'pro', 'custom');
-- ---------------------------------------------------------------------------
