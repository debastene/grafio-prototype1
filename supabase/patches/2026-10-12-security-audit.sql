-- =============================================================================
-- PATCH 2026-10-12 — Perbaikan audit keamanan (RLS & RPC)
--
-- MASALAH yang ditutup:
--   1. Policy "profile self update" tidak membatasi KOLOM → dari browser user
--      bisa `update profiles set plan='pro', credits=99999` untuk dirinya.
--      Clamp plan di trigger signup jadi tidak berarti.
--   2. RPC award_quiz_credits(p_user_id, p_credits) SECURITY DEFINER tanpa cek
--      auth.uid() dan (default Supabase) bisa dipanggil role anon → siapa pun
--      bisa menambah/mengurangi kredit user MANA PUN.
--   3. Tabel quizzes bisa di-select penuh oleh user login → kunci jawaban
--      (correct_idx) terkirim ke browser sebelum kuis dikerjakan.
--   4. Policy insert quiz_attempts → user bisa insert skor palsu langsung.
--
-- SOLUSI:
--   - Hak UPDATE profiles dibatasi per kolom (name, phone, social_media).
--   - award_quiz_credits hanya untuk service_role.
--   - Kuis diakses lewat 3 fungsi SECURITY DEFINER yang memakai auth.uid():
--       list_week_quizzes()             → daftar kuis minggu ini + attempt user
--       get_quiz_public(p_quiz_id)      → soal TANPA correct_idx/explanation
--       submit_quiz(p_quiz_id, p_answers) → nilai, simpan attempt, beri kredit
--                                          dalam SATU transaksi (atomic)
--   - Client tidak lagi bisa select quizzes / insert quiz_attempts langsung.
--
-- CARA PAKAI: Supabase dashboard → SQL Editor → paste file ini → Run.
-- Idempotent — aman dijalankan ulang. Jalankan SETELAH deploy kode terbaru
-- (kode baru otomatis memakai fungsi ini; kode lama butuh akses tabel langsung).
--
-- VERIFIKASI (harus semua false / 0 baris):
--   select has_function_privilege('anon', 'public.award_quiz_credits(uuid,integer)', 'execute');
--   select has_function_privilege('authenticated', 'public.award_quiz_credits(uuid,integer)', 'execute');
--   select has_column_privilege('authenticated', 'public.profiles', 'plan', 'UPDATE');
--   select has_column_privilege('authenticated', 'public.profiles', 'credits', 'UPDATE');
--   select policyname from pg_policies where tablename in ('quizzes') ;
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. PROFILES — user hanya boleh mengubah kolom profil biasa
-- -----------------------------------------------------------------------------

revoke insert, update, delete on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant update (name, phone, social_media) on public.profiles to authenticated;

drop policy if exists "profile self update" on public.profiles;
create policy "profile self update"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);


-- -----------------------------------------------------------------------------
-- 2. award_quiz_credits — hanya server (service_role)
-- -----------------------------------------------------------------------------

