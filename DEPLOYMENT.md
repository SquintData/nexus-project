# Implantação do Nexus

[Voltar ao README](README.md)

Este documento preserva o roteiro de implantação existente, com caminhos atualizados. As marcações de conclusão anteriores não foram verificadas nesta revisão. Uma instalação própria também precisa aplicar as migrações em `supabase/migrations/`, implantar as funções em `supabase/functions/` e configurar os segredos exigidos por cada uma. Consulte [Desenvolvimento](docs/development.md) para a separação dos ambientes.

**Endereço de frontend registrado no projeto:** `https://usenexus.online` (Vercel — squintdatas-projects/frontend)

Confira as configurações abaixo no ambiente de destino. O repositório não comprova o estado atual dos painéis de serviço.

## 1. Cloudflare Turnstile (Captcha)

1. Acesse [cloudflare.com/products/turnstile](https://www.cloudflare.com/products/turnstile/) e crie uma conta (grátis).
2. **Add Site** → nome `nexus-frontend` → domínio `usenexus.online` (e `localhost` pra dev).
3. Anote **Site Key** (pública) e **Secret Key** (vai no Supabase).

## 2. Supabase Dashboard (Auth e serviços)

Em [supabase.com/app](https://supabase.com/app) → projeto Jarvis:

- **Authentication → Providers → Email**
  - ✅ Confirm email
  - ✅ Secure email change
- **Authentication → URL Configuration**
  - Site URL: `https://usenexus.online`
  - Redirect URLs (adicionar): `https://usenexus.online` + `http://localhost:5173`
- **Authentication → Attack Protection → CAPTCHA**
  - Provider: Cloudflare Turnstile
  - Secret Key: (do passo 1)

## 3. Vercel — configuração registrada

Projeto já deployado em `https://usenexus.online` (squintdatas-projects/frontend).

Após configurar o Turnstile (passo 1), adicione a env var pendente:
```bash
cd frontend
echo "<SITE_KEY>" | npx vercel env add VITE_TURNSTILE_SITEKEY production
npx vercel deploy --prod --yes
```

O `vercel.json` em `frontend/` já cuida do SPA fallback (refresh em `/app` não dá 404).

## 4. Agente local — configuração registrada

`SUPABASE_SERVICE_ROLE_KEY` removida do `.env`. O Sphere usa JWT do user logado.

## 5. Pareamento do agente local (novo fluxo)

Não precisa mais colar email/senha no `.env`. O agente troca um código curto
por um `refresh_token` de longa duração.

Pra cada nova máquina onde o agente vai rodar:

1. Logue no frontend → menu lateral → **Parear agente** → "Gerar código".
2. Copie o código de 8 caracteres (expira em 10 min, single-use).
3. No terminal da máquina alvo:
   ```bash
   cd nexus-project
   .venv\Scripts\python -m agent.main
   ```
4. Quando pedir "Código de pareamento:", cole o valor e dê enter.
5. O agente salva `AGENT_USER_EMAIL` + `AGENT_REFRESH_TOKEN` no `.env` local
   e segue o boot normal. Em execuções seguintes, ele usa o token automaticamente.

O `refresh_token` rotaciona em cada uso — o callback `_on_auth_change` no
`NexusDB` persiste o valor novo no `.env` toda vez. Se o agente ficar offline
por >30 dias (TTL do refresh token), basta repetir o pareamento.

## 6. Verificação end-to-end

Após tudo configurado:

- Abra `https://usenexus.online` em aba anônima.
- Clique "Não tem conta? Criar uma" → preencha → resolver captcha → criar.
- Verifique inbox: email de confirmação. Clique no link.
- Faça login. Verifique que cada página (Dashboard/Kanban/Chat/Agenda/Memory/Parear agente) carrega.
- Refresh em `/app` direto na URL → não dá 404 (SPA fallback OK).
- Em `/app/agente` → gere código → no terminal local rode `.venv\Scripts\python -m agent.main` → cole o código.
- Diga wake word → Sphere no navegador muda de cor (`agent-status:<user_id>` per-user).
