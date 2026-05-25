"""STT via Groq Whisper, routed through Supabase Edge Function (stt-proxy).

Agent never sees the Groq API key — proxy validates the user JWT, enforces
quota, and forwards multipart audio to Groq with the server-side secret.
"""
from __future__ import annotations

import io
import wave
from typing import Callable

import httpx
import numpy as np


class GroqSTT:
    def __init__(self, proxy_url: str, get_token: Callable[[], str], model: str = "whisper-large-v3-turbo"):
        self.proxy_url = proxy_url
        self.get_token = get_token
        self.model = model

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000, language: str = "pt") -> str:
        """Transcribe int16 mono PCM audio array to text."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sample_rate)
            w.writeframes(audio.tobytes())
        buf.seek(0)

        files = {"file": ("audio.wav", buf.getvalue(), "audio/wav")}
        data = {"model": self.model, "language": language, "response_format": "text"}
        headers = {"Authorization": f"Bearer {self.get_token()}"}

        resp = httpx.post(self.proxy_url, headers=headers, data=data, files=files, timeout=60.0)
        if resp.status_code != 200:
            raise RuntimeError(f"STT proxy error {resp.status_code}: {resp.text}")
        return resp.text.strip()
