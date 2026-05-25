"""Interactive pairing flow for the local agent.

Trades a short-lived pairing code (generated in the frontend) for a long-lived
refresh_token that the agent persists to `.env`. Replaces the legacy
email+password setup — user never has to copy credentials manually.
"""
from __future__ import annotations

import logging

import httpx

from agent.config import update_env_var

log = logging.getLogger("nexus")


def run_pairing_flow(supabase_url: str, anon_key: str) -> None:
    """Block on stdin for a code, redeem it, and write the result to .env.

    Raises on any failure so main() can surface a clear error.
    """
    url = f"{supabase_url.rstrip('/')}/functions/v1/redeem_pairing_code"

    print()
    print("================== PAREAMENTO DO AGENTE ==================")
    print("Abra o frontend, faça login e vá em 'Parear agente' pra")
    print("gerar um código de 8 caracteres. Cole abaixo.")
    print("==========================================================")
    code = input("Código de pareamento: ").strip().upper()
    if not code:
        raise RuntimeError("Código vazio")

    log.info("Resgatando código junto ao Supabase…")
    resp = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {anon_key}",
            "apikey": anon_key,
            "Content-Type": "application/json",
        },
        json={"code": code},
        timeout=15.0,
    )
    if resp.status_code != 200:
        # Surface the server-side message verbatim — codes can be expired,
        # consumed, or simply wrong.
        raise RuntimeError(f"Pareamento falhou ({resp.status_code}): {resp.text}")

    data = resp.json()
    email = data.get("email")
    refresh_token = data.get("refresh_token")
    if not email or not refresh_token:
        raise RuntimeError(f"Resposta inválida do servidor: {data}")

    update_env_var("AGENT_USER_EMAIL", email)
    update_env_var("AGENT_REFRESH_TOKEN", refresh_token)

    print(f"\n✓ Pareado como {email}. Credenciais salvas em .env.\n")
