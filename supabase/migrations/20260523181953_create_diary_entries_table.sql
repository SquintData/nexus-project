create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.diary_entries enable row level security;

create policy "diary_owner_select" on public.diary_entries for select using (auth.uid() = user_id);
create policy "diary_owner_insert" on public.diary_entries for insert with check (auth.uid() = user_id);
create policy "diary_owner_update" on public.diary_entries for update using (auth.uid() = user_id);
create policy "diary_owner_delete" on public.diary_entries for delete using (auth.uid() = user_id);

create index diary_user_date_idx on public.diary_entries (user_id, date desc);

alter publication supabase_realtime add table public.diary_entries;
