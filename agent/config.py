"""Nexus agent config loader.

LLM/STT/TTS keys are NOT in this config — they live as Supabase Edge Function
secrets. The agent proxies all provider calls through llm-proxy / stt-proxy /
tts-proxy, authenticated by the user's own JWT.

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

# Defaults so a fresh installer doesn't need to know Supabase project details.
# Anon key is public by design (already shipped in the web frontend).
SUPABASE_URL_DEFAULT = "https://thjrromvhldqzkzyxwvb.supabase.co"
SUPABASE_ANON_KEY_DEFAULT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoanJyb212aGxkcXprenl4d3ZiIiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3Nzg1Mjk1ODUsImV4cCI6MjA5NDEwNTU4NX0."
    "koXRsR75ia61u9bTxcEflk6jOPrTQ_t0NT0LdUtPW_Y"
)


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_anon_key: str
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

    @property
    def llm_proxy_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/functions/v1/llm-proxy"

    @property
    def stt_proxy_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/functions/v1/stt-proxy"

    @property
    def tts_proxy_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/functions/v1/tts-proxy"


def load() -> Config:
    # Reload .env each call so the pairing flow can write new credentials
    # and a subsequent load() picks them up without restarting the process.
    load_dotenv(ENV_PATH, override=True)
    return Config(
        supabase_url=os.getenv("SUPABASE_URL", SUPABASE_URL_DEFAULT),
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY_DEFAULT),
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
