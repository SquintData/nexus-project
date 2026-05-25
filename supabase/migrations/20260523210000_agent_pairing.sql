-- Tabela de códigos de pareamento agente-usuário.
-- Fluxo: user logado no frontend gera código de 8 chars → cola no instalador
-- do agente local → Edge Function valida e devolve refresh_token de longa
-- duração que o agente persiste em .env, sem precisar de service_role.
create table public.agent_pairing_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz
);

create index agent_pairing_codes_user_idx on public.agent_pairing_codes(user_id);
create index agent_pairing_codes_expires_idx on public.agent_pairing_codes(expires_at)
  where consumed_at is null;

alter table public.agent_pairing_codes enable row level security;

-- User cria seus próprios códigos
create policy "pair_owner_insert" on public.agent_pairing_codes
  for insert with check (auth.uid() = user_id);

-- User vê seus próprios códigos (pra mostrar status na UI)
create policy "pair_owner_select" on public.agent_pairing_codes
  for select using (auth.uid() = user_id);

-- User pode cancelar seus próprios códigos
create policy "pair_owner_delete" on public.agent_pairing_codes
  for delete using (auth.uid() = user_id);

-- Sem UPDATE policy: só a Edge Function (com service_role) marca consumed_at.
