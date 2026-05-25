create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions_owner_select" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_owner_insert" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_owner_update" on public.transactions
  for update using (auth.uid() = user_id);
create policy "transactions_owner_delete" on public.transactions
  for delete using (auth.uid() = user_id);

create index transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

alter publication supabase_realtime add table public.transactions;
