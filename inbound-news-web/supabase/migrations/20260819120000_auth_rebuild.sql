-- =============================================================================
-- Migration: Custom Auth System - Argon2id, JWT, Edge-Aware Sessions
-- Date: 2026-08-19
-- =============================================================================

-- 1. Auth credentials table (Argon2id password hashes)
create table if not exists public.auth_credentials (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  password_hash   text not null,
  hash_algorithm  text not null default 'argon2id',
  hash_version    integer not null default 19,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.auth_credentials is 'Argon2id password hashes - decoupled from Supabase auth for edge verification.';

-- 2. Refresh tokens table
create table if not exists public.refresh_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  token_hash      text not null,
  device_info     text,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz
);

comment on table public.refresh_tokens is 'Hashed refresh tokens for session management.';

-- 3. Email verification tokens
create table if not exists public.email_verification_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  token_hash      text not null,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

comment on table public.email_verification_tokens is 'Time-limited email verification tokens.';

-- 4. Password reset tokens
create table if not exists public.password_reset_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  token_hash      text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.password_reset_tokens is 'Time-limited password reset tokens.';

-- 5. Email change nonces (dual-nonce workflow)
create table if not exists public.email_change_nonces (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  nonce_type      text not null check (nonce_type in ('old_email_revoke', 'new_email_verify')),
  new_email       text not null,
  token_hash      text not null,
  expires_at      timestamptz not null,
  used            boolean not null default false,
  created_at      timestamptz not null default now()
);

comment on table public.email_change_nonces is 'Dual-nonce tokens for secure email address changes.';

-- 6. Login attempts (for server-side rate limiting)
create table if not exists public.login_attempts (
  id              bigserial primary key,
  identifier      text not null,
  ip_address      text,
  success         boolean not null,
  created_at      timestamptz not null default now()
);

comment on table public.login_attempts is 'Login attempt log for rate limiting and security auditing.';

-- 7. Indexes
create index if not exists idx_refresh_tokens_user on public.refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_hash on public.refresh_tokens(token_hash);
create index if not exists idx_refresh_tokens_expires on public.refresh_tokens(expires_at);
create index if not exists idx_email_verify_user on public.email_verification_tokens(user_id);
create index if not exists idx_password_reset_user on public.password_reset_tokens(user_id);
create index if not exists idx_password_reset_hash on public.password_reset_tokens(token_hash);
create index if not exists idx_email_change_user on public.email_change_nonces(user_id, nonce_type);
create index if not exists idx_login_attempts_identifier on public.login_attempts(identifier, created_at);
create index if not exists idx_login_attempts_ip on public.login_attempts(ip_address, created_at);

-- 8. Updated-at trigger for auth_credentials
drop trigger if exists set_updated_at_auth on public.auth_credentials;
create trigger set_updated_at_auth
  before update on public.auth_credentials
  for each row
  execute function public.handle_updated_at();

-- 9. RLS policies (service-role only for auth tables)
alter table public.auth_credentials enable row level policy;
alter table public.refresh_tokens enable row level policy;
alter table public.email_verification_tokens enable row level policy;
alter table public.password_reset_tokens enable row level policy;
alter table public.email_change_nonces enable row level policy;
alter table public.login_attempts enable row level policy;

-- No user-facing RLS policies - all auth tables accessed via service role only
-- This ensures token hashes, password hashes, and nonces are never exposed
-- through Supabase's anon key or user-scoped connections.
