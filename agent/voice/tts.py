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


class OpenAITTS:
    def __init__(
        self,
        proxy_url: str,
        get_token: Callable[[], str],
        model: str = "gpt-4o-mini-tts",
        voice: str = "nova",
    ):
        self.proxy_url = proxy_url
        self.get_token = get_token
        self.model = model
        self.voice = voice

    def speak(self, text: str) -> None:
        if not text or not text.strip():
            return
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
        if resp.status_code != 200:
            raise RuntimeError(f"TTS proxy error {resp.status_code}: {resp.text}")
        audio_bytes = resp.content

        tmpdir = Path(tempfile.gettempdir())
        path = tmpdir / f"nexus_tts_{int(time.time()*1000)}.mp3"
        try:
            path.write_bytes(audio_bytes)
            try:
                from playsound import playsound
                playsound(str(path))
            except Exception:
                # Fallback: sounddevice + soundfile
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
