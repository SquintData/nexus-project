"""TTS via OpenAI gpt-4o-mini-tts, routed through Supabase Edge Function (tts-proxy).

Agent never sees the OpenAI API key — proxy authenticates the user JWT, enforces
quota, and forwards the request to OpenAI with the server-side secret.
"""
from __future__ import annotations

import io
import tempfile
import time
from pathlib import Path
from typing import Callable

import httpx

from agent.errors import plan_forbidden_from_httpx


class OpenAITTS:
    def __init__(
        self,
        proxy_url: str,
        get_token: Callable[[], str],
        model: str = "tts-1",
        voice: str = "nova",
    ):
        self.proxy_url = proxy_url
        self.get_token = get_token
        self.model = model
        self.voice = voice

    def fetch(self, text: str) -> bytes:
        """HTTP-only: returns raw MP3 bytes without playing."""
        if not text or not text.strip():
            return b""
        resp = httpx.post(
            self.proxy_url,
            headers={
                "Authorization": f"Bearer {self.get_token()}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "voice": self.voice,
                "input": text,
                "response_format": "mp3",
            },
            timeout=60.0,
        )
        if resp.status_code == 403:
            raise plan_forbidden_from_httpx(resp)
        if resp.status_code != 200:
            raise RuntimeError(f"TTS proxy error {resp.status_code}: {resp.text}")
        return resp.content

    def play(self, audio_bytes: bytes) -> None:
        """Play raw MP3 bytes without fetching."""
        if not audio_bytes:
            return
        tmpdir = Path(tempfile.gettempdir())
        path = tmpdir / f"nexus_tts_{int(time.time()*1000)}.mp3"
        try:
            path.write_bytes(audio_bytes)
            try:
                from playsound import playsound
                playsound(str(path))
            except Exception:
                import sounddevice as sd
                import soundfile as sf
                data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
                sd.play(data, sr)
                sd.wait()
        finally:
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass

    def speak(self, text: str) -> None:
        """Convenience: fetch + play in sequence."""
        audio = self.fetch(text)
        if audio:
            self.play(audio)
