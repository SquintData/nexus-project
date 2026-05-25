create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.habits enable row level security;

create policy "habits_owner_select" on public.habits for select using (auth.uid() = user_id);
create policy "habits_owner_insert" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_owner_delete" on public.habits for delete using (auth.uid() = user_id);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

alter table public.habit_logs enable row level security;

create policy "habit_logs_owner_select" on public.habit_logs for select using (auth.uid() = user_id);
create policy "habit_logs_owner_insert" on public.habit_logs for insert with check (auth.uid() = user_id);
create policy "habit_logs_owner_delete" on public.habit_logs for delete using (auth.uid() = user_id);

create index habit_logs_habit_date_idx on public.habit_logs (habit_id, date desc);

alter publication supabase_realtime add table public.habits;
alter publication supabase_realtime add table public.habit_logs;
