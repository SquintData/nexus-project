# Desenvolvimento do Nexus

[Voltar ao README](../README.md)

## Ambientes

O painel React, o agente Python e os serviços do backend precisam apontar para o mesmo projeto. Os valores padrão do agente referenciam o backend Nexus existente; clonar o código não cria um ambiente independente.

Para usar um backend próprio, prepare o schema a partir de `supabase/migrations/`, configure autenticação e Realtime e implante as funções em `supabase/functions/`. As funções de voz, LLM, memória e assinatura têm dependências e segredos próprios: confira cada implementação antes de habilitar o respectivo fluxo.

## Frontend

Copie `frontend/.env.example` para `frontend/.env` e preencha:

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do backend |
| `VITE_SUPABASE_ANON_KEY` | Chave pública do projeto |
| `VITE_TURNSTILE_SITEKEY` | Chave pública de CAPTCHA, quando configurado no Auth |

Variáveis `VITE_*` são incorporadas ao JavaScript entregue ao navegador. Nunca use chaves de serviço ou de provedores nesse arquivo.

```powershell
cd frontend
npm ci
npm run dev
```

A rota inicial `/` é a apresentação do produto; o painel autenticado fica em `/app`, com páginas como `/app/kanban`, `/app/chat` e `/app/agente`. Chat e pareamento passam por controle de plano no frontend; a configuração completa também depende do backend.

## Agente no Windows

Execute os comandos na raiz, que contém o pacote `agent/`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m agent.setup_models
.\.venv\Scripts\python.exe -m agent.main
```

O script `setup.bat` é uma alternativa interativa. Ele remove uma `.venv` existente antes de reinstalar; os comandos manuais acima permitem controlar esse processo.

Não existe `.env.example` na raiz. Se precisar trocar o backend ou parâmetros do agente, crie um `.env` local na raiz com as variáveis lidas por [agent/config.py](../agent/config.py):

```dotenv
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
WAKE_WORD=ola nexus
```

Esses valores de exemplo precisam ser substituídos. O pareamento grava as credenciais de sessão nesse mesmo arquivo. OpenAI e Groq são acessados pelos proxies: as chaves dos provedores não são necessárias no agente.

A abertura de aplicativos depende do mapa `allowed_apps` de [agent/config.json](../agent/config.json), com caminhos adequados à máquina.

## Verificação manual do fluxo

1. Configurar banco, Auth e funções do backend.
2. Criar uma conta de teste e conferir o acesso ao painel.
3. Com acesso ao plano correspondente, abrir `/app/agente` e gerar um código.
4. Iniciar o agente e concluir o pareamento.
5. Dizer a palavra de ativação e solicitar uma ação reversível, como consultar tarefas.
6. Conferir áudio, resposta, persistência e atualização no painel.
7. Testar chat e recursos de assinatura separadamente.

Esta sequência é um roteiro de validação, não um registro de execução bem-sucedida.
