
-- 1. chat_sessions table
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists chat_sessions_user_idx on public.chat_sessions(user_id, last_message_at desc);

alter table public.chat_sessions enable row level security;

create policy "sessions_owner_select" on public.chat_sessions for select using (auth.uid() = user_id);
create policy "sessions_owner_insert" on public.chat_sessions for insert with check (auth.uid() = user_id);
create policy "sessions_owner_update" on public.chat_sessions for update using (auth.uid() = user_id);
create policy "sessions_owner_delete" on public.chat_sessions for delete using (auth.uid() = user_id);

-- 2. add session_id to chat_messages
alter table public.chat_messages
  add column if not exists session_id uuid references public.chat_sessions(id) on delete cascade;

create index if not exists chat_messages_session_idx on public.chat_messages(session_id, created_at);

-- 3. Backfill: existing source='chat' messages → "Conversas antigas" session per user
do $$
declare
  u record;
  legacy_session_id uuid;
begin
  for u in
    select distinct user_id from public.chat_messages
    where source = 'chat' and session_id is null
  loop
    insert into public.chat_sessions (user_id, title, created_at, updated_at, last_message_at)
    select u.user_id,
           'Conversas antigas',
           min(created_at),
           max(created_at),
           max(created_at)
    from public.chat_messages
    where user_id = u.user_id and source = 'chat' and session_id is null
    returning id into legacy_session_id;

    update public.chat_messages
    set session_id = legacy_session_id
    where user_id = u.user_id and source = 'chat' and session_id is null;
  end loop;
end $$;
