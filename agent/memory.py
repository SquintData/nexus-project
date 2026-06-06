"""Long-term semantic memory (RAG) client via the memory-proxy Edge Function.

The agent has no OpenAI key — the proxy generates the embedding
(text-embedding-3-small) and enforces auth/plan. Auth uses the same user JWT as
the other proxies (NexusDB.get_access_token).
"""
from __future__ import annotations

import logging
from typing import Callable

import httpx

log = logging.getLogger("nexus")


class MemoryClient:
    def __init__(self, proxy_url: str, get_token: Callable[[], str | None]):
        self.proxy_url = proxy_url
        self.get_token = get_token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.get_token()}",
            "Content-Type": "application/json",
        }

    def save(self, content: str) -> bool:
        """Persist an explicit long-term memory. Returns True on success.

        Never raises — a memory write failure must not break the turn.
        """
        content = (content or "").strip()
        if not content:
            return False
        try:
            r = httpx.post(
                self.proxy_url,
                headers=self._headers(),
                json={"action": "save", "content": content},
                timeout=15.0,
            )
            if r.status_code != 200:
                log.warning("memory save failed: %s %s", r.status_code, r.text[:200])
                return False
            return bool(r.json().get("ok"))
        except Exception as e:
            log.warning("memory save error: %s", e)
            return False

    def search(self, query: str, threshold: float = 0.35, count: int = 5) -> list[str]:
        """Return up to `count` relevant memory texts for `query`.

        Best-effort: ANY failure (network, plan, timeout) returns [] so the turn
        proceeds without extra context instead of crashing.
        """
        query = (query or "").strip()
        if not query:
            return []
        try:
            r = httpx.post(
                self.proxy_url,
                headers=self._headers(),
                json={
                    "action": "search",
                    "query": query,
                    "match_threshold": threshold,
                    "match_count": count,
                },
                timeout=8.0,
            )
            if r.status_code != 200:
                log.debug("memory search non-200: %s", r.status_code)
                return []
            return [m["content"] for m in (r.json().get("matches") or []) if m.get("content")]
        except Exception as e:
            log.debug("memory search error: %s", e)
            return []
