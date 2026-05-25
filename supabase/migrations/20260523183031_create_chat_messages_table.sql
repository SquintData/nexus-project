create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  source text not null check (source in ('voice','chat')),
  status text not null default 'done' check (status in ('pending','done','error')),
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat_owner_select" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_owner_insert" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "chat_owner_update" on public.chat_messages for update using (auth.uid() = user_id);
create policy "chat_owner_delete" on public.chat_messages for delete using (auth.uid() = user_id);

create index chat_user_created_idx on public.chat_messages (user_id, created_at asc);
create index chat_pending_idx on public.chat_messages (user_id, status) where status = 'pending';

alter publication supabase_realtime add table public.chat_messages;
