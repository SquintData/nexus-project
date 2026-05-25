
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists user_preferences_user_idx on public.user_preferences(user_id);

alter table public.user_preferences enable row level security;

create policy "prefs_owner_select" on public.user_preferences for select using (auth.uid() = user_id);
create policy "prefs_owner_insert" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "prefs_owner_update" on public.user_preferences for update using (auth.uid() = user_id);
create policy "prefs_owner_delete" on public.user_preferences for delete using (auth.uid() = user_id);
