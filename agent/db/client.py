"""Supabase client + auth session for agent."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from supabase import Client, create_client

from agent.config import Config, update_env_var

log = logging.getLogger("nexus")


class NexusDB:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.client: Client = create_client(cfg.supabase_url, cfg.supabase_anon_key)
        self._user_id: str | None = None
        # Persist rotated refresh_tokens so a restart can still bootstrap.
        try:
            self.client.auth.on_auth_state_change(self._on_auth_change)
        except Exception:
            log.debug("on_auth_state_change not available; refresh rotation won't persist")

    def _on_auth_change(self, event: str, session) -> None:
        """Re-persist refresh_token on rotation. Supabase rotates it on every
        refresh and invalidates the previous one — if we don't save the new
        value, the next process start can't bootstrap.
        """
        if event in ("TOKEN_REFRESHED", "SIGNED_IN") and session and session.refresh_token:
            try:
                update_env_var("AGENT_REFRESH_TOKEN", session.refresh_token)
            except Exception:
                log.exception("Failed to persist rotated refresh_token")

    def login(self) -> str:
        """Sign in using whichever credential we have. Returns user_id.

        Prefers refresh_token; falls back to email/password (legacy).
        """
        if self.cfg.agent_refresh_token:
            return self._login_refresh_token(self.cfg.agent_refresh_token)
        if self.cfg.agent_user_email and self.cfg.agent_user_password:
            return self._login_password(self.cfg.agent_user_email, self.cfg.agent_user_password)
        raise RuntimeError(
            "No auth credentials: set AGENT_REFRESH_TOKEN (via pairing) or "
            "AGENT_USER_EMAIL/AGENT_USER_PASSWORD in .env"
        )

    def _login_password(self, email: str, password: str) -> str:
        resp = self.client.auth.sign_in_with_password({"email": email, "password": password})
        if not resp.user:
            raise RuntimeError("Supabase auth failed (password)")
        self._user_id = resp.user.id
        return self._user_id

    def _login_refresh_token(self, refresh_token: str) -> str:
        resp = self.client.auth.refresh_session(refresh_token)
        if not resp.user or not resp.session:
            raise RuntimeError("Refresh token invalid or expired — re-pair the agent")
        self._user_id = resp.user.id
        # The callback persists the rotated token automatically.
        return self._user_id

    @property
    def user_id(self) -> str:
        if not self._user_id:
            raise RuntimeError("Call login() first")
        return self._user_id

    def get_access_token(self) -> str | None:
        """Current user JWT. None if not logged in or session expired."""
        try:
            sess = self.client.auth.get_session()
            return sess.access_token if sess else None
        except Exception:
            return None

    # ---------- Tasks ----------
    def create_task(self, title: str, priority: int = 0, description: str | None = None) -> dict:
        row = {
            "user_id": self.user_id,
            "title": title,
            "priority": priority,
            "description": description,
            "status": "todo",
        }
        return self.client.table("tasks").insert(row).execute().data[0]

    def list_tasks(self, status: str | None = None) -> list[dict]:
        """Read tasks. status filter: todo/doing/done. None = all não concluídas.

        Ordered most-recent-first (created_at desc) for deterministic 'última'.
        """
        q = (
            self.client.table("tasks")
            .select("id,title,status,priority,created_at")
            .eq("user_id", self.user_id)
        )
        if status:
            q = q.eq("status", status)
        else:
            q = q.neq("status", "done")
        return (
            q.order("created_at", desc=True)
            .limit(50)
            .execute()
            .data
            or []
        )

    def update_task_status(self, task_id: str, status: str) -> dict | None:
        """Move task to a new status (todo/doing/done). Returns updated row or None."""
        res = (
            self.client.table("tasks")
            .update({"status": status})
            .eq("id", task_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def update_task_by_title(self, title_hint: str, status: str) -> list[dict]:
        """Find active tasks matching title_hint (ilike) and update the one match.

        Returns:
          []       → nothing found
          [row]    → exactly one match, already updated
          [r1, r2] → ambiguous (multiple matches, NOT updated — handler must disambiguate)
        """
        rows = (
            self.client.table("tasks")
            .select("id,title")
            .eq("user_id", self.user_id)
            .ilike("title", f"%{title_hint}%")
            .neq("status", "done")
            .execute()
            .data
            or []
        )
        if len(rows) == 1:
            updated = (
                self.client.table("tasks")
                .update({"status": status})
                .eq("id", rows[0]["id"])
                .eq("user_id", self.user_id)
                .execute()
                .data
            )
            return updated or rows
        return rows

    def delete_task(self, task_id: str) -> dict | None:
        """Delete a task. Returns the deleted row (for confirmation) or None."""
        res = (
            self.client.table("tasks")
            .delete()
            .eq("id", task_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    # ---------- Events ----------
    def create_event(self, title: str, start_at: str, location: str | None = None) -> dict:
        row = {
            "user_id": self.user_id,
            "title": title,
            "start_at": start_at,
            "location": location,
        }
        return self.client.table("events").insert(row).execute().data[0]

    def list_events(self, days: int = 7) -> list[dict]:
        """Read upcoming events within next `days` days (from now). Ordered soonest-first."""
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=days)
        return (
            self.client.table("events")
            .select("id,title,start_at,location")
            .eq("user_id", self.user_id)
            .gte("start_at", now.isoformat())
            .lte("start_at", end.isoformat())
            .order("start_at", desc=False)
            .limit(50)
            .execute()
            .data
            or []
        )

    def update_event_by_title(
        self,
        title_hint: str,
        new_start_at: str | None = None,
        new_location: str | None = None,
    ) -> list[dict]:
        """Find upcoming events matching title_hint, update if exactly one match.

        Returns:
          []    → nothing found
          [row] → updated
          [r1, r2, ...] → ambiguous (NOT updated)
        """
        now = datetime.now(timezone.utc)
        rows = (
            self.client.table("events")
            .select("id,title,start_at")
            .eq("user_id", self.user_id)
            .ilike("title", f"%{title_hint}%")
            .gte("start_at", now.isoformat())
            .execute()
            .data
            or []
        )
        if len(rows) == 1:
            updates: dict = {}
            if new_start_at:
                updates["start_at"] = new_start_at
            if new_location is not None:
                updates["location"] = new_location
            if not updates:
                return rows
            updated = (
                self.client.table("events")
                .update(updates)
                .eq("id", rows[0]["id"])
                .eq("user_id", self.user_id)
                .execute()
                .data
            )
            return updated or rows
        return rows

    def delete_event(self, event_id: str) -> dict | None:
        """Delete an event. Returns the deleted row (for confirmation) or None."""
        res = (
            self.client.table("events")
            .delete()
            .eq("id", event_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    # ---------- Ideas ----------
    def create_idea(self, content: str, tags: list[str] | None = None) -> dict:
        row = {
            "user_id": self.user_id,
            "content": content,
            "tags": tags or [],
        }
        return self.client.table("ideas").insert(row).execute().data[0]

    def list_ideas(self, limit: int = 20) -> list[dict]:
        """Read ideas, most-recent-first (created_at desc) — item 1 = última lançada."""
        return (
            self.client.table("ideas")
            .select("id,content,tags,created_at")
            .eq("user_id", self.user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
            .data
            or []
        )

    def delete_idea(self, idea_id: str) -> dict | None:
        """Delete an idea. Returns the deleted row (for confirmation) or None."""
        res = (
            self.client.table("ideas")
            .delete()
            .eq("id", idea_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    # ---------- Routines ----------
    def create_routine(self, name: str, actions_json: list[dict]) -> dict:
        row = {"user_id": self.user_id, "name": name, "actions_json": actions_json}
        return self.client.table("routines").insert(row).execute().data[0]

    def get_routine(self, name: str) -> dict | None:
        res = (
            self.client.table("routines")
            .select("*")
            .eq("user_id", self.user_id)
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def list_routine_names(self) -> list[str]:
        res = (
            self.client.table("routines")
            .select("name")
            .eq("user_id", self.user_id)
            .execute()
        )
        return [r["name"] for r in (res.data or [])]

    # ---------- Memory ----------
    def upsert_memory(self, key: str, value: str) -> dict:
        row = {"user_id": self.user_id, "key": key, "value": value}
        return (
            self.client.table("memory")
            .upsert(row, on_conflict="user_id,key")
            .execute()
            .data[0]
        )

    def list_memory(self) -> list[dict]:
        return (
            self.client.table("memory")
            .select("key,value")
            .eq("user_id", self.user_id)
            .execute()
            .data
        )

    # ---------- Chat ----------
    def save_chat_message(
        self,
        role: str,
        content: str,
        source: str,
        status: str = "done",
        session_id: str | None = None,
    ) -> dict:
        row = {
            "user_id": self.user_id,
            "role": role,
            "content": content,
            "source": source,
            "status": status,
        }
        if session_id is not None:
            row["session_id"] = session_id
        return self.client.table("chat_messages").insert(row).execute().data[0]

    def get_pending_chat_messages(self) -> list[dict]:
        return (
            self.client.table("chat_messages")
            .select("id,content,session_id")
            .eq("user_id", self.user_id)
            .eq("status", "pending")
            .order("created_at", desc=False)
            .execute()
            .data
            or []
        )

    def mark_chat_message_done(self, msg_id: str) -> None:
        self.client.table("chat_messages").update({"status": "done"}).eq("id", msg_id).execute()

    def mark_chat_message_error(self, msg_id: str) -> None:
        self.client.table("chat_messages").update({"status": "error"}).eq("id", msg_id).execute()

    def get_session_history(self, session_id: str, exclude_msg_id: str | None = None) -> list[dict]:
        """Load chat history for a session (role/content only, asc order)."""
        q = (
            self.client.table("chat_messages")
            .select("id,role,content,created_at")
            .eq("user_id", self.user_id)
            .eq("session_id", session_id)
            .order("created_at", desc=False)
        )
        if exclude_msg_id:
            q = q.neq("id", exclude_msg_id)
        return q.execute().data or []

    def touch_chat_session(self, session_id: str) -> None:
        """Update last_message_at and updated_at to now."""
        now_iso = datetime.now(timezone.utc).isoformat()
        self.client.table("chat_sessions").update(
            {"last_message_at": now_iso, "updated_at": now_iso}
        ).eq("id", session_id).execute()

    # ---------- Diary ----------
    def upsert_diary_entry(self, content: str, date: str | None = None) -> dict:
        """Insert or update today's diary entry. Appends if entry already exists."""
        entry_date = date or datetime.now(timezone.utc).date().isoformat()
        existing = (
            self.client.table("diary_entries")
            .select("id,content")
            .eq("user_id", self.user_id)
            .eq("date", entry_date)
            .execute()
            .data
        )
        if existing:
            new_content = existing[0]["content"] + "\n\n" + content
            return (
                self.client.table("diary_entries")
                .update({"content": new_content, "updated_at": datetime.now(timezone.utc).isoformat()})
                .eq("id", existing[0]["id"])
                .execute()
                .data[0]
            )
        row = {"user_id": self.user_id, "date": entry_date, "content": content}
        return self.client.table("diary_entries").insert(row).execute().data[0]

    def list_diary_entries(self, limit: int = 50) -> list[dict]:
        return (
            self.client.table("diary_entries")
            .select("id,date,content,updated_at")
            .eq("user_id", self.user_id)
            .order("date", desc=True)
            .limit(limit)
            .execute()
            .data
            or []
        )

    def update_diary_entry(self, entry_id: str, content: str) -> dict | None:
        res = (
            self.client.table("diary_entries")
            .update({"content": content, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", entry_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def delete_diary_entry(self, entry_id: str) -> dict | None:
        res = (
            self.client.table("diary_entries")
            .delete()
            .eq("id", entry_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    # ---------- Habits ----------
    def create_habit(self, name: str) -> dict:
        row = {"user_id": self.user_id, "name": name}
        return self.client.table("habits").insert(row).execute().data[0]

    def list_habits(self) -> list[dict]:
        return (
            self.client.table("habits")
            .select("*")
            .eq("user_id", self.user_id)
            .order("created_at", desc=False)
            .execute()
            .data
            or []
        )

    def delete_habit(self, habit_id: str) -> dict | None:
        res = (
            self.client.table("habits")
            .delete()
            .eq("id", habit_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def log_habit_today(self, habit_id: str) -> dict | None:
        today = datetime.now(timezone.utc).date().isoformat()
        res = (
            self.client.table("habit_logs")
            .upsert(
                {"user_id": self.user_id, "habit_id": habit_id, "date": today},
                on_conflict="habit_id,date",
            )
            .execute()
        )
        return res.data[0] if res.data else None

    def unlog_habit_today(self, habit_id: str) -> None:
        today = datetime.now(timezone.utc).date().isoformat()
        self.client.table("habit_logs").delete().eq("habit_id", habit_id).eq("date", today).execute()

    def get_habit_logs(self, habit_id: str, days: int = 30) -> list[str]:
        """Return list of ISO date strings where habit was completed (last N days)."""
        cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
        rows = (
            self.client.table("habit_logs")
            .select("date")
            .eq("habit_id", habit_id)
            .gte("date", cutoff)
            .execute()
            .data
            or []
        )
        return [r["date"] for r in rows]

    def complete_habit_by_name(self, name: str) -> dict | None:
        """Find habit by name (ilike) and log today. Returns habit row or None."""
        rows = (
            self.client.table("habits")
            .select("*")
            .eq("user_id", self.user_id)
            .ilike("name", f"%{name}%")
            .execute()
            .data
            or []
        )
        if len(rows) == 1:
            self.log_habit_today(rows[0]["id"])
            return rows[0]
        return None if not rows else rows  # type: ignore[return-value]

    # ---------- Transactions ----------
    def create_transaction(
        self, type: str, amount: float, description: str | None = None
    ) -> dict:
        row = {
            "user_id": self.user_id,
            "type": type,
            "amount": amount,
            "description": description,
        }
        return self.client.table("transactions").insert(row).execute().data[0]

    def list_transactions(self, month: str | None = None) -> list[dict]:
        """Read transactions. Optional `month` filter in 'YYYY-MM'. Newest first."""
        q = (
            self.client.table("transactions")
            .select("id,type,amount,description,created_at")
            .eq("user_id", self.user_id)
        )
        if month:
            year_s, mon_s = month.split("-")
            year, mon = int(year_s), int(mon_s)
            start = datetime(year, mon, 1, tzinfo=timezone.utc)
            end = (
                datetime(year + 1, 1, 1, tzinfo=timezone.utc)
                if mon == 12
                else datetime(year, mon + 1, 1, tzinfo=timezone.utc)
            )
            q = q.gte("created_at", start.isoformat()).lt("created_at", end.isoformat())
        return (
            q.order("created_at", desc=True).limit(50).execute().data or []
        )

    def delete_transaction(self, transaction_id: str) -> dict | None:
        res = (
            self.client.table("transactions")
            .delete()
            .eq("id", transaction_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def get_finance_summary(self) -> dict:
        """Compute balance (all-time) + current-month income/expense totals."""
        rows = (
            self.client.table("transactions")
            .select("type,amount,created_at")
            .eq("user_id", self.user_id)
            .execute()
            .data
            or []
        )
        now = datetime.now(timezone.utc)
        month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        balance = 0.0
        month_income = 0.0
        month_expense = 0.0
        for r in rows:
            amt = float(r["amount"])
            if r["type"] == "income":
                balance += amt
            else:
                balance -= amt
            created = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            if created >= month_start:
                if r["type"] == "income":
                    month_income += amt
                else:
                    month_expense += amt
        return {
            "balance": balance,
            "month_income": month_income,
            "month_expense": month_expense,
        }

    def delete_memory(self, key_hint: str) -> list[dict]:
        """Delete memory by key. Exact match first, then ilike fallback.

        Returns:
          []    → nothing found
          [row] → deleted (exact or single ilike match)
          [r1, r2, ...] → ambiguous ilike matches, nothing deleted
        """
        # Exact match → delete immediately
        res = (
            self.client.table("memory")
            .delete()
            .eq("user_id", self.user_id)
            .eq("key", key_hint)
            .execute()
        )
        if res.data:
            return res.data  # [deleted_row]
        # Fuzzy fallback: find candidates, delete only if unambiguous
        found = (
            self.client.table("memory")
            .select("key,value")
            .eq("user_id", self.user_id)
            .ilike("key", f"%{key_hint}%")
            .execute()
            .data
            or []
        )
        if len(found) == 1:
            res2 = (
                self.client.table("memory")
                .delete()
                .eq("user_id", self.user_id)
                .eq("key", found[0]["key"])
                .execute()
            )
            return res2.data or []
        return found  # 0 = not found, 2+ = ambiguous (caller handles)
