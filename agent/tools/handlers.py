"""Tool executor: maps tool_call name → action. Returns short result string for LLM."""
from __future__ import annotations

from typing import Callable

from datetime import datetime, timezone, timedelta

from agent.db.client import NexusDB
from agent.desktop.automation import open_app, open_url, play_music, run_routine


class ToolHandlers:
    def __init__(self, db: NexusDB, allowed_apps: dict[str, str]):
        self.db = db
        self.allowed_apps = {k.lower(): v for k, v in allowed_apps.items()}
        self.handlers: dict[str, Callable[[dict], str]] = {
            "open_app": self._open_app,
            "open_url": self._open_url,
            "play_music": self._play_music,
            "run_routine": self._run_routine,
            "create_task": self._create_task,
            "create_event": self._create_event,
            "create_idea": self._create_idea,
            "store_memory": self._store_memory,
            "get_tasks": self._get_tasks,
            "get_agenda": self._get_agenda,
            "get_ideas": self._get_ideas,
            "update_task": self._update_task,
            "update_event": self._update_event,
            "delete_task": self._delete_task,
            "delete_event": self._delete_event,
            "delete_idea": self._delete_idea,
            "get_memory": self._get_memory,
            "delete_memory": self._delete_memory,
            "create_transaction": self._create_transaction,
            "get_finance_summary": self._get_finance_summary,
            "add_diary_entry": self._add_diary_entry,
            "create_habit": self._create_habit,
            "complete_habit": self._complete_habit,
            "get_habits": self._get_habits,
        }

    def __call__(self, name: str, args: dict) -> str:
        fn = self.handlers.get(name)
        if not fn:
            return f"Tool desconhecida: {name}"
        return fn(args)

    # ---------- desktop ----------
    def _open_app(self, args: dict) -> str:
        app = (args.get("app") or "").lower().strip()
        target = self.allowed_apps.get(app)
        if not target:
            return f"App '{app}' não está na lista permitida"
        ok, msg = open_app(target)
        return msg

    def _open_url(self, args: dict) -> str:
        ok, msg = open_url(args.get("url", ""))
        return msg

    def _play_music(self, args: dict) -> str:
        ok, msg = play_music(args.get("query", ""))
        return msg

    def _run_routine(self, args: dict) -> str:
        name = (args.get("name") or "").strip()
        if not name:
            return "Nome da rotina vazio"
        routine = self.db.get_routine(name)
        if not routine:
            return f"Rotina '{name}' não encontrada"
        # Execute each action, reporting friendly labels (not technical exe paths)
        results: list[str] = []
        for a in routine.get("actions_json") or []:
            label = (a.get("target") or "").strip()
            if a.get("type") == "app":
                target = self.allowed_apps.get(label.lower(), label)
                from agent.desktop.automation import open_app
                ok, _ = open_app(target)
                results.append(f"{label} {'OK' if ok else 'falhou'}")
            elif a.get("type") == "url":
                from agent.desktop.automation import open_url
                ok, _ = open_url(label)
                results.append(f"link {'OK' if ok else 'falhou'}")
            else:
                results.append(f"ação desconhecida ({a.get('type')})")
        # Strong instruction so LLM does not invent or substitute names in its spoken reply
        items_str = ", ".join(results)
        return (
            f"Rotina '{routine['name']}' executada com sucesso. "
            f"Itens abertos (use EXATAMENTE estes nomes na sua resposta falada, "
            f"NÃO substitua nem invente): {items_str}"
        )

    # ---------- supabase ----------
    def _create_task(self, args: dict) -> str:
        title = args.get("title", "").strip()
        if not title:
            return "Título vazio"
        self.db.create_task(title=title, priority=int(args.get("priority", 0)))
        return f"Tarefa criada: {title}"

    def _create_event(self, args: dict) -> str:
        title = args.get("title", "").strip()
        start_at = args.get("start_at")
        if not title or not start_at:
            return "Faltou título ou data/hora"
        self.db.create_event(title=title, start_at=start_at, location=args.get("location"))
        return f"Evento criado: {title} em {start_at}"

    def _create_idea(self, args: dict) -> str:
        content = args.get("content", "").strip()
        if not content:
            return "Conteúdo vazio"
        self.db.create_idea(content=content, tags=args.get("tags") or [])
        return f"Ideia salva: {content[:40]}"

    def _store_memory(self, args: dict) -> str:
        key = args.get("key", "").strip()
        value = args.get("value", "").strip()
        if not key or not value:
            return "Chave ou valor vazio"
        self.db.upsert_memory(key=key, value=value)
        return f"Memória salva: {key}={value}"

    # ---------- consultas (read-only) ----------
    # Reads return a NUMBERED list with explicit order + hidden ids.
    # The id is needed by update_*/delete_* but must NEVER be spoken aloud.
    _BRT = timezone(timedelta(hours=-3))

    def _to_brt(self, iso: str) -> str:
        """Convert UTC ISO 8601 to BRT, return 'DD/MM às HHhMM' without tz suffix."""
        try:
            dt = datetime.fromisoformat(iso).astimezone(self._BRT)
            mins = f"{dt.minute:02d}" if dt.minute else ""
            return f"{dt.day:02d}/{dt.month:02d} às {dt.hour}h{mins}"
        except Exception:
            return iso

    _ID_NOTE = (
        "NÃO fale os id em voz alta — eles servem só para você usar em "
        "update_task/delete_task/delete_event/delete_idea."
    )
    _ST = {"todo": "a fazer", "doing": "em andamento", "done": "concluída"}
    _LIST_CAP = 3

    def _get_tasks(self, args: dict) -> str:
        status = (args.get("status") or "").strip() or None
        rows = self.db.list_tasks(status=status)
        if not rows:
            return "Nenhuma tarefa encontrada."
        shown, rest = rows[:self._LIST_CAP], rows[self._LIST_CAP:]
        lines = [
            f"{i}. {r['title']} — {self._ST.get(r.get('status'), r.get('status'))} "
            f"— id:{r['id']}"
            for i, r in enumerate(shown, 1)
        ]
        extra = f"\n(e mais {len(rest)} tarefa(s) não listadas)" if rest else ""
        return (
            f"{len(rows)} tarefa(s), da mais recente para a mais antiga:\n"
            + "\n".join(lines)
            + extra
            + f"\n{self._ID_NOTE}"
        )

    def _get_agenda(self, args: dict) -> str:
        days = int(args.get("days") or 7)
        rows = self.db.list_events(days=days)
        if not rows:
            return f"Nenhum compromisso nos próximos {days} dia(s)."
        shown, rest = rows[:self._LIST_CAP], rows[self._LIST_CAP:]
        lines = [
            f"{i}. {r['title']} em {self._to_brt(r['start_at'])}"
            + (f" ({r['location']})" if r.get("location") else "")
            + f" — id:{r['id']}"
            for i, r in enumerate(shown, 1)
        ]
        extra = f"\n(e mais {len(rest)} compromisso(s) não listados)" if rest else ""
        return (
            f"{len(rows)} compromisso(s), do mais próximo ao mais distante:\n"
            + "\n".join(lines)
            + extra
            + f"\n{self._ID_NOTE}"
        )

    def _get_ideas(self, args: dict) -> str:
        rows = self.db.list_ideas()
        if not rows:
            return "Nenhuma ideia salva."
        shown, rest = rows[:self._LIST_CAP], rows[self._LIST_CAP:]
        lines = [
            f"{i}. {r['content'][:80]} — id:{r['id']}"
            for i, r in enumerate(shown, 1)
        ]
        extra = f"\n(e mais {len(rest)} ideia(s) não listadas)" if rest else ""
        return (
            f"{len(rows)} ideia(s), da última lançada para a mais antiga "
            f"(item 1 = a mais recente):\n"
            + "\n".join(lines)
            + extra
            + f"\n{self._ID_NOTE}"
        )

    # ---------- update / delete ----------
    def _update_task(self, args: dict) -> str:
        status = (args.get("status") or "").strip()
        if status not in self._ST:
            return "Status inválido (todo/doing/done)"
        # Prefer explicit id (when LLM already has it from get_tasks result)
        task_id = (args.get("id") or "").strip()
        if task_id:
            row = self.db.update_task_status(task_id, status)
            if not row:
                return f"Tarefa id:{task_id} não encontrada"
            return f"Tarefa '{row['title']}' movida para {self._ST[status]}"
        # Fallback: fuzzy title match — one-shot, no pre-fetch needed
        title_hint = (args.get("title") or "").strip()
        if not title_hint:
            return "Faltou id ou título da tarefa"
        rows = self.db.update_task_by_title(title_hint, status)
        if not rows:
            return f"Nenhuma tarefa ativa encontrada com '{title_hint}'"
        if len(rows) > 1:
            names = "; ".join(r["title"] for r in rows)
            return f"Várias tarefas com '{title_hint}': {names}. Qual exatamente quer marcar?"
        return f"Tarefa '{rows[0]['title']}' movida para {self._ST[status]}"

    def _delete_task(self, args: dict) -> str:
        task_id = (args.get("id") or "").strip()
        if not task_id:
            return "Faltou o id da tarefa"
        row = self.db.delete_task(task_id)
        if not row:
            return f"Tarefa id:{task_id} não encontrada (nada excluído)"
        return f"Tarefa '{row['title']}' excluída"

    def _delete_event(self, args: dict) -> str:
        event_id = (args.get("id") or "").strip()
        if not event_id:
            return "Faltou o id do compromisso"
        row = self.db.delete_event(event_id)
        if not row:
            return f"Compromisso id:{event_id} não encontrado (nada excluído)"
        return f"Compromisso '{row['title']}' excluído"

    def _delete_idea(self, args: dict) -> str:
        idea_id = (args.get("id") or "").strip()
        if not idea_id:
            return "Faltou o id da ideia"
        row = self.db.delete_idea(idea_id)
        if not row:
            return f"Ideia id:{idea_id} não encontrada (nada excluído)"
        return f"Ideia '{row['content'][:40]}' excluída"

    def _update_event(self, args: dict) -> str:
        title_hint = (args.get("title") or "").strip()
        new_start_at = (args.get("new_start_at") or "").strip() or None
        new_location = args.get("new_location")
        if not title_hint:
            return "Faltou título do compromisso"
        if not new_start_at and new_location is None:
            return "Faltou nova data/hora ou local — informe ao menos um"
        rows = self.db.update_event_by_title(title_hint, new_start_at, new_location)
        if not rows:
            return f"Nenhum compromisso futuro encontrado com '{title_hint}'"
        if len(rows) > 1:
            names = "; ".join(r["title"] for r in rows)
            return f"Vários compromissos com '{title_hint}': {names}. Qual exatamente?"
        r = rows[0]
        return f"Compromisso '{r['title']}' atualizado: {r.get('start_at', '')} {r.get('location') or ''}".strip()

    # ---------- memory CRUD ----------
    def _get_memory(self, args: dict) -> str:
        rows = self.db.list_memory()
        if not rows:
            return "Nenhuma informação salva na memória ainda."
        lines = [f"- {r['key']}: {r['value']}" for r in rows]
        return "O que sei sobre você:\n" + "\n".join(lines)

    # ---------- diary ----------
    def _add_diary_entry(self, args: dict) -> str:
        content = (args.get("content") or "").strip()
        if not content:
            return "Conteúdo vazio"
        self.db.upsert_diary_entry(content=content)
        return "Anotação salva no diário."

    # ---------- habits ----------
    def _create_habit(self, args: dict) -> str:
        name = (args.get("name") or "").strip()
        if not name:
            return "Faltou o nome do hábito"
        self.db.create_habit(name=name)
        return f"Hábito '{name}' criado."


    def _complete_habit(self, args: dict) -> str:
        name = (args.get("name") or "").strip()
        if not name:
            return "Faltou o nome do hábito"
        result = self.db.complete_habit_by_name(name)
        if result is None:
            return f"Nenhum hábito encontrado com '{name}'"
        if isinstance(result, list):
            names = "; ".join(r["name"] for r in result)
            return f"Vários hábitos com '{name}': {names}. Qual exatamente?"
        return f"Hábito '{result['name']}' marcado como feito hoje."

    def _get_habits(self, args: dict) -> str:
        from datetime import date as date_type
        habits = self.db.list_habits()
        if not habits:
            return "Nenhum hábito cadastrado ainda."
        today = datetime.now(timezone.utc).date().isoformat()
        lines = []
        for h in habits:
            logs = self.db.get_habit_logs(h["id"], days=1)
            done = today in logs
            status = "✅" if done else "⬜"
            lines.append(f"{status} {h['name']}")
        return "Seus hábitos de hoje:\n" + "\n".join(lines)

    # ---------- finance ----------
    def _create_transaction(self, args: dict) -> str:
        type_ = (args.get("type") or "").strip()
        if type_ not in ("income", "expense"):
            return "Tipo inválido (income/expense)"
        try:
            amount = float(args.get("amount") or 0)
        except (TypeError, ValueError):
            return "Valor inválido"
        if amount <= 0:
            return "Valor deve ser positivo"
        description = (args.get("description") or "").strip() or None
        self.db.create_transaction(type=type_, amount=amount, description=description)
        kind = "Recebimento" if type_ == "income" else "Gasto"
        suffix = f" — {description}" if description else ""
        return f"{kind} de R$ {amount:.2f} registrado{suffix}."

    def _get_finance_summary(self, args: dict) -> str:
        s = self.db.get_finance_summary()
        return (
            f"Seu saldo é R$ {s['balance']:.2f}. "
            f"Este mês: entradas R$ {s['month_income']:.2f}, "
            f"saídas R$ {s['month_expense']:.2f}."
        )

    def _delete_memory(self, args: dict) -> str:
        key = (args.get("key") or "").strip()
        if not key:
            return "Faltou a chave da memória"
        rows = self.db.delete_memory(key)
        if not rows:
            return f"Chave '{key}' não encontrada. Chame get_memory para ver as chaves exatas."
        if len(rows) > 1:
            keys = "; ".join(r["key"] for r in rows)
            return f"Várias chaves com '{key}': {keys}. Especifique a chave exata."
        return f"Memória '{rows[0]['key']}' removida"

