"""Nexus agent config loader.

Auth modes (resolved at NexusDB.login):
- refresh_token (preferred, set by pairing flow)
- email + password (legacy / backwards compat)
- neither → main.py routes to interactive pairing
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)


def _req(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing env var: {name}")
    return val


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_anon_key: str
    groq_api_key: str
    openai_api_key: str
    wake_word: str
    wake_sensitivity: float
    sleep_timeout: int
    # auth (any one of these paths must be populated; pairing flow fills them in)
    agent_user_email: str | None
    agent_user_password: str | None
    agent_refresh_token: str | None
    stt_model: str
    llm_model: str
    tts_model: str
    tts_voice: str
    vosk_model_path: str


def load() -> Config:
    # Reload .env each call so the pairing flow can write new credentials
    # and a subsequent load() picks them up without restarting the process.
    load_dotenv(ENV_PATH, override=True)
    return Config(
        supabase_url=_req("SUPABASE_URL"),
        supabase_anon_key=_req("SUPABASE_ANON_KEY"),
        groq_api_key=_req("GROQ_API_KEY"),
        openai_api_key=_req("OPENAI_API_KEY"),
        wake_word=os.getenv("WAKE_WORD", "ola nexus").lower().strip(),
        wake_sensitivity=float(os.getenv("WAKE_SENSITIVITY", "0.5")),
        sleep_timeout=int(os.getenv("SLEEP_TIMEOUT", "7")),
        agent_user_email=os.getenv("AGENT_USER_EMAIL") or None,
        agent_user_password=os.getenv("AGENT_USER_PASSWORD") or None,
        agent_refresh_token=os.getenv("AGENT_REFRESH_TOKEN") or None,
        stt_model=os.getenv("STT_MODEL", "whisper-large-v3-turbo"),
        llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        tts_model=os.getenv("TTS_MODEL", "gpt-4o-mini-tts"),
        tts_voice=os.getenv("TTS_VOICE", "nova"),
        vosk_model_path=os.getenv("VOSK_MODEL_PATH", str(ROOT / "agent" / "models" / "vosk-pt")),
    )


def has_auth(cfg: Config) -> bool:
    """True only if we have a refresh_token (captcha blocks password login)."""
    return bool(cfg.agent_refresh_token)


def update_env_var(name: str, value: str) -> None:
    """Idempotent in-place upsert of `NAME=value` in `.env`.

    Used by pairing flow + refresh_token rotation. Preserves all other lines
    including comments. Creates .env if missing.
    """
    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    prefix = f"{name}="
    found = False
    new_lines: list[str] = []
    for line in lines:
        if line.startswith(prefix):
            new_lines.append(f"{name}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{name}={value}")
    ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    os.environ[name] = value