create or replace function public.award_quiz_credits(
    p_user_id uuid,
    p_credits integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_credits is null or p_credits < 0 or p_credits > 3 then
        raise exception 'invalid_credits' using errcode = '22023';
    end if;
    update public.profiles
       set credits = credits + p_credits
     where id = p_user_id;
end;
$$;

revoke execute on function public.award_quiz_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.award_quiz_credits(uuid, integer) to service_role;


-- -----------------------------------------------------------------------------
-- 3. KUIS — akses hanya lewat fungsi
-- -----------------------------------------------------------------------------

drop policy if exists "quizzes auth read" on public.quizzes;
drop policy if exists "attempts self insert" on public.quiz_attempts;
-- "attempts self read" tetap: user boleh melihat attempt miliknya sendiri.

revoke all on public.quizzes from anon, authenticated;
revoke insert, update, delete on public.quiz_attempts from anon, authenticated;

-- Senin minggu ini (WIB) — sama dengan thisWeekStartWIB() di lib/quiz/types.ts
create or replace function public.quiz_current_week()
returns date
language sql
stable
set search_path = public
as $$
    select (date_trunc('week', now() at time zone 'Asia/Jakarta'))::date;
$$;

create or replace function public.list_week_quizzes()
returns table (
    id uuid,
    title text,
    category text,
    slot integer,
    question_count integer,
    attempt jsonb
)
language sql
stable
security definer
set search_path = public
as $$
    select q.id,
           q.title,
           q.category,
           q.slot,
           jsonb_array_length(q.questions),
           (select jsonb_build_object('score', a.score, 'total', a.total, 'credits_awarded', a.credits_awarded)
              from public.quiz_attempts a
             where a.quiz_id = q.id and a.user_id = auth.uid())
      from public.quizzes q
     where auth.uid() is not null
       and q.week_start = public.quiz_current_week()
     order by q.category, q.slot;
$$;

create or replace function public.get_quiz_public(p_quiz_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
               'id', q.id,
               'title', q.title,
               'category', q.category,
               'week_start', q.week_start,
               'expired', q.week_start <> public.quiz_current_week(),
               -- HANYA teks soal & pilihan — correct_idx/explanation tidak pernah dikirim
               'questions', (
                   select coalesce(jsonb_agg(jsonb_build_object('q', e -> 'q', 'choices', e -> 'choices') order by ord), '[]'::jsonb)
                     from jsonb_array_elements(q.questions) with ordinality as t(e, ord)
               ),
               'attempt', (
                   select jsonb_build_object('score', a.score, 'total', a.total, 'credits_awarded', a.credits_awarded)
                     from public.quiz_attempts a
                    where a.quiz_id = q.id and a.user_id = auth.uid()
               )
           )
      from public.quizzes q
     where q.id = p_quiz_id
       and auth.uid() is not null;
$$;

create or replace function public.submit_quiz(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_quiz public.quizzes%rowtype;
    v_total integer;
    v_score integer := 0;
    v_credits integer;
    v_corrections jsonb := '[]'::jsonb;
    v_q jsonb;
    v_chosen jsonb;
    v_correct integer;
    v_is_correct boolean;
    v_prev jsonb;
    i integer;
begin
    if v_uid is null then
        raise exception 'auth_required' using errcode = '28000';
    end if;

    select * into v_quiz from public.quizzes where id = p_quiz_id;
    if not found then
        raise exception 'quiz_not_found' using errcode = 'P0002';
    end if;
    if v_quiz.week_start <> public.quiz_current_week() then
        raise exception 'quiz_expired' using errcode = 'P0001';
    end if;

    select jsonb_build_object('score', score, 'total', total, 'credits_awarded', credits_awarded)
      into v_prev
      from public.quiz_attempts
     where user_id = v_uid and quiz_id = p_quiz_id;
    if v_prev is not null then
        return jsonb_build_object('already_submitted', true, 'previous', v_prev);
    end if;

    v_total := jsonb_array_length(v_quiz.questions);
    if v_total = 0 or p_answers is null or jsonb_typeof(p_answers) <> 'array'
       or jsonb_array_length(p_answers) <> v_total then
        raise exception 'invalid_answers' using errcode = '22023';
    end if;

    for i in 0 .. v_total - 1 loop
        v_q := v_quiz.questions -> i;
        v_chosen := p_answers -> i;
        if jsonb_typeof(v_chosen) not in ('number', 'null') then
            raise exception 'invalid_answers' using errcode = '22023';
        end if;
        v_correct := (v_q ->> 'correct_idx')::integer;
        v_is_correct := jsonb_typeof(v_chosen) = 'number' and (v_chosen #>> '{}')::numeric = v_correct;
        if v_is_correct then
            v_score := v_score + 1;
        end if;
        v_corrections := v_corrections || jsonb_build_array(jsonb_build_object(
            'idx', i,
            'chosen', v_chosen,
            'correct_idx', v_correct,
            'is_correct', v_is_correct,
            'explanation', v_q -> 'explanation',
            'question', v_q -> 'q',
            'choices', v_q -> 'choices'
        ));
    end loop;

    -- Sama dengan creditsForScore() di lib/quiz/types.ts
    v_credits := case
        when v_score::numeric / v_total >= 0.9 then 3
        when v_score::numeric / v_total >= 0.7 then 2
        when v_score::numeric / v_total >= 0.5 then 1
        else 0
    end;

    insert into public.quiz_attempts (user_id, quiz_id, answers, score, total, credits_awarded)
    values (v_uid, p_quiz_id, p_answers, v_score, v_total, v_credits);

    if v_credits > 0 then
        update public.profiles set credits = credits + v_credits where id = v_uid;
    end if;

    return jsonb_build_object(
        'ok', true,
        'quiz_id', v_quiz.id,
        'title', v_quiz.title,
        'score', v_score,
        'total', v_total,
        'pct', round(v_score * 100.0 / v_total),
        'credits_awarded', v_credits,
        'corrections', v_corrections
    );
exception
    when unique_violation then
        -- Dua submit bersamaan: yang kedua ditolak oleh unique (user_id, quiz_id).
        return jsonb_build_object('already_submitted', true);
end;
$$;

revoke execute on function public.quiz_current_week() from public, anon;
revoke execute on function public.list_week_quizzes() from public, anon;
revoke execute on function public.get_quiz_public(uuid) from public, anon;
revoke execute on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.quiz_current_week() to authenticated, service_role;
grant execute on function public.list_week_quizzes() to authenticated;
grant execute on function public.get_quiz_public(uuid) to authenticated;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;
