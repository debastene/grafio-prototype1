-- =============================================================================
-- Grafio Quiz System — schema add-on (eval #7).
--
-- Append-only: jalankan setelah schema.sql utama selesai. Boleh dijalankan
-- ulang (semua statement idempotent).
--
-- TABLES:
--   - quizzes        : bank soal mingguan (3 datsci + 3 common = 6 per minggu)
--   - quiz_attempts  : log percobaan user per quiz
--
-- PROFILES tambah 2 kolom:
--   - credits         : reward dari quiz (bisa di-spend ke fitur bonus nanti)
--   - extra_uploads   : bonus upload jangka pendek
--
-- REWARD SCALE (dieksekusi server-side di /api/quiz/submit):
--   - score >= 90%  → +3 credits  (luar biasa)
--   - score 70-89%  → +2 credits  (bagus)
--   - score 50-69%  → +1 credit   (cukup)
--   - score < 50%   → 0           (coba kuis lain)
--
-- =============================================================================

-- =============================================================================
-- PROFILES — tambah kolom credits & extra_uploads
-- =============================================================================

alter table public.profiles
  add column if not exists credits integer not null default 0,
  add column if not exists extra_uploads integer not null default 0;


-- =============================================================================
-- QUIZZES TABLE — bank soal mingguan
-- =============================================================================

create table if not exists public.quizzes (
    id uuid primary key default uuid_generate_v4(),
    -- Minggu mulai (Senin WIB) — dipakai untuk filter "quiz minggu ini"
    week_start date not null,
    -- Kategori: 'datsci' (data science) atau 'common' (general knowledge)
    category text not null check (category in ('datsci', 'common')),
    -- Slot 1-3 supaya per minggu maksimal 3 quiz per kategori
    slot integer not null check (slot >= 1 and slot <= 3),
    title text not null,
    -- Soal disimpan sebagai JSONB array of:
    --   { q: string, choices: string[4], correct_idx: int, explanation: string }
    questions jsonb not null,
    -- AI model yang generate (untuk debugging / quality tracking)
    generated_by text,
    created_at timestamptz not null default now(),
    unique (week_start, category, slot)
);

create index if not exists quizzes_week_start_idx
    on public.quizzes (week_start desc);


-- =============================================================================
-- QUIZ ATTEMPTS TABLE — 1 user × 1 quiz × 1 attempt per week
-- =============================================================================

create table if not exists public.quiz_attempts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    quiz_id uuid not null references public.quizzes(id) on delete cascade,
    -- Array angka: jawaban user, urut sesuai questions di quizzes.questions
    answers jsonb not null,
    score integer not null check (score >= 0),
    total integer not null check (total > 0),
    credits_awarded integer not null default 0,
    created_at timestamptz not null default now(),
    unique (user_id, quiz_id)
);

create index if not exists quiz_attempts_user_id_idx
    on public.quiz_attempts (user_id, created_at desc);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;

-- Kuis TIDAK bisa di-select langsung oleh client (correct_idx ada di kolom
-- questions). Akses hanya lewat fungsi list_week_quizzes / get_quiz_public /
-- submit_quiz di bawah, yang memakai auth.uid().
drop policy if exists "quizzes auth read" on public.quizzes;
revoke all on public.quizzes from anon, authenticated;

-- Quiz attempts: user hanya bisa MELIHAT miliknya sendiri. Insert hanya lewat
-- submit_quiz() supaya skor tidak bisa dipalsukan.
drop policy if exists "attempts self read" on public.quiz_attempts;
create policy "attempts self read"
    on public.quiz_attempts for select
    using (auth.uid() = user_id);

drop policy if exists "attempts self insert" on public.quiz_attempts;
revoke insert, update, delete on public.quiz_attempts from anon, authenticated;


-- =============================================================================
-- HELPER FUNCTION — tambah kredit (HANYA service_role)
-- =============================================================================

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


-- =============================================================================
-- FUNGSI KUIS (SECURITY DEFINER, memakai auth.uid())
-- =============================================================================

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
