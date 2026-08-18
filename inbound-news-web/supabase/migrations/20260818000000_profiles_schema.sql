-- =============================================================================
-- Migration: profiles schema, RLS policies, and auto-provision trigger
-- Date: 2026-08-18
-- =============================================================================

-- 1. Profiles table — strictly decoupled from auth.users
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  -- Public / editorial
  handle        text unique,
  byline        text,
  avatar_url    text,
  bio           text,
  -- Personal information
  first_name    text,
  last_name     text,
  phone         text,
  address       text,
  -- Preferences
  newsletter_daily     boolean not null default false,
  newsletter_breaking  boolean not null default false,
  topic_interests      text[] not null default '{}',
  theme                text not null default 'system' check (theme in ('light','dark','system')),
  -- Legacy preferences (kept for backward compat)
  display_name  text,
  default_tier  text not null default 'standard',
  default_lang  text not null default 'en',
  stealth_mode  boolean not null default false,
  telegram_digest boolean not null default false,
  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Editorial user profile — decoupled from auth.users via RLS.';

-- 2. Updated-at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 3. Auto-provision profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 4. Row Level Security
alter table public.profiles enable row level policy;

-- Public read for editorial bylines and comment metadata
create policy "Public read for editorial bylines"
  on public.profiles
  for select
  using (true);

-- Owners can insert their own profile row (fallback when trigger hasn't fired)
create policy "Owners can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Owners can update their own profile
create policy "Owners can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Owners can delete their own profile
create policy "Owners can delete own profile"
  on public.profiles
  for delete
  using (auth.uid() = id);

-- 5. Indexes
create index if not exists idx_profiles_handle on public.profiles (handle);
create index if not exists idx_profiles_updated_at on public.profiles (updated_at desc);
