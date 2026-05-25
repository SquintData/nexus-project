# Nexus — Assistente Pessoal Híbrido

Agente local Python (voz + automação de desktop) + interface web React + backend Supabase.

## Estrutura

```
agent/      Python local agent (wake word, STT, LLM, TTS, desktop)
frontend/   React + Vite + Tailwind (UI)
supabase/   Migrations e referência de schema
```

## Pré-requisitos

- **Python 3.11 ou 3.12** (3.14 pode quebrar `vosk`/`pyaudio` por falta de wheels). Verificar com `python --version`.
- **Node.js 20+ LTS** — instale via [nodejs.org](https://nodejs.org/) ou `winget install OpenJS.NodeJS.LTS`.
- Windows com microfone + speakers ativos.

## Setup

### 1. Variáveis de ambiente

Copie `.env.example` → `.env` na raiz e em `frontend/`:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Preencha com:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` (já populados com o projeto Jarvis)
- `GROQ_API_KEY`
- `OPENAI_API_KEY`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` no frontend/.env
- `VITE_TURNSTILE_SITEKEY` no frontend/.env (opcional em dev — só obrigatório em prod)

Credenciais do agente (`AGENT_USER_EMAIL`, `AGENT_REFRESH_TOKEN`) são geradas
automaticamente pelo fluxo de pareamento — basta criar a conta no frontend e
rodar `python -m agent.main`; ele pede um código pareamento gerado em `/agente`.

Para produção (deploy Vercel, Supabase Auth hardening, captcha), veja [DEPLOYMENT.md](DEPLOYMENT.md).

### 2. Agente Python

```bash
cd agent
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
python -m agent.setup_models    # baixa modelo Vosk pt-BR (~30MB)
python -m agent.main            # inicia loop: "Olá, Nexus" para ativar
```

Requisitos extras (Windows):
- Microfone funcionando
- Speakers funcionando
- `pyaudio` precisa de Microsoft Visual C++ Build Tools (se falhar: `pip install pipwin && pipwin install pyaudio`)

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Crie uma conta na tela de login (sign-up) — o trigger `handle_new_user` cria o profile automaticamente. Depois vá em **Parear agente** no menu lateral, gere um código, e cole no terminal quando o agente pedir. Não precisa mais editar o `.env` à mão.

### 4. Build do agente (.exe — opcional)

```bash
pip install pyinstaller
pyinstaller --onefile --name nexus-agent agent/main.py
```

## Comandos de voz suportados (MVP)

| Comando | Intent |
|---|---|
| "Abra o VS Code" | `open_app` |
| "Abra youtube.com" | `open_url` |
| "Crie uma tarefa: estudar Python" | `create_task` |
| "Marque reunião amanhã às 14h" | `create_event` (pede data se faltar) |
| "Salve uma ideia: ..." | `create_idea` |
| "Modo Produtividade" | `run_routine` |
| "Lembre que meu hobby é xadrez" | `store_memory` |

## Arquitetura

```
[Microfone] → Vosk (local) → wake word detectado
            → grava 5s → Groq Whisper (STT) → texto
            → GPT-4o-mini (intent + params) → Action
            → Supabase (persist) / Desktop (subprocess) / TTS
            → OpenAI TTS → speakers
                                     ↓
                          Supabase Realtime
                                     ↓
                          Frontend React (auto-update)
```

## Stack

- **Backend**: Supabase (Postgres, Auth, Realtime, Storage)
- **Agente**: Python 3.11+, Vosk, Groq SDK, OpenAI SDK, sounddevice
- **Frontend**: Vite, React 18, TypeScript, Tailwind, react-router-dom

## Segurança

- RLS ativo em todas as tabelas: cada usuário só vê suas linhas
- Áudio contínuo nunca sai da máquina (wake word offline via Vosk)
- Apenas o comando pós-trigger é enviado às APIs
