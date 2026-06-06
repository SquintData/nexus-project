"""REPL de teste por texto — exercita o mesmo fluxo do agente (RAG + tools)."""
from agent.config import load
from agent.db.client import NexusDB
from agent.memory import MemoryClient
from agent.llm.orchestrator import LLMOrchestrator
from agent.tools.handlers import ToolHandlers
from agent.errors import PlanForbiddenError

cfg = load()
db = NexusDB(cfg)
print("Logando..."); db.login(); print("OK. Digite 'sair' pra encerrar.\n")

get_token = db.get_access_token
memory = MemoryClient(cfg.memory_proxy_url, get_token)
llm = LLMOrchestrator(cfg.llm_proxy_url, get_token, cfg.llm_model)
tools = ToolHandlers(db, {}, memory)

while True:
    text = input("Você: ").strip()
    if text.lower() in ("sair", "exit", "quit", ""):
        break
    rag = memory.search(text)
    rag_ctx = "\n".join(f"- {h}" for h in rag) if rag else None
    if rag_ctx:
        print(f"  \033[36m[RAG injetado]\033[0m\n  " + rag_ctx.replace("\n", "\n  "))
    try:
        reply, executed = llm.process(
            user_text=text, memory=db.list_memory(),
            routines=db.list_routine_names(), apps=[],
            tool_executor=tools, rag_context=rag_ctx,
        )
    except PlanForbiddenError:
        print("Nexus: [plano insuficiente — use uma conta chat/voice]\n"); continue
    for act in executed:
        print(f"  \033[35m[tool]\033[0m {act['name']}({act['args']}) -> {act['result']}")
    print(f"Nexus: {reply}\n")