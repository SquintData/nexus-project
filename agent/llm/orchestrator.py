"""LLM orchestrator with OpenAI tool_calls (multi-tool, parallel, two-pass)."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Callable

from openai import OpenAI

from agent.llm.tools import SYSTEM_PROMPT, build_tools_schema


class LLMOrchestrator:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.session_history: list[dict] = []
        self._system_prompt: str | None = None

    def reset_session(self) -> None:
        self.session_history = []
        self._system_prompt = None

    def _ensure_system(self, memory: list[dict], routines: list[str], apps: list[str]) -> None:
        memory_str = ", ".join(f"{m['key']}={m['value']}" for m in memory) or "vazia"
        now = datetime.now().strftime("%A, %d de %B de %Y - %H:%M (%Z)")
        prompt = SYSTEM_PROMPT.format(
            memory=memory_str,
            routines=", ".join(routines) or "(nenhuma)",
            apps=", ".join(apps) or "(nenhum)",
            now=now,
        )
        if self._system_prompt != prompt:
            self._system_prompt = prompt
            if self.session_history and self.session_history[0]["role"] == "system":
                self.session_history[0]["content"] = prompt
            else:
                self.session_history.insert(0, {"role": "system", "content": prompt})

    def _safe_history(self) -> list[dict]:
        """Return a history that is always valid for the OpenAI API.

        Two invariants enforced:
        1. Every 'tool' message must follow an assistant message that declared
           its tool_call_id in tool_calls (no orphaned tool messages).
        2. Every assistant message with tool_calls must be followed by tool
           messages for ALL its tool_call_ids (no incomplete tool_call groups).

        Strategy — two passes:
          Pass 1: collect which tool_call_ids have responses in the raw history.
          Pass 2: include an assistant(tool_calls) only if ALL its IDs are in
                  that set; include a tool message only if its ID belongs to a
                  complete group.
        Incomplete/orphaned entries are silently dropped.
        """
        # Pass 1 — which tool_call_ids are responded to in the raw history?
        responded: set[str] = set()
        for msg in self.session_history:
            if msg["role"] == "tool" and msg.get("tool_call_id"):
                responded.add(msg["tool_call_id"])

        # Determine which assistant tool_call groups are complete
        valid_ids: set[str] = set()
        for msg in self.session_history:
            if msg["role"] == "assistant" and msg.get("tool_calls"):
                group = {tc["id"] for tc in msg["tool_calls"]}
                if group.issubset(responded):
                    valid_ids |= group  # all IDs in this group are valid

        # Pass 2 — build clean history
        out: list[dict] = []
        for msg in self.session_history:
            if msg["role"] == "assistant" and msg.get("tool_calls"):
                group = {tc["id"] for tc in msg["tool_calls"]}
                if group.issubset(responded):
                    out.append(msg)
                # else: incomplete group — drop assistant + its tool msgs
            elif msg["role"] == "tool":
                if msg.get("tool_call_id", "") in valid_ids:
                    out.append(msg)
                # else: orphaned or from incomplete group — drop
            else:
                out.append(msg)
        return out

    def process(
        self,
        user_text: str,
        memory: list[dict],
        routines: list[str],
        apps: list[str],
        tool_executor: Callable[[str, dict], str],
    ) -> tuple[str, list[dict]]:
        """Run a turn. Returns (final_speech_text, executed_actions).

        `tool_executor(name, args) -> str` runs the tool synchronously and
        returns a short result message that goes back to the LLM for the
        natural follow-up reply.
        """
        self._ensure_system(memory, routines, apps)
        self.session_history.append({"role": "user", "content": user_text})

        # Trim history — always cut at a 'user' message boundary so tool/tool_call
        # pairs are never split (orphaned 'tool' role causes OpenAI 400 error).
        MAX_TAIL = 20
        if len(self.session_history) > 1 + MAX_TAIL:
            system = self.session_history[0]
            tail = self.session_history[-MAX_TAIL:]
            # Advance past any non-user messages at the start of the tail
            start = next((i for i, m in enumerate(tail) if m["role"] == "user"), None)
            if start is None:
                self.session_history = [system, self.session_history[-1]]
            else:
                self.session_history = [system] + tail[start:]

        # Apply safe-history in-place so that any corrupt state (e.g. from a
        # previous turn that crashed mid-tool-execution) is cleaned up before
        # the first API call of this turn.
        self.session_history = self._safe_history()

        tools = build_tools_schema(apps, routines)

        executed: list[dict] = []

        # Loop: each round may call tools; stops when LLM returns no tool_calls.
        # Supports sequential chains (get_tasks → update_task) and parallel tools.
        for _round in range(5):
            response = self.client.chat.completions.create(
                model=self.model,
                messages=self._safe_history(),  # defensive sanitize before every call
                tools=tools,
                tool_choice="auto",
                temperature=0.2,
            )
            msg = response.choices[0].message

            assistant_entry: dict[str, Any] = {"role": "assistant", "content": msg.content}
            if msg.tool_calls:
                assistant_entry["tool_calls"] = [
                    {
                        "id": t.id,
                        "type": t.type,
                        "function": {"name": t.function.name, "arguments": t.function.arguments},
                    }
                    for t in msg.tool_calls
                ]
            self.session_history.append(assistant_entry)

            if not msg.tool_calls:
                # No more tools — this is the final spoken reply
                return (msg.content or "Entendido."), executed

            for tc in msg.tool_calls:
                name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                try:
                    result = tool_executor(name, args)
                except Exception as e:
                    result = f"Erro: {e}"
                executed.append({"name": name, "args": args, "result": result})
                self.session_history.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": name,
                    "content": result,
                })

        # Fallback if max rounds hit (shouldn't happen in normal use)
        return "Pronto.", executed
