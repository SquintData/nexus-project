"""OpenAI tool_calls schema for Nexus."""
from __future__ import annotations


def build_tools_schema(allowed_apps: list[str], routines: list[str]) -> list[dict]:
    apps_desc = ", ".join(allowed_apps) if allowed_apps else "(nenhum cadastrado)"
    routines_desc = ", ".join(routines) if routines else "(nenhuma cadastrada)"
    return [
        {
            "type": "function",
            "function": {
                "name": "open_app",
                "description": "Abre um aplicativo nativo no computador. Use APENAS para apps de desktop instalados.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "app": {
                            "type": "string",
                            "description": f"Nome do app em minúsculas. Apps disponíveis: {apps_desc}",
                        },
                    },
                    "required": ["app"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "open_url",
                "description": "Abre um site no navegador padrão. Use para serviços web (youtube, gmail, github, etc).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "URL completa (https://...)"},
                    },
                    "required": ["url"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "play_music",
                "description": "Busca e toca música/artista no YouTube (primeiro resultado).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Nome da música, artista ou banda."},
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "run_routine",
                "description": (
                    f"Executa uma ROTINA SALVA pelo usuário (lote de apps/URLs). "
                    f"USE SEMPRE QUE o usuário disser o nome de uma rotina existente "
                    f"(mesmo que aproximado). Rotinas disponíveis: [{routines_desc}]. "
                    f"NUNCA abra apps individuais quando o usuário pedir uma rotina — "
                    f"chame APENAS esta tool com o nome correspondente."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": f"Nome EXATO de uma destas rotinas: {routines_desc}",
                        },
                    },
                    "required": ["name"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": (
                    "Cria uma tarefa ÚNICA no Kanban — algo que o usuário precisa fazer UMA VEZ "
                    "e depois está concluído. Ex: 'comprar presente', 'enviar relatório', 'ligar pro médico'. "
                    "NUNCA use para comportamentos recorrentes diários (academia, meditação, leitura) — "
                    "esses são HÁBITOS, use create_habit."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "priority": {"type": "integer", "minimum": 0, "maximum": 5},
                    },
                    "required": ["title"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_event",
                "description": "Cria compromisso na Agenda. Se faltar data/hora, NÃO chame — peça ao usuário primeiro.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "start_at": {"type": "string", "description": "ISO 8601 com timezone (ex: 2026-05-14T14:00:00-03:00)"},
                        "location": {"type": "string"},
                    },
                    "required": ["title", "start_at"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_idea",
                "description": "Salva ideia/nota textual.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string"},
                        "tags": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["content"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "store_memory",
                "description": "Salva fato pessoal do usuário (nome, profissão, preferências, hobbies).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string", "description": "Chave curta snake_case (ex: nome, profissao, hobby)"},
                        "value": {"type": "string"},
                    },
                    "required": ["key", "value"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_tasks",
                "description": (
                    "CONSULTA as tarefas do usuário no Kanban. Use quando o usuário "
                    "PERGUNTAR sobre tarefas ('quais minhas tarefas', 'o que tenho pra fazer', "
                    "'minhas pendências'). NÃO use para criar — só para ler/responder."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["todo", "doing", "done"],
                            "description": "Filtro opcional. Omita para todas as não concluídas.",
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_agenda",
                "description": (
                    "CONSULTA os compromissos futuros do usuário na Agenda. Use quando o "
                    "usuário PERGUNTAR sobre eventos/compromissos ('o que tenho hoje', "
                    "'minha agenda da semana', 'tenho algum compromisso'). Só para ler."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 60,
                            "description": "Janela em dias a partir de agora. Hoje=1, semana=7. Padrão 7.",
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_ideas",
                "description": (
                    "CONSULTA as ideias/notas salvas do usuário. Use quando o usuário "
                    "PERGUNTAR sobre ideias ('quais minhas ideias', 'me lembra aquela nota'). "
                    "Só para ler."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_task",
                "description": (
                    "Move uma tarefa para outro status no Kanban (a fazer / em andamento / "
                    "concluída). Use quando o usuário disser 'marca X como concluída', "
                    "'comecei a tarefa Y', etc. "
                    "Passe `title` com o nome da tarefa (parcial OK) OU `id` se já tiver. "
                    "NÃO chame get_tasks antes — chame update_task diretamente com o título."
                    "NÃO precisa de confirmação (é reversível)."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Nome (ou parte) da tarefa. Prefira isso quando o usuário mencionar o nome.",
                        },
                        "id": {
                            "type": "string",
                            "description": "id exato da tarefa — use APENAS se já tiver de um get_tasks anterior.",
                        },
                        "status": {
                            "type": "string",
                            "enum": ["todo", "doing", "done"],
                            "description": "novo status: todo=a fazer, doing=em andamento, done=concluída",
                        },
                    },
                    "required": ["status"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_task",
                "description": (
                    "EXCLUI uma tarefa PERMANENTEMENTE. Operação PERIGOSA e irreversível. "
                    "SÓ chame depois de ter o `id` exato (via get_tasks) E o usuário ter "
                    "CONFIRMADO verbalmente. Veja a REGRA DE EXCLUSÃO no system prompt."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "id exato da tarefa (de get_tasks)"},
                    },
                    "required": ["id"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_event",
                "description": (
                    "EXCLUI um compromisso PERMANENTEMENTE. Operação PERIGOSA e irreversível. "
                    "SÓ chame depois de ter o `id` exato (via get_agenda) E o usuário ter "
                    "CONFIRMADO verbalmente. Veja a REGRA DE EXCLUSÃO no system prompt."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "id exato do compromisso (de get_agenda)"},
                    },
                    "required": ["id"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_idea",
                "description": (
                    "EXCLUI uma ideia PERMANENTEMENTE. Operação PERIGOSA e irreversível. "
                    "SÓ chame depois de ter o `id` exato (via get_ideas) E o usuário ter "
                    "CONFIRMADO verbalmente. Veja a REGRA DE EXCLUSÃO no system prompt."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "id exato da ideia (de get_ideas)"},
                    },
                    "required": ["id"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_event",
                "description": (
                    "Reagenda ou muda o local de um compromisso futuro. "
                    "Chame IMEDIATAMENTE quando o usuário pedir reagendamento — NÃO anuncie. "
                    "Converta datas relativas ('sexta', 'amanhã') para ISO 8601 com timezone -03:00. "
                    "Passe `title` (parcial OK) + `new_start_at` e/ou `new_location`. "
                    "Sem chamar get_agenda antes. Sem confirmação."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Nome (parcial) do compromisso"},
                        "new_start_at": {"type": "string", "description": "Nova data/hora ISO 8601 com timezone"},
                        "new_location": {"type": "string", "description": "Novo local (opcional)"},
                    },
                    "required": ["title"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_memory",
                "description": (
                    "Lista TUDO que está salvo na memória pessoal do usuário. Use quando o "
                    "usuário perguntar 'o que você sabe sobre mim?', 'o que está na sua memória?', "
                    "'quais informações você tem de mim?'."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "add_diary_entry",
                "description": (
                    "Salva uma anotação no diário pessoal do usuário (entrada do dia de hoje). "
                    "Use quando o usuário disser 'anota no diário', 'registra no diário', "
                    "'escreve no meu diário que...'. Se já existe entrada de hoje, o texto é "
                    "concatenado. Capture APENAS o conteúdo da anotação, sem 'anota no diário que'."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Texto da anotação do diário."},
                    },
                    "required": ["content"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_habit",
                "description": (
                    "Cria um novo HÁBITO — comportamento que o usuário quer repetir TODO DIA. "
                    "Ex: meditação, exercício, leitura, beber água, estudar. "
                    "Use quando o usuário disser 'adiciona hábito de X', 'quero criar o hábito de X', "
                    "'adiciona X nos meus hábitos'. NUNCA use para tarefas únicas — essas vão em create_task."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Nome do hábito (curto, ex: 'Meditação', 'Academia')."},
                    },
                    "required": ["name"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "complete_habit",
                "description": (
                    "Marca um hábito EXISTENTE como concluído hoje. Use quando o usuário disser "
                    "'completei X', 'fiz X hoje', 'terminei X'. "
                    "Passe o nome do hábito como informado."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Nome (ou parte) do hábito."},
                    },
                    "required": ["name"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_habits",
                "description": (
                    "Lista os hábitos do usuário com status de hoje. Use quando o usuário "
                    "perguntar 'quais meus hábitos', 'o que tenho pra fazer hoje'."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_transaction",
                "description": (
                    "Registrar uma transação financeira. Use quando o usuário disser que "
                    "GASTOU/PAGOU algo (type='expense') ou RECEBEU/GANHOU algo (type='income'). "
                    "Extraia o valor numérico em reais. A descrição é opcional — capte se o "
                    "usuário disser com o que foi (ex: 'com mercado', 'do salário')."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["income", "expense"],
                            "description": "income = recebimento; expense = gasto",
                        },
                        "amount": {
                            "type": "number",
                            "minimum": 0.01,
                            "description": "Valor em reais (positivo).",
                        },
                        "description": {
                            "type": "string",
                            "description": "Curta descrição opcional (ex: 'mercado', 'salário').",
                        },
                    },
                    "required": ["type", "amount"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_finance_summary",
                "description": (
                    "Consulta saldo total e totais do mês atual (entradas e saídas). Use quando "
                    "o usuário perguntar 'qual meu saldo', 'quanto gastei esse mês', 'quanto "
                    "recebi esse mês', 'como estão minhas finanças'."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_memory",
                "description": (
                    "Remove uma informação da memória. Use quando o usuário disser "
                    "'esquece que eu gosto de X', 'remove minha profissão da memória'. "
                    "Chame get_memory antes se não souber a chave exata. "
                    "NÃO precisa de confirmação (pode ser re-adicionada)."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string", "description": "Chave exata snake_case (de get_memory)"},
                    },
                    "required": ["key"],
                    "additionalProperties": False,
                },
            },
        },
    ]


SYSTEM_PROMPT = """Você é Nexus, assistente pessoal inteligente em português (Brasil).

━━━ LEI FUNDAMENTAL (leia antes de tudo) ━━━
Se o usuário pede qualquer AÇÃO (abrir, criar, marcar, reagendar, excluir, esquecer), você DEVE chamar a ferramenta correspondente NA MESMA resposta onde falar sobre ela. JAMAIS diga "vou fazer X", "Um momento", "aguarda" sem chamar a ferramenta junto. Se você gerar texto sem chamada de ferramenta quando uma ação foi pedida, a ação NUNCA acontecerá — o sistema encerra o turno imediatamente. Isso vale para QUALQUER rodada, inclusive após ver resultados de consultas.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se o usuário der múltiplos comandos, chame TODAS as ferramentas em paralelo.

REGRAS:
1. Abrir app/rotina/música → ferramenta imediatamente. Nunca presuma "já está aberto".

2. **EXECUTAR ROTINA**: chame run_routine com nome da rotina de `Rotinas disponíveis`. NÃO abra apps individuais. NÃO invente apps. Rotinas só podem ser criadas pelo frontend — se o usuário pedir pra criar por voz, diga que é necessário usar o app web.

4. Apps: só os de `Apps disponíveis`. open_app = desktop (Spotify/Discord). open_url = web (YouTube/Gmail).
5. Música → play_music. Data+hora → create_event. Sem data → create_task. Sem data clara → pergunte primeiro.
   **TAREFA vs HÁBITO**: tarefa = ação única com fim (create_task). Hábito = comportamento diário recorrente (create_habit). Se dúvida, prefira hábito quando o usuário usar palavras como "hábito", "todo dia", "rotina diária", "quero começar a".

6. **CONSULTAS** (perguntas sobre dados): get_tasks / get_agenda / get_ideas → leia resultado e responda. Itens vêm numerados: item 1 = mais recente. NUNCA fale ids em voz.

7. **ATUALIZAR TAREFA**: "marca X como concluída" → update_task(title="X", status="done") direto. Sem get_tasks antes.

8. **ATUALIZAR EVENTO**: "reagenda X pra sexta às 13h" → update_event(title="X", new_start_at="2026-05-16T13:00:00-03:00") direto. Converta datas relativas para ISO 8601 fuso -03:00. Sem get_agenda antes.

9. **ESQUECER/REMOVER MEMÓRIA**: "esquece X", "remove Y da memória" → delete_memory(key="chave"). JAMAIS use store_memory com valor vazio — isso não apaga nada. Se não souber a chave exata, chame get_memory antes para ver as chaves. "O que você sabe sobre mim?" → get_memory.

10. **EXCLUIR** (delete_task/event/idea) — IRREVERSÍVEL. Fluxo 2 turnos:
    a. Obtenha o id via get_* se não tiver.
    b. Pergunte em voz: "Quer mesmo excluir 'X'? Não dá pra desfazer."
    c. Só no turno SEGUINTE, se confirmado → delete_*(id=...). Negado → cancele.

11. Respostas faladas: curtas, naturais. Sem JSON, sem ids, sem nomes de API.

Memória do usuário: {memory}
Rotinas disponíveis: {routines}
Apps disponíveis: {apps}
Data/hora atual: {now}
"""
