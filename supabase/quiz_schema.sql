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

-- Quizzes: semua user yang login bisa baca (publik untuk authenticated)
drop policy if exists "quizzes auth read" on public.quizzes;
create policy "quizzes auth read"
    on public.quizzes for select
    using (auth.uid() is not null);

-- Quiz attempts: user hanya bisa lihat & insert milik sendiri
drop policy if exists "attempts self read" on public.quiz_attempts;
create policy "attempts self read"
    on public.quiz_attempts for select
    using (auth.uid() = user_id);

drop policy if exists "attempts self insert" on public.quiz_attempts;
create policy "attempts self insert"
    on public.quiz_attempts for insert
    with check (auth.uid() = user_id);

-- Tidak ada update/delete — attempt sekali kunci.


-- =============================================================================
-- HELPER FUNCTION — increment credits + extra_uploads atomic
-- =============================================================================

create or replace function public.award_quiz_credits(
    p_user_id uuid,
    p_credits integer
) returns void
language plpgsql
security definer
as $$
begin
    update public.profiles
       set credits = credits + p_credits
     where id = p_user_id;
end;
$$;
