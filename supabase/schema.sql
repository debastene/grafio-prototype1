-- =============================================================================
-- Grafio database schema for Supabase Postgres
--
-- USAGE:
--   1. Create a new Supabase project at https://supabase.com
--   2. Open SQL Editor → New query
--   3. Paste this entire file → Run
--   4. Copy your project URL + anon key into .env.local:
--        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
--        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
--
-- TABLES:
--   - profiles  : user profile (extends auth.users), 1-to-1
--   - projects  : saved analysis snapshots, 1-to-many per user
--
-- SECURITY:
--   - Row Level Security enabled — users can ONLY see/modify their own rows
--   - public.profiles row auto-created via trigger when auth.users row inserts
-- =============================================================================

-- Required extension
create extension if not exists "uuid-ossp";


-- =============================================================================
-- PROFILES TABLE
-- =============================================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    name text not null default '',
    plan text not null default 'free' check (plan in ('free', 'trial', 'student', 'pro', 'custom')),
    phone text,
    social_media text,
    nrp text,
    institution text,
    trial_ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Auto-update updated_at on row modification
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- Auto-create profile row when a new auth.users record is created.
-- name + plan + extras come from raw_user_meta_data passed during signUp.
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
    insert into public.profiles (id, email, name, plan, phone, social_media, nrp, institution, trial_ends_at)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'plan', 'free'),
        new.raw_user_meta_data->>'phone',
        new.raw_user_meta_data->>'social_media',
        new.raw_user_meta_data->>'nrp',
        new.raw_user_meta_data->>'institution',
        case
            when new.raw_user_meta_data->>'trial_ends_at' is not null
                then (new.raw_user_meta_data->>'trial_ends_at')::timestamptz
            else null
        end
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- =============================================================================
-- PROJECTS TABLE
-- =============================================================================

create table if not exists public.projects (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    file_name text not null,
    domain_id text not null default 'generic',
    domain_name text not null default 'Generic',
    domain_emoji text not null default '📊',
    row_count integer not null default 0,
    column_count integer not null default 0,
    health_score integer,
    summary text not null default '',
    conclusion text,
    thumbnail jsonb,
    snapshot jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_created_at_idx
    on public.projects (user_id, created_at desc);

create index if not exists projects_user_id_domain_idx
    on public.projects (user_id, domain_id);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
    before update on public.projects
    for each row execute function public.set_updated_at();


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- Profiles: user can see/update their own row only
drop policy if exists "profile self read" on public.profiles;
create policy "profile self read"
    on public.profiles for select
    using (auth.uid() = id);

drop policy if exists "profile self update" on public.profiles;
create policy "profile self update"
    on public.profiles for update
    using (auth.uid() = id);

-- Projects: full CRUD on own rows only
drop policy if exists "projects self read" on public.projects;
create policy "projects self read"
    on public.projects for select
    using (auth.uid() = user_id);

drop policy if exists "projects self insert" on public.projects;
create policy "projects self insert"
    on public.projects for insert
    with check (auth.uid() = user_id);

drop policy if exists "projects self update" on public.projects;
create policy "projects self update"
    on public.projects for update
    using (auth.uid() = user_id);

drop policy if exists "projects self delete" on public.projects;
create policy "projects self delete"
    on public.projects for delete
    using (auth.uid() = user_id);
