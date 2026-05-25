"""Sphere state broadcaster.

Fires Supabase Realtime broadcasts so the frontend Sphere reflects agent state.
Topic: `agent-status:<user_id>` (per-user, so multi-tenant safe).
Auth: user JWT (apikey + Bearer = user access_token). No service_role needed.
Failures are swallowed — broadcast must never block the agent.
"""
from __future__ import annotations

import logging
from typing import Callable

import httpx

log = logging.getLogger("nexus")

_URL: str | None = None
_ANON_KEY: str | None = None
_GET_TOKEN: Callable[[], str | None] | None = None
_USER_ID: str | None = None

VALID_STATES = {"idle", "listening", "processing", "error"}


def configure(
    supabase_url: str,
    anon_key: str,
    get_token: Callable[[], str | None],
    user_id: str,
) -> None:
    """Bind broadcast deps once at startup. Call after db.login()."""
    global _URL, _ANON_KEY, _GET_TOKEN, _USER_ID
    _URL = supabase_url.rstrip("/")
    _ANON_KEY = anon_key
    _GET_TOKEN = get_token
    _USER_ID = user_id


def set_sphere(state: str) -> None:
    """Broadcast sphere state. Never raises."""
    if not _URL or not _ANON_KEY or not _USER_ID or not _GET_TOKEN:
        return
    if state not in VALID_STATES:
        log.warning(f"Invalid sphere state ignored: {state!r}")
        return
    token = _GET_TOKEN()
    if not token:
        return  # session expired or not logged in; broadcast silently skipped
    try:
        httpx.post(
            f"{_URL}/realtime/v1/api/broadcast",
            headers={
                "apikey": _ANON_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "messages": [
                    {
                        "topic": f"agent-status:{_USER_ID}",
                        "event": "state",
                        "payload": {"state": state},
                    }
                ]
            },
            timeout=3.0,
        )
    except Exception:
        pass
