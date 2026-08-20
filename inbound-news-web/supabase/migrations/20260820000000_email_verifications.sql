create table if not exists public.email_verifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index idx_email_verifications_email on public.email_verifications(email);
create index idx_email_verifications_token_hash on public.email_verifications(token_hash);

alter table public.email_verifications enable row level security;

create policy "Service role can manage email verifications"
  on public.email_verifications for all
  using (true)
  with check (true);
