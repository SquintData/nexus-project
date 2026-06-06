"""LLM orchestrator with OpenAI tool_calls (multi-tool, parallel, two-pass).

Routes every call through the Supabase llm-proxy Edge Function. The agent never
holds an OpenAI key — `get_token` returns the current user JWT, which the proxy
validates before forwarding to OpenAI with the server-side secret.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Callable

from openai import OpenAI, PermissionDeniedError

from agent.errors import PlanForbiddenError
from agent.llm.tools import SYSTEM_PROMPT, build_tools_schema

_SENTENCE_END = re.compile(r'(?<=[.!?…])\s+')


class LLMOrchestrator:
    def __init__(self, proxy_url: str, get_token: Callable[[], str], model: str = "gpt-4.1-mini"):
        self.proxy_url = proxy_url
        self.get_token = get_token
        self.model = model
        self.session_history: list[dict] = []
        self._system_prompt: str | None = None

    def _client(self) -> OpenAI:
        # Fresh client per turn so JWT refreshes are picked up. The OpenAI SDK
        # appends `/chat/completions` to base_url, which matches what the proxy
        # ignores (it forwards any POST to OpenAI's chat endpoint).
        return OpenAI(api_key=self.get_token(), base_url=self.proxy_url)

    def reset_session(self) -> None:
        self.session_history = []
        self._system_prompt = None

    def _ensure_system(self, memory: list[dict], routines: list[str], apps: list[str], rag_context: str | None = None) -> None:
        memory_str = ", ".join(f"{m['key']}={m['value']}" for m in memory) or "vazia"
        now = datetime.now().strftime("%A, %d de %B de %Y - %H:%M (%Z)")
        prompt = SYSTEM_PROMPT.format(
            memory=memory_str,
            routines=", ".join(routines) or "(nenhuma)",
            apps=", ".join(apps) or "(nenhum)",
            now=now,
        )
        if rag_context:
            prompt += (
                "\n\n━━━ MEMÓRIAS RELEVANTES (recuperadas para esta pergunta) ━━━\n"
                + rag_context
                + "\n(Use como contexto se útil; não mencione que veio da memória.)"
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
        rag_context: str | None = None,
    ) -> tuple[str, list[dict]]:
        """Run a turn. Returns (final_speech_text, executed_actions).

        `tool_executor(name, args) -> str` runs the tool synchronously and
        returns a short result message that goes back to the LLM for the
        natural follow-up reply.
        """
        self._ensure_system(memory, routines, apps, rag_context)
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

        # One fresh client per turn — JWT is current at call time.
        client = self._client()

        # Loop: each round may call tools; stops when LLM returns no tool_calls.
        # Supports sequential chains (get_tasks → update_task) and parallel tools.
        for _round in range(5):
            try:
                response = client.chat.completions.create(
                    model=self.model,
                    messages=self._safe_history(),  # defensive sanitize before every call
                    tools=tools,
                    tool_choice="auto",
                    temperature=0.2,
                )
            except PermissionDeniedError as e:
                raise PlanForbiddenError() from e
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

    # ------------------------------------------------------------------ #
    # Streaming variant — final text round streamed sentence-by-sentence  #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _flush_sentences(buf: str) -> tuple[list[str], str]:
        """Split buf into (complete_sentences, leftover).

        Sentences shorter than 3 words are held back and merged with the
        next one to avoid wasting TTS requests on fragments like "Sim."
        """
        parts = _SENTENCE_END.split(buf)
        if len(parts) <= 1:
            return [], buf
        complete, leftover = parts[:-1], parts[-1]
        # Merge short fragments with the next piece
        merged: list[str] = []
        carry = ""
        for part in complete:
            combined = (carry + " " + part).strip() if carry else part
            if len(combined.split()) < 3:
                carry = combined
            else:
                merged.append(combined)
                carry = ""
        remaining = (carry + " " + leftover).strip() if carry else leftover
        return merged, remaining

    def process_streaming(
        self,
        user_text: str,
        memory: list[dict],
        routines: list[str],
        apps: list[str],
        tool_executor: Callable[[str, dict], str],
        on_sentence: Callable[[str], None],
        rag_context: str | None = None,
    ) -> tuple[str, list[dict]]:
        """Like process(), but streams the final text round token-by-token.

        Tool-call rounds accumulate silently (stream=True, no on_sentence).
        On the final round (no tool_calls), sentences are fired via on_sentence
        as soon as each sentence boundary arrives in the token stream — TTS for
        sentence N starts while the LLM is still generating sentence N+1.
        """
        self._ensure_system(memory, routines, apps, rag_context)
        self.session_history.append({"role": "user", "content": user_text})

        MAX_TAIL = 20
        if len(self.session_history) > 1 + MAX_TAIL:
            system = self.session_history[0]
            tail = self.session_history[-MAX_TAIL:]
            start = next((i for i, m in enumerate(tail) if m["role"] == "user"), None)
            if start is None:
                self.session_history = [system, self.session_history[-1]]
            else:
                self.session_history = [system] + tail[start:]

        self.session_history = self._safe_history()

        tools = build_tools_schema(apps, routines)
        executed: list[dict] = []
        client = self._client()

        for _round in range(5):
            try:
                stream = client.chat.completions.create(
                    model=self.model,
                    messages=self._safe_history(),
                    tools=tools,
                    tool_choice="auto",
                    temperature=0.2,
                    stream=True,
                )
            except PermissionDeniedError as e:
                raise PlanForbiddenError() from e

            content_buf = ""
            sentence_buf = ""
            tool_calls_raw: dict[int, dict] = {}

            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                if delta.content:
                    content_buf += delta.content
                    sentence_buf += delta.content
                    sentences, sentence_buf = self._flush_sentences(sentence_buf)
                    for s in sentences:
                        on_sentence(s)

                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_calls_raw:
                            tool_calls_raw[idx] = {
                                "id": tc_delta.id or "",
                                "type": "function",
                                "function": {
                                    "name": tc_delta.function.name if tc_delta.function else "",
                                    "arguments": "",
                                },
                            }
                        else:
                            if tc_delta.id:
                                tool_calls_raw[idx]["id"] = tc_delta.id
                            if tc_delta.function:
                                if tc_delta.function.name:
                                    tool_calls_raw[idx]["function"]["name"] += tc_delta.function.name
                                if tc_delta.function.arguments:
                                    tool_calls_raw[idx]["function"]["arguments"] += tc_delta.function.arguments

            tool_calls_list = [tool_calls_raw[i] for i in sorted(tool_calls_raw)] if tool_calls_raw else None

            assistant_entry: dict[str, Any] = {
                "role": "assistant",
                "content": content_buf if content_buf else None,
            }
            if tool_calls_list:
                assistant_entry["tool_calls"] = tool_calls_list
            self.session_history.append(assistant_entry)

            if not tool_calls_list:
                # Flush any leftover text after the stream ends
                if sentence_buf.strip():
                    on_sentence(sentence_buf.strip())
                return content_buf or "Entendido.", executed

            for tc in tool_calls_list:
                name = tc["function"]["name"]
                try:
                    args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    args = {}
                try:
                    result = tool_executor(name, args)
                except Exception as e:
                    result = f"Erro: {e}"
                executed.append({"name": name, "args": args, "result": result})
                self.session_history.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": name,
                    "content": result,
                })

        return "Pronto.", executed
